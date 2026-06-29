import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { kanban_column, position_in_kanban } = await request.json();
  const supabase = createAdminClient();

  await supabase.from('content_plans')
    .update({ kanban_column, position_in_kanban, updated_at: new Date().toISOString() })
    .eq('id', params.id);

  return NextResponse.json({ message: 'Kanban diupdate.' });
}
