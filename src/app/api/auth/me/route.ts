import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Gunakan admin client agar tidak diblokir RLS
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (profile) {
    return NextResponse.json(profile);
  }

  // Fallback ke auth metadata jika row di users belum ada
  return NextResponse.json({
    id: authUser.id,
    email: authUser.email,
    name: authUser.user_metadata?.name ?? authUser.email,
    role: authUser.user_metadata?.role ?? 'content_planner',
    avatar_url: null,
    created_at: authUser.created_at,
    updated_at: authUser.created_at,
  });
}
