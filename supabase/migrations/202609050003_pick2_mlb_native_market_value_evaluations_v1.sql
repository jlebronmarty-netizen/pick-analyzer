begin;

create extension if not exists pgcrypto;

create table if not exists public.pick2_mlb_market_value_evaluations (
  id uuid primary key default gen_random_uuid(),
  value_identity text not null unique,
  prediction_id uuid not null references public.pick2_game_predictions(id),
  game_pk bigint not null references public.pick2_mlb_games(game_pk),
  side text not null,
  model_version_id uuid references public.pick2_model_versions(id),
  model_version text not null,
  model_probability numeric(18,15) not null,
  provider text not null,
  provider_event_id text not null,
  bookmaker_key text not null,
  bookmaker_name text,
  market text not null,
  provider_market_key text not null,
  american_odds integer not null,
  home_market_observation_id uuid not null references public.pick2_mlb_market_price_observations(id),
  away_market_observation_id uuid not null references public.pick2_mlb_market_price_observations(id),
  selected_side_market_observation_id uuid not null references public.pick2_mlb_market_price_observations(id),
  raw_implied_probability numeric(18,15) not null,
  no_vig_probability numeric(18,15) not null,
  edge numeric(18,15) not null,
  unit_ev numeric(18,15) not null,
  consensus_probability numeric(18,15),
  consensus_edge numeric(18,15),
  market_dispersion numeric(18,15),
  book_count integer not null,
  market_freshness text not null,
  starter_status text,
  temporal_eligibility text not null,
  eligibility_flags jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  evaluation_method_version text not null,
  prediction_as_of timestamptz not null,
  provider_last_update timestamptz,
  market_acquired_at timestamptz not null,
  evaluated_at timestamptz not null,
  source_payload_digest text not null,
  evaluation_payload_digest text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (length(trim(value_identity)) > 0),
  check (game_pk > 0),
  check (side in ('HOME', 'AWAY')),
  check (market = 'MONEYLINE'),
  check (provider_market_key = 'h2h'),
  check (american_odds <> 0),
  check (model_probability > 0 and model_probability < 1),
  check (raw_implied_probability > 0 and raw_implied_probability < 1),
  check (no_vig_probability > 0 and no_vig_probability < 1),
  check (consensus_probability is null or (consensus_probability > 0 and consensus_probability < 1)),
  check (book_count >= 1),
  check (market_freshness in ('FRESH', 'AGING', 'STALE')),
  check (temporal_eligibility in ('PREGAME_VALID', 'PREGAME_VALID_AT_MARKET_ACQUISITION', 'STARTED_GAME_BLOCKED', 'STALE_MARKET_BLOCKED', 'AGING_ANALYTICAL_ONLY')),
  check (jsonb_typeof(eligibility_flags) = 'array'),
  check (jsonb_typeof(risk_flags) = 'array'),
  check (home_market_observation_id <> away_market_observation_id),
  check (
    (side = 'HOME' and selected_side_market_observation_id = home_market_observation_id)
    or
    (side = 'AWAY' and selected_side_market_observation_id = away_market_observation_id)
  ),
  check (length(trim(evaluation_method_version)) > 0),
  check (length(trim(source_payload_digest)) > 0),
  check (length(trim(evaluation_payload_digest)) > 0)
);

create index if not exists pick2_mlb_market_value_evaluations_game_latest_idx
  on public.pick2_mlb_market_value_evaluations (game_pk, market, evaluated_at desc);

create index if not exists pick2_mlb_market_value_evaluations_prediction_idx
  on public.pick2_mlb_market_value_evaluations (prediction_id);

create index if not exists pick2_mlb_market_value_evaluations_book_side_idx
  on public.pick2_mlb_market_value_evaluations (provider, bookmaker_key, side, evaluated_at desc);

create index if not exists pick2_mlb_market_value_evaluations_edge_idx
  on public.pick2_mlb_market_value_evaluations (edge desc, unit_ev desc);

create index if not exists pick2_mlb_market_value_evaluations_eligibility_idx
  on public.pick2_mlb_market_value_evaluations (temporal_eligibility, market_freshness, evaluated_at desc);

create or replace function public.pick2_prevent_mlb_market_value_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'pick2_mlb_market_value_evaluations are immutable; write a new evaluation instead';
end;
$$;

drop trigger if exists pick2_mlb_market_value_evaluations_no_update on public.pick2_mlb_market_value_evaluations;
create trigger pick2_mlb_market_value_evaluations_no_update
  before update on public.pick2_mlb_market_value_evaluations
  for each row execute function public.pick2_prevent_mlb_market_value_update();

create or replace function public.pick2_prevent_mlb_market_value_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'pick2_mlb_market_value_evaluations are immutable; deletion is not allowed';
end;
$$;

drop trigger if exists pick2_mlb_market_value_evaluations_no_delete on public.pick2_mlb_market_value_evaluations;
create trigger pick2_mlb_market_value_evaluations_no_delete
  before delete on public.pick2_mlb_market_value_evaluations
  for each row execute function public.pick2_prevent_mlb_market_value_delete();

alter table public.pick2_mlb_market_value_evaluations enable row level security;

create policy pick2_mlb_market_value_evaluations_service_role_insert
  on public.pick2_mlb_market_value_evaluations for insert to service_role with check (true);

create policy pick2_mlb_market_value_evaluations_service_role_select
  on public.pick2_mlb_market_value_evaluations for select to service_role using (true);

create policy pick2_mlb_market_value_evaluations_authenticated_select
  on public.pick2_mlb_market_value_evaluations for select to authenticated using (true);

grant select on public.pick2_mlb_market_value_evaluations to authenticated;
grant select, insert on public.pick2_mlb_market_value_evaluations to service_role;

commit;
