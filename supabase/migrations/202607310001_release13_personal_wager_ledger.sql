-- Release 13 Personal Wager Ledger V1
--
-- Additive, user-owned persistence only.
-- This migration does not touch prediction_history, settlement, learning,
-- calibration, scheduler, provider, performance, or Official Pick tables.

create table if not exists public.user_wagers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_created_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  placed_at timestamptz,
  sportsbook text,
  bet_type text not null,
  stake numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  potential_payout numeric(14, 2),
  actual_payout numeric(14, 2),
  status text not null default 'DRAFT',
  result text,
  notes text,
  source_category text not null default 'USER_ONLY',
  model_snapshot jsonb not null default '{}'::jsonb,
  model_probability numeric(7, 3),
  confidence numeric(7, 3),
  total_entered_odds numeric(12, 3),
  is_archived boolean not null default false,
  archived_at timestamptz,
  constraint user_wagers_client_created_unique unique (user_id, client_created_id),
  constraint user_wagers_bet_type_check check (bet_type in ('SINGLE', 'PARLAY')),
  constraint user_wagers_stake_check check (stake >= 0),
  constraint user_wagers_currency_check check (char_length(currency) = 3),
  constraint user_wagers_status_check check (status in ('DRAFT', 'PLACED', 'WON', 'LOST', 'PUSH', 'VOID', 'ARCHIVED')),
  constraint user_wagers_source_category_check check (source_category in ('OFFICIAL_PICK', 'VALUE_CANDIDATE', 'RESEARCH_PICK', 'USER_ONLY', 'MIXED')),
  constraint user_wagers_model_probability_check check (model_probability is null or (model_probability >= 0 and model_probability <= 100)),
  constraint user_wagers_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 100))
);

create table if not exists public.user_wager_legs (
  id uuid primary key default gen_random_uuid(),
  wager_id uuid not null references public.user_wagers(id) on delete cascade,
  created_at timestamptz not null default now(),
  event_id text,
  prediction_id text,
  sport text,
  league text,
  matchup text,
  event_start_time timestamptz,
  market text,
  selection text not null,
  user_entered_line numeric(12, 3),
  user_entered_odds numeric(12, 3),
  canonical_line_snapshot numeric(12, 3),
  canonical_odds_snapshot numeric(12, 3),
  model_probability_snapshot numeric(7, 3),
  confidence_snapshot numeric(7, 3),
  evidence_grade text,
  result text,
  status text not null default 'PENDING',
  constraint user_wager_legs_status_check check (status in ('PENDING', 'WON', 'LOST', 'PUSH', 'VOID', 'BLOCKED')),
  constraint user_wager_legs_probability_check check (model_probability_snapshot is null or (model_probability_snapshot >= 0 and model_probability_snapshot <= 100)),
  constraint user_wager_legs_confidence_check check (confidence_snapshot is null or (confidence_snapshot >= 0 and confidence_snapshot <= 100))
);

create index if not exists user_wagers_owner_created_idx
  on public.user_wagers (user_id, created_at desc);

create index if not exists user_wagers_owner_status_idx
  on public.user_wagers (user_id, status, is_archived);

create index if not exists user_wagers_owner_placed_idx
  on public.user_wagers (user_id, placed_at desc);

create index if not exists user_wager_legs_wager_idx
  on public.user_wager_legs (wager_id);

create index if not exists user_wager_legs_sport_market_idx
  on public.user_wager_legs (sport, market);

alter table public.user_wagers enable row level security;
alter table public.user_wager_legs enable row level security;

drop policy if exists user_wagers_select_own on public.user_wagers;
create policy user_wagers_select_own
  on public.user_wagers
  for select
  using (auth.uid() = user_id);

drop policy if exists user_wagers_insert_own on public.user_wagers;
create policy user_wagers_insert_own
  on public.user_wagers
  for insert
  with check (auth.uid() = user_id);

drop policy if exists user_wagers_update_own on public.user_wagers;
create policy user_wagers_update_own
  on public.user_wagers
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_wagers_delete_own on public.user_wagers;
create policy user_wagers_delete_own
  on public.user_wagers
  for delete
  using (auth.uid() = user_id);

drop policy if exists user_wager_legs_select_own on public.user_wager_legs;
create policy user_wager_legs_select_own
  on public.user_wager_legs
  for select
  using (
    exists (
      select 1
      from public.user_wagers
      where user_wagers.id = user_wager_legs.wager_id
        and user_wagers.user_id = auth.uid()
    )
  );

drop policy if exists user_wager_legs_insert_own on public.user_wager_legs;
create policy user_wager_legs_insert_own
  on public.user_wager_legs
  for insert
  with check (
    exists (
      select 1
      from public.user_wagers
      where user_wagers.id = user_wager_legs.wager_id
        and user_wagers.user_id = auth.uid()
    )
  );

drop policy if exists user_wager_legs_update_own on public.user_wager_legs;
create policy user_wager_legs_update_own
  on public.user_wager_legs
  for update
  using (
    exists (
      select 1
      from public.user_wagers
      where user_wagers.id = user_wager_legs.wager_id
        and user_wagers.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.user_wagers
      where user_wagers.id = user_wager_legs.wager_id
        and user_wagers.user_id = auth.uid()
    )
  );

drop policy if exists user_wager_legs_delete_own on public.user_wager_legs;
create policy user_wager_legs_delete_own
  on public.user_wager_legs
  for delete
  using (
    exists (
      select 1
      from public.user_wagers
      where user_wagers.id = user_wager_legs.wager_id
        and user_wagers.user_id = auth.uid()
    )
  );

comment on table public.user_wagers is
  'Release 13 user-owned personal wager ledger. Separate from prediction_history, model settlement, learning, calibration, Official Picks, and performance metrics.';

comment on table public.user_wager_legs is
  'Release 13 personal wager legs. Stores stable references and decision-time snapshots only; it must not update model prediction or settlement records.';
