-- ============================================================
-- MIGRATION: Tambah status 'published' ke content_plans
-- Jalankan di Supabase SQL Editor (sekali saja)
-- ============================================================

-- PostgreSQL tidak bisa ALTER CHECK constraint secara langsung.
-- Solusi: drop constraint lama, buat baru dengan 'published' ditambahkan.

ALTER TABLE content_plans
  DROP CONSTRAINT IF EXISTS content_plans_status_check;

ALTER TABLE content_plans
  ADD CONSTRAINT content_plans_status_check
  CHECK (status IN (
    'draft',
    'pending_approval',
    'approved',
    'in_production',
    'submitted',
    'done',
    'rejected',
    'published'
  ));
