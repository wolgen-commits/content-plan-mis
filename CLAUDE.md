# Content Planner System — CLAUDE.md

## Memory Files (Baca Ini Dulu!)

Folder `.memory/` berisi konteks lengkap project. **Baca semua file ini di awal setiap sesi:**

1. [.memory/activecontext.md](.memory/activecontext.md) — ⚡ Fokus sesi ini & status debug terkini
2. [.memory/brief.md](.memory/brief.md) — Deskripsi project & fitur
3. [.memory/techcontext.md](.memory/techcontext.md) — Stack, env, keputusan teknis
4. [.memory/systempatterns.md](.memory/systempatterns.md) — Konvensi kode & pola arsitektur
5. [.memory/progress.md](.memory/progress.md) — Checklist progress & next actions

---

## Project Overview

Full-stack content planning system for a marketing team. Content planners create briefs → managers approve → designers/videographers receive tasks and upload assets → tracked via calendar + kanban board.

**Design system:** Magenta ERP — brand `#BB2649`, dark sidebar `#1A1A1C`, DM Sans font.

---

## Directory Structure

```
d:\content plan\
├── backend\      ← Laravel 11 (API only, no Blade UI)
├── frontend\     ← Next.js 14 App Router (TypeScript)
└── database\
    └── schema.sql  ← Run once in Supabase SQL Editor
```

---

## Architecture

```
Browser (Next.js 14)
  ├── REST  ──────→ Laravel 11 API  (http://localhost:8000/api/v1)
  ├── Realtime ───→ Supabase Realtime  (postgres_changes)
  └── Upload ─────→ Supabase Storage   (signed URL direct PUT)

Laravel 11
  └── DB ─────────→ Supabase PostgreSQL (pgsql driver, SSL, connection pooler port 6543)
```

---

## Running Locally

### Backend (Laravel)
```bash
cd backend
php artisan config:clear
php artisan serve          # http://localhost:8000
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev                # http://localhost:3001 (or 3000)
```

### Seed users
```bash
cd backend
php artisan db:seed
```

Default credentials (all passwords: `password`):

| Email | Role |
|---|---|
| admin@magenta.id | admin |
| planner@magenta.id | content_planner |
| manager@magenta.id | manager_marketing |
| designer@magenta.id | designer |
| video@magenta.id | videographer |

---

## Environment Variables

### `backend/.env` (critical keys)
```env
DB_CONNECTION=pgsql
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com   # connection pooler
DB_PORT=6543
DB_DATABASE=postgres
DB_USERNAME=postgres.wgefhisxkhmrdyccckli
DB_PASSWORD=...
DB_SSLMODE=require

SUPABASE_URL=https://wgefhisxkhmrdyccckli.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=content-submissions

FRONTEND_URL=http://localhost:3001   # match actual frontend port
SANCTUM_STATEFUL_DOMAINS=localhost:3001
```

### `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://wgefhisxkhmrdyccckli.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Known Setup Notes

- **PHP extensions required:** `pdo_pgsql`, `pgsql`, `fileinfo` — uncomment in `C:\laragon\bin\php\php-8.4.12-nts-Win32-vs17-x64\php.ini`
- **Supabase direct port 5432 is blocked** — use connection pooler (port 6543) with username format `postgres.[project-ref]`
- **`statefulApi()` removed** from `bootstrap/app.php` — we use Bearer token auth, not cookie-based SPA auth, so CSRF middleware is not needed
- **Supabase free tier** pauses after inactivity — restore from dashboard before connecting

---

## Auth Flow

1. `POST /api/v1/auth/login` → Laravel returns `{ token, user }`
2. Frontend stores token in `localStorage` + cookie (`auth_token`) + Zustand store
3. Axios interceptor adds `Authorization: Bearer {token}` to every request
4. `src/middleware.ts` checks `auth_token` cookie → redirect to `/login` if missing
5. On 401 response → clear store + redirect to `/login`

---

## User Roles & Permissions

| Role | Can Do |
|---|---|
| `admin` | Everything |
| `content_planner` | Create/edit/delete plans, submit for approval, approve/reject submissions |
| `manager_marketing` | Approve/reject plans |
| `designer` | View assigned plans, upload design files |
| `videographer` | View assigned plans, upload video files |

---

## Content Plan Workflow

```
draft
  └─[planner submits]──→ pending_approval
                              ├─[manager approves]──→ approved ──→ in_production
                              │                                         └─[assets uploaded]──→ submitted
                              │                                                                    └─[planner approves all]──→ done
                              └─[manager rejects]──→ rejected
```

---

## API Routes (prefix: `/api/v1`)

```
POST   /auth/login
POST   /auth/logout              [sanctum]
GET    /auth/me                  [sanctum]

GET    /users                    [sanctum, admin]
POST   /users                    [sanctum, admin]
PUT    /users/{id}               [sanctum, admin]
DELETE /users/{id}               [sanctum, admin]
GET    /users/by-role/{role}     [sanctum]

GET    /content-plans            [sanctum]
POST   /content-plans            [sanctum, content_planner|admin]
GET    /content-plans/calendar   [sanctum]  ?start=&end=&channel=&status=
GET    /content-plans/kanban     [sanctum]
GET    /content-plans/{id}       [sanctum]
PUT    /content-plans/{id}       [sanctum, content_planner|admin]
DELETE /content-plans/{id}       [sanctum, content_planner|admin]
POST   /content-plans/{id}/submit      [sanctum, content_planner]
POST   /content-plans/{id}/approve     [sanctum, manager_marketing|admin]
POST   /content-plans/{id}/reject      [sanctum, manager_marketing|admin]
PATCH  /content-plans/{id}/kanban-move [sanctum]

POST   /content-plans/{id}/assignees           [sanctum, content_planner|admin]
DELETE /content-plans/{id}/assignees/{userId}  [sanctum, content_planner|admin]

GET    /content-plans/{id}/submissions  [sanctum]
POST   /content-plans/{id}/submissions  [sanctum, designer|videographer]
GET    /submissions/my                  [sanctum]
POST   /submissions/{id}/approve        [sanctum, content_planner|admin]
POST   /submissions/{id}/reject         [sanctum, content_planner|admin]

POST   /storage/signed-url       [sanctum]

GET    /notifications            [sanctum]  ?unread_only=true
PATCH  /notifications/{id}/read  [sanctum]
PATCH  /notifications/read-all   [sanctum]
```

---

## Key Frontend Files

| File | Purpose |
|---|---|
| `src/lib/api.ts` | Axios instance + Bearer token interceptor |
| `src/lib/supabase.ts` | Supabase client for Realtime |
| `src/store/authStore.ts` | Zustand auth state (user + token) |
| `src/middleware.ts` | Next.js middleware — cookie auth guard |
| `src/hooks/useRealtimeSubscription.ts` | Supabase Realtime hooks |
| `src/types/index.ts` | All TypeScript types |
| `src/lib/utils.ts` | `cn()`, `formatDate()`, status color maps |
| `tailwind.config.ts` | Magenta design tokens |

---

## Key Backend Files

| File | Purpose |
|---|---|
| `app/Http/Middleware/CheckRole.php` | Role-based route guard |
| `app/Services/NotificationService.php` | Bulk insert notifications |
| `app/Services/StorageService.php` | Supabase signed URL generation |
| `app/Console/Commands/SendDeadlineReminders.php` | Daily 08:00 cron |
| `routes/api.php` | All API routes |
| `bootstrap/app.php` | Middleware registration (no `statefulApi`) |

---

## File Upload Flow (Designer/Videographer)

1. `POST /storage/signed-url` → Laravel calls Supabase Storage API → `{ signed_url, public_url }`
2. Client does `PUT signed_url` directly with file binary (XHR with progress)
3. `POST /content-plans/{id}/submissions` → Laravel saves record + fires notification

---

## Realtime Subscriptions

Both mounted in `src/app/(dashboard)/layout.tsx`:

```typescript
// Kanban sync
supabase.channel('content_plans_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'content_plans' }, handler)

// Notifications
supabase.channel(`notifications_${userId}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications',
      filter: `user_id=eq.${userId}` }, handler)
```

For Realtime to work, run in Supabase SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE content_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

---

## Design Tokens (Tailwind)

```
brand:   #BB2649  (hover: #9B1E3C, light: #F9E3E8, faint: #FDF4F6)
sidebar: #1A1A1C
success: #16A34A
warning: #D97706
danger:  #DC2626
info:    #2563EB
radius:  card=10px, btn=6px
font:    DM Sans (sans), DM Mono (mono)
```

---

## Notification Types

| Type | Trigger | Recipients |
|---|---|---|
| `plan_submitted` | planner submits | all manager_marketing |
| `plan_approved` | manager approves | planner + assignees |
| `plan_rejected` | manager rejects | planner |
| `submission_received` | designer uploads | planner |
| `submission_approved` | planner approves | submitter |
| `submission_rejected` | planner rejects | submitter |
| `assigned_to_plan` | planner assigns | that user |
| `plan_deadline_approaching` | cron 24h before | all assignees |

Run deadline cron manually:
```bash
php artisan notifications:deadline-reminders
```
