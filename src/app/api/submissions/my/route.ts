import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('content_submissions')
    .select('*, plan:content_plans(id, title, channel, status, deadline_date)')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ data });
}
