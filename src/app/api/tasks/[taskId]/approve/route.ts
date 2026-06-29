import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

export async function POST(_req: NextRequest, { params }: { params: { taskId: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const db = createAdminClient();

  const { data: task } = await db
    .from('content_plan_tasks')
    .select('id, name, status, storage_path, file_name, pic_user_id, content_plan:content_plans!content_plan_id(id, title, created_by)')
    .eq('id', params.taskId)
    .single();

  if (!task) return NextResponse.json({ message: 'Task tidak ditemukan' }, { status: 404 });

  const plan = task.content_plan as unknown as { id: string; title: string; created_by: string } | null;
  const isOwner = plan?.created_by === user.id;
  if (!isOwner && user.role !== 'admin') {
    return NextResponse.json({ message: 'Hanya pembuat plan yang dapat menyetujui task' }, { status: 403 });
  }
  if (task.status !== 'submitted') {
    return NextResponse.json({ message: 'Task belum di-submit' }, { status: 400 });
  }

  // Pindahkan file dari RAW ke Final
  let new_file_url: string | null = null;
  let new_storage_path: string | null = task.storage_path ?? null;

  if (task.storage_path) {
    const finalPath = task.storage_path.replace('/RAW/', '/Final/');

    const { error: copyErr } = await db.storage
      .from('content-submissions')
      .copy(task.storage_path, finalPath);

    if (!copyErr) {
      // Hapus file RAW setelah berhasil copy
      await db.storage.from('content-submissions').remove([task.storage_path]);

      const { data: urlData } = db.storage.from('content-submissions').getPublicUrl(finalPath);
      new_file_url    = urlData?.publicUrl ?? null;
      new_storage_path = finalPath;
    }
    // Jika copy gagal, file tetap di RAW — tidak block approval
  }

  const now = new Date().toISOString();
  const { error } = await db.from('content_plan_tasks').update({
    status: 'done',
    approved_by: user.id,
    approved_at: now,
    completed_at: now,
    completed_by: user.id,
    ...(new_file_url && { file_url: new_file_url, storage_path: new_storage_path }),
  }).eq('id', params.taskId);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  // Notif ke PIC bahwa tasknya disetujui
  if (task.pic_user_id) {
    await sendNotifications({
      userIds: [task.pic_user_id],
      type: 'submission_approved',
      message: `Task "${task.name}" kamu telah disetujui pada plan "${plan?.title}"`,
      contentPlanId: plan?.id,
    });
  }

  return NextResponse.json({ success: true });
}
