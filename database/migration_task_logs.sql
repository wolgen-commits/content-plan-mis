-- ============================================================
-- MIGRATION: Task Log Histori + Revision Counter
-- Jalankan di Supabase SQL Editor (sekali saja)
-- ============================================================

-- 1. Tambah kolom counter ke content_plan_tasks
ALTER TABLE content_plan_tasks
  ADD COLUMN IF NOT EXISTS submit_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revision_count INTEGER NOT NULL DEFAULT 0;

-- 2. Tabel log histori task
CREATE TABLE IF NOT EXISTS content_plan_task_logs (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID    NOT NULL REFERENCES content_plan_tasks(id) ON DELETE CASCADE,
  event_type    VARCHAR(50) NOT NULL
                  CHECK (event_type IN ('created','submitted','revision_requested','approved')),
  event_number  INTEGER,          -- submit #N atau revision #N (null untuk created & approved)
  notes         TEXT,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name    VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_logs_task_time
  ON content_plan_task_logs(task_id, created_at);

-- 3. RLS
ALTER TABLE content_plan_task_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_logs_select" ON content_plan_task_logs;
DROP POLICY IF EXISTS "task_logs_insert" ON content_plan_task_logs;

CREATE POLICY "task_logs_select"
  ON content_plan_task_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "task_logs_insert"
  ON content_plan_task_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
