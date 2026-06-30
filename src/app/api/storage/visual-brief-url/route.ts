import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { folder_id, file_name, content_type } = await request.json();

  const timestamp = Date.now();
  const safeFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `visual-briefs/${folder_id}/${timestamp}_${safeFileName}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from('content-submissions')
    .createSignedUploadUrl(path);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-submissions/${path}`;

  return NextResponse.json({ signed_url: data.signedUrl, public_url: publicUrl });
}
