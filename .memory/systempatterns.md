# System Patterns & Conventions

## Backend (Laravel 11)

### Controller Pattern
- Semua controller di `app/Http/Controllers/Api/V1/`
- Return JSON, gunakan `response()->json()`
- Status HTTP semantik: 200, 201, 422, 403, 404
- Error validation: `$request->validate([...])` — Laravel auto-return 422

### Model Convention
- Semua model pakai UUID PK: gunakan trait `HasUuids`
- `$fillable` array eksplisit, tidak pakai `$guarded`
- Relationships di-eager load di controller, bukan di model `$with`
- Date fields (`scheduled_date`, `deadline_date`) di-cast ke `'date'`

### Auth Pattern
- Pure Bearer token via Laravel Sanctum
- `auth:sanctum` middleware untuk semua route terproteksi
- `role` middleware (alias `CheckRole`) menerima variadic roles: `role:admin,content_planner`
- **TIDAK** menggunakan `statefulApi()` — sudah dihapus dari `bootstrap/app.php`

### Notification Pattern
- Semua notifikasi melalui `NotificationService::notify()`
- Bulk insert ke tabel `notifications`
- Supabase Realtime mendeliver ke frontend secara real-time

### Storage Pattern
- `StorageService::createSignedUploadUrl()` memanggil Supabase REST API
- Menggunakan `SUPABASE_SERVICE_ROLE_KEY` untuk bypass RLS
- Path format: `submissions/{planId}/{fileType}/{timestamp}_{fileName}`

---

## Frontend (Next.js 14)

### File & Component Rules
- Semua page component: `"use client"` di baris pertama
- Import path alias: `@/` untuk `src/`
- Tidak ada `any` type kecuali untuk `useFieldArray` fields (gunakan eslint-disable comment)

### API Call Pattern
```typescript
// Selalu gunakan instance dari src/lib/api.ts (bukan fetch langsung)
import api from "@/lib/api";
const { data } = await api.get("/content-plans");
```

### Data Fetching Pattern
```typescript
// Server state: TanStack React Query
const { data, isLoading } = useQuery({
  queryKey: ["content-plans", filter1, filter2],
  queryFn: () => api.get("/content-plans").then(r => r.data),
});

// Mutation dengan invalidate
const mutation = useMutation({
  mutationFn: (data) => api.post("/content-plans", data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["content-plans"] });
    toast.success("Berhasil!");
  },
  onError: (err) => toast.error(err.response?.data?.message ?? "Gagal."),
});
```

### Auth State Pattern
```typescript
// Baca dari Zustand store
const user = useAuthStore(s => s.user);
const { setAuth, clearAuth } = useAuthStore();
```

### Hook Rules
- **WAJIB:** semua hooks dipanggil sebelum early return (React rules of hooks)
- Jika ada guard (role check, dll) → pindahkan guard ke BAWAH semua hook declarations
- Gunakan `enabled: isAdmin` pada `useQuery` untuk query conditional

### Error Handling Pattern
```typescript
// Hindari `any`, gunakan tipe spesifik untuk error
onError: (err: { response?: { data?: { message?: string } } }) =>
  toast.error(err.response?.data?.message ?? "Terjadi kesalahan.");

// Untuk catch block:
} catch (err: unknown) {
  toast.error(err instanceof Error ? err.message : "Gagal.");
}
```

### Component Patterns

#### Status & Channel Badge
```typescript
import { StatusBadge, ChannelBadge } from "@/components/ui/Badge";
<StatusBadge status={plan.status} />
<ChannelBadge channel={plan.channel} />
```

#### Modal dengan Footer
```typescript
<Modal open={open} onClose={onClose} title="..." size="md"
  footer={
    <>
      <Button variant="ghost" onClick={onClose}>Batal</Button>
      <Button variant="primary" loading={isPending}>Simpan</Button>
    </>
  }
>
  {/* content */}
</Modal>
```

#### Confirm Delete
```typescript
<ConfirmModal
  open={!!deleteId}
  onClose={() => setDeleteId(null)}
  onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
  loading={deleteMutation.isPending}
  title="Hapus ..."
  description="Tindakan ini tidak dapat diundur."
  confirmLabel="Hapus"
  danger
/>
```

### Tailwind Class Conventions

Selalu gunakan design token, jangan hardcode warna:
```
✓  text-brand         ✗  text-[#BB2649]
✓  bg-danger-light    ✗  bg-red-100
✓  rounded-card       ✗  rounded-[10px]
✓  rounded-btn        ✗  rounded-md
```

Status row colors di tabel:
```typescript
className={cn(
  "border-b border-gray-100 hover:bg-gray-50",
  plan.status === "rejected" && "bg-danger-faint",
  plan.status === "pending_approval" && "bg-warning-faint",
)}
```

### useFieldArray Pattern (untuk assignees/references)
```typescript
// useFieldArray fields tidak expose custom props secara langsung
// Gunakan eslint-disable untuk findIndex/some dengan field props:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const idx = assigneeFields.findIndex((f: any) => f.user_id === userId);
```

---

## Database Conventions

- Semua PK: `UUID DEFAULT gen_random_uuid()`
- Semua tabel punya `created_at TIMESTAMP DEFAULT NOW()`
- Tabel junction (assignees) punya `UNIQUE(content_plan_id, user_id)`
- Foreign keys dengan `ON DELETE CASCADE` untuk child records
- Foreign keys dengan `ON DELETE RESTRICT` untuk pemilik utama
- RLS diaktifkan di semua tabel; Laravel pakai service role key (bypass RLS)

---

## Supabase Realtime

Untuk mengaktifkan:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE content_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

Subscribe pattern:
```typescript
supabase
  .channel('unique-channel-name')
  .on('postgres_changes', {
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    schema: 'public',
    table: 'table_name',
    filter: 'column=eq.value',   // opsional
  }, (payload) => { /* handle */ })
  .subscribe();
```

---

## Naming Conventions

| Context | Convention | Contoh |
|---|---|---|
| React Component | PascalCase | `ContentPlanCard` |
| Hook | camelCase + use prefix | `useContentPlanRealtime` |
| API route | kebab-case | `/content-plans/kanban` |
| DB column | snake_case | `scheduled_date` |
| TS type/interface | PascalCase | `ContentPlan` |
| Zod schema | camelCase | `schema`, `createSchema` |
| Query key | array of strings | `["content-plans", filter]` |
