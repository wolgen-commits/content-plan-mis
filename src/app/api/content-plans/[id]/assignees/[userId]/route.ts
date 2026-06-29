import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

export async function DELETE(_: NextRequest, { params }: { params: { id: string; userId: string } }) {
  const user = await getSessionUser();
  if (!user || !['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const supabase = createAdminClient();
  await supabase.from('content_assignees')
    .delete()
    .eq('content_plan_id', params.id)
    .eq('user_id', params.userId);

  return NextResponse.json({ message: 'Assignee dihapus.' });
}
