import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: plan } = await supabase
    .from('content_plans').select('title, created_by, status')
    .eq('id', params.id).single();

  if (!plan) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });
  if (plan.created_by !== user.id && user.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
  if (plan.status !== 'draft' && plan.status !== 'rejected') {
    return NextResponse.json({ message: 'Hanya draft atau rejected yang bisa disubmit.' }, { status: 422 });
  }

  await supabase.from('content_plans')
    .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
    .eq('id', params.id);

  const { data: managers } = await supabase
    .from('users').select('id').eq('role', 'manager_marketing');

  await sendNotifications({
    userIds: (managers ?? []).map((m: { id: string }) => m.id),
    type: 'plan_submitted',
    message: `Plan "${plan.title}" menunggu persetujuan Anda.`,
    contentPlanId: params.id,
    data: { submittedBy: user.name },
  });

  return NextResponse.json({ message: 'Plan berhasil disubmit.' });
}
