-- =====================================================
-- HERSYNC AI — COMPLETE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =====================================================

-- =====================================================
-- 1. PROFILES
-- =====================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text not null default 'User',
  ai_name text not null default 'Luna',
  date_of_birth date,
  language text default 'en',
  companion_style text default 'friendly',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile." on public.profiles
  for select using ( auth.uid() = id );
create policy "Users can insert own profile." on public.profiles
  for insert with check ( auth.uid() = id );
create policy "Users can update own profile." on public.profiles
  for update using ( auth.uid() = id );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, ai_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'User'),
    coalesce(new.raw_user_meta_data->>'ai_name', 'Luna')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =====================================================
-- 2. USER MEMORY (AI context memory per user)
-- =====================================================
create table if not exists public.user_memory (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  preferred_language text default 'en',
  communication_style text default 'friendly',
  wellness_goals jsonb default '[]'::jsonb,
  common_concerns jsonb default '[]'::jsonb,
  ai_relationship_preferences text,
  summary text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_memory enable row level security;

create policy "Users can view own memory." on public.user_memory
  for select using ( auth.uid() = user_id );
create policy "Users can insert own memory." on public.user_memory
  for insert with check ( auth.uid() = user_id );
create policy "Users can update own memory." on public.user_memory
  for update using ( auth.uid() = user_id );


-- =====================================================
-- 3. DAILY LOGS (check-ins)
-- =====================================================
create table if not exists public.daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  log_date date not null,
  mood text not null,
  sleep numeric not null,
  water numeric not null,
  exercise numeric not null,
  stress numeric not null,
  acne integer default 0,
  hair_fall text default 'none',
  bloating text default 'none',
  fatigue text default 'none',
  cramps text default 'none',
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, log_date)
);

alter table public.daily_logs enable row level security;

create policy "Users can view own daily logs." on public.daily_logs
  for select using ( auth.uid() = user_id );
create policy "Users can insert own daily logs." on public.daily_logs
  for insert with check ( auth.uid() = user_id );
create policy "Users can update own daily logs." on public.daily_logs
  for update using ( auth.uid() = user_id );
create policy "Users can delete own daily logs." on public.daily_logs
  for delete using ( auth.uid() = user_id );


-- =====================================================
-- 4. CYCLE LOGS (period tracking)
-- =====================================================
create table if not exists public.cycle_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.cycle_logs enable row level security;

create policy "Users can view own cycle logs." on public.cycle_logs
  for select using ( auth.uid() = user_id );
create policy "Users can insert own cycle logs." on public.cycle_logs
  for insert with check ( auth.uid() = user_id );
create policy "Users can update own cycle logs." on public.cycle_logs
  for update using ( auth.uid() = user_id );
create policy "Users can delete own cycle logs." on public.cycle_logs
  for delete using ( auth.uid() = user_id );


-- =====================================================
-- 5. SKIN LOGS
-- =====================================================
create table if not exists public.skin_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  log_date date not null,
  image text,
  acne integer not null check (acne >= 0 and acne <= 10),
  oiliness integer not null check (oiliness >= 0 and oiliness <= 10),
  dryness integer not null check (dryness >= 0 and dryness <= 10),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, log_date)
);

alter table public.skin_logs enable row level security;

create policy "Users can view own skin logs." on public.skin_logs
  for select using ( auth.uid() = user_id );
create policy "Users can insert own skin logs." on public.skin_logs
  for insert with check ( auth.uid() = user_id );
create policy "Users can update own skin logs." on public.skin_logs
  for update using ( auth.uid() = user_id );
create policy "Users can delete own skin logs." on public.skin_logs
  for delete using ( auth.uid() = user_id );


-- =====================================================
-- 6. SYMPTOM LOGS
-- =====================================================
create table if not exists public.symptom_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  log_date date not null,
  cramps text not null,
  bloating text not null,
  fatigue text not null,
  hair_fall text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, log_date)
);

alter table public.symptom_logs enable row level security;

create policy "Users can view own symptom logs." on public.symptom_logs
  for select using ( auth.uid() = user_id );
create policy "Users can insert own symptom logs." on public.symptom_logs
  for insert with check ( auth.uid() = user_id );
create policy "Users can update own symptom logs." on public.symptom_logs
  for update using ( auth.uid() = user_id );


-- =====================================================
-- 7. CONVERSATIONS (chat sessions)
-- =====================================================
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text default 'Wellness Session',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.conversations enable row level security;

create policy "Users can view own conversations." on public.conversations
  for select using ( auth.uid() = user_id );
create policy "Users can insert own conversations." on public.conversations
  for insert with check ( auth.uid() = user_id );
create policy "Users can update own conversations." on public.conversations
  for update using ( auth.uid() = user_id );
create policy "Users can delete own conversations." on public.conversations
  for delete using ( auth.uid() = user_id );


-- =====================================================
-- 8. MESSAGES (chat messages within conversations)
-- =====================================================
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations on delete cascade not null,
  role text not null,  -- 'user' or 'assistant'
  content text not null,
  context_audit jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.messages enable row level security;

-- Messages RLS: users can access messages belonging to their own conversations
create policy "Users can view own messages." on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
create policy "Users can insert own messages." on public.messages
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );


-- =====================================================
-- 9. PREMIUM WELLNESS PLANS (AI-generated daily tasks)
-- =====================================================
create table if not exists public.premium_wellness_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  plan_date date not null,
  tasks jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, plan_date)
);

alter table public.premium_wellness_plans enable row level security;

create policy "Users can view own wellness plans." on public.premium_wellness_plans
  for select using ( auth.uid() = user_id );
create policy "Users can insert own wellness plans." on public.premium_wellness_plans
  for insert with check ( auth.uid() = user_id );
create policy "Users can update own wellness plans." on public.premium_wellness_plans
  for update using ( auth.uid() = user_id );


-- =====================================================
-- 10. PREMIUM STREAKS (streak tracking)
-- =====================================================
create table if not exists public.premium_streaks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.premium_streaks enable row level security;

create policy "Users can view own streaks." on public.premium_streaks
  for select using ( auth.uid() = user_id );
create policy "Users can insert own streaks." on public.premium_streaks
  for insert with check ( auth.uid() = user_id );
create policy "Users can update own streaks." on public.premium_streaks
  for update using ( auth.uid() = user_id );


-- =====================================================
-- 11. PERFORMANCE INDEXES
-- =====================================================
create index if not exists idx_daily_logs_user_date on public.daily_logs(user_id, log_date);
create index if not exists idx_cycle_logs_user_start on public.cycle_logs(user_id, start_date);
create index if not exists idx_skin_logs_user_date on public.skin_logs(user_id, log_date);
create index if not exists idx_symptom_logs_user_date on public.symptom_logs(user_id, log_date);
create index if not exists idx_conversations_user on public.conversations(user_id, updated_at);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at);
create index if not exists idx_premium_plans_user_date on public.premium_wellness_plans(user_id, plan_date);
-- ============================================================
-- HERSYNC — Daily Check-in Slots Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Check-in slots table: One row per user + date + time slot
-- Enforces exactly one submission per slot per day via unique constraint
create table if not exists public.checkin_slots (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users on delete cascade not null,
  date          date not null default current_date,
  slot          text not null check (slot in ('morning', 'afternoon', 'evening')),
  completed_at  timestamp with time zone default now() not null,

  -- Morning slot data
  mood          text,
  sleep_hours   numeric,
  stress        integer check (stress >= 1 and stress <= 10),

  -- Afternoon slot data
  water_liters  numeric,
  exercise_min  integer,

  -- Evening slot data
  acne          integer check (acne >= 1 and acne <= 10),
  hair_fall     text,
  bloating      text,
  fatigue       text,
  cramps        text,
  notes         text,

  created_at    timestamp with time zone default now() not null,

  -- CRITICAL: Prevents duplicate submissions at the database level
  unique (user_id, date, slot)
);

alter table public.checkin_slots enable row level security;

create policy "Users can view own checkin slots"
  on public.checkin_slots for select
  using (auth.uid() = user_id);

create policy "Users can insert own checkin slots"
  on public.checkin_slots for insert
  with check (auth.uid() = user_id);

create policy "Users can update own checkin slots"
  on public.checkin_slots for update
  using (auth.uid() = user_id);

-- Performance index
create index if not exists idx_checkin_slots_user_date 
  on public.checkin_slots(user_id, date);

create index if not exists idx_checkin_slots_user_date_slot 
  on public.checkin_slots(user_id, date, slot);
