import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { user_id, role } = await request.json();
  const supabase = createAdminClient();

  const { data: plan } = await supabase
    .from('content_plans').select('title, created_by').eq('id', params.id).single();

  if (!plan || (plan.created_by !== user.id && user.role !== 'admin')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('content_assignees')
    .insert({ content_plan_id: params.id, user_id, role });

  if (error) return NextResponse.json({ message: 'User sudah di-assign.' }, { status: 422 });

  await sendNotifications({
    userIds: [user_id],
    type: 'assigned_to_plan',
    message: `Kamu di-assign ke plan "${plan.title}"`,
    contentPlanId: params.id,
  });

  return NextResponse.json({ message: 'Assignee ditambahkan.' }, { status: 201 });
}
