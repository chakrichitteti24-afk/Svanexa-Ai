-- ============================================================
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Wellness streaks table (replaces legacy premium_streaks)
create table if not exists public.wellness_streaks (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users not null unique,
  current_streak  integer default 0 not null,
  longest_streak  integer default 0 not null,
  last_active_date date,
  weekly_consistency integer default 0,
  created_at    timestamp with time zone default now() not null,
  updated_at    timestamp with time zone default now() not null
);

alter table public.wellness_streaks enable row level security;

create policy "Users can manage own streaks"
  on public.wellness_streaks for all
  using (auth.uid() = user_id);

-- Ensure wellness_plans has the columns we use
-- (title = plan_date string, content = JSON tasks array)
-- This was already created in the previous schema.

-- Optional: drop the old legacy tables if they exist
-- drop table if exists public.premium_wellness_plans;
-- drop table if exists public.premium_streaks;
