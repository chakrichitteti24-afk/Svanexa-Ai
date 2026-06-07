-- Create a table for public profiles
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text not null,
  username text not null,
  ai_name text not null,
  date_of_birth date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a table for user preferences
create table public.user_preferences (
  user_id uuid references auth.users not null primary key,
  language text default 'en',
  communication_style text default 'friendly',
  emoji_preference boolean default true,
  response_length text default 'medium'
);

-- Create a table for user memory
create table public.user_memory (
  user_id uuid references auth.users not null primary key,
  summary text,
  preferred_language text default 'en',
  communication_style text default 'friendly',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_memory enable row level security;

-- Create policies for profiles
create policy "Users can view their own profile."
  on profiles for select
  using ( auth.uid() = id );

create policy "Users can update their own profile."
  on profiles for update
  using ( auth.uid() = id );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

-- Create policies for user_preferences
create policy "Users can view their own preferences."
  on user_preferences for select
  using ( auth.uid() = user_id );

create policy "Users can update their own preferences."
  on user_preferences for update
  using ( auth.uid() = user_id );

create policy "Users can insert their own preferences."
  on user_preferences for insert
  with check ( auth.uid() = user_id );

-- Create policies for user_memory
create policy "Users can view their own memory."
  on user_memory for select
  using ( auth.uid() = user_id );

create policy "Users can update their own memory."
  on user_memory for update
  using ( auth.uid() = user_id );

create policy "Users can insert their own memory."
  on user_memory for insert
  with check ( auth.uid() = user_id );

-- Create a trigger to automatically create a profile, user_preferences, and user_memory when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, ai_name, date_of_birth)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'ai_name',
    (new.raw_user_meta_data->>'date_of_birth')::date
  );

  insert into public.user_preferences (user_id)
  values (new.id);

  insert into public.user_memory (user_id)
  values (new.id);

  return new;
end;
$$;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
