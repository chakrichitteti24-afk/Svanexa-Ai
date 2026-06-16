-- Supabase Schema Patch for HerSync Complete Master System Tables
-- This ensures all expected tables (skin_logs, symptom_logs, wellness_plans) are initialized.

-- 1. Create skin_logs table
create table if not exists public.skin_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  log_date date not null,
  image text,
  acne integer not null check (acne >= 0 and acne <= 10),
  oiliness integer not null check (oiliness >= 0 and oiliness <= 10),
  dryness integer not null check (dryness >= 0 and dryness <= 10),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, log_date)
);

-- Enable RLS and setup policies for skin_logs
alter table public.skin_logs enable row level security;

create policy "Users can view own skin logs." on public.skin_logs
  for select using ( auth.uid() = user_id );

create policy "Users can insert own skin logs." on public.skin_logs
  for insert with check ( auth.uid() = user_id );

create policy "Users can update own skin logs." on public.skin_logs
  for update using ( auth.uid() = user_id );

create policy "Users can delete own skin logs." on public.skin_logs
  for delete using ( auth.uid() = user_id );


-- 2. Create symptom_logs table (complementary to daily_logs)
create table if not exists public.symptom_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  log_date date not null,
  cramps text not null,
  bloating text not null,
  fatigue text not null,
  hair_fall text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, log_date)
);

-- Enable RLS and setup policies for symptom_logs
alter table public.symptom_logs enable row level security;

create policy "Users can view own symptom logs." on public.symptom_logs
  for select using ( auth.uid() = user_id );

create policy "Users can insert own symptom logs." on public.symptom_logs
  for insert with check ( auth.uid() = user_id );

create policy "Users can update own symptom logs." on public.symptom_logs
  for update using ( auth.uid() = user_id );


-- 3. Create compatible wellness_plans table
create table if not exists public.wellness_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  plan_date date not null,
  tasks jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, plan_date)
);

-- Enable RLS and setup policies for wellness_plans
alter table public.wellness_plans enable row level security;

create policy "Users can view own wellness plans." on public.wellness_plans
  for select using ( auth.uid() = user_id );

create policy "Users can insert own wellness plans." on public.wellness_plans
  for insert with check ( auth.uid() = user_id );

create policy "Users can update own wellness plans." on public.wellness_plans
  for update using ( auth.uid() = user_id );


-- 4. Setup performance indexes
create index if not exists idx_skin_logs_user_date on public.skin_logs(user_id, log_date);
create index if not exists idx_symptom_logs_user_date on public.symptom_logs(user_id, log_date);
create index if not exists idx_wellness_plans_user_date on public.wellness_plans(user_id, plan_date);
