-- Add tables and memory configurations for HerSync AI

-- 1. Create Profiles Table (if not exists)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text not null,
  username text not null,
  ai_name text not null default 'Luna',
  date_of_birth date not null default '2000-01-01'::date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Extend or create user_memory
create table if not exists public.user_memory (
  user_id uuid references auth.users not null primary key,
  preferred_language text default 'en',
  communication_style text default 'friendly',
  wellness_goals text[] default '{}',
  common_concerns text[] default '{}',
  ai_relationship_preferences text,
  summary text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create daily_logs table (replaces check_ins)
create table if not exists public.daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  log_date date not null,
  mood text not null,
  sleep numeric not null check (sleep >= 0 and sleep <= 24),
  water numeric not null check (water >= 0 and water <= 10),
  exercise numeric not null check (exercise >= 0 and exercise <= 360),
  stress numeric not null check (stress >= 1 and stress <= 10),
  acne numeric not null check (acne >= 1 and acne <= 10),
  hair_fall text not null,
  bloating text not null,
  fatigue text not null,
  cramps text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, log_date)
);

-- 4. Create cycle_logs table (replaces cycles)
create table if not exists public.cycle_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint start_before_end check (start_date <= end_date)
);

-- 5. Create conversations table
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Create messages table with a JSONB column for the Context Audit System
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  context_audit jsonb default '{"used_sleep_data": false, "used_mood_data": false, "used_stress_data": false, "used_cycle_data": false, "used_symptom_data": false}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_memory enable row level security;
alter table public.daily_logs enable row level security;
alter table public.cycle_logs enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Policies for profiles
create policy "Users can view own profile." on profiles for select using ( auth.uid() = id );
create policy "Users can update own profile." on profiles for update using ( auth.uid() = id );
create policy "Users can insert own profile." on profiles for insert with check ( auth.uid() = id );

-- Policies for user_memory
create policy "Users can view own memory." on user_memory for select using ( auth.uid() = user_id );
create policy "Users can update own memory." on user_memory for update using ( auth.uid() = user_id );
create policy "Users can insert own memory." on user_memory for insert with check ( auth.uid() = user_id );

-- Policies for daily_logs
create policy "Users can view own daily logs." on daily_logs for select using ( auth.uid() = user_id );
create policy "Users can insert own daily logs." on daily_logs for insert with check ( auth.uid() = user_id );
create policy "Users can update own daily logs." on daily_logs for update using ( auth.uid() = user_id );
create policy "Users can delete own daily logs." on daily_logs for delete using ( auth.uid() = user_id );

-- Policies for cycle_logs
create policy "Users can view own cycle logs." on cycle_logs for select using ( auth.uid() = user_id );
create policy "Users can insert own cycle logs." on cycle_logs for insert with check ( auth.uid() = user_id );
create policy "Users can update own cycle logs." on cycle_logs for update using ( auth.uid() = user_id );
create policy "Users can delete own cycle logs." on cycle_logs for delete using ( auth.uid() = user_id );

-- Policies for conversations
create policy "Users can view own conversations." on conversations for select using ( auth.uid() = user_id );
create policy "Users can insert own conversations." on conversations for insert with check ( auth.uid() = user_id );
create policy "Users can update own conversations." on conversations for update using ( auth.uid() = user_id );
create policy "Users can delete own conversations." on conversations for delete using ( auth.uid() = user_id );

-- Policies for messages
create policy "Users can view own messages." on messages for select using (
  exists (
    select 1 from public.conversations c 
    where c.id = messages.conversation_id and c.user_id = auth.uid()
  )
);
create policy "Users can insert own messages." on messages for insert with check (
  exists (
    select 1 from public.conversations c 
    where c.id = messages.conversation_id and c.user_id = auth.uid()
  )
);

-- Performance Indexes
create index if not exists idx_daily_logs_user_date on public.daily_logs(user_id, log_date);
create index if not exists idx_cycle_logs_user_date on public.cycle_logs(user_id, start_date);
create index if not exists idx_conversations_user on public.conversations(user_id);
create index if not exists idx_messages_conversation on public.messages(conversation_id);

-- Auth Trigger to Automatically Create Profiles & User Memory Rows on SignUp
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username, ai_name, date_of_birth)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', 'User'),
    coalesce(new.raw_user_meta_data->>'ai_name', 'Luna'),
    coalesce((new.raw_user_meta_data->>'date_of_birth')::date, '2000-01-01'::date)
  );

  insert into public.user_memory (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger cleanly
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
