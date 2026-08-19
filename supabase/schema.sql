-- =============================================================
-- NQ Journal — Supabase schema
-- Run this once in the Supabase SQL Editor.
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- trades
-- -------------------------------------------------------------
create table if not exists public.trades (
  id              uuid primary key default gen_random_uuid(),

  -- Identity
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
-- -------------------------------------------------------------
create table if not exists public.day_notes (
  date            date primary key,
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

-- -------------------------------------------------------------
-- Row Level Security
--
-- This is a single-user personal journal reached with the anon key, so the
-- policies below are permissive. If you ever expose this publicly, replace
-- them with auth.uid()-scoped policies and add a user_id column.
-- -------------------------------------------------------------
alter table public.trades       enable row level security;
alter table public.day_notes    enable row level security;
alter table public.cash_flows   enable row level security;
alter table public.app_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['trades','day_notes','cash_flows','app_settings'] loop
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
-- =============================================================

create or replace view public.v_daily_pnl as
select
  day,
  count(*)                                     as trades,
  count(*) filter (where net_pnl > 0)          as wins,
  count(*) filter (where net_pnl < 0)          as losses,
  round(sum(net_pnl), 2)                       as net_pnl,
  round(sum(commission), 2)                    as commissions,
  round(avg(r_multiple), 3)                    as avg_r
from public.trades
where day is not null
group by day
order by day desc;

create or replace view public.v_risk_discipline as
select
  day,
  count(*)                                     as trades,
  round(avg(risk_pct), 3)                      as avg_risk_pct,
  round(max(risk_pct), 3)                      as max_risk_pct,
  round(sum(risk_amount), 2)                   as total_risked,
  round(sum(net_pnl), 2)                       as net_pnl
from public.trades
where risk_pct is not null
group by day
order by day desc;

create or replace view public.v_setup_performance as
select
  coalesce(nullif(setup, ''), 'Sin setup')     as setup,
  count(*)                                     as trades,
  round(100.0 * count(*) filter (where net_pnl > 0) / nullif(count(*), 0), 1) as win_rate,
  round(sum(net_pnl), 2)                       as net_pnl,
  round(avg(net_pnl), 2)                       as avg_pnl,
  round(avg(r_multiple), 3)                    as avg_r
from public.trades
group by 1
order by net_pnl desc;

create or replace view public.v_session_performance as
select
  coalesce(session, 'desconocida')             as session,
  count(*)                                     as trades,
  round(100.0 * count(*) filter (where net_pnl > 0) / nullif(count(*), 0), 1) as win_rate,
  round(sum(net_pnl), 2)                       as net_pnl,
  round(avg(r_multiple), 3)                    as avg_r
from public.trades
group by 1
order by net_pnl desc;
