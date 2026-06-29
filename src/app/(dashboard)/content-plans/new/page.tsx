'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { toast } from 'sonner';
import { CONTENT_TYPES, CHANNELS, WORK_ORDERS } from '@/lib/utils';
import { User } from '@/types';
import Link from 'next/link';

const schema = z.object({
  title: z.string().min(1, 'Judul wajib diisi'),
  content_type: z.string().min(1, 'Tipe konten wajib diisi'),
  channel: z.string().min(1, 'Channel wajib diisi'),
  topic: z.string().optional(),
  material: z.string().optional(),
  visual_brief: z.string().optional(),
  caption: z.string().optional(),
  scheduled_date: z.string().optional(),
  deadline_date: z.string().optional(),
  work_order: z.string().optional(),
  tags: z.string().optional(),
  references: z.array(z.object({ url: z.string(), label: z.string() })).optional(),
});

type FormData = z.infer<typeof schema>;

const TODAY = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

export default function NewContentPlanPage() {
  const router = useRouter();
  const [selectedAssignees, setSelectedAssignees] = useState<{ user_id: string; role: string; name: string }[]>([]);

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { references: [] },
  });

  const { fields: refFields, append: appendRef, remove: removeRef } = useFieldArray({
    control, name: 'references',
  });

  const { data: creatives = [] } = useQuery({
    queryKey: ['users', 'creatives'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('users')
        .select('id, name, role')
        .in('role', ['designer', 'videographer'])
        .order('name');
      return (data ?? []) as User[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/content-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Gagal menyimpan');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success('Content plan berhasil dibuat!');
      router.push(`/content-plans/${data.data.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onSubmit(values: FormData) {
    const tags = values.tags
      ? values.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    const references = (values.references ?? []).filter(r => r.url.trim());

    mutation.mutate({
      title: values.title,
      content_type: values.content_type,
      channel: values.channel,
      topic: values.topic || null,
      material: values.material || null,
      visual_brief: values.visual_brief || null,
      caption: values.caption || null,
      scheduled_date: values.scheduled_date || null,
      deadline_date: values.deadline_date || null,
      work_order: values.work_order || null,
      tags,
      references,
      assignees: selectedAssignees.map(a => ({ user_id: a.user_id, role: a.role })),
    });
  }

  function toggleAssignee(user: User) {
    setSelectedAssignees(prev => {
      const exists = prev.find(a => a.user_id === user.id);
      if (exists) return prev.filter(a => a.user_id !== user.id);
      return [...prev, { user_id: user.id, role: user.role, name: user.name }];
    });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/content-plans" className="text-gray-400 hover:text-gray-600 text-sm">← Kembali</Link>
        <h1 className="text-xl font-semibold text-gray-900">Buat Content Plan Baru</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-card shadow-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Informasi Dasar</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal Dibuat</label>
            <div className="px-3 py-2 border border-gray-100 rounded-btn bg-gray-50 text-[13px] text-gray-500 select-none">
              {TODAY}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Judul <span className="text-danger">*</span></label>
            <Input {...register('title')} placeholder="Judul konten..." />
            {errors.title && <p className="text-danger text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipe Konten <span className="text-danger">*</span></label>
              <Select {...register('content_type')}>
                <option value="">Pilih tipe...</option>
                {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
              {errors.content_type && <p className="text-danger text-xs mt-1">{errors.content_type.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Channel <span className="text-danger">*</span></label>
              <Select {...register('channel')}>
                <option value="">Pilih channel...</option>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              {errors.channel && <p className="text-danger text-xs mt-1">{errors.channel.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal Tayang</label>
              <Input type="date" {...register('scheduled_date')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Deadline</label>
              <Input type="date" {...register('deadline_date')} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Work Order</label>
            <Select {...register('work_order')}>
              <option value="">Tidak ditentukan</option>
              {WORK_ORDERS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="bg-white rounded-card shadow-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Konten</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Topik / Angle</label>
            <Textarea {...register('topic')} placeholder="Topik atau angle konten..." rows={2} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Materi / Referensi Konten</label>
            <Textarea {...register('material')} placeholder="Deskripsi materi yang akan dibuat..." rows={3} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Visual Brief</label>
            <Textarea {...register('visual_brief')} placeholder="Arahan visual untuk desainer/videografer..." rows={3} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Caption</label>
            <Textarea {...register('caption')} placeholder="Draft caption..." rows={3} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
            <Input {...register('tags')} placeholder="Pisahkan dengan koma: marketing, promo, brand" />
          </div>
        </div>

        <div className="bg-white rounded-card shadow-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Referensi</h2>
          {refFields.map((field, i) => (
            <div key={field.id} className="flex gap-2">
              <Input {...register(`references.${i}.url`)} placeholder="https://..." className="flex-1" />
              <Input {...register(`references.${i}.label`)} placeholder="Label (opsional)" className="w-40" />
              <button type="button" onClick={() => removeRef(i)} className="text-danger text-sm px-2">×</button>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm"
            onClick={() => appendRef({ url: '', label: '' })}>
            + Tambah Referensi
          </Button>
        </div>

        <div className="bg-white rounded-card shadow-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Assign Tim Kreatif</h2>
          {creatives.length === 0 ? (
            <p className="text-sm text-gray-400">Tidak ada user kreatif tersedia.</p>
          ) : (
            <div className="space-y-2">
              {creatives.map(u => (
                <label key={u.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-btn">
                  <input
                    type="checkbox"
                    checked={selectedAssignees.some(a => a.user_id === u.id)}
                    onChange={() => toggleAssignee(u)}
                    className="accent-brand"
                  />
                  <span className="text-sm text-gray-700">{u.name}</span>
                  <span className="text-xs text-gray-400 capitalize">{u.role.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/content-plans">
            <Button variant="secondary" type="button">Batal</Button>
          </Link>
          <Button type="submit" loading={mutation.isPending}>Simpan Plan</Button>
        </div>
      </form>
    </div>
  );
}
