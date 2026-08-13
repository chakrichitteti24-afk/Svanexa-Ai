-- ============================================================
-- SVANEXA AI — WELLNESS COINS & REWARD SYSTEM MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. USER COIN BALANCES TABLE
create table if not exists public.user_coin_balances (
  user_id     uuid references auth.users on delete cascade primary key,
  balance     integer not null default 0 check (balance >= 0),
  updated_at  timestamp with time zone default now() not null
);

alter table public.user_coin_balances enable row level security;

create policy "Users can view own coin balance"
  on public.user_coin_balances for select
  using (auth.uid() = user_id);

create policy "Users can insert own coin balance"
  on public.user_coin_balances for insert
  with check (auth.uid() = user_id);

create policy "Users can update own coin balance"
  on public.user_coin_balances for update
  using (auth.uid() = user_id);


-- 2. USER COIN TRANSACTIONS TABLE (Duplicate-proof via unique reference_id)
create table if not exists public.user_coin_transactions (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users on delete cascade not null,
  amount           integer not null, -- positive for earned, negative for spent
  transaction_type text not null,     -- 'checkin_slot', 'checkin_all_bonus', 'wellness_task', 'milestone', 'store_purchase'
  reference_id     text not null,     -- e.g. 'checkin:2026-08-13:morning', 'task:2026-08-13:task_id', 'store:theme:lavender'
  description      text not null,
  created_at       timestamp with time zone default now() not null,

  -- CRITICAL: Ensures duplicate coins can NEVER be created for the same action
  unique (user_id, reference_id)
);

alter table public.user_coin_transactions enable row level security;

create policy "Users can view own transactions"
  on public.user_coin_transactions for select
  using (auth.uid() = user_id);

create index if not exists idx_coin_transactions_user_date
  on public.user_coin_transactions(user_id, created_at desc);


-- 3. USER UNLOCKED ITEMS TABLE (Stores purchased themes & styles)
create table if not exists public.user_unlocked_items (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  item_type   text not null check (item_type in ('theme', 'dashboard_style', 'companion_style')),
  item_id     text not null,
  unlocked_at timestamp with time zone default now() not null,

  unique (user_id, item_type, item_id)
);

alter table public.user_unlocked_items enable row level security;

create policy "Users can view own unlocked items"
  on public.user_unlocked_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own unlocked items"
  on public.user_unlocked_items for insert
  with check (auth.uid() = user_id);


-- 4. ADD ACTIVE SELECTIONS TO PROFILES TABLE
alter table public.profiles
  add column if not exists active_theme text default 'default',
  add column if not exists active_dashboard_style text default 'minimal',
  add column if not exists active_companion_style text default 'friendly';


-- 5. RPC FUNCTION: AWARD COINS (Atomically inserts transaction + updates balance)
create or replace function public.award_user_coins(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_ref_id text,
  p_description text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_inserted boolean := false;
  v_new_balance integer := 0;
begin
  -- 1. Try to insert transaction. On conflict (user_id, reference_id), do nothing.
  insert into public.user_coin_transactions (user_id, amount, transaction_type, reference_id, description)
  values (p_user_id, p_amount, p_type, p_ref_id, p_description)
  on conflict (user_id, reference_id) do nothing;

  -- Check if row was actually inserted
  if found then
    v_inserted := true;

    -- 2. Upsert balance
    insert into public.user_coin_balances (user_id, balance, updated_at)
    values (p_user_id, p_amount, now())
    on conflict (user_id) do update
    set balance = public.user_coin_balances.balance + p_amount,
        updated_at = now();
  end if;

  -- Get updated balance
  select balance into v_new_balance
  from public.user_coin_balances
  where user_id = p_user_id;

  return jsonb_build_object(
    'awarded', v_inserted,
    'amount', case when v_inserted then p_amount else 0 end,
    'new_balance', coalesce(v_new_balance, 0)
  );
end;
$$;


-- 6. RPC FUNCTION: PURCHASE STORE ITEM (Atomic transaction with balance validation)
create or replace function public.purchase_store_item(
  p_user_id uuid,
  p_item_type text,
  p_item_id text,
  p_cost integer,
  p_item_name text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_balance integer := 0;
  v_new_balance integer := 0;
  v_already_unlocked boolean := false;
  v_ref_id text;
begin
  -- 1. Check if item is already unlocked
  select exists (
    select 1 from public.user_unlocked_items
    where user_id = p_user_id and item_type = p_item_type and item_id = p_item_id
  ) into v_already_unlocked;

  if v_already_unlocked then
    select coalesce(balance, 0) into v_current_balance
    from public.user_coin_balances where user_id = p_user_id;

    return jsonb_build_object(
      'success', true,
      'already_unlocked', true,
      'message', 'Item is already unlocked.',
      'new_balance', v_current_balance
    );
  end if;

  -- 2. Check user balance
  select coalesce(balance, 0) into v_current_balance
  from public.user_coin_balances
  where user_id = p_user_id;

  if v_current_balance < p_cost then
    return jsonb_build_object(
      'success', false,
      'error', 'Insufficient coins',
      'message', 'Keep checking in to earn more coins.',
      'new_balance', v_current_balance
    );
  end if;

  -- 3. Deduct balance
  update public.user_coin_balances
  set balance = balance - p_cost,
      updated_at = now()
  where user_id = p_user_id;

  select balance into v_new_balance
  from public.user_coin_balances
  where user_id = p_user_id;

  -- 4. Record transaction
  v_ref_id := 'store:' || p_item_type || ':' || p_item_id;
  insert into public.user_coin_transactions (user_id, amount, transaction_type, reference_id, description)
  values (p_user_id, -p_cost, 'store_purchase', v_ref_id, 'Unlocked ' || p_item_name)
  on conflict (user_id, reference_id) do nothing;

  -- 5. Record unlocked item
  insert into public.user_unlocked_items (user_id, item_type, item_id)
  values (p_user_id, p_item_type, p_item_id)
  on conflict (user_id, item_type, item_id) do nothing;

  -- 6. Set active selection in profiles table
  if p_item_type = 'theme' then
    update public.profiles set active_theme = p_item_id where id = p_user_id;
  elsif p_item_type = 'dashboard_style' then
    update public.profiles set active_dashboard_style = p_item_id where id = p_user_id;
  elsif p_item_type = 'companion_style' then
    update public.profiles set active_companion_style = p_item_id where id = p_user_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'already_unlocked', false,
    'message', p_item_name || ' unlocked successfully!',
    'new_balance', v_new_balance
  );
end;
$$;
