-- =============================================================
-- NQ Journal — Supabase schema
--
-- Run this once in the Supabase SQL Editor. It is idempotent and it is also
-- the migration path for a journal created before accounts existed: every
-- trade, note and cash flow that has no account yet is adopted by a default
-- account built from your current settings, so nothing you already loaded is
-- lost or orphaned.
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- accounts — one journal per trading account
--
-- The whole app is scoped to exactly one of these at a time. A backtest, a
-- demo, a funded challenge and a live account each keep their own trades,
-- notes, cash flows and money settings, so their statistics never mix.
--
-- `settings` holds the money/risk/instrument preferences that only make sense
-- per account (starting balance, risk capital, commissions, daily limits).
-- App-wide preferences — theme, timezone, vocabulary — stay in `app_settings`.
-- -------------------------------------------------------------
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  kind            text        not null default 'real'
                    check (kind in ('backtest', 'demo', 'real', 'fondeo', 'otro')),
  broker          text,
  note            text,
  settings        jsonb       not null default '{}',
  archived        boolean     not null default false,
  sort_order      integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists accounts_sort_idx on public.accounts (archived, sort_order, created_at);

-- -------------------------------------------------------------
-- trades
-- -------------------------------------------------------------
create table if not exists public.trades (
  id              uuid primary key default gen_random_uuid(),

  -- Identity
  account_id      uuid,
  symbol          text        not null default 'MNQ',
  direction       text        not null check (direction in ('Long', 'Short')),
  contracts       numeric(10,2) not null default 1,

  -- Execution
  entry_price     numeric(14,4),
  exit_price      numeric(14,4),
  stop_price      numeric(14,4),
  target_price    numeric(14,4),
  entry_at        timestamptz,
  exit_at         timestamptz,

  -- Money (derived on write so SQL consumers need no formulas)
  pnl_mode        text        not null default 'prices',
  commission      numeric(12,2) not null default 0,
  gross_pnl       numeric(12,2) not null default 0,
  net_pnl         numeric(12,2) not null default 0,
  points          numeric(12,4),
  ticks           numeric(12,2),
  rr_ratio        numeric(10,2),
  manual_risk     numeric(12,2),
  risk_amount     numeric(12,2),
  risk_pct        numeric(8,4),
  risk_source     text,
  r_multiple      numeric(10,3),
  planned_rr      numeric(10,2),

  -- Classification
  outcome         text        not null default 'breakeven',
  session         text,
  day             date,
  duration_min    numeric(10,2),

  -- Journal
  setup           text,
  tags            text[]      not null default '{}',
  mistakes        text[]      not null default '{}',
  emotion         text,
  rating          smallint    not null default 0,
  followed_plan   boolean,
  notes           text,
  images          jsonb       not null default '[]',

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists trades_day_idx      on public.trades (day desc);
create index if not exists trades_symbol_idx   on public.trades (symbol);
create index if not exists trades_session_idx  on public.trades (session);
create index if not exists trades_setup_idx    on public.trades (setup);
create index if not exists trades_tags_idx     on public.trades using gin (tags);

-- Migration for journals created before the R:R risk fields existed.
-- Safe to re-run; `if not exists` makes each column idempotent.
alter table public.trades add column if not exists rr_ratio    numeric(10,2);
alter table public.trades add column if not exists manual_risk numeric(12,2);
alter table public.trades add column if not exists risk_pct    numeric(8,4);
alter table public.trades add column if not exists risk_source text;

-- -------------------------------------------------------------
-- day_notes — the daily journaling entry (pre-market plan, review)
--
-- Keyed by (account, date): the same calendar day can hold one plan for the
-- demo account and a different one for the funded challenge.
-- -------------------------------------------------------------
create table if not exists public.day_notes (
  account_id      uuid,
  date            date        not null,
  bias            text,
  mood            text,
  discipline      smallint,
  plan            text,
  review          text,
  lessons         text,
  images          jsonb       not null default '[]',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -------------------------------------------------------------
-- cash_flows — deposits and withdrawals
-- -------------------------------------------------------------
create table if not exists public.cash_flows (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid,
  date            date        not null,
  amount          numeric(12,2) not null,
  kind            text        not null check (kind in ('deposit', 'withdrawal')),
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists cash_flows_date_idx on public.cash_flows (date desc);

-- -------------------------------------------------------------
-- app_settings — a single JSON blob keyed by name
-- -------------------------------------------------------------
create table if not exists public.app_settings (
  key             text primary key,
  value           jsonb       not null default '{}',
  updated_at      timestamptz not null default now()
);

-- =============================================================
-- Accounts migration
--
-- Everything below runs on an existing journal as well as an empty one. On an
-- existing one it creates a single account seeded from your current settings
-- and hands it every row that predates accounts.
-- =============================================================

alter table public.trades     add column if not exists account_id uuid;
alter table public.day_notes  add column if not exists account_id uuid;
alter table public.cash_flows add column if not exists account_id uuid;

do $$
declare
  fallback uuid;
  legacy   jsonb;
begin
  -- Only adopt orphans if there is something to adopt, so re-running this on a
  -- healthy multi-account journal is a no-op.
  if exists (select 1 from public.trades     where account_id is null)
  or exists (select 1 from public.day_notes  where account_id is null)
  or exists (select 1 from public.cash_flows where account_id is null)
  or not exists (select 1 from public.accounts)
  then
    select value into legacy from public.app_settings where key = 'main';

    -- Prefer an account that already exists (a re-run after a partial
    -- migration) over creating a second one.
    select id into fallback from public.accounts order by sort_order, created_at limit 1;

    if fallback is null then
      insert into public.accounts (name, kind, settings, sort_order)
      values (
        coalesce(nullif(legacy->>'accountName', ''), 'Mi cuenta'),
        'real',
        coalesce(legacy, '{}'::jsonb),
        0
      )
      returning id into fallback;
    end if;

    update public.trades     set account_id = fallback where account_id is null;
    update public.day_notes  set account_id = fallback where account_id is null;
    update public.cash_flows set account_id = fallback where account_id is null;
  end if;
end $$;

-- With every row adopted, the column can carry its constraints.
do $$
begin
  if exists (select 1 from public.accounts) then
    alter table public.trades     alter column account_id set not null;
    alter table public.day_notes  alter column account_id set not null;
    alter table public.cash_flows alter column account_id set not null;
  end if;
exception when others then
  raise notice 'account_id sigue siendo nullable: %', sqlerrm;
end $$;

-- Deleting an account takes its journal with it; that is the point of the
-- "eliminar cuenta" button in Ajustes.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trades_account_fk' and conrelid = 'public.trades'::regclass
  ) then
    alter table public.trades add constraint trades_account_fk
      foreign key (account_id) references public.accounts (id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'day_notes_account_fk' and conrelid = 'public.day_notes'::regclass
  ) then
    alter table public.day_notes add constraint day_notes_account_fk
      foreign key (account_id) references public.accounts (id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'cash_flows_account_fk' and conrelid = 'public.cash_flows'::regclass
  ) then
    alter table public.cash_flows add constraint cash_flows_account_fk
      foreign key (account_id) references public.accounts (id) on delete cascade;
  end if;
end $$;

-- day_notes used to be keyed by date alone. Two accounts need to be able to
-- journal the same day, so the key becomes the pair.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'day_notes_pkey'
      and conrelid = 'public.day_notes'::regclass
      and array_length(conkey, 1) = 1
  ) then
    alter table public.day_notes drop constraint day_notes_pkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'day_notes_pkey' and conrelid = 'public.day_notes'::regclass
  ) then
    alter table public.day_notes add constraint day_notes_pkey primary key (account_id, date);
  end if;
end $$;

create index if not exists trades_account_idx     on public.trades (account_id, day desc);
create index if not exists day_notes_account_idx  on public.day_notes (account_id, date desc);
create index if not exists cash_flows_account_idx on public.cash_flows (account_id, date);

-- -------------------------------------------------------------
-- updated_at trigger
-- -------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trades_touch on public.trades;
create trigger trades_touch before update on public.trades
  for each row execute function public.touch_updated_at();

drop trigger if exists day_notes_touch on public.day_notes;
create trigger day_notes_touch before update on public.day_notes
  for each row execute function public.touch_updated_at();

drop trigger if exists accounts_touch on public.accounts;
create trigger accounts_touch before update on public.accounts
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------
-- Row Level Security
--
-- This is a single-user personal journal reached with the anon key, so the
-- policies below are permissive. If you ever expose this publicly, replace
-- them with auth.uid()-scoped policies and add a user_id column.
-- -------------------------------------------------------------
alter table public.accounts     enable row level security;
alter table public.trades       enable row level security;
alter table public.day_notes    enable row level security;
alter table public.cash_flows   enable row level security;
alter table public.app_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['accounts','trades','day_notes','cash_flows','app_settings'] loop
    execute format('drop policy if exists "personal access" on public.%I', t);
    execute format(
      'create policy "personal access" on public.%I for all using (true) with check (true)', t
    );
  end loop;
end $$;

-- -------------------------------------------------------------
-- Storage bucket for chart screenshots
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('trade-images', 'trade-images', true)
on conflict (id) do nothing;

drop policy if exists "trade images read"  on storage.objects;
drop policy if exists "trade images write" on storage.objects;

create policy "trade images read" on storage.objects
  for select using (bucket_id = 'trade-images');

create policy "trade images write" on storage.objects
  for all using (bucket_id = 'trade-images') with check (bucket_id = 'trade-images');

-- =============================================================
-- Handy analysis views
--
-- All of them break down by account, so a query that used to answer "how did
-- I do" now answers it per journal instead of averaging a backtest together
-- with a funded account.
-- =============================================================

-- `create or replace view` cannot reorder or rename existing columns, and
-- every view below now leads with `account_id`. Dropping them first is what
-- lets this file run against a journal created before accounts existed.
drop view if exists public.v_accounts;
drop view if exists public.v_daily_pnl;
drop view if exists public.v_risk_discipline;
drop view if exists public.v_setup_performance;
drop view if exists public.v_session_performance;

create view public.v_accounts as
select
  a.id,
  a.name,
  a.kind,
  a.archived,
  coalesce((a.settings->>'startingBalance')::numeric, 0)          as starting_balance,
  count(t.id)                                                     as trades,
  round(coalesce(sum(t.net_pnl), 0), 2)                           as net_pnl,
  round(
    coalesce((a.settings->>'startingBalance')::numeric, 0) + coalesce(sum(t.net_pnl), 0), 2
  )                                                               as equity,
  max(t.day)                                                      as last_trade_day
from public.accounts a
left join public.trades t on t.account_id = a.id
group by a.id
order by a.archived, a.sort_order, a.created_at;

create view public.v_daily_pnl as
select
  account_id,
  day,
  count(*)                                     as trades,
  count(*) filter (where net_pnl > 0)          as wins,
  count(*) filter (where net_pnl < 0)          as losses,
  round(sum(net_pnl), 2)                       as net_pnl,
  round(sum(commission), 2)                    as commissions,
  round(avg(r_multiple), 3)                    as avg_r
from public.trades
where day is not null
group by account_id, day
order by day desc;

create view public.v_risk_discipline as
select
  account_id,
  day,
  count(*)                                     as trades,
  round(avg(risk_pct), 3)                      as avg_risk_pct,
  round(max(risk_pct), 3)                      as max_risk_pct,
  round(sum(risk_amount), 2)                   as total_risked,
  round(sum(net_pnl), 2)                       as net_pnl
from public.trades
where risk_pct is not null
group by account_id, day
order by day desc;

create view public.v_setup_performance as
select
  account_id,
  coalesce(nullif(setup, ''), 'Sin setup')     as setup,
  count(*)                                     as trades,
  round(100.0 * count(*) filter (where net_pnl > 0) / nullif(count(*), 0), 1) as win_rate,
  round(sum(net_pnl), 2)                       as net_pnl,
  round(avg(net_pnl), 2)                       as avg_pnl,
  round(avg(r_multiple), 3)                    as avg_r
from public.trades
group by account_id, 2
order by net_pnl desc;

create view public.v_session_performance as
select
  account_id,
  coalesce(session, 'desconocida')             as session,
  count(*)                                     as trades,
  round(100.0 * count(*) filter (where net_pnl > 0) / nullif(count(*), 0), 1) as win_rate,
  round(sum(net_pnl), 2)                       as net_pnl,
  round(avg(r_multiple), 3)                    as avg_r
from public.trades
group by account_id, 2
order by net_pnl desc;

-- PostgREST reaches these with the anon key, the same as the tables. The
-- account switcher reads `v_accounts` to put a balance next to every account
-- name without loading every account's trades.
grant select on
  public.v_accounts,
  public.v_daily_pnl,
  public.v_risk_discipline,
  public.v_setup_performance,
  public.v_session_performance
to anon, authenticated;
