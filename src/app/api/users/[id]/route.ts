import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getSessionUser();
  if (!currentUser || currentUser.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { name, email, password, role } = await request.json();
  const adminClient = createAdminClient();

  if (email || password) {
    await adminClient.auth.admin.updateUserById(params.id, { email, password });
  }

  await adminClient.from('users').update({ name, email, role }).eq('id', params.id);

  const { data: profile } = await adminClient
    .from('users').select('*').eq('id', params.id).single();

  return NextResponse.json({ data: profile });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getSessionUser();
  if (!currentUser || currentUser.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const adminClient = createAdminClient();
  await adminClient.auth.admin.deleteUser(params.id);

  return NextResponse.json({ message: 'User dihapus.' });
}
