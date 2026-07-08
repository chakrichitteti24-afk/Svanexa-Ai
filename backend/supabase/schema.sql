-- HerSync Supabase Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  dob DATE
);

-- Table: user_preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  theme TEXT DEFAULT 'light',
  notifications_enabled BOOLEAN DEFAULT true,
  tracking_goals TEXT[]
);

-- Table: daily_checkins
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  summary TEXT,
  UNIQUE(user_id, date)
);

-- Table: cycle_logs
CREATE TABLE IF NOT EXISTS public.cycle_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  flow_intensity TEXT,
  symptoms TEXT[]
);

-- Table: pregnancy_logs
CREATE TABLE IF NOT EXISTS public.pregnancy_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date DATE,
  current_week INTEGER,
  symptoms TEXT[]
);

-- Table: skin_logs
CREATE TABLE IF NOT EXISTS public.skin_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  condition TEXT,
  breakouts BOOLEAN,
  notes TEXT
);

-- Table: exercise_logs
CREATE TABLE IF NOT EXISTS public.exercise_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT,
  duration_minutes INTEGER,
  intensity TEXT
);

-- Table: water_logs
CREATE TABLE IF NOT EXISTS public.water_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount_ml INTEGER
);

-- Table: sleep_logs
CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duration_hours NUMERIC,
  quality TEXT
);

-- Table: mood_logs
CREATE TABLE IF NOT EXISTS public.mood_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mood TEXT,
  intensity INTEGER,
  notes TEXT
);

-- Table: wellness_plans
CREATE TABLE IF NOT EXISTS public.wellness_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Table: reports
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year TEXT,
  summary TEXT,
  data JSONB
);

-- Table: chat_sessions
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT
);

-- Table: chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT,
  content TEXT
);

-- Table: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT,
  is_read BOOLEAN DEFAULT false
);

-- Set up Row Level Security (RLS)

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pregnancy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for User Access
CREATE POLICY "Users can manage their own profiles" ON public.profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own checkins" ON public.daily_checkins FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own cycle logs" ON public.cycle_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own pregnancy logs" ON public.pregnancy_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own skin logs" ON public.skin_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own exercise logs" ON public.exercise_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own water logs" ON public.water_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own sleep logs" ON public.sleep_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own mood logs" ON public.mood_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own wellness plans" ON public.wellness_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own reports" ON public.reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own chat sessions" ON public.chat_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own chat messages" ON public.chat_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- Enable Realtime for relevant tables
alter publication supabase_realtime add table public.daily_checkins;
alter publication supabase_realtime add table public.mood_logs;
alter publication supabase_realtime add table public.cycle_logs;
alter publication supabase_realtime add table public.pregnancy_logs;
alter publication supabase_realtime add table public.reports;

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.daily_checkins FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.cycle_logs FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.pregnancy_logs FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.skin_logs FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.exercise_logs FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.water_logs FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.sleep_logs FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.mood_logs FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.wellness_plans FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.chat_sessions FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
