-- ============================================================
-- Content Planner — Schema untuk Next.js + Supabase
-- Jalankan SELURUH file ini di Supabase SQL Editor (sekali saja)
-- ============================================================

-- 1. USERS PROFILE
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

-- Trigger: otomatis buat row di users saat user baru dibuat di auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'content_planner')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
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
-- AKTIFKAN REALTIME (aman dijalankan berulang)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'content_plans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE content_plans;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

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
-- HELPER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- USERS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "users_select_authenticated" ON users;
DROP POLICY IF EXISTS "users_insert_admin" ON users;
DROP POLICY IF EXISTS "users_update_admin_or_self" ON users;
DROP POLICY IF EXISTS "users_delete_admin" ON users;

CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');

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
DROP POLICY IF EXISTS "content_plans_select" ON content_plans;
DROP POLICY IF EXISTS "content_plans_insert" ON content_plans;
DROP POLICY IF EXISTS "content_plans_update" ON content_plans;
DROP POLICY IF EXISTS "content_plans_delete" ON content_plans;

CREATE POLICY "content_plans_select"
  ON content_plans FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "content_plans_insert"
  ON content_plans FOR INSERT
  WITH CHECK (get_my_role() IN ('content_planner', 'admin'));

CREATE POLICY "content_plans_update"
  ON content_plans FOR UPDATE
  USING (created_by = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "content_plans_delete"
  ON content_plans FOR DELETE
  USING (created_by = auth.uid() OR get_my_role() = 'admin');

-- ============================================================
-- CONTENT REFERENCES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "refs_select" ON content_references;
DROP POLICY IF EXISTS "refs_insert" ON content_references;
DROP POLICY IF EXISTS "refs_delete" ON content_references;

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
DROP POLICY IF EXISTS "tags_select" ON content_tags;
DROP POLICY IF EXISTS "tags_insert" ON content_tags;
DROP POLICY IF EXISTS "tags_delete" ON content_tags;

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
DROP POLICY IF EXISTS "assignees_select" ON content_assignees;
DROP POLICY IF EXISTS "assignees_insert" ON content_assignees;
DROP POLICY IF EXISTS "assignees_delete" ON content_assignees;

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
DROP POLICY IF EXISTS "submissions_select" ON content_submissions;
DROP POLICY IF EXISTS "submissions_insert" ON content_submissions;
DROP POLICY IF EXISTS "submissions_update" ON content_submissions;

CREATE POLICY "submissions_select" ON content_submissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "submissions_insert" ON content_submissions FOR INSERT WITH CHECK (
  get_my_role() IN ('designer', 'videographer', 'admin') AND submitted_by = auth.uid()
);
CREATE POLICY "submissions_update" ON content_submissions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM content_plans cp
    WHERE cp.id = content_plan_id AND (cp.created_by = auth.uid() OR get_my_role() = 'admin')
  )
);

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "notifications_select" ON notifications;

CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- UPDATE ROLE USER YANG SUDAH DI-SEED
-- (Jalankan setelah seed via /api/seed)
-- ============================================================
UPDATE users SET role = 'admin'             WHERE email = 'admin@magenta.id';
UPDATE users SET role = 'content_planner'   WHERE email = 'planner@magenta.id';
UPDATE users SET role = 'manager_marketing' WHERE email = 'manager@magenta.id';
UPDATE users SET role = 'designer'          WHERE email = 'designer@magenta.id';
UPDATE users SET role = 'videographer'      WHERE email = 'video@magenta.id';
