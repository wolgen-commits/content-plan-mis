import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

// Manager menyetujui publish — pending_publish → published
export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['manager_marketing', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();

  const { data: plan } = await db
    .from('content_plans')
    .select('title, created_by, status, assignees:content_assignees(user_id)')
    .eq('id', params.id)
    .single();

  if (!plan) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });
  if (plan.status !== 'pending_publish') {
    return NextResponse.json({ message: 'Hanya plan pending_publish yang dapat disetujui publishnya.' }, { status: 422 });
  }

  const { error } = await db
    .from('content_plans')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const assigneeIds = (plan.assignees as { user_id: string }[] ?? []).map(a => a.user_id);
  const uniqueIds = Array.from(new Set([plan.created_by, ...assigneeIds]));

  await sendNotifications({
    userIds: uniqueIds,
    type: 'plan_publish_approved',
    message: `Plan "${plan.title}" telah disetujui dan dipublish.`,
    contentPlanId: params.id,
    data: { approvedBy: user.name },
  });

  return NextResponse.json({ success: true });
}
