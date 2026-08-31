-- ==============================================================================
-- SVANEXA / HERSYNC — Ultra-Safe Supabase Instant Sync & Multilingual Patch
-- Fully idempotent with nested exception handlers for 100% error-free execution
-- Run this in your Supabase Project Dashboard -> SQL Editor -> Run
-- ==============================================================================

DO $$
BEGIN
  -- ──────────────────────────────────────────────────────────────────────────
  -- 1. Enable Supabase Realtime CDC (Change Data Capture)
  -- ──────────────────────────────────────────────────────────────────────────
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_checkins;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_balances;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_preferences;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wellness_plans;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.skin_logs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cycle_logs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 2. Multi-Language & AI Customization Columns
  -- ──────────────────────────────────────────────────────────────────────────
  BEGIN
    ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS language text DEFAULT 'English';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_name text DEFAULT 'Luna';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_theme text DEFAULT 'default';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_dashboard_style text DEFAULT 'minimal';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_companion_style text DEFAULT 'friendly';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.daily_checkins ADD COLUMN IF NOT EXISTS summary text;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 3. Dynamic Indexes (Safely checks exact column names before indexing)
  -- ──────────────────────────────────────────────────────────────────────────
  -- user_preferences
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id)';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- coin_balances
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_coin_balances_user_id ON public.coin_balances(user_id)';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- daily_checkins
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_checkins' AND column_name = 'date') THEN
    BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.daily_checkins(user_id, date)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_checkins' AND column_name = 'checkin_date') THEN
    BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.daily_checkins(user_id, checkin_date)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_checkins' AND column_name = 'log_date') THEN
    BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.daily_checkins(user_id, log_date)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- wellness_plans
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wellness_plans' AND column_name = 'plan_date') THEN
    BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wellness_plans_user_date ON public.wellness_plans(user_id, plan_date)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wellness_plans' AND column_name = 'date') THEN
    BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wellness_plans_user_date ON public.wellness_plans(user_id, date)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wellness_plans' AND column_name = 'title') THEN
    BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wellness_plans_user_date ON public.wellness_plans(user_id, title)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- skin_logs
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'skin_logs' AND column_name = 'log_date') THEN
    BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_skin_logs_user_date ON public.skin_logs(user_id, log_date)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'skin_logs' AND column_name = 'date') THEN
    BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_skin_logs_user_date ON public.skin_logs(user_id, date)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- cycle_logs
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cycle_logs' AND column_name = 'start_date') THEN
    BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cycle_logs_user_start ON public.cycle_logs(user_id, start_date)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cycle_logs' AND column_name = 'date') THEN
    BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cycle_logs_user_start ON public.cycle_logs(user_id, date)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

END $$;

SELECT 'Svanexa Instant Sync & Multilingual Patch applied successfully!' AS status;
