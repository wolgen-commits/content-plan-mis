'use client';
import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { toast } from 'sonner';
import { CONTENT_TYPES, CONTENT_TYPE_LABELS, CONTENT_TYPE_CHANNEL_MAP, CHANNELS } from '@/lib/utils';
import { getSupabaseBrowser } from '@/lib/supabase/client';

/* ── Schema ── */
const schema = z.object({
  title: z.string().min(1, 'Judul wajib diisi'),
  company: z.string().min(1, 'Perusahaan wajib dipilih'),
  topic: z.string().optional(),
  material: z.string().optional(),
  visual_brief: z.string().optional(),
  caption: z.string().optional(),
  scheduled_date: z.string().optional(),
  tags: z.string().optional(),
  references: z.array(z.object({ url: z.string(), label: z.string() })).optional(),
});
type FormData = z.infer<typeof schema>;

/* ── Types ── */
interface PlanTask {
  id: string;
  name: string;
  deadline: string;
  pic: string;
  pic_user_id: string;
  reference: string;
  description: string;
}

interface UserOption { id: string; name: string; role: string; }
interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

/* ── Style helpers ── */
const LBL = 'text-[13px] font-medium text-gray-700 text-left pr-3 leading-none whitespace-nowrap self-center';
const SEC = 'text-[11px] font-bold uppercase tracking-[0.8px] text-gray-500 col-span-full pt-3 pb-1.5 border-b border-gray-200';

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-danger text-[10px] mt-0.5 leading-none">{msg}</p>;
}

const EMPTY_TASK = { name: '', deadline: '', pic: '', pic_user_id: '', reference: '', description: '' };

/* ── Main component ── */
export function ContentPlanFormModal({ open, onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'tasks'>('info');
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [newTask, setNewTask] = useState(EMPTY_TASK);
  const [taskErrors, setTaskErrors] = useState({ name: '', deadline: '' });
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [typeError, setTypeError] = useState('');
  const [channelError, setChannelError] = useState('');

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { references: [] },
  });

  const { data: userOptions = [] } = useQuery<UserOption[]>({
    queryKey: ['users-for-task-pic'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('users')
        .select('id, name, role')
        .in('role', ['content_planner', 'designer', 'videographer'])
        .order('name');
      return (data ?? []) as UserOption[];
    },
    enabled: open,
  });

  // Channel yang tersedia = union dari semua tipe yang dipilih
  const availableChannels = Array.from(
    new Set(selectedTypes.flatMap(t => CONTENT_TYPE_CHANNEL_MAP[t] ?? []))
  ).filter(ch => CHANNELS.includes(ch as typeof CHANNELS[number]));
  const { fields: refFields, append: appendRef, remove: removeRef } = useFieldArray({
    control, name: 'references',
  });

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/content-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message ?? 'Gagal menyimpan'); }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success('Content plan berhasil dibuat!');
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
      handleReset();
      onClose();
      onCreated?.(data.data.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleReset() {
    reset();
    setTasks([]);
    setNewTask(EMPTY_TASK);
    setTaskErrors({ name: '', deadline: '' });
    setSelectedTypes([]);
    setSelectedChannels([]);
    setTypeError('');
    setChannelError('');
    setActiveTab('info');
  }

  function toggleType(type: string) {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(next);
    setTypeError('');
    // hapus channel yang tidak lagi tersedia
    const stillAvailable = new Set(next.flatMap(t => CONTENT_TYPE_CHANNEL_MAP[t] ?? []));
    setSelectedChannels(prev => prev.filter(ch => stillAvailable.has(ch)));
  }

  function toggleChannel(ch: string) {
    setSelectedChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
    setChannelError('');
  }

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => { if (!open) handleReset(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(values: FormData) {
    let valid = true;
    if (selectedTypes.length === 0) { setTypeError('Pilih minimal 1 tipe konten'); valid = false; }
    if (selectedChannels.length === 0) { setChannelError('Pilih minimal 1 channel'); valid = false; }
    if (!valid) { setActiveTab('info'); return; }
    const tags = values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const references = (values.references ?? []).filter(r => r.url.trim());
    mutation.mutate({
      title: values.title,
      company: values.company,
      content_type: selectedTypes,
      channel: selectedChannels,
      topic: values.topic || null, material: values.material || null,
      visual_brief: values.visual_brief || null, caption: values.caption || null,
      scheduled_date: values.scheduled_date || null,
      tags, references,
      tasks: tasks.map(t => ({
        name: t.name, deadline: t.deadline,
        pic: t.pic || null, pic_user_id: t.pic_user_id || null,
        reference: t.reference || null, description: t.description || null,
      })),
    });
  }

  function addTask() {
    const errs = { name: '', deadline: '' };
    if (!newTask.name.trim()) errs.name = 'Nama task wajib diisi';
    if (!newTask.deadline) errs.deadline = 'Deadline wajib diisi';
    setTaskErrors(errs);
    if (errs.name || errs.deadline) return;
    // Sisipkan task terurut berdasarkan deadline (paling awal → paling atas)
    setTasks(prev =>
      [...prev, { id: crypto.randomUUID(), ...newTask }]
        .sort((a, b) => a.deadline.localeCompare(b.deadline))
    );
    setNewTask(EMPTY_TASK);
    setTaskErrors({ name: '', deadline: '' });
  }

  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        className="relative bg-white rounded-card shadow-2xl flex flex-col"
        style={{ width: '40vw', maxHeight: '85vh', minWidth: 420 }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BB2649" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Tambah Konten Marketing</h2>
              <p className="text-[12px] text-gray-500 mt-0.5">Isi data rencana konten baru</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl leading-none"
          >×</button>
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex mx-6 mt-3 mb-0 border border-gray-200 rounded-md overflow-hidden flex-shrink-0">
          {(['info', 'tasks'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-[12px] font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-brand text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 bg-white'
              }`}
            >
              {tab === 'info' ? 'Informasi Konten' : `Tasks${tasks.length > 0 ? ` (${tasks.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* ══ TAB 1: Informasi Konten ══ */}
          {activeTab === 'info' && (
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-center">

                <p className={SEC}>Informasi Dasar</p>

                <span className={LBL}>Judul <span className="text-danger">*</span></span>
                <div>
                  <Input {...register('title')} placeholder="Judul konten..." />
                  <Err msg={errors.title?.message} />
                </div>

                <span className={LBL}>Perusahaan <span className="text-danger">*</span></span>
                <div>
                  <Select {...register('company')}>
                    <option value="">Pilih...</option>
                    <option value="Magenta">Magenta</option>
                    <option value="Putrama">Putrama</option>
                  </Select>
                  <Err msg={errors.company?.message} />
                </div>

                <span className={`${LBL} self-start pt-1`}>Tipe Konten <span className="text-danger">*</span></span>
                <div className="self-start">
                  <div className="flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-none">
                    {CONTENT_TYPES.map(type => {
                      const active = selectedTypes.includes(type);
                      return (
                        <button key={type} type="button" onClick={() => toggleType(type)}
                          className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                            active ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-300 hover:border-brand hover:text-brand'
                          }`}>
                          {CONTENT_TYPE_LABELS[type] ?? type}
                        </button>
                      );
                    })}
                  </div>
                  {typeError && <p className="text-danger text-[10px] mt-1 leading-none">{typeError}</p>}
                </div>

                <span className={`${LBL} self-start pt-1`}>Channel <span className="text-danger">*</span></span>
                <div className="self-start">
                  {availableChannels.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic py-1">Pilih tipe konten dulu</p>
                  ) : (
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                      {availableChannels.map(ch => {
                        const active = selectedChannels.includes(ch);
                        return (
                          <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                              active ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-300 hover:border-brand hover:text-brand'
                            }`}>
                            {ch}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {channelError && <p className="text-danger text-[10px] mt-1 leading-none">{channelError}</p>}
                </div>

                <span className={LBL}>Tanggal Tayang</span>
                <Input type="date" {...register('scheduled_date')} />

                <p className={SEC}>Konten</p>

                <span className={`${LBL} self-start pt-[9px]`}>Topik / Angle</span>
                <Textarea {...register('topic')} placeholder="Topik atau angle konten..." rows={2} />

                <span className={`${LBL} self-start pt-[9px]`}>Materi</span>
                <Textarea {...register('material')} placeholder="Deskripsi materi yang akan dibuat..." rows={2} />

                <span className={`${LBL} self-start pt-[9px]`}>Visual Brief</span>
                <Textarea {...register('visual_brief')} placeholder="Arahan visual untuk desainer/videografer..." rows={2} />

                <span className={`${LBL} self-start pt-[9px]`}>Caption</span>
                <Textarea {...register('caption')} placeholder="Draft caption..." rows={2} />

                <span className={LBL}>Tags</span>
                <Input {...register('tags')} placeholder="marketing, promo, brand" />

                <p className={SEC}>Referensi</p>

                {refFields.length === 0 ? (
                  <>
                    <span className={LBL} />
                    <div>
                      <Button type="button" variant="secondary" size="sm"
                        onClick={() => appendRef({ url: '', label: '' })}>
                        + Tambah Referensi
                      </Button>
                    </div>
                  </>
                ) : refFields.map((field, i) => (
                  <>
                    <span key={`lbl-${field.id}`} className={LBL}>URL {i + 1}</span>
                    <div key={`url-${field.id}`} className="flex gap-2 items-center">
                      <Input {...register(`references.${i}.url`)} placeholder="https://..." className="flex-1" />
                      <Input {...register(`references.${i}.label`)} placeholder="Label" className="w-32" />
                      <button type="button" onClick={() => removeRef(i)}
                        className="text-danger hover:text-danger/80 w-7 flex-shrink-0 text-lg leading-none">×</button>
                      {i === refFields.length - 1 && (
                        <Button type="button" variant="secondary" size="sm"
                          onClick={() => appendRef({ url: '', label: '' })}>+</Button>
                      )}
                    </div>
                  </>
                ))}
              </div>
            </form>
          )}

          {/* ══ TAB 2: Tasks ══ */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">

              {/* Form tambah task */}
              <div className="border border-gray-200 rounded-card p-4">
                <p className="text-[12px] font-semibold text-gray-700 mb-2">Tambah Task Baru</p>
                <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-1 items-center">

                  {/* Baris 1: Nama Task | Deadline */}
                  <span className={LBL}>Nama Task <span className="text-danger">*</span></span>
                  <div>
                    <Select value={newTask.name}
                      onChange={e => {
                        const name = e.target.value;
                        let autoPic = '';
                        let autoPicUserId = '';
                        if (name === 'Design') {
                          const designer = userOptions.find(u => u.role === 'designer');
                          if (designer) { autoPic = designer.name; autoPicUserId = designer.id; }
                        } else if (name === 'Photo' || name === 'Video') {
                          const videographer = userOptions.find(u => u.role === 'videographer');
                          if (videographer) { autoPic = videographer.name; autoPicUserId = videographer.id; }
                        }
                        setNewTask(p => ({ ...p, name, pic: autoPic, pic_user_id: autoPicUserId }));
                      }}>
                      <option value="">Pilih task...</option>
                      <option value="Design">Design</option>
                      <option value="Photo">Photo</option>
                      <option value="Video">Video</option>
                    </Select>
                    {taskErrors.name && <p className="text-danger text-[10px] mt-0.5 leading-none">{taskErrors.name}</p>}
                  </div>
                  <span className={LBL}>Deadline <span className="text-danger">*</span></span>
                  <div>
                    <Input type="date" value={newTask.deadline}
                      onChange={e => setNewTask(p => ({ ...p, deadline: e.target.value }))} />
                    {taskErrors.deadline && <p className="text-danger text-[10px] mt-0.5 leading-none">{taskErrors.deadline}</p>}
                  </div>

                  {/* Baris 2: PIC | Referensi */}
                  <span className={LBL}>PIC</span>
                  <Select
                    value={newTask.pic_user_id}
                    onChange={e => {
                      const selected = userOptions.find(u => u.id === e.target.value);
                      setNewTask(p => ({
                        ...p,
                        pic_user_id: e.target.value,
                        pic: selected?.name ?? '',
                      }));
                    }}
                  >
                    <option value="">Pilih PIC...</option>
                    {['content_planner', 'designer', 'videographer'].map(role => {
                      const group = userOptions.filter(u => u.role === role);
                      if (!group.length) return null;
                      const roleLabel = role === 'content_planner' ? 'Planner' : role === 'designer' ? 'Designer' : 'Videografer';
                      return (
                        <optgroup key={role} label={roleLabel}>
                          {group.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </Select>
                  <span className={LBL}>Referensi</span>
                  <Input value={newTask.reference}
                    onChange={e => setNewTask(p => ({ ...p, reference: e.target.value }))}
                    placeholder="Link atau catatan referensi" />

                  {/* Baris 3: Hasil Kerja — span 3 kolom */}
                  <span className={`${LBL} self-start pt-[9px]`}>Hasil Kerja</span>
                  <div className="col-span-3">
                    <Textarea value={newTask.description}
                      onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                      placeholder="Deskripsi hasil kerja yang diharapkan (opsional)"
                      rows={2} />
                  </div>

                  {/* Tombol tambah */}
                  <span className={LBL} />
                  <div className="col-span-3 pt-1">
                    <button type="button" onClick={addTask}
                      className="w-full flex items-center justify-center gap-2 h-9 rounded-btn bg-brand hover:bg-brand-hover text-white text-[13px] font-semibold transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Tambah Task
                    </button>
                  </div>
                </div>
              </div>

              {/* Daftar tasks — terurut deadline terdekat di atas */}
              <div>
                <p className="text-[12px] font-semibold text-gray-700 mb-2">
                  Daftar Tasks ({tasks.length})
                </p>
                {tasks.length === 0 ? (
                  <div className="border border-gray-200 rounded-card p-6 text-center text-[12px] text-gray-400">
                    Belum ada task. Tambahkan task untuk konten ini.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {tasks.map((task, i) => (
                      <div key={task.id}
                        className="flex items-start gap-3 border border-gray-200 rounded-card px-4 py-2.5 group hover:bg-gray-50 transition-colors">
                        <span className="w-5 h-5 rounded-full bg-brand/10 text-brand text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-4 gap-y-0.5">
                          <div>
                            <p className="text-[10px] text-gray-400 leading-none">Nama Task</p>
                            <p className="text-[12px] font-medium text-gray-800 mt-0.5">{task.name}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 leading-none">Deadline</p>
                            <p className="text-[12px] font-mono text-gray-700 mt-0.5">{task.deadline}</p>
                          </div>
                          {task.pic && (
                            <div>
                              <p className="text-[10px] text-gray-400 leading-none">PIC</p>
                              <p className="text-[12px] text-gray-700 mt-0.5">{task.pic}</p>
                            </div>
                          )}
                          {task.reference && (
                            <div>
                              <p className="text-[10px] text-gray-400 leading-none">Referensi</p>
                              <p className="text-[12px] text-gray-700 mt-0.5 truncate">{task.reference}</p>
                            </div>
                          )}
                          {task.description && (
                            <div className="col-span-2">
                              <p className="text-[10px] text-gray-400 leading-none">Hasil Kerja</p>
                              <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={() => removeTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-danger transition-all text-lg leading-none flex-shrink-0"
                          title="Hapus task">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
          <Button variant="ghost" type="button" onClick={onClose} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button type="button" onClick={handleSubmit(onSubmit)} loading={mutation.isPending}>
            Simpan Plan
          </Button>
        </div>
      </div>
    </div>
  );
}
