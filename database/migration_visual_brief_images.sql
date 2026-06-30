-- Migration: Tambah kolom visual_brief_images di content_plans
-- Jalankan di Supabase SQL Editor

ALTER TABLE content_plans
  ADD COLUMN IF NOT EXISTS visual_brief_images JSONB DEFAULT '[]'::jsonb;
