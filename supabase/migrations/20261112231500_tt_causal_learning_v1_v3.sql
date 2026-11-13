create table if not exists public.tt_causal_diagnostics_v1 (
  forecast_id text primary key,
  event_id text not null,
  market text not null,
  selection text,
  probability double precision,
  projection double precision,
  outcome_status text,
  actual double precision,
  absolute_error double precision,
  observed_labels jsonb not null default '[]'::jsonb,
  observed_evidence jsonb not null default '{}'::jsonb,
  evidence_quality text not null default 'HIGH' check (evidence_quality in ('LOW','MEDIUM','HIGH')),
  causal_status text not null default 'HYPOTHESIS_ONLY' check (causal_status in ('HYPOTHESIS_ONLY','CORROBORATED','VALIDATED_PATTERN')),
  analyzed_at timestamptz not null default now()
);
create table if not exists public.tt_h2h_observations_v3 (
  event_id text primary key,
  game_date date,
  player_a text not null,
  player_b text not null,
  winner text,
  sets_a integer,
  sets_b integer,
  total_points integer,
  set_points jsonb not null default '[]'::jsonb,
  source text,
  captured_at timestamptz not null,
  source_version text not null default 'TT_CAUSAL_H2H_V3'
);
create index if not exists tt_h2h_pair_idx on public.tt_h2h_observations_v3(player_a,player_b,game_date);
alter table public.tt_causal_diagnostics_v1 enable row level security;
alter table public.tt_h2h_observations_v3 enable row level security;
revoke all on public.tt_causal_diagnostics_v1 from anon,authenticated;
revoke all on public.tt_h2h_observations_v3 from anon,authenticated;
grant select,insert,update on public.tt_causal_diagnostics_v1 to service_role;
grant select,insert,update on public.tt_h2h_observations_v3 to service_role;
comment on table public.tt_h2h_observations_v3 is 'Direct table-tennis player A vs player B H2H observations reconstructed from stored settled outcomes; no new provider call.';
