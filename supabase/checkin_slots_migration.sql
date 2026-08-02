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
