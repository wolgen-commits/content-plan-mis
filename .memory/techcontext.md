# Tech Context

## Stack

| Layer | Teknologi |
|---|---|
| Backend | Laravel 11 (API only, no Blade) |
| Database | Supabase PostgreSQL |
| Frontend | Next.js 14 App Router, TypeScript |
| Auth | Laravel Sanctum (Bearer token) |
| State | Zustand (auth), TanStack React Query v5 (server state) |
| Realtime | Supabase Realtime (postgres_changes) |
| File Storage | Supabase Storage (signed URL direct upload) |
| Styling | Tailwind CSS v3 + Magenta design tokens |
| Forms | react-hook-form + zod |
| Calendar | @fullcalendar/react |
| Kanban DnD | @dnd-kit/core + @dnd-kit/sortable |
| Toast | sonner |
| HTTP Client | axios |

## Supabase Project

- **Project ID:** `wgefhisxkhmrdyccckli`
- **Region:** ap-southeast-1 (Singapore)
- **URL:** `https://wgefhisxkhmrdyccckli.supabase.co`

## Koneksi Database

Gunakan **Connection Pooler** (port 5432 diblokir ISP):
```
Host:     aws-0-ap-southeast-1.pooler.supabase.com
Port:     6543
Username: postgres.wgefhisxkhmrdyccckli
DB:       postgres
SSL:      require
```

## Environment Files

### `backend/.env` (keys penting)
```
DB_CONNECTION=pgsql
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
DB_PORT=6543
DB_DATABASE=postgres
DB_USERNAME=postgres.wgefhisxkhmrdyccckli
DB_SSLMODE=require

SUPABASE_URL=https://wgefhisxkhmrdyccckli.supabase.co
SUPABASE_STORAGE_BUCKET=content-submissions

FRONTEND_URL=http://localhost:3001   ← sesuaikan port aktual
SANCTUM_STATEFUL_DOMAINS=localhost:3001
```

### `frontend/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://wgefhisxkhmrdyccckli.supabase.co
```

## Setup PHP (Laragon)

php.ini path: `C:\laragon\bin\php\php-8.4.12-nts-Win32-vs17-x64\php.ini`

Extension yang harus aktif (uncomment):
```ini
extension=pdo_pgsql
extension=pgsql
extension=fileinfo
extension=intl     ; untuk php artisan db:show (opsional)
```

## Keputusan Teknis Penting

| Keputusan | Alasan |
|---|---|
| `statefulApi()` DIHAPUS dari `bootstrap/app.php` | Kita pakai Bearer token, bukan cookie SPA auth. Menyebabkan CSRF mismatch jika diaktifkan |
| Connection pooler port 6543 | Port 5432 timeout (diblokir ISP/network) |
| `username = postgres.[project-ref]` | Format wajib saat pakai Supabase pooler |
| Token disimpan di localStorage + cookie | localStorage untuk Zustand, cookie untuk Next.js middleware |
| File upload via signed URL langsung ke Supabase | File tidak melewati Laravel, hemat bandwidth server |
| Supabase Realtime pakai `postgres_changes` | Tidak perlu WebSocket server di Laravel |

## Struktur Direktori

```
d:\content plan\
├── backend\                  ← Laravel 11
│   ├── app\
│   │   ├── Http\Controllers\Api\V1\
│   │   ├── Http\Middleware\CheckRole.php
│   │   ├── Models\
│   │   └── Services\         ← NotificationService, StorageService
│   ├── routes\api.php
│   └── bootstrap\app.php
├── frontend\                 ← Next.js 14
│   ├── src\
│   │   ├── app\
│   │   │   ├── (auth)\login\
│   │   │   └── (dashboard)\  ← layout + semua pages
│   │   ├── components\ui\
│   │   ├── hooks\
│   │   ├── lib\              ← api.ts, supabase.ts, utils.ts
│   │   ├── store\authStore.ts
│   │   ├── types\index.ts
│   │   └── middleware.ts
│   ├── tailwind.config.ts
│   └── .env.local
├── database\schema.sql       ← DDL, jalankan di Supabase SQL Editor
├── CLAUDE.md
└── .memory\
```

## Menjalankan

```bash
# Backend
cd backend && php artisan serve

# Frontend
cd frontend && npm run dev

# Seed
cd backend && php artisan db:seed

# Deadline cron (manual test)
cd backend && php artisan notifications:deadline-reminders
```
