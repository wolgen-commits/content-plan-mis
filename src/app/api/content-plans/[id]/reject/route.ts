import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['manager_marketing', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { rejection_notes } = await request.json();
  const supabase = createAdminClient();

  const { data: plan } = await supabase
    .from('content_plans').select('title, created_by, status').eq('id', params.id).single();

  if (!plan || !['pending_approval', 'pending_publish'].includes(plan.status)) {
    return NextResponse.json({ message: 'Tidak valid.' }, { status: 422 });
  }

  // pending_approval → rejected (planner harus edit & ajukan ulang)
  // pending_publish  → approved  (dikembalikan ke produksi untuk perbaikan)
  const newStatus = plan.status === 'pending_publish' ? 'approved' : 'rejected';

  await supabase.from('content_plans')
    .update({ status: newStatus, rejection_notes, updated_at: new Date().toISOString() })
    .eq('id', params.id);

  const notifType = plan.status === 'pending_publish' ? 'plan_publish_rejected' : 'plan_rejected';
  const message = plan.status === 'pending_publish'
    ? `Plan "${plan.title}" dikembalikan ke tahap produksi. Catatan: ${rejection_notes}`
    : `Plan "${plan.title}" ditolak. Catatan: ${rejection_notes}`;

  await sendNotifications({
    userIds: [plan.created_by],
    type: notifType,
    message,
    contentPlanId: params.id,
  });

  return NextResponse.json({ message: plan.status === 'pending_publish' ? 'Plan dikembalikan ke produksi.' : 'Plan ditolak.' });
}
