begin;

create extension if not exists pgcrypto;

create table if not exists public.pick2_mlb_market_price_observations (
  id uuid primary key default gen_random_uuid(),
  observation_identity text not null unique,
  game_pk bigint not null references public.pick2_mlb_games(game_pk),
  provider text not null,
  provider_event_id text not null,
  market_event_mapping_id uuid references public.pick2_mlb_market_event_mappings(id),
  region text,
  bookmaker_key text not null,
  bookmaker_name text,
  market text not null,
  provider_market_key text not null,
  side text not null,
  outcome_name text,
  american_odds integer not null,
  provider_last_update timestamptz,
  acquired_at timestamptz not null,
  commence_time timestamptz,
  source_payload_digest text not null,
  source_response_digest text,
  source_provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (game_pk > 0),
  check (length(trim(observation_identity)) > 0),
  check (length(trim(provider)) > 0),
  check (length(trim(provider_event_id)) > 0),
  check (length(trim(bookmaker_key)) > 0),
  check (market = 'MONEYLINE'),
  check (provider_market_key = 'h2h'),
  check (side in ('HOME', 'AWAY')),
  check (american_odds <> 0),
  check (length(trim(source_payload_digest)) > 0)
);

create index if not exists pick2_mlb_market_price_observations_game_latest_idx
  on public.pick2_mlb_market_price_observations (game_pk, market, acquired_at desc);

create index if not exists pick2_mlb_market_price_observations_book_idx
  on public.pick2_mlb_market_price_observations (provider, bookmaker_key, market, acquired_at desc);

create index if not exists pick2_mlb_market_price_observations_event_idx
  on public.pick2_mlb_market_price_observations (provider, provider_event_id, market, acquired_at desc);

create index if not exists pick2_mlb_market_price_observations_pair_idx
  on public.pick2_mlb_market_price_observations (
    game_pk,
    provider,
    bookmaker_key,
    market,
    provider_market_key,
    coalesce(provider_last_update, acquired_at)
  );

create or replace function public.pick2_prevent_market_price_observation_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'pick2_mlb_market_price_observations are immutable; write a new observation instead';
end;
$$;

drop trigger if exists pick2_mlb_market_price_observations_no_update on public.pick2_mlb_market_price_observations;
create trigger pick2_mlb_market_price_observations_no_update
  before update on public.pick2_mlb_market_price_observations
  for each row execute function public.pick2_prevent_market_price_observation_update();

create or replace function public.pick2_prevent_market_price_observation_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'pick2_mlb_market_price_observations are immutable; deletion is not allowed';
end;
$$;

drop trigger if exists pick2_mlb_market_price_observations_no_delete on public.pick2_mlb_market_price_observations;
create trigger pick2_mlb_market_price_observations_no_delete
  before delete on public.pick2_mlb_market_price_observations
  for each row execute function public.pick2_prevent_market_price_observation_delete();

alter table public.pick2_mlb_market_price_observations enable row level security;

create policy pick2_mlb_market_price_observations_service_role_insert
  on public.pick2_mlb_market_price_observations for insert to service_role with check (true);

create policy pick2_mlb_market_price_observations_service_role_select
  on public.pick2_mlb_market_price_observations for select to service_role using (true);

create policy pick2_mlb_market_price_observations_authenticated_select
  on public.pick2_mlb_market_price_observations for select to authenticated using (true);

grant select on public.pick2_mlb_market_price_observations to authenticated;
grant select, insert on public.pick2_mlb_market_price_observations to service_role;

commit;
