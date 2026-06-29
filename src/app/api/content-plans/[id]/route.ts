import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('content_plans')
    .select(`
      *,
      creator:users!created_by(id, name, email, avatar_url, role),
      approver:users!approved_by(id, name),
      references:content_references(*),
      tags:content_tags(*),
      assignees:content_assignees(*, user:users(id, name, email, avatar_url, role)),
      submissions:content_submissions(*, submitter:users!submitted_by(id, name, avatar_url))
    `)
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });

  return NextResponse.json({ data });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('content_plans').select('created_by').eq('id', params.id).single();

  if (!existing) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });
  if (existing.created_by !== user.id && user.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { references, tags, ...planData } = body;

  const { data: plan, error } = await supabase
    .from('content_plans')
    .update({ ...planData, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 422 });

  if (references !== undefined) {
    await supabase.from('content_references').delete().eq('content_plan_id', params.id);
    if (references.length) {
      await supabase.from('content_references').insert(
        references.map((r: { url: string; label?: string }) => ({
          content_plan_id: params.id, url: r.url, label: r.label ?? null,
        }))
      );
    }
  }

  if (tags !== undefined) {
    await supabase.from('content_tags').delete().eq('content_plan_id', params.id);
    if (tags.length) {
      await supabase.from('content_tags').insert(
        tags.map((tag: string) => ({ content_plan_id: params.id, tag }))
      );
    }
  }

  return NextResponse.json({ data: plan });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('content_plans').select('created_by').eq('id', params.id).single();

  if (!existing) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });
  if (existing.created_by !== user.id && user.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  await supabase.from('content_plans').delete().eq('id', params.id);
  return NextResponse.json({ message: 'Content plan dihapus.' });
}
