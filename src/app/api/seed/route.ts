import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const SEED_USERS = [
  { email: 'admin@magenta.id',   password: 'password', name: 'Admin',             role: 'admin' },
  { email: 'planner@magenta.id', password: 'password', name: 'Content Planner',   role: 'content_planner' },
  { email: 'manager@magenta.id', password: 'password', name: 'Manager Marketing', role: 'manager_marketing' },
  { email: 'designer@magenta.id',password: 'password', name: 'Designer',          role: 'designer' },
  { email: 'video@magenta.id',   password: 'password', name: 'Videografer',       role: 'videographer' },
];

export async function POST() {
  const supabase = createAdminClient();
  const results: { email: string; status: string; error?: string }[] = [];

  for (const u of SEED_USERS) {
    // Buat user di Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role },
    });

    if (authError) {
      // User mungkin sudah ada
      results.push({ email: u.email, status: 'skipped', error: authError.message });
      continue;
    }

    // Update tabel users (trigger handle_new_user sudah insert row, tapi pastikan role benar)
    await supabase
      .from('users')
      .upsert({ id: authData.user.id, name: u.name, email: u.email, role: u.role })
      .eq('id', authData.user.id);

    results.push({ email: u.email, status: 'created' });
  }

  return NextResponse.json({ results });
}
