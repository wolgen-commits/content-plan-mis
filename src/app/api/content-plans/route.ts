import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const channel = searchParams.get('channel');
  const search = searchParams.get('search');
  const view = searchParams.get('view');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const supabase = createClient();
  let query = supabase
    .from('content_plans')
    .select(`
      *,
      creator:users!created_by(id, name, avatar_url),
      assignees:content_assignees(id, role, user:users(id, name, avatar_url)),
      tags:content_tags(id, tag),
      tasks:content_plan_tasks(id, name, deadline, pic, reference, description, status)
    `);

  if (view === 'calendar' && start && end) {
    query = query
      .gte('scheduled_date', start)
      .lte('scheduled_date', end)
      .not('scheduled_date', 'is', null);
  }

  if (view === 'kanban') {
    query = query.order('kanban_column').order('position_in_kanban');
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (status) query = query.eq('status', status);
  if (channel) query = query.eq('channel', channel);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { references, tags, assignees, tasks, ...planData } = body;

  // Gunakan admin client agar tidak diblokir RLS — user sudah diverifikasi di atas
  const db = createAdminClient();

  // Pastikan user ada di public.users (trigger mungkin tidak berjalan untuk user lama)
  await db.from('users').upsert(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    { onConflict: 'id', ignoreDuplicates: true }
  );

  const { data: plan, error } = await db
    .from('content_plans')
    .insert({ ...planData, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 422 });

  if (tasks?.length) {
    const { data: insertedTasks } = await db.from('content_plan_tasks').insert(
      tasks.map((t: { name: string; deadline: string; pic?: string; pic_user_id?: string; reference?: string; description?: string }) => ({
        content_plan_id: plan.id,
        name: t.name,
        deadline: t.deadline,
        pic: t.pic || null,
        pic_user_id: t.pic_user_id || null,
        reference: t.reference || null,
        description: t.description || null,
      }))
    ).select('id');

    if (insertedTasks?.length) {
      await db.from('content_plan_task_logs').insert(
        insertedTasks.map((t: { id: string }) => ({
          task_id:    t.id,
          event_type: 'created',
          notes:      null,
          actor_id:   user.id,
          actor_name: user.name,
        }))
      );
    }

    const { sendNotifications } = await import('@/lib/notifications');
    const taskPicIds = tasks
      .filter((t: { pic_user_id?: string }) => t.pic_user_id)
      .map((t: { pic_user_id: string; name: string }) => ({ id: t.pic_user_id, name: t.name }));

    for (const pic of taskPicIds) {
      await sendNotifications({
        userIds: [pic.id],
        type: 'assigned_to_task',
        message: `Kamu di-assign ke task "${pic.name}" pada plan "${plan.title}"`,
        contentPlanId: plan.id,
      });
    }
  }

  if (references?.length) {
    await db.from('content_references').insert(
      references.map((r: { url: string; label?: string }) => ({
        content_plan_id: plan.id, url: r.url, label: r.label ?? null,
      }))
    );
  }

  if (tags?.length) {
    await db.from('content_tags').insert(
      tags.map((tag: string) => ({ content_plan_id: plan.id, tag }))
    );
  }

  if (assignees?.length) {
    const { sendNotifications } = await import('@/lib/notifications');
    await db.from('content_assignees').insert(
      assignees.map((a: { user_id: string; role: string }) => ({
        content_plan_id: plan.id, user_id: a.user_id, role: a.role,
      }))
    );
    await sendNotifications({
      userIds: assignees.map((a: { user_id: string }) => a.user_id),
      type: 'assigned_to_plan',
      message: `Kamu di-assign ke plan "${plan.title}"`,
      contentPlanId: plan.id,
    });
  }

  return NextResponse.json({ data: plan }, { status: 201 });
}
