import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const path = new URL(req.url).searchParams.get('path') ?? '';
  const db   = createAdminClient();

  const { data, error } = await db.storage
    .from('content-submissions')
    .list(path || undefined, {
      limit: 200,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  // Tandai setiap item: folder (metadata===null) atau file
  const items = (data ?? []).map(item => ({
    name:        item.name,
    isFolder:    item.metadata === null,
    size:        item.metadata?.size ?? null,
    mimetype:    item.metadata?.mimetype ?? null,
    updatedAt:   item.updated_at ?? null,
    path:        path ? `${path}/${item.name}` : item.name,
    publicUrl:   item.metadata
      ? db.storage.from('content-submissions').getPublicUrl(path ? `${path}/${item.name}` : item.name).data.publicUrl
      : null,
  }));

  // Folder selalu di atas, lalu file
  items.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ data: items, path });
}
