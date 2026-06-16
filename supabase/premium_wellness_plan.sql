-- Create premium_wellness_plans table
create table if not exists public.premium_wellness_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  plan_date date not null,
  tasks jsonb not null default '[]'::jsonb, -- Array of: { id: string, text: string, category: string, completed: boolean, completed_at: string | null }
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, plan_date)
);

-- Create premium_streaks table to keep track of streaks
create table if not exists public.premium_streaks (
  user_id uuid references auth.users not null primary key,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.premium_wellness_plans enable row level security;
alter table public.premium_streaks enable row level security;

-- Policies for premium_wellness_plans
create policy "Users can view own premium wellness plans." on premium_wellness_plans for select using ( auth.uid() = user_id );
create policy "Users can insert own premium wellness plans." on premium_wellness_plans for insert with check ( auth.uid() = user_id );
create policy "Users can update own premium wellness plans." on premium_wellness_plans for update using ( auth.uid() = user_id );

-- Policies for premium_streaks
create policy "Users can view own premium streaks." on premium_streaks for select using ( auth.uid() = user_id );
create policy "Users can insert own premium streaks." on premium_streaks for insert with check ( auth.uid() = user_id );
create policy "Users can update own premium streaks." on premium_streaks for update using ( auth.uid() = user_id );
