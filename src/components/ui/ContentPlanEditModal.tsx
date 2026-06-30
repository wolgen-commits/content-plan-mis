'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { toast } from 'sonner';
import {
  CONTENT_TYPES, CONTENT_TYPE_LABELS, CONTENT_TYPE_CHANNEL_MAP,
  CHANNELS, WORK_ORDERS,
} from '@/lib/utils';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { ContentPlan } from '@/types';

/* ── Schema ── */
const schema = z.object({
  title:          z.string().min(1, 'Judul wajib diisi'),
  company:       z.string().optional(),
  topic:          z.string().optional(),
  material:       z.string().optional(),
  visual_brief:   z.string().optional(),
  caption:        z.string().optional(),
  scheduled_date: z.string().optional(),
  deadline_date:  z.string().optional(),
  work_order:     z.string().optional(),
  tags:           z.string().optional(),
  references:     z.array(z.object({ url: z.string(), label: z.string() })).optional(),
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
  isExisting?: boolean;
}
interface UserOption { id: string; name: string; role: string; }
interface Props {
  open: boolean;
  onClose: () => void;
  planId: string;
  onSaved?: () => void;
}

/* ── Style helpers ── */
const LBL = 'text-[13px] font-medium text-gray-700 text-left pr-3 leading-none whitespace-nowrap self-center';
const SEC = 'text-[11px] font-bold uppercase tracking-[0.8px] text-gray-500 col-span-full pt-3 pb-1.5 border-b border-gray-200';
function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-danger text-[10px] mt-0.5 leading-none">{msg}</p>;
}

interface ImageStripProps {
  images: { url: string; name: string }[];
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (i: number) => void;
}
function VisualBriefImageStrip({ images, uploading, onUpload, onRemove }: ImageStripProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {images.map((img, i) => (
        <div key={i} className="relative group w-16 h-16 rounded-md overflow-hidden border border-gray-200 flex-shrink-0">
          <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >×</button>
        </div>
      ))}
      <label className={`w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed rounded-md flex-shrink-0 transition-colors cursor-pointer ${
        uploading ? 'border-brand/40 bg-brand/5 cursor-wait' : 'border-gray-300 hover:border-brand hover:bg-brand/5'
      }`}>
        {uploading ? (
          <svg className="animate-spin text-brand" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className="text-[9px] text-gray-400 mt-0.5">Gambar</span>
          </>
        )}
        <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={onUpload} />
      </label>
    </div>
  );
}

const EMPTY_TASK = { name: '', deadline: '', pic: '', pic_user_id: '', reference: '', description: '' };

/* ── Main component ── */
export function ContentPlanEditModal({ open, onClose, planId, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab]           = useState<'info' | 'tasks'>('info');
  const [selectedTypes, setSelectedTypes]   = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [typeError, setTypeError]           = useState('');
  const [channelError, setChannelError]     = useState('');
  const [tasks, setTasks]                   = useState<PlanTask[]>([]);
  const [deletedTaskIds, setDeletedTaskIds] = useState<Set<string>>(new Set());
  const [newTask, setNewTask]               = useState(EMPTY_TASK);
  const [taskErrors, setTaskErrors]         = useState({ name: '', deadline: '' });
  const [visualBriefImages, setVisualBriefImages] = useState<{ url: string; name: string }[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const folderId = useRef('');

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { references: [] },
  });
  const { fields: refFields, append: appendRef, remove: removeRef } = useFieldArray({ control, name: 'references' });

  /* ── Fetch plan ── */
  const { data: plan, isLoading } = useQuery<ContentPlan>({
    queryKey: ['content-plan-edit', planId],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('content_plans')
        .select('*, references:content_references(*), tags:content_tags(*), tasks:content_plan_tasks(id, name, deadline, pic, pic_user_id, reference, description, status)')
        .eq('id', planId)
        .single();
      return data as unknown as ContentPlan;
    },
    enabled: open && !!planId,
  });

  /* ── Fetch users for task PIC ── */
  const { data: userOptions = [] } = useQuery<UserOption[]>({
    queryKey: ['users-for-task-pic'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('users').select('id, name, role')
        .in('role', ['content_planner', 'designer', 'videographer'])
        .order('name');
      return (data ?? []) as UserOption[];
    },
    enabled: open,
  });

  /* ── Populate form when plan loads ── */
  const availableChannels = Array.from(
    new Set(selectedTypes.flatMap(t => CONTENT_TYPE_CHANNEL_MAP[t] ?? []))
  ).filter(ch => CHANNELS.includes(ch as typeof CHANNELS[number]));

  const populateForm = useCallback((p: ContentPlan) => {
    const types = Array.isArray(p.content_type) ? p.content_type : (p.content_type ? [p.content_type] : []);
    const channels = Array.isArray(p.channel) ? p.channel : (p.channel ? [p.channel] : []);
    setSelectedTypes(types as string[]);
    setSelectedChannels(channels as string[]);
    reset({
      title:          p.title,
      company:       p.company ?? '',
      topic:          p.topic ?? '',
      material:       p.material ?? '',
      visual_brief:   p.visual_brief ?? '',
      caption:        p.caption ?? '',
      scheduled_date: p.scheduled_date ?? '',
      deadline_date:  p.deadline_date ?? '',
      work_order:     p.work_order ?? '',
      tags:           p.tags?.map((t: { tag: string }) => t.tag).join(', ') ?? '',
      references:     p.references?.map((r: { url: string; label: string | null }) => ({ url: r.url, label: r.label ?? '' })) ?? [],
    });
    const existingTasks = ((p.tasks ?? []) as PlanTask[]).map(t => ({ ...t, isExisting: true }));
    setTasks(existingTasks);
    setDeletedTaskIds(new Set());
    setVisualBriefImages(p.visual_brief_images ?? []);
    folderId.current = p.id;
  }, [reset]);

  useEffect(() => {
    if (plan) populateForm(plan);
  }, [plan, populateForm]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setActiveTab('info');
      setTypeError('');
      setChannelError('');
      setNewTask(EMPTY_TASK);
      setTaskErrors({ name: '', deadline: '' });
    }
  }, [open]);

  /* ── Mutations ── */
  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/content-plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message ?? 'Gagal menyimpan'); }
      return res.json();
    },
    onSuccess: async () => {
      const supabase = getSupabaseBrowser();
      // Delete removed tasks
      if (deletedTaskIds.size > 0) {
        await supabase.from('content_plan_tasks').delete().in('id', Array.from(deletedTaskIds));
      }
      // Insert new tasks
      const newTasks = tasks.filter(t => !t.isExisting);
      if (newTasks.length > 0) {
        await supabase.from('content_plan_tasks').insert(
          newTasks.map(t => ({
            content_plan_id: planId,
            name: t.name,
            deadline: t.deadline,
            pic: t.pic || null,
            pic_user_id: t.pic_user_id || null,
            reference: t.reference || null,
            description: t.description || null,
          }))
        );
      }
      toast.success('Content plan berhasil diupdate!');
      queryClient.invalidateQueries({ queryKey: ['content-plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
      onSaved?.();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setImageUploading(true);
    try {
      for (const file of files) {
        const res = await fetch('/api/storage/visual-brief-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder_id: folderId.current || planId, file_name: file.name, content_type: file.type }),
        });
        if (!res.ok) throw new Error('Gagal mendapatkan URL upload');
        const { signed_url, public_url } = await res.json();
        await fetch(signed_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        setVisualBriefImages(prev => [...prev, { url: public_url, name: file.name }]);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  }

  function toggleType(type: string) {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(next);
    setTypeError('');
    const stillAvailable = new Set(next.flatMap(t => CONTENT_TYPE_CHANNEL_MAP[t] ?? []));
    setSelectedChannels(prev => prev.filter(ch => stillAvailable.has(ch)));
  }

  function toggleChannel(ch: string) {
    setSelectedChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
    setChannelError('');
  }

  function addTask() {
    const errs = { name: '', deadline: '' };
    if (!newTask.name.trim()) errs.name = 'Nama task wajib diisi';
    if (!newTask.deadline)    errs.deadline = 'Deadline wajib diisi';
    setTaskErrors(errs);
    if (errs.name || errs.deadline) return;
    setTasks(prev =>
      [...prev, { id: crypto.randomUUID(), ...newTask, isExisting: false }]
        .sort((a, b) => a.deadline.localeCompare(b.deadline))
    );
    setNewTask(EMPTY_TASK);
    setTaskErrors({ name: '', deadline: '' });
  }

  function removeTask(task: PlanTask) {
    if (task.isExisting) {
      setDeletedTaskIds(prev => { const next = new Set(Array.from(prev)); next.add(task.id); return next; });
    }
    setTasks(prev => prev.filter(t => t.id !== task.id));
  }

  function onSubmit(values: FormData) {
    let valid = true;
    if (selectedTypes.length === 0) { setTypeError('Pilih minimal 1 tipe konten'); valid = false; }
    if (selectedChannels.length === 0) { setChannelError('Pilih minimal 1 channel'); valid = false; }
    if (!valid) { setActiveTab('info'); return; }
    const tags = values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const references = (values.references ?? []).filter(r => r.url.trim());
    mutation.mutate({
      title:          values.title,
      company:       values.company || null,
      content_type:   selectedTypes,
      channel:        selectedChannels,
      topic:          values.topic || null,
      material:       values.material || null,
      visual_brief:        values.visual_brief || null,
      visual_brief_images: visualBriefImages.length ? visualBriefImages : null,
      caption:             values.caption || null,
      scheduled_date: values.scheduled_date || null,
      deadline_date:  values.deadline_date || null,
      work_order:     values.work_order || null,
      tags,
      references,
    });
  }

  if (!open) return null;

  const visibleTasks = tasks;
  const taskCount    = visibleTasks.length;

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
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Edit Konten Marketing</h2>
              <p className="text-[12px] text-gray-500 mt-0.5">Ubah data rencana konten</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl leading-none">×</button>
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex mx-6 mt-3 mb-0 border border-gray-200 rounded-md overflow-hidden flex-shrink-0">
          {(['info', 'tasks'] as const).map(tab => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-[12px] font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-brand text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 bg-white'
              }`}>
              {tab === 'info' ? 'Informasi Konten' : `Tasks${taskCount > 0 ? ` (${taskCount})` : ''}`}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-[13px] text-gray-400">Memuat data...</div>
          ) : (
            <>
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

                    <span className={LBL}>Perusahaan</span>
                    <Select {...register('company')}>
                      <option value="">Pilih...</option>
                      <option value="Magenta">Magenta</option>
                      <option value="Putrama">Putrama</option>
                    </Select>

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

                    <span className={LBL}>Deadline Plan</span>
                    <Input type="date" {...register('deadline_date')} />

                    <span className={LBL}>Work Order</span>
                    <Select {...register('work_order')}>
                      <option value="">Tidak ditentukan</option>
                      {WORK_ORDERS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                    </Select>

                    <p className={SEC}>Konten</p>

                    <span className={`${LBL} self-start pt-[9px]`}>Topik / Angle</span>
                    <Textarea {...register('topic')} placeholder="Topik atau angle konten..." rows={2} />

                    <span className={`${LBL} self-start pt-[9px]`}>Materi</span>
                    <Textarea {...register('material')} placeholder="Deskripsi materi yang akan dibuat..." rows={2} />

                    <span className={`${LBL} self-start pt-[9px]`}>Visual Brief</span>
                    <Textarea {...register('visual_brief')} placeholder="Arahan visual untuk desainer/videografer..." rows={2} />

                    <span />
                    <VisualBriefImageStrip
                      images={visualBriefImages}
                      uploading={imageUploading}
                      onUpload={handleImageUpload}
                      onRemove={i => setVisualBriefImages(prev => prev.filter((_, idx) => idx !== i))}
                    />

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

                      <span className={LBL}>Nama Task <span className="text-danger">*</span></span>
                      <div>
                        <Select value={newTask.name}
                          onChange={e => {
                            const name = e.target.value;
                            let autoPic = ''; let autoPicUserId = '';
                            if (name === 'Design') {
                              const d = userOptions.find(u => u.role === 'designer');
                              if (d) { autoPic = d.name; autoPicUserId = d.id; }
                            } else if (name === 'Photo' || name === 'Video') {
                              const v = userOptions.find(u => u.role === 'videographer');
                              if (v) { autoPic = v.name; autoPicUserId = v.id; }
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

                      <span className={LBL}>PIC</span>
                      <Select value={newTask.pic_user_id}
                        onChange={e => {
                          const selected = userOptions.find(u => u.id === e.target.value);
                          setNewTask(p => ({ ...p, pic_user_id: e.target.value, pic: selected?.name ?? '' }));
                        }}>
                        <option value="">Pilih PIC...</option>
                        {['content_planner', 'designer', 'videographer'].map(role => {
                          const group = userOptions.filter(u => u.role === role);
                          if (!group.length) return null;
                          const roleLabel = role === 'content_planner' ? 'Planner' : role === 'designer' ? 'Designer' : 'Videografer';
                          return (
                            <optgroup key={role} label={roleLabel}>
                              {group.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </optgroup>
                          );
                        })}
                      </Select>

                      <span className={LBL}>Referensi</span>
                      <Input value={newTask.reference}
                        onChange={e => setNewTask(p => ({ ...p, reference: e.target.value }))}
                        placeholder="Link atau catatan referensi" />

                      <span className={`${LBL} self-start pt-[9px]`}>Hasil Kerja</span>
                      <div className="col-span-3">
                        <Textarea value={newTask.description}
                          onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                          placeholder="Deskripsi hasil kerja yang diharapkan (opsional)"
                          rows={2} />
                      </div>

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

                  {/* Daftar tasks */}
                  <div>
                    <p className="text-[12px] font-semibold text-gray-700 mb-2">Daftar Tasks ({taskCount})</p>
                    {visibleTasks.length === 0 ? (
                      <div className="border border-gray-200 rounded-card p-6 text-center text-[12px] text-gray-400">
                        Belum ada task. Tambahkan task untuk konten ini.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {visibleTasks.map((task, i) => (
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
                            <button type="button" onClick={() => removeTask(task)}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-danger transition-all text-lg leading-none flex-shrink-0"
                              title="Hapus task">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
          <Button variant="ghost" type="button" onClick={onClose} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button type="button" onClick={handleSubmit(onSubmit)} loading={mutation.isPending}>
            Simpan Perubahan
          </Button>
        </div>
      </div>
    </div>
  );
}
