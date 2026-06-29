'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { toast } from 'sonner';
import { CONTENT_TYPES, CHANNELS, WORK_ORDERS } from '@/lib/utils';
import { ContentPlan } from '@/types';
import Link from 'next/link';

const schema = z.object({
  title: z.string().min(1, 'Judul wajib diisi'),
  content_type: z.string().min(1),
  channel: z.string().min(1),
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

export default function EditContentPlanPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['content-plan', params.id],
    queryFn: async () => {
      const res = await fetch(`/api/content-plans/${params.id}`);
      const json = await res.json();
      return json.data as ContentPlan;
    },
  });

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { references: [] },
  });

  const { fields: refFields, append: appendRef, remove: removeRef } = useFieldArray({
    control, name: 'references',
  });

  useEffect(() => {
    if (data) {
      reset({
        title: data.title,
        content_type: Array.isArray(data.content_type) ? data.content_type.join(',') : (data.content_type ?? ''),
        channel: Array.isArray(data.channel) ? data.channel.join(',') : (data.channel ?? ''),
        topic: data.topic ?? '',
        material: data.material ?? '',
        visual_brief: data.visual_brief ?? '',
        caption: data.caption ?? '',
        scheduled_date: data.scheduled_date ?? '',
        deadline_date: data.deadline_date ?? '',
        work_order: data.work_order ?? '',
        tags: data.tags?.map((t: { tag: string }) => t.tag).join(', ') ?? '',
        references: data.references?.map((r: { url: string; label: string | null }) => ({
          url: r.url, label: r.label ?? '',
        })) ?? [],
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/content-plans/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Gagal menyimpan');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Content plan berhasil diupdate!');
      queryClient.invalidateQueries({ queryKey: ['content-plan', params.id] });
      router.push(`/content-plans/${params.id}`);
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
    });
  }

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Memuat...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/content-plans/${params.id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Kembali</Link>
        <h1 className="text-xl font-semibold text-gray-900">Edit Content Plan</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-card shadow-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Informasi Dasar</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Judul <span className="text-danger">*</span></label>
            <Input {...register('title')} placeholder="Judul konten..." />
            {errors.title && <p className="text-danger text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipe Konten</label>
              <Select {...register('content_type')}>
                <option value="">Pilih tipe...</option>
                {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Channel</label>
              <Select {...register('channel')}>
                <option value="">Pilih channel...</option>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Materi</label>
            <Textarea {...register('material')} placeholder="Deskripsi materi..." rows={3} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Visual Brief</label>
            <Textarea {...register('visual_brief')} placeholder="Arahan visual..." rows={3} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Caption</label>
            <Textarea {...register('caption')} placeholder="Draft caption..." rows={3} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
            <Input {...register('tags')} placeholder="Pisahkan dengan koma: marketing, promo" />
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

        <div className="flex justify-end gap-3">
          <Link href={`/content-plans/${params.id}`}>
            <Button variant="secondary" type="button">Batal</Button>
          </Link>
          <Button type="submit" loading={mutation.isPending}>Simpan Perubahan</Button>
        </div>
      </form>
    </div>
  );
}
