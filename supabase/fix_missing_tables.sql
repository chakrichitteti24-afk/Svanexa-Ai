-- =====================================================
-- FIX MISSING TABLES (pregnancy_logs, period_logs, coin_balances, coin_transactions, chat_history)
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- =====================================================

-- 1. Pregnancy Logs
CREATE TABLE IF NOT EXISTS public.pregnancy_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date DATE,
  current_week INTEGER,
  symptoms TEXT[],
  notes TEXT
);

ALTER TABLE public.pregnancy_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own pregnancy logs" ON public.pregnancy_logs;
CREATE POLICY "Users can manage their own pregnancy logs" 
  ON public.pregnancy_logs 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Period / Cycle Logs
CREATE TABLE IF NOT EXISTS public.period_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  flow_intensity TEXT,
  symptoms TEXT[],
  notes TEXT
);

ALTER TABLE public.period_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own period logs" ON public.period_logs;
CREATE POLICY "Users can manage their own period logs" 
  ON public.period_logs 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Coin Balances
CREATE TABLE IF NOT EXISTS public.coin_balances (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  balance INTEGER DEFAULT 0,
  lifetime_earned INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own coin balance" ON public.coin_balances;
CREATE POLICY "Users can manage their own coin balance" 
  ON public.coin_balances 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Coin Transactions
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT
);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own coin transactions" ON public.coin_transactions;
CREATE POLICY "Users can manage their own coin transactions" 
  ON public.coin_transactions 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Chat History
CREATE TABLE IF NOT EXISTS public.chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL
);

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own chat history" ON public.chat_history;
CREATE POLICY "Users can manage their own chat history" 
  ON public.chat_history 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
