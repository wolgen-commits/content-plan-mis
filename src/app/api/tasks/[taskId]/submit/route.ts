import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';
import { format } from 'date-fns';

function buildStoragePath(role: string, fileName: string): string {
  const folder   = role === 'videographer' ? 'video' : 'design';
  const now      = new Date();
  const yearMonth = format(now, 'yyyy-MMM').toUpperCase(); // e.g. 2026-JUN
  const day       = format(now, 'dd');                     // e.g. 26
  const ext       = fileName.split('.').pop() ?? 'bin';
  const unique    = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  return `${folder}/${yearMonth}/${day}/RAW/${unique}.${ext}`;
}

export async function POST(req: NextRequest, { params }: { params: { taskId: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();

  const { data: task } = await db
    .from('content_plan_tasks')
    .select('id, name, pic_user_id, content_plan_id, status, content_plan:content_plans!content_plan_id(id, title, created_by)')
    .eq('id', params.taskId)
    .single();

  if (!task) return NextResponse.json({ message: 'Task tidak ditemukan' }, { status: 404 });
  if (task.pic_user_id !== user.id && user.role !== 'admin') {
    return NextResponse.json({ message: 'Hanya PIC yang dapat submit task ini' }, { status: 403 });
  }
  if (task.status === 'done') {
    return NextResponse.json({ message: 'Task sudah selesai' }, { status: 400 });
  }

  const formData = await req.formData();
  const file     = formData.get('file') as File | null;
  const notes    = formData.get('notes') as string | null;

  let file_url: string | null     = null;
  let file_name: string | null    = null;
  let storage_path: string | null = null;

  if (file && file.size > 0) {
    const path = buildStoragePath(user.role, file.name);
    const buf  = await file.arrayBuffer();

    const { error: upErr } = await db.storage
      .from('content-submissions')
      .upload(path, buf, { contentType: file.type, upsert: false });

    if (upErr) return NextResponse.json({ message: `Upload gagal: ${upErr.message}` }, { status: 500 });

    const { data: urlData } = db.storage.from('content-submissions').getPublicUrl(path);
    file_url     = urlData?.publicUrl ?? null;
    file_name    = file.name;
    storage_path = path;
  }

  const { error } = await db.from('content_plan_tasks').update({
    status: 'submitted',
    file_url,
    file_name,
    storage_path,
    submission_notes: notes || null,
    submitted_at: new Date().toISOString(),
  }).eq('id', params.taskId);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  // Notif ke pembuat plan
  const plan = task.content_plan as unknown as { id: string; title: string; created_by: string } | null;
  if (plan?.created_by) {
    await sendNotifications({
      userIds: [plan.created_by],
      type: 'task_submitted',
      message: `${user.name} telah submit task "${task.name}" pada plan "${plan.title}"`,
      contentPlanId: plan.id,
    });
  }

  return NextResponse.json({ success: true });
}
