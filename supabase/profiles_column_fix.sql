-- ============================================================
-- PROFILES TABLE: Safe column additions
-- Run this in Supabase SQL editor.
-- Each ALTER is separate — safe to re-run at any time.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_theme text DEFAULT 'default';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_dashboard_style text DEFAULT 'minimal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_companion_style text DEFAULT 'friendly';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());
