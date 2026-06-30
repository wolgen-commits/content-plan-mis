# Progress & Checklist

> Update file ini setiap kali task selesai atau dimulai.
> Format: `- [x]` selesai · `- [ ]` belum · `- [~]` sedang dikerjakan

---

## Phase 1 — Database Setup

- [x] Buat schema SQL (`database/schema.sql`)
- [x] Jalankan schema di Supabase SQL Editor
- [x] Aktifkan RLS per tabel
- [x] Aktifkan Supabase Realtime untuk `content_plans` dan `notifications` ✅
- [x] Buat Supabase Storage bucket `content-submissions` (private) ✅

---

## Phase 2 — Laravel Backend

### Setup & Config
- [x] Install Laravel 11 + Sanctum
- [x] Konfigurasi `.env` (pgsql, Supabase, CORS)
- [x] `bootstrap/app.php` — CORS, CheckRole alias (**tanpa** `statefulApi`)
- [x] `config/cors.php` — allow FRONTEND_URL with credentials
- [x] `config/database.php` — default pgsql
- [x] `config/services.php` — Supabase config block

### Models
- [x] `User.php` — HasApiTokens, HasUuids, role helpers
- [x] `ContentPlan.php` — semua fields, relationships, `isOverdue()`
- [x] `ContentReference.php`
- [x] `ContentTag.php`
- [x] `ContentAssignee.php`
- [x] `ContentSubmission.php`
- [x] `Notification.php`

### Middleware & Services
- [x] `CheckRole.php` — variadic roles
- [x] `NotificationService.php` — bulk insert, semua trigger types
- [x] `StorageService.php` — signed URL via Supabase REST API

### Controllers
- [x] `AuthController.php` — login, logout, me
- [x] `UserController.php` — CRUD + byRole
- [x] `ContentPlanController.php` — CRUD, calendar, kanban, submit, approve, reject, kanbanMove
- [x] `ContentAssigneeController.php` — add/remove
- [x] `SubmissionController.php` — create, approve, reject, mySubmissions
- [x] `StorageController.php` — signed URL endpoint
- [x] `NotificationController.php` — list, markRead, markAllRead

### Routes & Cron
- [x] `routes/api.php` — semua routes dengan middleware
- [x] `SendDeadlineReminders.php` — daily cron command
- [x] `routes/console.php` — schedule cron

### Database Seeder
- [x] `DatabaseSeeder.php` — 5 user (1 per role), password: `password`
- [x] Berhasil seed ke Supabase ✅

---

## Phase 3 — Next.js Frontend

### Setup & Config
- [x] Install Next.js 14 + semua dependencies
- [x] `tailwind.config.ts` — Magenta design tokens
- [x] `.env.local` — API URL + Supabase keys
- [x] `src/types/index.ts` — semua TypeScript types
- [x] `src/lib/api.ts` — Axios + Bearer token interceptor
- [x] `src/lib/supabase.ts` — Supabase client
- [x] `src/lib/utils.ts` — cn(), formatDate(), status maps
- [x] `src/store/authStore.ts` — Zustand auth store
- [x] `src/middleware.ts` — cookie auth guard
- [x] `src/app/globals.css` — font imports, FC overrides
- [x] `src/app/layout.tsx` — root layout
- [x] `src/app/providers.tsx` — QueryClient + Toaster

### UI Components
- [x] `Button.tsx` — variants: primary/secondary/ghost/danger/success
- [x] `Badge.tsx` — StatusBadge, ChannelBadge, Badge
- [x] `Input.tsx` — Input, Textarea, Select
- [x] `Modal.tsx` — Modal, ConfirmModal
- [x] `Avatar.tsx` — Avatar, AvatarGroup
- [x] `Sidebar.tsx` — dark sidebar, role-based nav
- [x] `Topbar.tsx` — breadcrumb, notification bell, user info

### Pages
- [x] `(auth)/login/page.tsx` — login form
- [x] `(dashboard)/layout.tsx` — shell + realtime init
- [x] `(dashboard)/dashboard/page.tsx` — stats + recent plans
- [x] `(dashboard)/content-plans/page.tsx` — table list + filters
- [x] `(dashboard)/content-plans/new/page.tsx` — create form
- [x] `(dashboard)/content-plans/[id]/page.tsx` — detail + approval flow
- [x] `(dashboard)/content-plans/[id]/edit/page.tsx` — edit form
- [x] `(dashboard)/calendar/page.tsx` — FullCalendar
- [x] `(dashboard)/kanban/page.tsx` — dnd-kit board
- [x] `(dashboard)/submissions/page.tsx` — designer/videografer tasks
- [x] `(dashboard)/notifications/page.tsx` — notification list
- [x] `(dashboard)/users/page.tsx` — admin user management
- [x] `app/page.tsx` — redirect to /dashboard

### Hooks
- [x] `useRealtimeSubscription.ts` — content plan + notification realtime

### Build
- [x] `npm run build` — **PASS** (0 errors, 14 routes) ✅

---

## Phase 4 — Integration & Testing

### Setup Lokal
- [x] PHP extension `pdo_pgsql` aktif
- [x] Koneksi ke Supabase berhasil (via connection pooler)
- [x] `php artisan db:seed` berhasil ✅
- [~] Login di browser — **sedang debug** (CSRF error sudah fix dengan hapus `statefulApi()`)
- [ ] Verifikasi redirect setelah login berhasil

### Functional Testing
- [ ] Login sebagai setiap role, verifikasi redirect + sidebar nav
- [ ] Buat content plan sebagai `content_planner`
- [ ] Submit plan untuk approval
- [ ] Login sebagai `manager_marketing`, approve/reject plan
- [ ] Verifikasi notifikasi real-time muncul
- [ ] Login sebagai `designer`, lihat tugas, upload file
- [ ] Verifikasi signed URL upload flow bekerja
- [ ] Content planner approve submission
- [ ] Drag & drop di Kanban board
- [ ] Verifikasi Kanban sync di tab lain (Realtime)
- [ ] Calendar: event muncul di tanggal yang benar
- [ ] Calendar drag untuk reschedule

### Supabase Config
- [x] Aktifkan Realtime publikasi untuk `content_plans` dan `notifications` ✅
- [x] Buat bucket `content-submissions` di Supabase Storage ✅
- [x] Set bucket sebagai private ✅
- [ ] Verifikasi file upload sukses

---

## Issues & Catatan

| Tanggal | Issue | Status |
|---|---|---|
| 2026-06-24 | PHP ext-fileinfo tidak aktif → uncomment di php.ini | ✅ Fix |
| 2026-06-24 | Port 5432 timeout → pakai connection pooler port 6543 | ✅ Fix |
| 2026-06-24 | CSRF token mismatch → hapus `statefulApi()` dari bootstrap/app.php | ✅ Fix |
| 2026-06-24 | Login gagal di browser → sedang diuji setelah CSRF fix | 🔄 Testing |

---

## Next Actions (prioritas)

1. Test full workflow: buat plan → submit → approve → assign → upload → approve submission → done
2. Verifikasi notifikasi realtime muncul di topbar
3. Test upload file (designer/videographer) — verifikasi signed URL flow bekerja
4. Test Kanban drag & drop + sync antar tab
