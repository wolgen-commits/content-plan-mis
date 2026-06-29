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
  const { data: sub } = await supabase
    .from('content_submissions')
    .select('*, plan:content_plans(id, title, created_by)')
    .eq('id', params.id).single();

  if (!sub) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });

  await supabase.from('content_submissions')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', params.id);

  await sendNotifications({
    userIds: [sub.submitted_by],
    type: 'submission_approved',
    message: `Submission kamu untuk "${(sub.plan as { title: string })?.title}" disetujui.`,
    contentPlanId: sub.content_plan_id,
  });

  return NextResponse.json({ message: 'Submission diapprove.' });
}
