import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['manager_marketing', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: plan } = await supabase
    .from('content_plans')
    .select('title, created_by, status, assignees:content_assignees(user_id)')
    .eq('id', params.id).single();

  if (!plan) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });
  if (plan.status !== 'pending_approval') {
    return NextResponse.json({ message: 'Hanya plan pending_approval yang bisa diapprove.' }, { status: 422 });
  }

  await supabase.from('content_plans')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  const assigneeIds = (plan.assignees as { user_id: string }[] ?? []).map(a => a.user_id);
  const recipientIds = [plan.created_by, ...assigneeIds];
  const uniqueIds = Array.from(new Set(recipientIds));

  await sendNotifications({
    userIds: uniqueIds,
    type: 'plan_approved',
    message: `Plan "${plan.title}" telah disetujui.`,
    contentPlanId: params.id,
    data: { approvedBy: user.name },
  });

  return NextResponse.json({ message: 'Plan berhasil diapprove.' });
}
