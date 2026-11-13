create table if not exists public.nhl_causal_diagnostics_v1 (
  prediction_id text primary key,
  event_id text not null,
  model text,
  selection text not null,
  predicted_probability double precision,
  outcome text not null,
  actual_margin double precision,
  brier double precision,
  period_margins jsonb not null default '[]'::jsonb,
  observed_labels jsonb not null default '[]'::jsonb,
  observed_evidence jsonb not null default '{}'::jsonb,
  evidence_quality text not null default 'LOW' check (evidence_quality in ('LOW','MEDIUM','HIGH')),
  causal_status text not null default 'HYPOTHESIS_ONLY' check (causal_status in ('HYPOTHESIS_ONLY','CORROBORATED','VALIDATED_PATTERN')),
  analyzed_at timestamptz not null default now()
);
create table if not exists public.nhl_game_context_v2 (
  event_id text primary key,
  provider_game_id bigint not null,
  play_by_play jsonb,
  boxscore jsonb,
  pbp_captured_at timestamptz,
  boxscore_captured_at timestamptz,
  provider text not null default 'nhl_web_api',
  source_version text not null default 'NHL_CAUSAL_CONTEXT_V2',
  updated_at timestamptz not null default now()
);
create table if not exists public.nhl_matchup_observations_v3 (
  event_id text not null,
  provider_game_id bigint not null,
  game_date date,
  shooting_player_id bigint not null,
  goalie_id bigint not null,
  shooting_player_name text,
  goalie_name text,
  shots integer not null default 0,
  goals integer not null default 0,
  strength_states jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null,
  source_version text not null default 'NHL_CAUSAL_MATCHUPS_V3',
  primary key(event_id,shooting_player_id,goalie_id)
);
create index if not exists nhl_matchup_observations_pair_idx on public.nhl_matchup_observations_v3(shooting_player_id,goalie_id,game_date);
alter table public.nhl_causal_diagnostics_v1 enable row level security;
alter table public.nhl_game_context_v2 enable row level security;
alter table public.nhl_matchup_observations_v3 enable row level security;
revoke all on public.nhl_causal_diagnostics_v1 from anon,authenticated;
revoke all on public.nhl_game_context_v2 from anon,authenticated;
revoke all on public.nhl_matchup_observations_v3 from anon,authenticated;
grant select,insert,update on public.nhl_causal_diagnostics_v1 to service_role;
grant select,insert,update on public.nhl_game_context_v2 to service_role;
grant select,insert,update on public.nhl_matchup_observations_v3 to service_role;
comment on table public.nhl_causal_diagnostics_v1 is 'NHL postgame causal hypotheses from frozen predictions plus official NHL game evidence. Never authorizes model changes.';
comment on table public.nhl_game_context_v2 is 'NHL official PBP and boxscore archive for learning only.';
comment on table public.nhl_matchup_observations_v3 is 'Confirmed shooter-vs-goalie NHL observations derived from official PBP.';
