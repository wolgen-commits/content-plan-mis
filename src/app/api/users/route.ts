import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  const supabase = createAdminClient();
  let query = supabase.from('users').select('id, name, email, role, avatar_url, created_at').order('name');
  if (role) query = query.eq('role', role);

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const currentUser = await getSessionUser();
  if (!currentUser || currentUser.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { name, email, password, role } = await request.json();
  const adminClient = createAdminClient();

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (authError) return NextResponse.json({ message: authError.message }, { status: 422 });

  await adminClient.from('users').update({ name, role }).eq('id', authData.user.id);

  const { data: profile } = await adminClient
    .from('users').select('*').eq('id', authData.user.id).single();

  return NextResponse.json({ data: profile }, { status: 201 });
}
