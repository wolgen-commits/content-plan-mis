import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { reviewer_notes } = await request.json();
  const supabase = createAdminClient();

  const { data: sub } = await supabase
    .from('content_submissions')
    .select('submitted_by, content_plan_id, plan:content_plans!content_plan_id(title)')
    .eq('id', params.id).single();

  if (!sub) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });

  await supabase.from('content_submissions')
    .update({ status: 'rejected', reviewer_notes })
    .eq('id', params.id);

  await sendNotifications({
    userIds: [sub.submitted_by],
    type: 'submission_rejected',
    message: `Submission kamu untuk "${(sub.plan as unknown as { title: string })?.title}" ditolak. Catatan: ${reviewer_notes}`,
    contentPlanId: sub.content_plan_id,
  });

  return NextResponse.json({ message: 'Submission ditolak.' });
}
