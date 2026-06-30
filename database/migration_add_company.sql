-- Migration: Tambah kolom company di content_plans
-- Jalankan di Supabase SQL Editor

ALTER TABLE content_plans ADD COLUMN IF NOT EXISTS company VARCHAR(100);
