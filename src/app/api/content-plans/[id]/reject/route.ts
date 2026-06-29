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

  if (!plan || plan.status !== 'pending_approval') {
    return NextResponse.json({ message: 'Tidak valid.' }, { status: 422 });
  }

  await supabase.from('content_plans')
    .update({ status: 'rejected', rejection_notes, updated_at: new Date().toISOString() })
    .eq('id', params.id);

  await sendNotifications({
    userIds: [plan.created_by],
    type: 'plan_rejected',
    message: `Plan "${plan.title}" ditolak. Catatan: ${rejection_notes}`,
    contentPlanId: params.id,
  });

  return NextResponse.json({ message: 'Plan ditolak.' });
}
