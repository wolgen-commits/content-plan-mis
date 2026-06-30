import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

// Planner mengajukan publish — requires approved + semua task done → pending_publish
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  if (!['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Hanya content planner atau admin yang dapat mengajukan publish' }, { status: 403 });
  }

  const db = createAdminClient();

  const { data: plan } = await db
    .from('content_plans')
    .select('id, title, status, created_by')
    .eq('id', params.id)
    .single();

  if (!plan) return NextResponse.json({ message: 'Plan tidak ditemukan' }, { status: 404 });
  if (plan.created_by !== user.id && user.role !== 'admin') {
    return NextResponse.json({ message: 'Hanya pembuat plan yang dapat mengajukan publish' }, { status: 403 });
  }
  if (plan.status !== 'approved') {
    return NextResponse.json({ message: 'Hanya plan berstatus Disetujui yang dapat diajukan publish' }, { status: 400 });
  }

  // Cek semua task sudah done
  const { data: tasks } = await db
    .from('content_plan_tasks')
    .select('id, name, status')
    .eq('content_plan_id', params.id);

  const incomplete = (tasks ?? []).filter(t => t.status !== 'done');
  if (incomplete.length > 0) {
    return NextResponse.json({
      message: 'Semua task harus selesai sebelum mengajukan publish',
      incomplete_tasks: incomplete.map(t => ({ id: t.id, name: t.name })),
    }, { status: 400 });
  }

  const { error } = await db
    .from('content_plans')
    .update({ status: 'pending_publish', updated_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  // Notifikasi ke semua manager
  const { data: managers } = await db
    .from('users').select('id').eq('role', 'manager_marketing');

  await sendNotifications({
    userIds: (managers ?? []).map((m: { id: string }) => m.id),
    type: 'plan_publish_submitted',
    message: `Plan "${plan.title}" diajukan untuk publish. Silakan review dan setujui.`,
    contentPlanId: params.id,
    data: { submittedBy: user.name },
  });

  return NextResponse.json({ success: true });
}
