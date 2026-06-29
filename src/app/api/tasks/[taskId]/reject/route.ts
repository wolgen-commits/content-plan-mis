import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

export async function POST(req: NextRequest, { params }: { params: { taskId: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const revision_notes: string | null = body.revision_notes ?? null;

  const db = createAdminClient();

  const { data: task } = await db
    .from('content_plan_tasks')
    .select('id, name, status, storage_path, pic_user_id, revision_count, content_plan:content_plans!content_plan_id(id, title, created_by)')
    .eq('id', params.taskId)
    .single();

  if (!task) return NextResponse.json({ message: 'Task tidak ditemukan' }, { status: 404 });

  const plan = task.content_plan as unknown as { id: string; title: string; created_by: string } | null;
  const isOwner = plan?.created_by === user.id;
  if (!isOwner && user.role !== 'admin') {
    return NextResponse.json({ message: 'Hanya pembuat plan yang dapat menolak task' }, { status: 403 });
  }
  if (task.status !== 'submitted') {
    return NextResponse.json({ message: 'Task belum di-submit' }, { status: 400 });
  }

  if (task.storage_path) {
    await db.storage.from('content-submissions').remove([task.storage_path]);
  }

  const newRevisionCount = (task.revision_count ?? 0) + 1;

  const { error } = await db.from('content_plan_tasks').update({
    status: 'pending',
    revision_count: newRevisionCount,
    file_url: null,
    file_name: null,
    storage_path: null,
    submission_notes: revision_notes,
    submitted_at: null,
  }).eq('id', params.taskId);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  // Insert log
  await db.from('content_plan_task_logs').insert({
    task_id:      params.taskId,
    event_type:   'revision_requested',
    event_number: newRevisionCount,
    notes:        revision_notes,
    actor_id:     user.id,
    actor_name:   user.name,
  });

  if (task.pic_user_id) {
    const noteText = revision_notes ? ` Catatan: ${revision_notes}` : '';
    await sendNotifications({
      userIds: [task.pic_user_id],
      type: 'submission_rejected',
      message: `Task "${task.name}" diminta revisi ke-${newRevisionCount}, silakan submit ulang pada plan "${plan?.title}".${noteText}`,
      contentPlanId: plan?.id,
    });
  }

  return NextResponse.json({ success: true });
}
