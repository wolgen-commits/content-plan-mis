-- Migration: Update content_plans status CHECK constraint untuk alur kerja baru
-- Jalankan di Supabase SQL Editor

-- Hapus constraint lama dan buat yang baru
ALTER TABLE content_plans
  DROP CONSTRAINT IF EXISTS content_plans_status_check;

ALTER TABLE content_plans
  ADD CONSTRAINT content_plans_status_check
  CHECK (status IN ('draft','pending_approval','approved','pending_publish','rejected','published'));

-- Update data lama jika ada (opsional — sesuaikan dengan kondisi data Anda)
-- in_production → approved
UPDATE content_plans SET status = 'approved' WHERE status = 'in_production';
-- submitted → pending_publish
UPDATE content_plans SET status = 'pending_publish' WHERE status = 'submitted';
-- done → pending_publish (planner bisa ajukan publish lagi)
UPDATE content_plans SET status = 'pending_publish' WHERE status = 'done';
