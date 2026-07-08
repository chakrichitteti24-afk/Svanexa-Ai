-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Core User Tables
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text not null,
  username text not null,
  ai_name text not null,
  date_of_birth date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  first_name text,
  last_name text,
  avatar_url text
);

create table if not exists public.user_preferences (
  user_id uuid references auth.users not null primary key,
  language text default 'en',
  communication_style text default 'friendly',
  emoji_preference boolean default true,
  response_length text default 'medium',
  theme text default 'light',
  notifications_enabled boolean default true,
  tracking_goals text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.user_memory (
  user_id uuid references auth.users not null primary key,
  summary text,
  preferred_language text default 'en',
  communication_style text default 'friendly',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Health Logging Tables
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  summary TEXT,
  UNIQUE(user_id, date)
);

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

CREATE TABLE IF NOT EXISTS public.pregnancy_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date DATE,
  current_week INTEGER,
  symptoms TEXT[]
);

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

CREATE TABLE IF NOT EXISTS public.water_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount_ml INTEGER
);

CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duration_hours NUMERIC,
  quality TEXT
);

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

CREATE TABLE IF NOT EXISTS public.wellness_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year TEXT,
  summary TEXT,
  data JSONB
);

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT,
  content TEXT
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT,
  is_read BOOLEAN DEFAULT false
);

-- 3. Enable RLS
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_memory enable row level security;
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

-- 4. Create Policies (Users can only access their own data)
create policy "Users can view their own profile." on profiles for select using ( auth.uid() = id );
create policy "Users can update their own profile." on profiles for update using ( auth.uid() = id );
create policy "Users can insert their own profile." on profiles for insert with check ( auth.uid() = id );

create policy "Users can view their own preferences." on user_preferences for select using ( auth.uid() = user_id );
create policy "Users can update their own preferences." on user_preferences for update using ( auth.uid() = user_id );
create policy "Users can insert their own preferences." on user_preferences for insert with check ( auth.uid() = user_id );

create policy "Users can view their own memory." on user_memory for select using ( auth.uid() = user_id );
create policy "Users can update their own memory." on user_memory for update using ( auth.uid() = user_id );
create policy "Users can insert their own memory." on user_memory for insert with check ( auth.uid() = user_id );

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

-- 5. Trigger to handle new users on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, ai_name, date_of_birth, first_name, last_name)
  values (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'username', 'User'),
    COALESCE(new.raw_user_meta_data->>'ai_name', 'Luna'),
    COALESCE((new.raw_user_meta_data->>'date_of_birth')::date, CURRENT_DATE),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );

  insert into public.user_preferences (user_id)
  values (new.id);

  insert into public.user_memory (user_id)
  values (new.id);

  return new;
end;
$$;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable Realtime
alter publication supabase_realtime add table public.daily_checkins;
alter publication supabase_realtime add table public.mood_logs;
alter publication supabase_realtime add table public.cycle_logs;
alter publication supabase_realtime add table public.reports;
