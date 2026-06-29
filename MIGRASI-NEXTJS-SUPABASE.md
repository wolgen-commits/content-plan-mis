# Dokumentasi Migrasi: Content Planner → Next.js + Supabase (Tanpa Laravel)

> Dokumen ini berisi semua yang diperlukan untuk membangun ulang sistem Content Planner
> menggunakan **Next.js 14 App Router + Supabase** secara langsung, tanpa Laravel backend.

---

## Daftar Isi

1. [Perbandingan Arsitektur](#1-perbandingan-arsitektur)
2. [Stack & Dependencies](#2-stack--dependencies)
3. [Setup Project](#3-setup-project)
4. [Database Schema (Supabase)](#4-database-schema-supabase)
5. [Supabase Auth — Ganti Sanctum](#5-supabase-auth--ganti-sanctum)
6. [Row Level Security (RLS) Policies](#6-row-level-security-rls-policies)
7. [Environment Variables](#7-environment-variables)
8. [Struktur Direktori](#8-struktur-direktori)
9. [Core Library Files](#9-core-library-files)
10. [TypeScript Types](#10-typescript-types)
11. [Auth Store (Zustand)](#11-auth-store-zustand)
12. [Middleware (Route Guard)](#12-middleware-route-guard)
13. [Pattern Data Fetching](#13-pattern-data-fetching)
14. [API Routes (Next.js Server Actions)](#14-api-routes-nextjs-server-actions)
15. [Modul: Auth (Login/Logout)](#15-modul-auth-loginlogout)
16. [Modul: Users (Admin)](#16-modul-users-admin)
17. [Modul: Content Plans](#17-modul-content-plans)
18. [Modul: Approval Workflow](#18-modul-approval-workflow)
19. [Modul: Assignees](#19-modul-assignees)
20. [Modul: Submissions (Upload Aset)](#20-modul-submissions-upload-aset)
21. [Modul: Notifications (Realtime)](#21-modul-notifications-realtime)
22. [Modul: Calendar](#22-modul-calendar)
23. [Modul: Kanban Board](#23-modul-kanban-board)
24. [File Upload ke Supabase Storage](#24-file-upload-ke-supabase-storage)
25. [Realtime Subscriptions](#25-realtime-subscriptions)
26. [Deadline Reminder Cron](#26-deadline-reminder-cron)
27. [UI Components (Design System)](#27-ui-components-design-system)
28. [Tailwind Config](#28-tailwind-config)
29. [Supabase Config Checklist](#29-supabase-config-checklist)

---

## 1. Perbandingan Arsitektur

### Sebelum (Laravel + Next.js)
```
Browser (Next.js 14)
  ├── REST ──────→ Laravel 11 API  (http://localhost:8000/api/v1)
  ├── Realtime ──→ Supabase Realtime
  └── Upload ────→ Supabase Storage (via signed URL dari Laravel)
```

### Sesudah (Next.js + Supabase langsung)
```
Browser (Next.js 14)
  ├── @supabase/ssr ──→ Supabase Auth   (session via cookies)
  ├── supabase-js   ──→ Supabase DB     (query langsung + RLS)
  ├── Realtime      ──→ Supabase Realtime
  └── Upload        ──→ Supabase Storage (signed URL dari Next.js API Route)
```

### Yang Diganti
| Laravel | Next.js + Supabase |
|---|---|
| `auth:sanctum` middleware | Supabase Auth Session (`@supabase/ssr`) |
| Bearer token di localStorage | Session cookie (httpOnly, dikelola Supabase SSR) |
| `CheckRole` middleware | RLS Policy + server-side role check |
| Controller (CRUD) | Supabase client query langsung / Route Handler |
| `NotificationService` | Supabase insert langsung dari Route Handler |
| `StorageService` (signed URL) | Supabase Storage API dari Route Handler |
| `SendDeadlineReminders` artisan | Vercel Cron Job / Supabase Edge Function |
| `personal_access_tokens` table | `auth.users` (Supabase internal) |

---

## 2. Stack & Dependencies

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "typescript": "5.x",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "zustand": "^4.x",
    "@tanstack/react-query": "^5.x",
    "axios": "^1.x",
    "react-hook-form": "^7.x",
    "zod": "^3.x",
    "@hookform/resolvers": "^3.x",
    "@fullcalendar/react": "^6.x",
    "@fullcalendar/daygrid": "^6.x",
    "@fullcalendar/timegrid": "^6.x",
    "@fullcalendar/interaction": "^6.x",
    "@dnd-kit/core": "^6.x",
    "@dnd-kit/sortable": "^7.x",
    "@dnd-kit/utilities": "^3.x",
    "sonner": "^1.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x",
    "date-fns": "^3.x"
  },
  "devDependencies": {
    "tailwindcss": "^3.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x",
    "@types/node": "^20.x",
    "@types/react": "^18.x"
  }
}
```

Install:
```bash
npx create-next-app@14 content-planner --typescript --tailwind --app --src-dir
cd content-planner

npm install @supabase/supabase-js @supabase/ssr zustand @tanstack/react-query \
  axios react-hook-form zod @hookform/resolvers \
  @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  sonner clsx tailwind-merge date-fns
```

---

## 3. Setup Project

### Struktur Direktori
```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx               ← shell + realtime init
│   │   ├── dashboard/page.tsx
│   │   ├── content-plans/
│   │   │   ├── page.tsx             ← list + filter
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx         ← detail
│   │   │       └── edit/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── kanban/page.tsx
│   │   ├── submissions/page.tsx
│   │   ├── notifications/page.tsx
│   │   └── users/page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   └── logout/route.ts
│   │   ├── users/route.ts
│   │   ├── content-plans/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── submit/route.ts
│   │   │       ├── approve/route.ts
│   │   │       ├── reject/route.ts
│   │   │       ├── kanban-move/route.ts
│   │   │       ├── assignees/route.ts
│   │   │       └── submissions/route.ts
│   │   ├── submissions/
│   │   │   ├── [id]/
│   │   │   │   ├── approve/route.ts
│   │   │   │   └── reject/route.ts
│   │   │   └── my/route.ts
│   │   ├── notifications/route.ts
│   │   └── storage/signed-url/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ui/
│       ├── Button.tsx
│       ├── Badge.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── Avatar.tsx
│       ├── Sidebar.tsx
│       └── Topbar.tsx
├── hooks/
│   └── useRealtimeSubscription.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts                ← browser client
│   │   ├── server.ts                ← server client (Route Handlers)
│   │   └── middleware.ts            ← middleware client
│   ├── api.ts                       ← axios ke /api/* (opsional)
│   └── utils.ts
├── store/
│   └── authStore.ts
├── types/
│   └── index.ts
└── middleware.ts
```

---

## 4. Database Schema (Supabase)

> Jalankan di Supabase SQL Editor. Tabel `personal_access_tokens` **tidak diperlukan** lagi.

```sql
-- ============================================================
-- Content Planner — Schema untuk Next.js + Supabase
-- ============================================================

-- 1. USERS PROFILE
-- auth.users dikelola Supabase Auth secara internal.
-- Tabel ini menyimpan data profil + role.
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  role        VARCHAR(50) NOT NULL DEFAULT 'content_planner'
                CHECK (role IN ('admin','content_planner','manager_marketing','designer','videographer')),
  avatar_url  TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Trigger: otomatis buat row di users saat user baru signup/create di auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'content_planner')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. CONTENT PLANS
CREATE TABLE IF NOT EXISTS content_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR(255) NOT NULL,
  content_type        VARCHAR(50) NOT NULL CHECK (content_type IN ('post','reel','story','carousel','video','thread','short')),
  channel             VARCHAR(50) NOT NULL CHECK (channel IN ('Instagram','TikTok','YouTube','LinkedIn','Twitter','Facebook')),
  topic               TEXT,
  material            TEXT,
  visual_brief        TEXT,
  caption             TEXT,
  scheduled_date      DATE,
  deadline_date       DATE,
  work_order          VARCHAR(50) CHECK (work_order IN ('designer_first','videographer_first','parallel')),
  status              VARCHAR(50) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','pending_approval','approved','in_production','submitted','done','rejected')),
  rejection_notes     TEXT,
  kanban_column       VARCHAR(50) DEFAULT 'briefing'
                        CHECK (kanban_column IN ('briefing','design_in_progress','video_in_progress','review','approved','published')),
  position_in_kanban  INTEGER DEFAULT 0,
  created_by          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cp_status ON content_plans(status);
CREATE INDEX IF NOT EXISTS idx_cp_date ON content_plans(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_cp_kanban ON content_plans(kanban_column, position_in_kanban);
CREATE INDEX IF NOT EXISTS idx_cp_created_by ON content_plans(created_by);

-- 3. CONTENT REFERENCES
CREATE TABLE IF NOT EXISTS content_references (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_plan_id UUID NOT NULL REFERENCES content_plans(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  label           VARCHAR(255),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- 4. CONTENT TAGS
CREATE TABLE IF NOT EXISTS content_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_plan_id UUID NOT NULL REFERENCES content_plans(id) ON DELETE CASCADE,
  tag             VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ct_plan ON content_tags(content_plan_id);

-- 5. CONTENT ASSIGNEES
CREATE TABLE IF NOT EXISTS content_assignees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_plan_id UUID NOT NULL REFERENCES content_plans(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(50) NOT NULL CHECK (role IN ('designer','videographer')),
  assigned_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(content_plan_id, user_id)
);

-- 6. CONTENT SUBMISSIONS
CREATE TABLE IF NOT EXISTS content_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_plan_id  UUID NOT NULL REFERENCES content_plans(id) ON DELETE CASCADE,
  submitted_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  file_url         TEXT NOT NULL,
  file_name        VARCHAR(255),
  file_size        BIGINT,
  file_type        VARCHAR(50) NOT NULL CHECK (file_type IN ('design','video')),
  version          INTEGER NOT NULL DEFAULT 1,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submission_notes TEXT,
  reviewer_notes   TEXT,
  approved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_plan ON content_submissions(content_plan_id);
CREATE INDEX IF NOT EXISTS idx_sub_by ON content_submissions(submitted_by);

-- 7. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_plan_id UUID REFERENCES content_plans(id) ON DELETE SET NULL,
  type            VARCHAR(100) NOT NULL,
  message         TEXT NOT NULL,
  data            JSONB,
  read_at         TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);

-- ============================================================
-- AKTIFKAN REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE content_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

### Seed Users (via Supabase Dashboard)

Buat user di **Authentication → Users → Create User**, lalu update role via SQL:

```sql
-- Setelah buat user lewat dashboard Auth, update role mereka:
UPDATE users SET role = 'admin', name = 'Admin'
  WHERE email = 'admin@magenta.id';

UPDATE users SET role = 'content_planner', name = 'Content Planner'
  WHERE email = 'planner@magenta.id';

UPDATE users SET role = 'manager_marketing', name = 'Manager Marketing'
  WHERE email = 'manager@magenta.id';

UPDATE users SET role = 'designer', name = 'Designer'
  WHERE email = 'designer@magenta.id';

UPDATE users SET role = 'videographer', name = 'Videografer'
  WHERE email = 'video@magenta.id';
```

---

## 5. Supabase Auth — Ganti Sanctum

### Konsep
- Supabase Auth mengelola session via **JWT** yang disimpan dalam **httpOnly cookie**
- Package `@supabase/ssr` menangani refresh token otomatis di server/client
- Role user disimpan di tabel `users.role` dan dimuat saat login
- Tidak ada lagi Bearer token di localStorage — lebih aman

### Flow Login
```
User submit email+password
  → supabase.auth.signInWithPassword()
  → Supabase Auth validasi
  → JWT session tersimpan di cookie (diatur @supabase/ssr)
  → Load user profile dari tabel users (ambil role)
  → Simpan ke Zustand store
  → Redirect ke /dashboard
```

---

## 6. Row Level Security (RLS) Policies

> RLS menggantikan `CheckRole` middleware Laravel. Jalankan di Supabase SQL Editor.

```sql
-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION: ambil role user yang sedang login
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================

-- Semua user yang login bisa lihat semua user (untuk assignee picker)
CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Hanya admin bisa insert/update/delete user
CREATE POLICY "users_insert_admin"
  ON users FOR INSERT
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "users_update_admin_or_self"
  ON users FOR UPDATE
  USING (get_my_role() = 'admin' OR id = auth.uid());

CREATE POLICY "users_delete_admin"
  ON users FOR DELETE
  USING (get_my_role() = 'admin');

-- ============================================================
-- CONTENT PLANS POLICIES
-- ============================================================

-- Semua user terautentikasi bisa baca content plans
CREATE POLICY "content_plans_select"
  ON content_plans FOR SELECT
  USING (auth.role() = 'authenticated');

-- Hanya content_planner dan admin bisa buat
CREATE POLICY "content_plans_insert"
  ON content_plans FOR INSERT
  WITH CHECK (get_my_role() IN ('content_planner', 'admin'));

-- Planner (pemilik) atau admin bisa edit
CREATE POLICY "content_plans_update"
  ON content_plans FOR UPDATE
  USING (created_by = auth.uid() OR get_my_role() = 'admin');

-- Hanya pemilik atau admin yang bisa hapus
CREATE POLICY "content_plans_delete"
  ON content_plans FOR DELETE
  USING (created_by = auth.uid() OR get_my_role() = 'admin');

-- ============================================================
-- CONTENT REFERENCES POLICIES
-- ============================================================
CREATE POLICY "refs_select" ON content_references FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "refs_insert" ON content_references FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM content_plans WHERE id = content_plan_id AND (created_by = auth.uid() OR get_my_role() = 'admin'))
);
CREATE POLICY "refs_delete" ON content_references FOR DELETE USING (
  EXISTS (SELECT 1 FROM content_plans WHERE id = content_plan_id AND (created_by = auth.uid() OR get_my_role() = 'admin'))
);

-- ============================================================
-- CONTENT TAGS POLICIES
-- ============================================================
CREATE POLICY "tags_select" ON content_tags FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tags_insert" ON content_tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM content_plans WHERE id = content_plan_id AND (created_by = auth.uid() OR get_my_role() = 'admin'))
);
CREATE POLICY "tags_delete" ON content_tags FOR DELETE USING (
  EXISTS (SELECT 1 FROM content_plans WHERE id = content_plan_id AND (created_by = auth.uid() OR get_my_role() = 'admin'))
);

-- ============================================================
-- CONTENT ASSIGNEES POLICIES
-- ============================================================
CREATE POLICY "assignees_select" ON content_assignees FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "assignees_insert" ON content_assignees FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM content_plans WHERE id = content_plan_id AND (created_by = auth.uid() OR get_my_role() = 'admin'))
);
CREATE POLICY "assignees_delete" ON content_assignees FOR DELETE USING (
  EXISTS (SELECT 1 FROM content_plans WHERE id = content_plan_id AND (created_by = auth.uid() OR get_my_role() = 'admin'))
);

-- ============================================================
-- CONTENT SUBMISSIONS POLICIES
-- ============================================================

-- Semua user autentikasi bisa lihat submission
CREATE POLICY "submissions_select" ON content_submissions FOR SELECT USING (auth.role() = 'authenticated');

-- Hanya designer/videografer (yang di-assign) bisa submit
CREATE POLICY "submissions_insert" ON content_submissions FOR INSERT WITH CHECK (
  get_my_role() IN ('designer', 'videographer', 'admin') AND submitted_by = auth.uid()
);

-- Approve/reject: hanya content_planner (pemilik plan) atau admin
CREATE POLICY "submissions_update" ON content_submissions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM content_plans cp
    WHERE cp.id = content_plan_id AND (cp.created_by = auth.uid() OR get_my_role() = 'admin')
  )
);

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================

-- User hanya bisa lihat notifikasi milik sendiri
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());

-- Insert hanya dari service role (Route Handler) — frontend tidak insert langsung
-- Tidak perlu policy INSERT untuk anon/authenticated
```

---

## 7. Environment Variables

### `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://wgefhisxkhmrdyccckli.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...anon_key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role_key...

# Hanya diperlukan jika pakai Next.js API Routes
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Penting:**
> - `NEXT_PUBLIC_*` aman diekspos ke browser
> - `SUPABASE_SERVICE_ROLE_KEY` **TIDAK BOLEH** di-prefix `NEXT_PUBLIC_` — hanya dipakai di server (Route Handlers/Server Actions)
> - Service role key **bypass RLS** — gunakan hanya untuk operasi admin di sisi server

---

## 8. Struktur Direktori

Lihat bagian [Setup Project](#3-setup-project) di atas.

---

## 9. Core Library Files

### `src/lib/supabase/client.ts` — Browser Client
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Singleton untuk dipakai di komponen client
let browserClient: ReturnType<typeof createClient> | null = null;
export function getSupabaseBrowser() {
  if (!browserClient) browserClient = createClient();
  return browserClient;
}
```

### `src/lib/supabase/server.ts` — Server Client (Route Handlers)
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Untuk operasi biasa (respects RLS)
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// Untuk operasi admin (bypass RLS) — gunakan dengan hati-hati
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
      auth: { persistSession: false },
    }
  );
}
```

### `src/lib/supabase/middleware.ts` — Middleware Client
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — JANGAN dihapus!
  const { data: { user } } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
```

### `src/lib/utils.ts`
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null, fmt = 'dd MMM yyyy') {
  if (!date) return '-';
  return format(new Date(date), fmt, { locale: id });
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Menunggu Approval',
  approved: 'Disetujui',
  in_production: 'Dalam Produksi',
  submitted: 'Submitted',
  done: 'Selesai',
  rejected: 'Ditolak',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-warning-light text-warning',
  approved: 'bg-info-light text-info',
  in_production: 'bg-purple-100 text-purple-700',
  submitted: 'bg-brand-light text-brand',
  done: 'bg-success-light text-success',
  rejected: 'bg-danger-light text-danger',
};

export const CHANNEL_COLORS: Record<string, string> = {
  Instagram: 'bg-pink-100 text-pink-700',
  TikTok: 'bg-gray-900 text-white',
  YouTube: 'bg-red-100 text-red-700',
  LinkedIn: 'bg-blue-100 text-blue-700',
  Twitter: 'bg-sky-100 text-sky-700',
  Facebook: 'bg-indigo-100 text-indigo-700',
};

export const KANBAN_COLUMNS = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'design_in_progress', label: 'Design in Progress' },
  { id: 'video_in_progress', label: 'Video in Progress' },
  { id: 'review', label: 'Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'published', label: 'Published' },
] as const;
```

---

## 10. TypeScript Types

### `src/types/index.ts`
```typescript
export type UserRole =
  | 'admin'
  | 'content_planner'
  | 'manager_marketing'
  | 'designer'
  | 'videographer';

export type ContentStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'in_production'
  | 'submitted'
  | 'done'
  | 'rejected';

export type ContentType = 'post' | 'reel' | 'story' | 'carousel' | 'video' | 'thread' | 'short';
export type Channel = 'Instagram' | 'TikTok' | 'YouTube' | 'LinkedIn' | 'Twitter' | 'Facebook';
export type KanbanColumn =
  | 'briefing'
  | 'design_in_progress'
  | 'video_in_progress'
  | 'review'
  | 'approved'
  | 'published';

export type WorkOrder = 'designer_first' | 'videographer_first' | 'parallel';
export type FileType = 'design' | 'video';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type NotificationType =
  | 'plan_submitted'
  | 'plan_approved'
  | 'plan_rejected'
  | 'submission_received'
  | 'submission_approved'
  | 'submission_rejected'
  | 'assigned_to_plan'
  | 'plan_deadline_approaching';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface ContentReference {
  id: string;
  content_plan_id: string;
  url: string;
  label: string | null;
}

export interface ContentTag {
  id: string;
  content_plan_id: string;
  tag: string;
}

export interface ContentAssignee {
  id: string;
  content_plan_id: string;
  user_id: string;
  role: 'designer' | 'videographer';
  assigned_at: string;
  user?: User;
}

export interface ContentSubmission {
  id: string;
  content_plan_id: string;
  submitted_by: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  file_type: FileType;
  version: number;
  status: SubmissionStatus;
  submission_notes: string | null;
  reviewer_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  submitter?: User;
}

export interface ContentPlan {
  id: string;
  title: string;
  content_type: ContentType;
  channel: Channel;
  topic: string | null;
  material: string | null;
  visual_brief: string | null;
  caption: string | null;
  scheduled_date: string | null;
  deadline_date: string | null;
  work_order: WorkOrder | null;
  status: ContentStatus;
  rejection_notes: string | null;
  kanban_column: KanbanColumn;
  position_in_kanban: number;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: User;
  approver?: User;
  references?: ContentReference[];
  tags?: ContentTag[];
  assignees?: ContentAssignee[];
  submissions?: ContentSubmission[];
}

export interface Notification {
  id: string;
  user_id: string;
  content_plan_id: string | null;
  type: NotificationType;
  message: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  content_plan?: Pick<ContentPlan, 'id' | 'title'>;
}

// API Response shapes
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}
```

---

## 11. Auth Store (Zustand)

### `src/store/authStore.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearAuth: () => set({ user: null }),
    }),
    { name: 'auth-store' }
  )
);
```

---

## 12. Middleware (Route Guard)

### `src/middleware.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_PATHS = ['/login'];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

---

## 13. Pattern Data Fetching

### Dari Browser (Client Component)
```typescript
'use client';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ───────────────────────────
// READ (useQuery)
// ───────────────────────────
export function useContentPlans(filters?: { status?: string; channel?: string }) {
  return useQuery({
    queryKey: ['content-plans', filters],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      let query = supabase
        .from('content_plans')
        .select(`
          *,
          creator:users!created_by(id, name, avatar_url),
          assignees:content_assignees(*, user:users(*)),
          tags:content_tags(*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.channel) query = query.eq('channel', filters.channel);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// ───────────────────────────
// WRITE (useMutation → API Route)
// ───────────────────────────
// Untuk operasi yang butuh notifikasi/side-effects,
// kirim ke Next.js API Route (bukan langsung ke Supabase):
export function useCreateContentPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateContentPlanInput) => {
      const res = await fetch('/api/content-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Gagal membuat content plan.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
    },
  });
}
```

### Kapan Pakai API Route vs Langsung Supabase?

| Operasi | Pendekatan |
|---|---|
| Read data (list, detail) | Langsung `supabase.from().select()` dari client |
| Create/Update sederhana (tanpa side effect) | Langsung `supabase.from().insert()` dari client |
| Operasi yang trigger notifikasi | API Route (server dapat bypass RLS untuk insert notif) |
| Workflow state changes (submit, approve, reject) | API Route (validasi + notifikasi) |
| Upload signed URL | API Route (butuh service role key) |
| Admin create user | API Route (butuh `supabase.auth.admin.createUser()`) |

---

## 14. API Routes (Next.js Server Actions)

### Helper: Get Current User di Route Handler
```typescript
// src/lib/supabase/get-session.ts
import { createClient } from '@/lib/supabase/server';
import { User } from '@/types';

export async function getSessionUser(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  return profile;
}
```

### Helper: Send Notification (server-side)
```typescript
// src/lib/notifications.ts
import { createAdminClient } from '@/lib/supabase/server';
import { NotificationType } from '@/types';

interface NotifyPayload {
  userIds: string[];
  type: NotificationType;
  message: string;
  contentPlanId?: string;
  data?: Record<string, unknown>;
}

export async function sendNotifications({
  userIds,
  type,
  message,
  contentPlanId,
  data,
}: NotifyPayload) {
  if (userIds.length === 0) return;
  const supabase = createAdminClient();
  await supabase.from('notifications').insert(
    userIds.map(userId => ({
      user_id: userId,
      type,
      message,
      content_plan_id: contentPlanId ?? null,
      data: data ?? null,
    }))
  );
}
```

---

## 15. Modul: Auth (Login/Logout)

### `src/app/api/auth/login/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ message: 'Email atau password salah.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  return NextResponse.json({ user: profile });
}
```

### `src/app/api/auth/logout/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ message: 'Logout berhasil.' });
}
```

### `src/app/(auth)/login/page.tsx`
```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore(s => s.setUser);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const password = form.get('password') as string;

    const supabase = getSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Email atau password salah.');
      setLoading(false);
      return;
    }

    // Ambil profile dari tabel users
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      if (profile) setUser(profile);
    }

    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-card shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Masuk</h1>
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="email" type="email" placeholder="Email" required
            className="w-full border border-gray-200 rounded-btn px-3 py-2 text-sm focus:outline-none focus:border-brand" />
          <input name="password" type="password" placeholder="Password" required
            className="w-full border border-gray-200 rounded-btn px-3 py-2 text-sm focus:outline-none focus:border-brand" />
          <button type="submit" disabled={loading}
            className="w-full bg-brand text-white rounded-btn py-2 text-sm font-medium hover:bg-brand-hover disabled:opacity-50">
            {loading ? 'Memuat...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

## 16. Modul: Users (Admin)

### `src/app/api/users/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

// GET /api/users?role=designer
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  const supabase = createClient();
  let query = supabase.from('users').select('id, name, email, role, avatar_url, created_at').order('name');
  if (role) query = query.eq('role', role);

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// POST /api/users  [admin only]
export async function POST(request: NextRequest) {
  const currentUser = await getSessionUser();
  if (!currentUser || currentUser.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { name, email, password, role } = await request.json();
  const adminClient = createAdminClient();

  // Buat user di Supabase Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (authError) return NextResponse.json({ message: authError.message }, { status: 422 });

  // Update role di tabel users (trigger sudah insert row, tapi role perlu diupdate)
  await adminClient.from('users').update({ name, role }).eq('id', authData.user.id);

  const { data: profile } = await adminClient
    .from('users').select('*').eq('id', authData.user.id).single();

  return NextResponse.json({ data: profile }, { status: 201 });
}
```

### `src/app/api/users/[id]/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

// PUT /api/users/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getSessionUser();
  if (!currentUser || currentUser.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { name, email, password, role } = await request.json();
  const adminClient = createAdminClient();

  const updates: Record<string, string> = {};
  if (name) updates.user_metadata = JSON.stringify({ name, role });
  if (email) updates.email = email;
  if (password) updates.password = password;

  if (email || password) {
    await adminClient.auth.admin.updateUserById(params.id, { email, password });
  }

  await adminClient.from('users').update({ name, email, role }).eq('id', params.id);

  const { data: profile } = await adminClient
    .from('users').select('*').eq('id', params.id).single();

  return NextResponse.json({ data: profile });
}

// DELETE /api/users/[id]
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getSessionUser();
  if (!currentUser || currentUser.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const adminClient = createAdminClient();
  await adminClient.auth.admin.deleteUser(params.id);
  // Cascade delete otomatis hapus row di tabel users (FK references auth.users)

  return NextResponse.json({ message: 'User dihapus.' });
}
```

---

## 17. Modul: Content Plans

### `src/app/api/content-plans/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

// GET /api/content-plans
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const channel = searchParams.get('channel');
  const search = searchParams.get('search');

  const supabase = createClient();
  let query = supabase
    .from('content_plans')
    .select(`
      *,
      creator:users!created_by(id, name, avatar_url),
      assignees:content_assignees(id, role, user:users(id, name, avatar_url)),
      tags:content_tags(id, tag)
    `)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (channel) query = query.eq('channel', channel);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// POST /api/content-plans
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { references, tags, assignees, ...planData } = body;

  const supabase = createClient();

  const { data: plan, error } = await supabase
    .from('content_plans')
    .insert({ ...planData, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 422 });

  // Insert references
  if (references?.length) {
    await supabase.from('content_references').insert(
      references.map((r: { url: string; label?: string }) => ({
        content_plan_id: plan.id, url: r.url, label: r.label ?? null,
      }))
    );
  }

  // Insert tags
  if (tags?.length) {
    await supabase.from('content_tags').insert(
      tags.map((tag: string) => ({ content_plan_id: plan.id, tag }))
    );
  }

  // Insert assignees + kirim notifikasi
  if (assignees?.length) {
    const { sendNotifications } = await import('@/lib/notifications');
    await supabase.from('content_assignees').insert(
      assignees.map((a: { user_id: string; role: string }) => ({
        content_plan_id: plan.id, user_id: a.user_id, role: a.role,
      }))
    );
    await sendNotifications({
      userIds: assignees.map((a: { user_id: string }) => a.user_id),
      type: 'assigned_to_plan',
      message: `Kamu di-assign ke plan "${plan.title}"`,
      contentPlanId: plan.id,
    });
  }

  return NextResponse.json({ data: plan }, { status: 201 });
}
```

### `src/app/api/content-plans/[id]/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

// GET /api/content-plans/[id]
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('content_plans')
    .select(`
      *,
      creator:users!created_by(id, name, email, avatar_url, role),
      approver:users!approved_by(id, name),
      references:content_references(*),
      tags:content_tags(*),
      assignees:content_assignees(*, user:users(id, name, email, avatar_url, role)),
      submissions:content_submissions(*, submitter:users!submitted_by(id, name, avatar_url))
    `)
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });

  return NextResponse.json({ data });
}

// PUT /api/content-plans/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data: existing } = await supabase
    .from('content_plans').select('created_by').eq('id', params.id).single();

  if (!existing) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });
  if (existing.created_by !== user.id && user.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { references, tags, ...planData } = body;

  const { data: plan, error } = await supabase
    .from('content_plans')
    .update({ ...planData, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 422 });

  // Rebuild references & tags (delete lama, insert baru)
  if (references !== undefined) {
    await supabase.from('content_references').delete().eq('content_plan_id', params.id);
    if (references.length) {
      await supabase.from('content_references').insert(
        references.map((r: { url: string; label?: string }) => ({
          content_plan_id: params.id, url: r.url, label: r.label ?? null,
        }))
      );
    }
  }

  if (tags !== undefined) {
    await supabase.from('content_tags').delete().eq('content_plan_id', params.id);
    if (tags.length) {
      await supabase.from('content_tags').insert(
        tags.map((tag: string) => ({ content_plan_id: params.id, tag }))
      );
    }
  }

  return NextResponse.json({ data: plan });
}

// DELETE /api/content-plans/[id]
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data: existing } = await supabase
    .from('content_plans').select('created_by').eq('id', params.id).single();

  if (!existing) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });
  if (existing.created_by !== user.id && user.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  await supabase.from('content_plans').delete().eq('id', params.id);
  return NextResponse.json({ message: 'Content plan dihapus.' });
}
```

### Query Kalender & Kanban
```typescript
// GET /api/content-plans?view=calendar&start=2024-01-01&end=2024-01-31
// Tambahkan di GET handler content-plans/route.ts:
const view = searchParams.get('view');
const start = searchParams.get('start');
const end = searchParams.get('end');

if (view === 'calendar' && start && end) {
  query = query
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .not('scheduled_date', 'is', null);
}

if (view === 'kanban') {
  query = query.order('kanban_column').order('position_in_kanban');
}
```

---

## 18. Modul: Approval Workflow

### `src/app/api/content-plans/[id]/submit/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();
  const { data: plan } = await supabase
    .from('content_plans').select('*, creator:users!created_by(id, name)')
    .eq('id', params.id).single();

  if (!plan) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });
  if (plan.created_by !== user.id && user.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
  if (plan.status !== 'draft') {
    return NextResponse.json({ message: 'Hanya draft yang bisa disubmit.' }, { status: 422 });
  }

  await supabase.from('content_plans')
    .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
    .eq('id', params.id);

  // Notifikasi ke semua manager_marketing
  const { data: managers } = await supabase
    .from('users').select('id').eq('role', 'manager_marketing');

  await sendNotifications({
    userIds: (managers ?? []).map(m => m.id),
    type: 'plan_submitted',
    message: `Plan "${plan.title}" menunggu persetujuan Anda.`,
    contentPlanId: plan.id,
    data: { submittedBy: user.name },
  });

  return NextResponse.json({ message: 'Plan berhasil disubmit.' });
}
```

### `src/app/api/content-plans/[id]/approve/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['manager_marketing', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();
  const { data: plan } = await supabase
    .from('content_plans')
    .select('*, assignees:content_assignees(user_id)')
    .eq('id', params.id).single();

  if (!plan) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });
  if (plan.status !== 'pending_approval') {
    return NextResponse.json({ message: 'Hanya plan pending_approval yang bisa diapprove.' }, { status: 422 });
  }

  await supabase.from('content_plans')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  const recipientIds = [plan.created_by, ...(plan.assignees ?? []).map((a: { user_id: string }) => a.user_id)];
  await sendNotifications({
    userIds: [...new Set(recipientIds)],
    type: 'plan_approved',
    message: `Plan "${plan.title}" telah disetujui.`,
    contentPlanId: plan.id,
    data: { approvedBy: user.name },
  });

  return NextResponse.json({ message: 'Plan berhasil diapprove.' });
}
```

### `src/app/api/content-plans/[id]/reject/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['manager_marketing', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { rejection_notes } = await request.json();
  const supabase = createClient();

  const { data: plan } = await supabase
    .from('content_plans').select('title, created_by, status').eq('id', params.id).single();

  if (!plan || plan.status !== 'pending_approval') {
    return NextResponse.json({ message: 'Tidak valid.' }, { status: 422 });
  }

  await supabase.from('content_plans')
    .update({ status: 'rejected', rejection_notes, updated_at: new Date().toISOString() })
    .eq('id', params.id);

  await sendNotifications({
    userIds: [plan.created_by],
    type: 'plan_rejected',
    message: `Plan "${plan.title}" ditolak. Catatan: ${rejection_notes}`,
    contentPlanId: params.id,
  });

  return NextResponse.json({ message: 'Plan ditolak.' });
}
```

### Kanban Move
```typescript
// src/app/api/content-plans/[id]/kanban-move/route.ts
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { kanban_column, position_in_kanban } = await request.json();
  const supabase = createClient();

  await supabase.from('content_plans')
    .update({ kanban_column, position_in_kanban, updated_at: new Date().toISOString() })
    .eq('id', params.id);

  return NextResponse.json({ message: 'Kanban diupdate.' });
}
```

---

## 19. Modul: Assignees

### `src/app/api/content-plans/[id]/assignees/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

// POST — tambah assignee
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { user_id, role } = await request.json();
  const supabase = createClient();

  const { data: plan } = await supabase
    .from('content_plans').select('title, created_by').eq('id', params.id).single();

  if (!plan || (plan.created_by !== user.id && user.role !== 'admin')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('content_assignees')
    .insert({ content_plan_id: params.id, user_id, role });

  if (error) return NextResponse.json({ message: 'User sudah di-assign.' }, { status: 422 });

  await sendNotifications({
    userIds: [user_id],
    type: 'assigned_to_plan',
    message: `Kamu di-assign ke plan "${plan.title}"`,
    contentPlanId: params.id,
  });

  return NextResponse.json({ message: 'Assignee ditambahkan.' }, { status: 201 });
}
```

### `src/app/api/content-plans/[id]/assignees/[userId]/route.ts`
```typescript
// DELETE — hapus assignee
export async function DELETE(_: NextRequest, { params }: { params: { id: string; userId: string } }) {
  const user = await getSessionUser();
  if (!user || !['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();
  await supabase.from('content_assignees')
    .delete()
    .eq('content_plan_id', params.id)
    .eq('user_id', params.userId);

  return NextResponse.json({ message: 'Assignee dihapus.' });
}
```

---

## 20. Modul: Submissions (Upload Aset)

### `src/app/api/content-plans/[id]/submissions/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';
import { sendNotifications } from '@/lib/notifications';

// GET — list submissions untuk plan
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('content_submissions')
    .select('*, submitter:users!submitted_by(id, name, avatar_url, role)')
    .eq('content_plan_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — submit file baru
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['designer', 'videographer', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const supabase = createClient();

  const { data: plan } = await supabase
    .from('content_plans').select('title, created_by, status').eq('id', params.id).single();

  if (!plan || !['approved', 'in_production'].includes(plan.status)) {
    return NextResponse.json({ message: 'Plan belum dalam status produksi.' }, { status: 422 });
  }

  // Hitung versi berikutnya
  const { count } = await supabase
    .from('content_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('content_plan_id', params.id)
    .eq('submitted_by', user.id)
    .eq('file_type', body.file_type);

  const { data: submission, error } = await supabase
    .from('content_submissions')
    .insert({
      content_plan_id: params.id,
      submitted_by: user.id,
      file_url: body.file_url,
      file_name: body.file_name,
      file_size: body.file_size,
      file_type: body.file_type,
      version: (count ?? 0) + 1,
      submission_notes: body.submission_notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 422 });

  // Update status plan ke in_production atau submitted
  await supabase.from('content_plans')
    .update({ status: 'in_production', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('status', 'approved');

  // Notifikasi ke content planner
  await sendNotifications({
    userIds: [plan.created_by],
    type: 'submission_received',
    message: `${user.name} mengupload ${body.file_type} untuk plan "${plan.title}"`,
    contentPlanId: params.id,
    data: { submissionId: submission.id },
  });

  return NextResponse.json({ data: submission }, { status: 201 });
}
```

### `src/app/api/submissions/[id]/approve/route.ts`
```typescript
export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !['content_planner', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();
  const { data: sub } = await supabase
    .from('content_submissions')
    .select('*, plan:content_plans(title, created_by)')
    .eq('id', params.id).single();

  if (!sub) return NextResponse.json({ message: 'Tidak ditemukan.' }, { status: 404 });

  await supabase.from('content_submissions')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', params.id);

  await sendNotifications({
    userIds: [sub.submitted_by],
    type: 'submission_approved',
    message: `Submission kamu untuk "${sub.plan?.title}" disetujui.`,
    contentPlanId: sub.content_plan_id,
  });

  return NextResponse.json({ message: 'Submission diapprove.' });
}
```

### `src/app/api/submissions/my/route.ts`
```typescript
// GET /api/submissions/my — untuk designer/videografer
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data } = await supabase
    .from('content_submissions')
    .select('*, plan:content_plans(id, title, channel, status, deadline_date)')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ data });
}
```

---

## 21. Modul: Notifications (Realtime)

### `src/app/api/notifications/route.ts`
```typescript
// GET /api/notifications?unread_only=true
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unread_only') === 'true';

  const supabase = createClient();
  let query = supabase
    .from('notifications')
    .select('*, content_plan:content_plans(id, title)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.is('read_at', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const unreadCount = data?.filter(n => !n.read_at).length ?? 0;
  return NextResponse.json({ data, unread_count: unreadCount });
}

// PATCH /api/notifications/read-all
export async function PATCH() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  return NextResponse.json({ message: 'Semua notifikasi ditandai sudah dibaca.' });
}
```

---

## 22. Modul: Calendar

### `src/app/(dashboard)/calendar/page.tsx`
```typescript
'use client';
import { useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { STATUS_COLORS } from '@/lib/utils';
import { ContentPlan } from '@/types';

export default function CalendarPage() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  const { data: plans } = useQuery({
    queryKey: ['content-plans', 'calendar'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('content_plans')
        .select('id, title, channel, status, scheduled_date')
        .not('scheduled_date', 'is', null);
      return data as ContentPlan[];
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const res = await fetch(`/api/content-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: date }),
      });
      if (!res.ok) throw new Error('Gagal reschedule.');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-plans', 'calendar'] }),
  });

  const events = (plans ?? []).map(plan => ({
    id: plan.id,
    title: plan.title,
    date: plan.scheduled_date,
    classNames: [STATUS_COLORS[plan.status]?.split(' ')[0] ?? 'bg-gray-100'],
  }));

  const canDrag = user?.role === 'content_planner' || user?.role === 'admin';

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">Kalender Konten</h1>
      <div className="bg-white rounded-card shadow-sm p-4">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          editable={canDrag}
          eventDrop={(info) => {
            rescheduleMutation.mutate({
              id: info.event.id,
              date: info.event.startStr,
            });
          }}
          locale="id"
          height="auto"
        />
      </div>
    </div>
  );
}
```

---

## 23. Modul: Kanban Board

### `src/app/(dashboard)/kanban/page.tsx`
```typescript
'use client';
import { useState } from 'react';
import { DndContext, DragEndEvent, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { KANBAN_COLUMNS } from '@/lib/utils';
import { ContentPlan, KanbanColumn } from '@/types';

// KanbanCard component
function KanbanCard({ plan }: { plan: ContentPlan }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plan.id,
    data: { column: plan.kanban_column },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="bg-white rounded-card border border-gray-100 p-3 shadow-sm cursor-grab active:cursor-grabbing">
      <p className="text-sm font-medium text-gray-900 line-clamp-2">{plan.title}</p>
      <p className="text-xs text-gray-400 mt-1">{plan.channel}</p>
    </div>
  );
}

export default function KanbanPage() {
  const queryClient = useQueryClient();

  const { data: plans = [] } = useQuery({
    queryKey: ['content-plans', 'kanban'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('content_plans')
        .select('id, title, channel, status, kanban_column, position_in_kanban')
        .order('kanban_column')
        .order('position_in_kanban');
      return data as ContentPlan[];
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, kanban_column, position_in_kanban }: {
      id: string; kanban_column: string; position_in_kanban: number;
    }) => {
      await fetch(`/api/content-plans/${id}/kanban-move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanban_column, position_in_kanban }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-plans', 'kanban'] }),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const newColumn = over.data.current?.column ?? over.id;
    moveMutation.mutate({
      id: active.id as string,
      kanban_column: newColumn as string,
      position_in_kanban: 0,
    });
  }

  return (
    <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="p-6 overflow-x-auto">
        <h1 className="text-xl font-semibold mb-6">Kanban Board</h1>
        <div className="flex gap-4 min-w-max">
          {KANBAN_COLUMNS.map(col => {
            const colPlans = plans.filter(p => p.kanban_column === col.id);
            return (
              <div key={col.id} className="w-64 flex-shrink-0">
                <div className="bg-gray-50 rounded-card p-3">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3">
                    {col.label} <span className="text-gray-400">({colPlans.length})</span>
                  </h3>
                  <SortableContext
                    items={colPlans.map(p => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2 min-h-[100px]">
                      {colPlans.map(plan => (
                        <KanbanCard key={plan.id} plan={plan} />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}
```

---

## 24. File Upload ke Supabase Storage

### `src/app/api/storage/signed-url/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/get-session';

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !['designer', 'videographer', 'admin'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { content_plan_id, file_name, file_type, content_type } = await request.json();

  const timestamp = Date.now();
  const safeFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `submissions/${content_plan_id}/${file_type}/${timestamp}_${safeFileName}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from('content-submissions')
    .createSignedUploadUrl(path);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-submissions/${path}`;

  return NextResponse.json({ signed_url: data.signedUrl, public_url: publicUrl, path });
}
```

### Upload dari Client
```typescript
// Hook: useFileUpload.ts
export function useFileUpload() {
  const [progress, setProgress] = useState(0);

  async function upload(file: File, contentPlanId: string, fileType: 'design' | 'video') {
    // 1. Minta signed URL
    const res = await fetch('/api/storage/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_plan_id: contentPlanId,
        file_name: file.name,
        file_type: fileType,
        content_type: file.type,
      }),
    });
    const { signed_url, public_url } = await res.json();

    // 2. Upload langsung ke Supabase Storage via XHR (untuk progress)
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error('Upload gagal'));
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.open('PUT', signed_url);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    return { file_url: public_url, file_name: file.name, file_size: file.size };
  }

  return { upload, progress };
}
```

---

## 25. Realtime Subscriptions

### `src/hooks/useRealtimeSubscription.ts`
```typescript
'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { Notification } from '@/types';

export function useRealtimeSubscription() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseBrowser();

    // Kanban / Content Plans sync
    const plansChannel = supabase
      .channel('content_plans_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'content_plans',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['content-plans'] });
      })
      .subscribe();

    // Notifications per user
    const notifChannel = supabase
      .channel(`notifications_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const notif = payload.new as Notification;
        toast.info(notif.message, { duration: 5000 });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(plansChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [user, queryClient]);
}
```

### Mount di Dashboard Layout
```typescript
// src/app/(dashboard)/layout.tsx
'use client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import Sidebar from '@/components/ui/Sidebar';
import Topbar from '@/components/ui/Topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useRealtimeSubscription();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## 26. Deadline Reminder Cron

### Opsi A: Vercel Cron (Rekomendasi)

**`src/app/api/cron/deadline-reminders/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendNotifications } from '@/lib/notifications';

// Vercel memanggil endpoint ini setiap hari pukul 08:00 WIB (01:00 UTC)
export async function GET(request: NextRequest) {
  // Validasi request dari Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Cari plan dengan deadline besok yang belum selesai
  const { data: plans } = await supabase
    .from('content_plans')
    .select('id, title, assignees:content_assignees(user_id)')
    .eq('deadline_date', tomorrowStr)
    .in('status', ['approved', 'in_production']);

  let totalSent = 0;
  for (const plan of (plans ?? [])) {
    const userIds = (plan.assignees as { user_id: string }[]).map(a => a.user_id);
    if (userIds.length === 0) continue;
    await sendNotifications({
      userIds,
      type: 'plan_deadline_approaching',
      message: `Deadline plan "${plan.title}" adalah besok!`,
      contentPlanId: plan.id,
    });
    totalSent += userIds.length;
  }

  return NextResponse.json({ sent: totalSent, date: tomorrowStr });
}
```

**`vercel.json`**
```json
{
  "crons": [
    {
      "path": "/api/cron/deadline-reminders",
      "schedule": "0 1 * * *"
    }
  ]
}
```

Tambahkan `CRON_SECRET=random_string_panjang` ke environment variables Vercel.

### Opsi B: Supabase Edge Function

```bash
supabase functions new deadline-reminders
```

```typescript
// supabase/functions/deadline-reminders/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: plans } = await supabase
    .from('content_plans')
    .select('id, title, assignees:content_assignees(user_id)')
    .eq('deadline_date', tomorrowStr)
    .in('status', ['approved', 'in_production']);

  for (const plan of (plans ?? [])) {
    const userIds = plan.assignees.map((a: { user_id: string }) => a.user_id);
    if (!userIds.length) continue;
    await supabase.from('notifications').insert(
      userIds.map((uid: string) => ({
        user_id: uid,
        type: 'plan_deadline_approaching',
        message: `Deadline plan "${plan.title}" adalah besok!`,
        content_plan_id: plan.id,
      }))
    );
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
```

Jadwalkan via Supabase Dashboard → Edge Functions → Schedule.

---

## 27. UI Components (Design System)

### `src/components/ui/Button.tsx`
```typescript
import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const VARIANTS = {
  primary:   'bg-brand text-white hover:bg-brand-hover disabled:bg-brand/50',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
  ghost:     'text-gray-600 hover:bg-gray-100',
  danger:    'bg-danger text-white hover:bg-red-700',
  success:   'bg-success text-white hover:bg-green-700',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary', size = 'md', loading, disabled, className, children, ...props
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center gap-2 font-medium rounded-btn transition-colors',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      VARIANTS[variant], SIZES[size], className
    )}
    {...props}
  >
    {loading && (
      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    )}
    {children}
  </button>
));
Button.displayName = 'Button';
```

### `src/components/ui/Badge.tsx`
```typescript
import { cn } from '@/lib/utils';
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_COLORS } from '@/lib/utils';
import { ContentStatus, Channel } from '@/types';

interface BadgeProps {
  label: string;
  className?: string;
}

export function Badge({ label, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', className)}>
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <Badge label={STATUS_LABELS[status] ?? status} className={STATUS_COLORS[status]} />
  );
}

export function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <Badge label={channel} className={CHANNEL_COLORS[channel]} />
  );
}
```

### `src/components/ui/Input.tsx`
```typescript
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

const baseClass = 'w-full border border-gray-200 rounded-btn px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:bg-gray-50 disabled:text-gray-500';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseClass, className)} {...props} />
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} rows={3} className={cn(baseClass, 'resize-none', className)} {...props} />
  )
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(baseClass, 'bg-white cursor-pointer', className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = 'Select';
```

### `src/components/ui/Modal.tsx`
```typescript
'use client';
import { cn } from '@/lib/utils';
import { ReactNode, useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  children: ReactNode;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export function Modal({ open, onClose, title, size = 'md', footer, children }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn('relative bg-white rounded-card shadow-xl w-full', SIZES[size])}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmModal({
  open, onClose, onConfirm, loading, title = 'Konfirmasi',
  description = 'Apakah kamu yakin?', confirmLabel = 'Ya', danger,
}: ConfirmModalProps) {
  const { Button } = require('@/components/ui/Button');
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{description}</p>
    </Modal>
  );
}
```

---

## 28. Tailwind Config

### `tailwind.config.ts`
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#BB2649',
          hover: '#9B1E3C',
          light: '#F9E3E8',
          faint: '#FDF4F6',
        },
        sidebar: '#1A1A1C',
        success: {
          DEFAULT: '#16A34A',
          light: '#DCFCE7',
        },
        warning: {
          DEFAULT: '#D97706',
          light: '#FEF3C7',
          faint: '#FFFBEB',
        },
        danger: {
          DEFAULT: '#DC2626',
          light: '#FEE2E2',
          faint: '#FFF5F5',
        },
        info: {
          DEFAULT: '#2563EB',
          light: '#DBEAFE',
        },
      },
      borderRadius: {
        card: '10px',
        btn: '6px',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
```

### `src/app/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

/* FullCalendar overrides */
.fc-button-primary {
  background-color: #BB2649 !important;
  border-color: #BB2649 !important;
}
.fc-button-primary:hover {
  background-color: #9B1E3C !important;
}
.fc-event {
  border-radius: 4px;
  border: none;
  padding: 2px 4px;
  font-size: 12px;
}
```

### `src/app/layout.tsx`
```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Content Planner — Magenta',
  description: 'Sistem manajemen content planning tim marketing Magenta',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

### `src/app/providers.tsx`
```typescript
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
```

---

## 29. Supabase Config Checklist

Sebelum deploy/run, pastikan semua ini sudah dikonfigurasi di Supabase Dashboard:

### Authentication
- [ ] Email provider diaktifkan (Authentication → Providers → Email)
- [ ] "Confirm email" dinonaktifkan untuk development (atau kirim email konfirmasi)
- [ ] Redirect URLs dikonfigurasi (Authentication → URL Configuration)

### Database
- [ ] Schema SQL sudah dijalankan (termasuk trigger `handle_new_user`)
- [ ] Semua RLS policies sudah dibuat
- [ ] Function `get_my_role()` sudah dibuat

### Realtime
```sql
-- Jalankan di SQL Editor:
ALTER PUBLICATION supabase_realtime ADD TABLE content_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

### Storage
- [ ] Bucket `content-submissions` dibuat (Storage → New Bucket)
- [ ] Bucket diset sebagai **Private**
- [ ] Storage policy untuk service role (sudah bypass RLS via service key)

### API Keys
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — dari Project Settings → API
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — service_role key (RAHASIA!)

### Users (Seed)
1. Buka **Authentication → Users → Add User**
2. Buat 5 user dengan email & password
3. Jalankan SQL update role (lihat bagian [Database Schema](#4-database-schema-supabase))

---

## Ringkasan Perubahan Penting

| Aspek | Laravel | Next.js + Supabase |
|---|---|---|
| **Auth** | Sanctum Bearer token | Supabase Auth (cookie session) |
| **Token storage** | localStorage + cookie | httpOnly cookie (Supabase SSR) |
| **Role guard** | `CheckRole` middleware | RLS Policy + server-side check |
| **Users table** | Custom table + bcrypt | Linked ke `auth.users` via trigger |
| **CRUD** | Controller PHP | Supabase client / Route Handler |
| **Notifikasi** | `NotificationService.php` | `sendNotifications()` di Route Handler |
| **Signed URL** | `StorageService.php` | Route Handler dengan admin client |
| **Cron** | `php artisan` + schedule | Vercel Cron / Supabase Edge Function |
| **Realtime** | Supabase (sama) | Supabase (sama) |
| **Upload** | Signed URL PUT (sama) | Signed URL PUT (sama) |

---

*Dokumentasi ini mencakup semua yang diperlukan untuk membangun ulang sistem Content Planner dari nol menggunakan Next.js 14 App Router + Supabase, tanpa Laravel.*
