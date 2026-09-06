begin;

create extension if not exists pgcrypto;

create table if not exists public.pick2_mlb_official_picks (
  id uuid primary key default gen_random_uuid(),
  official_pick_identity text not null unique,
  prediction_id uuid not null references public.pick2_game_predictions(id),
  value_evaluation_id uuid not null references public.pick2_mlb_market_value_evaluations(id),
  game_pk bigint not null references public.pick2_mlb_games(game_pk),
  sport text not null,
  market text not null,
  side text not null,
  bookmaker_key text not null,
  bookmaker_name text,
  american_odds integer not null,
  model_version text not null,
  model_probability numeric(18,15) not null,
  consensus_probability numeric(18,15),
  consensus_edge numeric(18,15) not null,
  unit_ev numeric(18,15) not null,
  policy_version text not null,
  decision_status text not null,
  eligibility_flags jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  blocker_codes jsonb not null default '[]'::jsonb,
  prediction_as_of timestamptz not null,
  market_acquired_at timestamptz not null,
  evaluated_at timestamptz not null,
  decision_at timestamptz not null default timezone('utc', now()),
  source_payload_digest text not null,
  decision_payload_digest text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (length(trim(official_pick_identity)) > 0),
  check (game_pk > 0),
  check (sport = 'MLB'),
  check (market = 'MONEYLINE'),
  check (side in ('HOME', 'AWAY')),
  check (length(trim(bookmaker_key)) > 0),
  check (american_odds <> 0),
  check (length(trim(model_version)) > 0),
  check (model_probability > 0 and model_probability < 1),
  check (consensus_probability is null or (consensus_probability > 0 and consensus_probability < 1)),
  check (length(trim(policy_version)) > 0),
  check (decision_status in ('OFFICIAL_PICK')),
  check (jsonb_typeof(eligibility_flags) = 'array'),
  check (jsonb_typeof(risk_flags) = 'array'),
  check (jsonb_typeof(reason_codes) = 'array'),
  check (jsonb_typeof(blocker_codes) = 'array'),
  check (length(trim(source_payload_digest)) > 0),
  check (length(trim(decision_payload_digest)) > 0)
);

create index if not exists pick2_mlb_official_picks_game_decision_idx
  on public.pick2_mlb_official_picks (game_pk, decision_at desc);

create index if not exists pick2_mlb_official_picks_prediction_idx
  on public.pick2_mlb_official_picks (prediction_id);

create index if not exists pick2_mlb_official_picks_value_evaluation_idx
  on public.pick2_mlb_official_picks (value_evaluation_id);

create index if not exists pick2_mlb_official_picks_policy_status_idx
  on public.pick2_mlb_official_picks (policy_version, decision_status, decision_at desc);

create index if not exists pick2_mlb_official_picks_book_side_idx
  on public.pick2_mlb_official_picks (bookmaker_key, side, decision_at desc);

create or replace function public.pick2_prevent_mlb_official_pick_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'pick2_mlb_official_picks are immutable; write a new official pick decision instead';
end;
$$;

drop trigger if exists pick2_mlb_official_picks_no_update on public.pick2_mlb_official_picks;
create trigger pick2_mlb_official_picks_no_update
  before update on public.pick2_mlb_official_picks
  for each row execute function public.pick2_prevent_mlb_official_pick_update();

create or replace function public.pick2_prevent_mlb_official_pick_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'pick2_mlb_official_picks are immutable; deletion is not allowed';
end;
$$;

drop trigger if exists pick2_mlb_official_picks_no_delete on public.pick2_mlb_official_picks;
create trigger pick2_mlb_official_picks_no_delete
  before delete on public.pick2_mlb_official_picks
  for each row execute function public.pick2_prevent_mlb_official_pick_delete();

alter table public.pick2_mlb_official_picks enable row level security;

create policy pick2_mlb_official_picks_service_role_insert
  on public.pick2_mlb_official_picks for insert to service_role with check (true);

create policy pick2_mlb_official_picks_service_role_select
  on public.pick2_mlb_official_picks for select to service_role using (true);

create policy pick2_mlb_official_picks_authenticated_select
  on public.pick2_mlb_official_picks for select to authenticated using (true);

grant select on public.pick2_mlb_official_picks to authenticated;
grant select, insert on public.pick2_mlb_official_picks to service_role;

commit;
