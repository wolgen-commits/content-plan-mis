'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { formatDate, CONTENT_TYPE_LABELS } from '@/lib/utils';
import { ContentPlan, ContentPlanTask, User, ContentAssignee, ContentSubmission } from '@/types';
import Link from 'next/link';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/useFileUpload';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { ContentPlanEditModal } from '@/components/ui/ContentPlanEditModal';

/* ── WIB formatter ── */
function fmtWIB(d: string | null | undefined): string | null {
  if (!d) return null;
  try {
    const s = new Date(d).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return s.replace(/\./g, ':') + ' WIB';
  } catch { return d; }
}

/* ── Dynamic task status badge ── */
interface TaskBadge { label: string; bg: string; text: string; dot: string }
function getTaskBadge(status: string, submitCount: number, revisionCount: number): TaskBadge {
  if (status === 'done') return { label: 'Disetujui', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' };
  if (status === 'submitted') {
    const n = submitCount > 0 ? submitCount : 1;
    return { label: `Diajukan #${n}`, bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
  }
  if (status === 'pending' && revisionCount > 0) return { label: `Perlu Revisi #${revisionCount}`, bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' };
  return { label: 'Belum Dikerjakan', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' };
}

/* ── Task history log ── */
interface TaskLog {
  id: string;
  event_type: 'created' | 'submitted' | 'revision_requested' | 'approved';
  event_number: number | null;
  notes: string | null;
  actor_name: string | null;
  created_at: string;
}

const LOG_META: Record<string, { label: (n?: number | null) => string; color: string; icon: React.ReactNode }> = {
  created: {
    label: () => 'Task Dibuat',
    color: 'bg-blue-500',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  },
  submitted: {
    label: (n) => `Submit #${n ?? 1}`,
    color: 'bg-amber-500',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
  },
  revision_requested: {
    label: (n) => `Revisi #${n ?? 1}`,
    color: 'bg-orange-400',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  },
  approved: {
    label: () => 'Disetujui',
    color: 'bg-emerald-500',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  },
};

/* ── Task history modal ── */
function TaskHistoryModal({ task, planTitle, onClose }: { task: ContentPlanTask; planTitle: string; onClose: () => void }) {
  const { data: logs = [], isLoading } = useQuery<TaskLog[]>({
    queryKey: ['task-logs', task.id],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('content_plan_task_logs')
        .select('id, event_type, event_number, notes, actor_name, created_at')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });
      return (data ?? []) as TaskLog[];
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-[14px] font-bold text-gray-900">Log Histori Task</h3>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[220px]">
              {task.name} · {planTitle}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 text-lg leading-none">×</button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-[12px] text-gray-400">Memuat histori...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-gray-400 italic">Belum ada log histori untuk task ini.</div>
          ) : (
            <div className="relative">
              <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gray-200" />
              <div className="space-y-4">
                {logs.map(log => {
                  const meta = LOG_META[log.event_type];
                  if (!meta) return null;
                  return (
                    <div key={log.id} className="flex items-start gap-3 relative">
                      <div className={`w-[30px] h-[30px] rounded-full ${meta.color} flex items-center justify-center flex-shrink-0 text-white z-10 shadow-sm`}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-bold text-gray-800">{meta.label(log.event_number)}</p>
                          {log.actor_name && <span className="text-[10px] text-gray-400">oleh {log.actor_name}</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{fmtWIB(log.created_at)}</p>
                        {log.notes && (
                          <div className="mt-1.5 bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5">
                            <p className="text-[11px] text-gray-600 italic leading-relaxed">&ldquo;{log.notes}&rdquo;</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {task.file_url && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">File Hasil Kerja Saat Ini</p>
              <a href={task.file_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-btn border border-brand/30 bg-brand/5 text-brand text-[12px] hover:bg-brand/10 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {task.file_name ?? 'Lihat File'}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Task action dropdown ── */
interface TaskActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
  disabled?: boolean;
}

function TaskActionDropdown({ items }: { items: TaskActionItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
    }
    setOpen(v => !v);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div>
      <button ref={btnRef} type="button" onClick={toggle}
        className="w-7 h-7 rounded-md flex items-center justify-center bg-gray-100 hover:bg-brand hover:text-white text-gray-500 transition-colors">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-48 bg-white rounded-card border border-gray-200 shadow-xl py-1 overflow-hidden">
          {items.map((item, i) => (
            <div key={i}>
              {item.dividerBefore && <div className="border-t border-gray-100 my-1" />}
              <button type="button" disabled={item.disabled}
                onClick={() => { if (!item.disabled) { setOpen(false); item.onClick(); } }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors text-left disabled:opacity-40 ${
                  item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                <span className={`flex-shrink-0 ${item.danger ? 'text-red-400' : 'text-gray-400'}`}>{item.icon}</span>
                {item.label}
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

const EMPTY_TASK = { name: '', deadline: '', pic: '', reference: '', description: '' };

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ContentPlanDetailPage({ params }: { params: { id: string } }) {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  // edit modal
  const [showEditModal, setShowEditModal] = useState(false);

  // plan action modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showPublishSubmitConfirm, setShowPublishSubmitConfirm] = useState(false);
  const [showApprovePublishConfirm, setShowApprovePublishConfirm] = useState(false);

  // upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileType, setUploadFileType] = useState<'design' | 'video'>('design');
  const [uploadNotes, setUploadNotes] = useState('');
  const { upload, progress, uploading } = useFileUpload();

  // task form
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState(EMPTY_TASK);
  const [taskErrors, setTaskErrors] = useState({ name: '', deadline: '' });

  // task revision modal
  const [reviseTaskId, setReviseTaskId] = useState<string | null>(null);
  const [reviseNotes, setReviseNotes] = useState('');

  // task history modal
  const [historyTarget, setHistoryTarget] = useState<ContentPlanTask | null>(null);

  // task submit modal
  const [submitTaskTarget, setSubmitTaskTarget] = useState<ContentPlanTask | null>(null);
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitNotes, setSubmitNotes] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['content-plan', params.id] });

  const { data, isLoading } = useQuery({
    queryKey: ['content-plan', params.id],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from('content_plans')
        .select(`
          *,
          creator:users!created_by(id, name, email, avatar_url, role),
          approver:users!approved_by(id, name),
          references:content_references(*),
          tags:content_tags(*),
          assignees:content_assignees(*, user:users(id, name, email, avatar_url, role)),
          submissions:content_submissions(*, submitter:users!submitted_by(id, name, avatar_url)),
          tasks:content_plan_tasks(id, name, deadline, pic, pic_user_id, reference, description, status, submit_count, revision_count, file_url, file_name, submission_notes, submitted_at, approved_by, approved_at, completed_at, completed_by, created_at)
        `)
        .eq('id', params.id)
        .single();
      if (error || !data) throw new Error('Tidak ditemukan');
      const plan = data as unknown as ContentPlan;
      // sort tasks by deadline
      if (plan.tasks) plan.tasks = [...plan.tasks].sort((a, b) => a.deadline.localeCompare(b.deadline));
      return plan;
    },
  });

  /* ── Plan mutations ── */
  const submitMutation = useMutation({
    mutationFn: () => fetch(`/api/content-plans/${params.id}/submit`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => { toast.success('Plan disubmit untuk approval!'); invalidate(); setShowSubmitConfirm(false); },
    onError: () => toast.error('Gagal submit plan'),
  });

  const approvePlanMutation = useMutation({
    mutationFn: () => fetch(`/api/content-plans/${params.id}/approve`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => { toast.success('Plan diapprove!'); invalidate(); setShowApproveConfirm(false); },
    onError: () => toast.error('Gagal approve plan'),
  });

  const rejectPlanMutation = useMutation({
    mutationFn: () => fetch(`/api/content-plans/${params.id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejection_notes: rejectionNotes }),
    }).then(r => r.json()),
    onSuccess: (_, __, _ctx) => {
      const isPublishReject = data?.status === 'pending_publish';
      toast.success(isPublishReject ? 'Plan dikembalikan ke produksi' : 'Plan ditolak');
      invalidate();
      setShowRejectModal(false);
    },
    onError: () => toast.error('Gagal menolak'),
  });

  const submitPublishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/content-plans/${params.id}/publish`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw body;
    },
    onSuccess: () => { toast.success('Diajukan untuk publish!'); invalidate(); setShowPublishSubmitConfirm(false); },
    onError: (err: { message?: string; incomplete_tasks?: { id: string; name: string }[] }) => {
      toast.error(err.message ?? 'Gagal mengajukan publish');
    },
  });

  const approvePublishMutation = useMutation({
    mutationFn: () => fetch(`/api/content-plans/${params.id}/approve-publish`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => { toast.success('Plan berhasil dipublish!'); invalidate(); setShowApprovePublishConfirm(false); },
    onError: () => toast.error('Gagal menyetujui publish'),
  });

  /* ── Submission mutations ── */
  const approveSubMutation = useMutation({
    mutationFn: (subId: string) => fetch(`/api/submissions/${subId}/approve`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => { toast.success('Submission diapprove!'); invalidate(); },
    onError: () => toast.error('Gagal approve submission'),
  });

  const rejectSubMutation = useMutation({
    mutationFn: ({ subId, notes }: { subId: string; notes: string }) =>
      fetch(`/api/submissions/${subId}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_notes: notes }),
      }).then(r => r.json()),
    onSuccess: () => { toast.success('Submission ditolak'); invalidate(); },
    onError: () => toast.error('Gagal tolak submission'),
  });

  /* ── Task mutations (Supabase direct) ── */
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const supabase = getSupabaseBrowser();
      await supabase.from('content_plan_tasks').update({
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? (user?.id ?? null) : null,
      }).eq('id', taskId);
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error('Gagal update task'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const supabase = getSupabaseBrowser();
      await supabase.from('content_plan_tasks').delete().eq('id', taskId);
    },
    onSuccess: () => { toast.success('Task dihapus'); invalidate(); },
    onError: () => toast.error('Gagal hapus task'),
  });

  const addTaskMutation = useMutation({
    mutationFn: async (task: typeof EMPTY_TASK) => {
      const supabase = getSupabaseBrowser();
      await supabase.from('content_plan_tasks').insert({
        content_plan_id: params.id,
        name: task.name,
        deadline: task.deadline,
        pic: task.pic || null,
        reference: task.reference || null,
        description: task.description || null,
      });
    },
    onSuccess: () => {
      toast.success('Task ditambahkan');
      invalidate();
      setNewTask(EMPTY_TASK);
      setShowAddTask(false);
    },
    onError: () => toast.error('Gagal tambah task'),
  });

  const approveTaskMutation = useMutation({
    mutationFn: (taskId: string) => fetch(`/api/tasks/${taskId}/approve`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => { toast.success('Task disetujui!'); invalidate(); },
    onError: () => toast.error('Gagal setujui task'),
  });

  const rejectTaskMutation = useMutation({
    mutationFn: ({ taskId, notes }: { taskId: string; notes: string }) =>
      fetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_notes: notes }),
      }).then(r => r.json()),
    onSuccess: () => {
      toast.success('Revisi diminta, PIC akan mendapat notifikasi');
      invalidate();
      setReviseTaskId(null);
      setReviseNotes('');
    },
    onError: () => toast.error('Gagal meminta revisi'),
  });

  async function handleTaskSubmit() {
    if (!submitTaskTarget) return;
    setSubmittingTask(true);
    try {
      const fd = new FormData();
      if (submitFile) fd.append('file', submitFile);
      if (submitNotes) fd.append('notes', submitNotes);
      const res = await fetch(`/api/tasks/${submitTaskTarget.id}/submit`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Gagal submit');
      toast.success('Task berhasil di-submit!');
      invalidate();
      setSubmitTaskTarget(null);
      setSubmitFile(null);
      setSubmitNotes('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmittingTask(false);
    }
  }

  function submitAddTask() {
    const errs = { name: '', deadline: '' };
    if (!newTask.name.trim()) errs.name = 'Wajib diisi';
    if (!newTask.deadline) errs.deadline = 'Wajib diisi';
    setTaskErrors(errs);
    if (errs.name || errs.deadline) return;
    addTaskMutation.mutate(newTask);
  }

  async function handleUpload() {
    if (!uploadFile || !data) return;
    try {
      const { file_url, file_name, file_size } = await upload(uploadFile, data.id, uploadFileType);
      const res = await fetch(`/api/content-plans/${data.id}/submissions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url, file_name, file_size, file_type: uploadFileType, submission_notes: uploadNotes }),
      });
      if (!res.ok) throw new Error('Gagal submit file');
      toast.success('File berhasil diupload!');
      invalidate();
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadNotes('');
    } catch (err) { toast.error((err as Error).message); }
  }

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Memuat...</div>;
  if (!data) return <div className="p-6 text-sm text-danger">Plan tidak ditemukan</div>;

  const isCreator    = data.created_by === user?.id;
  const isPlanner    = user?.role === 'content_planner' || user?.role === 'admin';
  const isManager    = user?.role === 'manager_marketing' || user?.role === 'admin';
  const isAssignee   = data.assignees?.some((a: ContentAssignee) => a.user_id === user?.id);
  const isCreative   = user?.role === 'designer' || user?.role === 'videographer';
  const canManage    = isCreator || user?.role === 'admin';
  const tasks        = (data.tasks ?? []) as ContentPlanTask[];
  const doneCount    = tasks.filter(t => t.status === 'done').length;
  const allTasksDone = tasks.every(t => t.status === 'done');
  const contentTypes = Array.isArray(data.content_type) ? data.content_type : [data.content_type];
  const channels     = Array.isArray(data.channel) ? data.channel : [data.channel];

  return (
    <div className="px-6 py-5 space-y-4 min-h-full">

      {/* ── Breadcrumb + Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1.5">
            <Link href="/content-plans" className="hover:text-brand transition-colors">Content Plans</Link>
            <span>/</span>
            <span className="text-gray-600 truncate">{data.title}</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight mb-2">{data.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            {channels.map(ch => (
              <span key={ch} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">{ch}</span>
            ))}
            {contentTypes.map(ct => (
              <span key={ct} className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500">{CONTENT_TYPE_LABELS[ct] ?? ct}</span>
            ))}
          </div>
        </div>

        <div className="flex flex-shrink-0 gap-2">
          {canManage && ['draft', 'rejected'].includes(data.status) && (
            <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>Edit</Button>
          )}
          {canManage && ['draft', 'rejected'].includes(data.status) && (
            <Button size="sm" onClick={() => setShowSubmitConfirm(true)}>Ajukan Persetujuan</Button>
          )}
          {isManager && data.status === 'pending_approval' && (
            <>
              <Button variant="success" size="sm" onClick={() => setShowApproveConfirm(true)}>Setujui</Button>
              <Button variant="danger" size="sm" onClick={() => setShowRejectModal(true)}>Tolak</Button>
            </>
          )}
          {canManage && data.status === 'approved' && (
            <Button size="sm"
              disabled={!allTasksDone}
              title={!allTasksDone ? 'Semua task harus selesai terlebih dahulu' : undefined}
              onClick={() => setShowPublishSubmitConfirm(true)}>
              Ajukan Publish
            </Button>
          )}
          {isManager && data.status === 'pending_publish' && (
            <>
              <Button variant="success" size="sm" onClick={() => setShowApprovePublishConfirm(true)}>Setujui Publish</Button>
              <Button variant="danger" size="sm" onClick={() => setShowRejectModal(true)}>Kembalikan</Button>
            </>
          )}
          {isCreative && isAssignee && data.status === 'approved' && (
            <Button size="sm" onClick={() => setShowUploadModal(true)}>Upload Hasil</Button>
          )}
        </div>
      </div>

      {/* ── Rejection notice ── */}
      {data.rejection_notes && (
        <div className="bg-danger-light border border-danger/20 rounded-card px-4 py-3">
          <p className="text-xs font-semibold text-danger mb-0.5">Catatan Penolakan</p>
          <p className="text-sm text-gray-700">{data.rejection_notes}</p>
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="grid grid-cols-[1fr_300px] gap-4 items-start">

        {/* ── Left: content + tasks + submissions ── */}
        <div className="space-y-4 min-w-0">

          {/* Info konten */}
          <div className="bg-white rounded-card border border-gray-100 shadow-card p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[1px] text-gray-400 mb-3">Isi Konten</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {data.topic && (
                <div className="col-span-2">
                  <p className="text-[10px] font-medium text-gray-400 mb-0.5">Topik / Angle</p>
                  <p className="text-[13px] text-gray-700">{data.topic}</p>
                </div>
              )}
              {data.material && (
                <div>
                  <p className="text-[10px] font-medium text-gray-400 mb-0.5">Materi</p>
                  <p className="text-[13px] text-gray-700 whitespace-pre-wrap">{data.material}</p>
                </div>
              )}
              {data.visual_brief && (
                <div>
                  <p className="text-[10px] font-medium text-gray-400 mb-0.5">Visual Brief</p>
                  <p className="text-[13px] text-gray-700 whitespace-pre-wrap">{data.visual_brief}</p>
                </div>
              )}
              {data.caption && (
                <div className="col-span-2">
                  <p className="text-[10px] font-medium text-gray-400 mb-0.5">Caption</p>
                  <p className="text-[13px] text-gray-700 whitespace-pre-wrap">{data.caption}</p>
                </div>
              )}
              {!data.topic && !data.material && !data.visual_brief && !data.caption && (
                <p className="col-span-2 text-[12px] text-gray-300 italic">Belum ada isi konten.</p>
              )}
            </div>

            {/* Tags */}
            {data.tags && data.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-gray-50">
                {data.tags.map((t: { id: string; tag: string }) => (
                  <span key={t.id} className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded">#{t.tag}</span>
                ))}
              </div>
            )}

            {/* Referensi */}
            {data.references && data.references.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-50">
                <p className="text-[10px] font-semibold text-gray-400 mb-2">REFERENSI</p>
                <ul className="space-y-1">
                  {data.references.map((ref: { id: string; url: string; label: string | null }) => (
                    <li key={ref.id}>
                      <a href={ref.url} target="_blank" rel="noopener noreferrer"
                        className="text-[12px] text-brand hover:underline flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        {ref.label || ref.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── Tasks ── */}
          <div className="bg-white rounded-card border border-gray-100 shadow-card">
            <div className="px-5 pt-3 pb-2 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[1px] text-gray-400">Tasks</p>
                  {tasks.length > 0 && (
                    <span className="text-[10px] font-mono text-gray-400">{doneCount}/{tasks.length} selesai</span>
                  )}
                </div>
                {canManage && (
                  <button type="button" onClick={() => { setShowAddTask(v => !v); setNewTask(EMPTY_TASK); setTaskErrors({ name: '', deadline: '' }); }}
                    className="text-[11px] font-medium text-brand hover:text-brand-hover flex items-center gap-1 transition-colors">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Tambah Task
                  </button>
                )}
              </div>
              {tasks.length > 0 && (
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((doneCount / tasks.length) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Add task form */}
            {showAddTask && (
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 mb-2">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Nama Task *</p>
                    <Input value={newTask.name} onChange={e => setNewTask(p => ({ ...p, name: e.target.value }))} placeholder="Nama task..." />
                    {taskErrors.name && <p className="text-[10px] text-danger mt-0.5">{taskErrors.name}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Deadline *</p>
                    <Input type="date" value={newTask.deadline} onChange={e => setNewTask(p => ({ ...p, deadline: e.target.value }))} />
                    {taskErrors.deadline && <p className="text-[10px] text-danger mt-0.5">{taskErrors.deadline}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">PIC</p>
                    <Input value={newTask.pic} onChange={e => setNewTask(p => ({ ...p, pic: e.target.value }))} placeholder="Penanggung jawab..." />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Referensi</p>
                    <Input value={newTask.reference} onChange={e => setNewTask(p => ({ ...p, reference: e.target.value }))} placeholder="Link/catatan..." />
                  </div>
                </div>
                <div className="mb-2">
                  <p className="text-[10px] text-gray-400 mb-0.5">Hasil Kerja</p>
                  <Textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Deskripsi hasil yang diharapkan..." />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitAddTask} loading={addTaskMutation.isPending}>Simpan Task</Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setShowAddTask(false)}>Batal</Button>
                </div>
              </div>
            )}

            {/* Task table */}
            {tasks.length === 0 ? (
              <div className="px-5 py-6 text-center text-[12px] text-gray-300">
                Belum ada task. {canManage && 'Klik "+ Tambah Task" untuk menambahkan.'}
              </div>
            ) : (
              <table className="w-full border-collapse text-[12px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.7px] text-gray-400 border-b border-gray-200 whitespace-nowrap">Aksi</th>
                    <th className="px-3 py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.7px] text-gray-400 border-b border-gray-200 min-w-[180px]">Nama Task</th>
                    <th className="px-3 py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.7px] text-gray-400 border-b border-gray-200 whitespace-nowrap">PIC</th>
                    <th className="px-3 py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.7px] text-gray-400 border-b border-gray-200 whitespace-nowrap">Deadline</th>
                    <th className="px-3 py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.7px] text-gray-400 border-b border-gray-200 whitespace-nowrap">Status</th>
                    {canManage && <th className="px-3 py-[9px] border-b border-gray-200 w-8"/>}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => {
                    const taskWithCounts = task as ContentPlanTask & { submit_count?: number; revision_count?: number };
                    const st = getTaskBadge(task.status, taskWithCounts.submit_count ?? 0, taskWithCounts.revision_count ?? 0);
                    const isPic = task.pic_user_id === user?.id;
                    const canSubmitTask  = isPic && task.status === 'pending';
                    const canApproveTask = canManage && task.status === 'submitted';
                    const todayJkt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })); todayJkt.setHours(0, 0, 0, 0);
                    const isLate = task.deadline && task.status !== 'done' && new Date(new Date(task.deadline).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })) < todayJkt;

                    const dropdownItems: TaskActionItem[] = [
                      {
                        label: 'Submit Task',
                        icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
                        onClick: () => { setSubmitTaskTarget(task); setSubmitFile(null); setSubmitNotes(''); },
                        disabled: !canSubmitTask,
                      },
                      {
                        label: 'Setujui Task',
                        icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
                        onClick: () => approveTaskMutation.mutate(task.id),
                        disabled: !canApproveTask,
                      },
                      {
                        label: 'Minta Revisi',
                        icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
                        onClick: () => { setReviseTaskId(task.id); setReviseNotes(''); },
                        disabled: !canApproveTask,
                        danger: true,
                      },
                      {
                        label: 'Log Histori',
                        icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                        onClick: () => setHistoryTarget(task),
                        dividerBefore: true,
                      },
                    ];

                    return (
                      <tr key={task.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/70 transition-colors group ${isLate ? 'bg-red-50/30' : ''}`}>
                        {/* Aksi */}
                        <td className="px-3 py-2.5 w-[44px]">
                          <TaskActionDropdown items={dropdownItems} />
                        </td>

                        {/* Nama Task */}
                        <td className="px-3 py-2.5">
                          <p className={`font-medium ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.name}</p>
                          {task.description && (
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{task.description}</p>
                          )}
                          {task.status === 'pending' && task.submission_notes && (
                            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-amber-700">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              <span className="italic line-clamp-1">Revisi: {task.submission_notes}</span>
                            </div>
                          )}
                          {task.status === 'submitted' && task.submission_notes && (
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{task.submission_notes}</p>
                          )}
                          {task.file_url && (
                            <a href={task.file_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-brand hover:underline mt-0.5">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              {task.file_name ?? 'Lihat File'}
                            </a>
                          )}
                          {task.reference && (
                            <a href={task.reference.startsWith('http') ? task.reference : '#'}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand hover:underline mt-0.5 ml-2">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                              Ref
                            </a>
                          )}
                        </td>

                        {/* PIC */}
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">
                          {task.pic || <span className="text-gray-300">—</span>}
                        </td>

                        {/* Deadline */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`text-[12px] ${isLate ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                            {task.deadline ? fmtDate(task.deadline) : <span className="text-gray-300">—</span>}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${st.bg} ${st.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                            {st.label}
                          </span>
                        </td>

                        {/* Delete */}
                        {canManage && (
                          <td className="px-2 py-2.5">
                            <button type="button" onClick={() => deleteTaskMutation.mutate(task.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-danger transition-all"
                              title="Hapus task">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Submissions ── */}
          {data.submissions && data.submissions.length > 0 && (
            <div className="bg-white rounded-card border border-gray-100 shadow-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[1px] text-gray-400 mb-3">Submissions</p>
              <div className="space-y-2">
                {data.submissions.map((sub: ContentSubmission) => (
                  <div key={sub.id} className="border border-gray-100 rounded-btn p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {sub.submitter && <Avatar name={(sub.submitter as User).name} avatarUrl={(sub.submitter as User).avatar_url} size="sm" />}
                        <div>
                          <p className="text-[12px] font-medium text-gray-900">{sub.file_name ?? 'File'}</p>
                          <p className="text-[10px] text-gray-400">v{sub.version} · {sub.file_type} · {formatDate(sub.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          sub.status === 'approved' ? 'bg-success-light text-success' :
                          sub.status === 'rejected' ? 'bg-danger-light text-danger' : 'bg-warning-light text-warning'
                        }`}>{sub.status}</span>
                        <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand hover:underline">Unduh</a>
                      </div>
                    </div>
                    {sub.submission_notes && <p className="text-[11px] text-gray-500 mt-2">Catatan: {sub.submission_notes}</p>}
                    {sub.reviewer_notes && <p className="text-[11px] text-danger mt-1">Review: {sub.reviewer_notes}</p>}
                    {sub.status === 'pending' && isPlanner && canManage && (
                      <div className="flex gap-2 mt-2">
                        <Button variant="success" size="sm" loading={approveSubMutation.isPending}
                          onClick={() => approveSubMutation.mutate(sub.id)}>Setujui</Button>
                        <Button variant="danger" size="sm"
                          onClick={() => { const n = window.prompt('Catatan penolakan:'); if (n) rejectSubMutation.mutate({ subId: sub.id, notes: n }); }}>
                          Tolak
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-3 sticky top-4">

          {/* Info plan */}
          <div className="bg-white rounded-card border border-gray-100 shadow-card p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[1px] text-gray-400">Info Plan</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-400">Tanggal Tayang</p>
                <p className="text-[12px] font-medium text-gray-900 mt-0.5">{formatDate(data.scheduled_date) || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Deadline</p>
                <p className="text-[12px] font-medium text-gray-900 mt-0.5">{formatDate(data.deadline_date) || '—'}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-gray-400">Dibuat oleh</p>
              {data.creator && (
                <div className="flex items-center gap-2 mt-1">
                  <Avatar name={(data.creator as User).name} avatarUrl={(data.creator as User).avatar_url} size="sm" />
                  <div>
                    <p className="text-[12px] font-medium text-gray-800">{(data.creator as User).name}</p>
                    <p className="text-[10px] text-gray-400">{formatDate(data.created_at)}</p>
                  </div>
                </div>
              )}
            </div>

            {data.approver && (
              <div>
                <p className="text-[10px] text-gray-400">Disetujui oleh</p>
                <p className="text-[12px] font-medium text-gray-800 mt-0.5">{(data.approver as User).name}</p>
              </div>
            )}
          </div>

          {/* Tim Kreatif */}
          {data.assignees && data.assignees.length > 0 && (
            <div className="bg-white rounded-card border border-gray-100 shadow-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[1px] text-gray-400 mb-3">Tim Kreatif</p>
              <div className="space-y-2">
                {data.assignees.map((a: ContentAssignee) => (
                  <div key={a.id} className="flex items-center gap-2">
                    {a.user && <Avatar name={(a.user as User).name} avatarUrl={(a.user as User).avatar_url} size="sm" />}
                    <div>
                      <p className="text-[12px] font-medium text-gray-900">{a.user ? (a.user as User).name : '-'}</p>
                      <p className="text-[10px] text-gray-400 capitalize">{a.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload button for creative */}
          {isCreative && isAssignee && data.status === 'approved' && (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-card border-2 border-dashed border-brand/30 text-brand hover:bg-brand/5 transition-colors text-[12px] font-medium"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
              Upload Hasil Kerja
            </button>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <ContentPlanEditModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        planId={params.id}
        onSaved={invalidate}
      />

      {historyTarget && (
        <TaskHistoryModal task={historyTarget} planTitle={data.title} onClose={() => setHistoryTarget(null)} />
      )}

      <ConfirmModal open={showSubmitConfirm} onClose={() => setShowSubmitConfirm(false)}
        onConfirm={() => submitMutation.mutate()} loading={submitMutation.isPending}
        title="Ajukan untuk Persetujuan"
        description="Plan ini akan dikirim ke manager untuk disetujui. Yakin?"
        confirmLabel="Ajukan" />

      <ConfirmModal open={showApproveConfirm} onClose={() => setShowApproveConfirm(false)}
        onConfirm={() => approvePlanMutation.mutate()} loading={approvePlanMutation.isPending}
        title="Setujui Plan"
        description="Kamu menyetujui content plan ini dan tim kreatif akan mulai produksi. Yakin?"
        confirmLabel="Setujui" />

      <ConfirmModal open={showPublishSubmitConfirm} onClose={() => setShowPublishSubmitConfirm(false)}
        onConfirm={() => submitPublishMutation.mutate()} loading={submitPublishMutation.isPending}
        title="Ajukan untuk Publish"
        description="Semua task sudah selesai. Plan akan dikirim ke manager untuk review dan persetujuan publish. Yakin?"
        confirmLabel="Ajukan Publish" />

      <ConfirmModal open={showApprovePublishConfirm} onClose={() => setShowApprovePublishConfirm(false)}
        onConfirm={() => approvePublishMutation.mutate()} loading={approvePublishMutation.isPending}
        title="Setujui Publish"
        description="Kamu telah mereview konten dan hasil task. Plan ini akan berstatus Published. Yakin?"
        confirmLabel="Setujui & Publish" />

      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={data.status === 'pending_publish' ? 'Kembalikan ke Produksi' : 'Tolak Content Plan'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRejectModal(false)}>Batal</Button>
            <Button variant="danger" onClick={() => rejectPlanMutation.mutate()} loading={rejectPlanMutation.isPending}>
              {data.status === 'pending_publish' ? 'Kembalikan' : 'Tolak Plan'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {data.status === 'pending_publish'
              ? 'Plan akan dikembalikan ke tahap produksi. Berikan catatan perbaikan untuk planner.'
              : 'Berikan catatan agar content planner bisa memperbaiki.'}
          </p>
          <Textarea value={rejectionNotes} onChange={e => setRejectionNotes(e.target.value)} placeholder="Catatan..." rows={4} />
        </div>
      </Modal>

      {/* Minta Revisi Modal */}
      <Modal
        open={!!reviseTaskId}
        onClose={() => { setReviseTaskId(null); setReviseNotes(''); }}
        title="Minta Revisi Task"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setReviseTaskId(null); setReviseNotes(''); }}>Batal</Button>
            <Button
              loading={rejectTaskMutation.isPending}
              onClick={() => reviseTaskId && rejectTaskMutation.mutate({ taskId: reviseTaskId, notes: reviseNotes })}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              Kirim Permintaan Revisi
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-gray-600">PIC akan mendapat notifikasi dan diminta untuk submit ulang task ini.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Catatan Revisi <span className="text-gray-400 font-normal">(opsional — jelaskan apa yang perlu diperbaiki)</span>
            </label>
            <Textarea
              value={reviseNotes}
              onChange={e => setReviseNotes(e.target.value)}
              rows={3}
              placeholder="Contoh: Warna background perlu disesuaikan dengan brand guideline..."
            />
          </div>
        </div>
      </Modal>

      {/* Task Submit Modal */}
      <Modal open={!!submitTaskTarget} onClose={() => setSubmitTaskTarget(null)} title={`Submit Task: ${submitTaskTarget?.name ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSubmitTaskTarget(null)} disabled={submittingTask}>Batal</Button>
            <Button onClick={handleTaskSubmit} loading={submittingTask}>Submit</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">File Hasil Kerja</label>
            <input type="file" onChange={e => setSubmitFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-btn file:border-0 file:text-[11px] file:font-semibold file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Catatan (opsional)</label>
            <Textarea value={submitNotes} onChange={e => setSubmitNotes(e.target.value)} rows={3} placeholder="Catatan untuk reviewer..." />
          </div>
        </div>
      </Modal>

      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Hasil Kerja"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowUploadModal(false)} disabled={uploading}>Batal</Button>
            <Button onClick={handleUpload} loading={uploading} disabled={!uploadFile}>
              {uploading ? `Upload ${progress}%` : 'Upload'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipe File</label>
            <select value={uploadFileType} onChange={e => setUploadFileType(e.target.value as 'design' | 'video')}
              className="w-full border border-gray-200 rounded-btn px-3 py-2 text-sm focus:outline-none focus:border-brand bg-white">
              <option value="design">Design</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">File</label>
            <input type="file" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-gray-600" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Catatan (opsional)</label>
            <Textarea value={uploadNotes} onChange={e => setUploadNotes(e.target.value)} rows={2} placeholder="Catatan untuk reviewer..." />
          </div>
          {uploading && (
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-brand h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
