import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('content_submissions')
    .select('*, submitter:users!submitted_by(id, name, avatar_url, role)')
    .eq('content_plan_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['designer', 'videographer', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  const { data: plan } = await supabase
    .from('content_plans').select('title, created_by, status').eq('id', params.id).single();

  if (!plan || !['approved', 'in_production'].includes(plan.status)) {
    return NextResponse.json({ message: 'Plan belum dalam status produksi.' }, { status: 422 });
  }

  const { count } = await supabase
    .from('content_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('content_plan_id', params.id)
    .eq('submitted_by', user.id)
    .eq('file_type', body.file_type);

  const { data: submission, error } = await supabase
    .from('content_submissions')
    .insert({
      content_plan_id: params.id,
      submitted_by: user.id,
      file_url: body.file_url,
      file_name: body.file_name,
      file_size: body.file_size,
      file_type: body.file_type,
      version: (count ?? 0) + 1,
      submission_notes: body.submission_notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 422 });

  await supabase.from('content_plans')
    .update({ status: 'in_production', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('status', 'approved');

  await sendNotifications({
    userIds: [plan.created_by],
    type: 'submission_received',
    message: `${user.name} mengupload ${body.file_type} untuk plan "${plan.title}"`,
    contentPlanId: params.id,
    data: { submissionId: submission.id },
  });

  return NextResponse.json({ data: submission }, { status: 201 });
}
