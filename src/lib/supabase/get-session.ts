import { createClient, createAdminClient } from '@/lib/supabase/server';
import { User } from '@/types';

export async function getSessionUser(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const admin = createAdminClient();

  // 1. Cari profil by id (normal case)
  const { data: profile } = await admin
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (profile) return profile as User;

  // 2. Fallback: cari by email (UUID mismatch antara auth.users & public.users)
  const { data: profileByEmail } = await admin
    .from('users')
    .select('*')
    .eq('email', authUser.email ?? '')
    .maybeSingle();

  if (profileByEmail) {
    // Update UUID di public.users agar cocok dengan auth UUID
    await admin.from('users').update({ id: authUser.id }).eq('email', authUser.email ?? '');
    return { ...profileByEmail, id: authUser.id } as User;
  }

  // 3. User belum ada sama sekali — insert baru
  const newUser = {
    id: authUser.id,
    email: authUser.email ?? '',
    name: (authUser.user_metadata?.name as string) ?? authUser.email ?? '',
    role: (authUser.user_metadata?.role as User['role']) ?? 'content_planner',
    avatar_url: null,
  };
  await admin.from('users').insert(newUser);
  return newUser as User;
}
