import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  if (!['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Hanya content planner atau admin yang dapat mempublish' }, { status: 403 });
  }

  const db = createAdminClient();

  const { data: plan } = await db
    .from('content_plans')
    .select('id, title, status, created_by')
    .eq('id', params.id)
    .single();

  if (!plan) return NextResponse.json({ message: 'Plan tidak ditemukan' }, { status: 404 });
  if (plan.created_by !== user.id && user.role !== 'admin') {
    return NextResponse.json({ message: 'Hanya pembuat plan yang dapat mempublish' }, { status: 403 });
  }
  if (plan.status !== 'done') {
    return NextResponse.json({ message: 'Plan harus berstatus Selesai untuk dapat dipublish' }, { status: 400 });
  }

  // Cek semua task sudah done
  const { data: tasks } = await db
    .from('content_plan_tasks')
    .select('id, name, status')
    .eq('content_plan_id', params.id);

  const incomplete = (tasks ?? []).filter(t => t.status !== 'done');
  if (incomplete.length > 0) {
    return NextResponse.json({
      message: 'Ada task yang belum selesai',
      incomplete_tasks: incomplete.map(t => ({ id: t.id, name: t.name })),
    }, { status: 400 });
  }

  const { error } = await db
    .from('content_plans')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
