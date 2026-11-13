create table if not exists public.ncaab_causal_diagnostics_v1 (
  prediction_id text primary key,
  event_id text not null,
  model text,
  selection_team_id text,
  selection_name text,
  predicted_probability double precision,
  outcome text not null,
  actual_margin double precision,
  projected_margin double precision,
  projected_total double precision,
  actual_total double precision,
  margin_error double precision,
  total_error double precision,
  brier double precision,
  observed_labels jsonb not null default '[]'::jsonb,
  observed_evidence jsonb not null default '{}'::jsonb,
  evidence_quality text not null default 'LOW' check (evidence_quality in ('LOW','MEDIUM','HIGH')),
  causal_status text not null default 'HYPOTHESIS_ONLY' check (causal_status in ('HYPOTHESIS_ONLY','CORROBORATED','VALIDATED_PATTERN')),
  analyzed_at timestamptz not null default now()
);
create table if not exists public.ncaab_game_context_v2 (
  event_id text primary key,
  provider_event_id text not null,
  summary_payload jsonb not null,
  captured_at timestamptz not null,
  provider text not null default 'espn',
  source_version text not null default 'NCAAB_CAUSAL_CONTEXT_V2',
  updated_at timestamptz not null default now()
);
create table if not exists public.ncaab_opponent_matchups_v3 (
  event_id text not null,
  provider_event_id text not null,
  game_date date,
  player_id text not null,
  player_name text,
  team_id text not null,
  opponent_team_id text not null,
  opponent_team_name text,
  minutes double precision,
  points double precision,
  rebounds double precision,
  assists double precision,
  turnovers double precision,
  fouls double precision,
  fgm double precision,
  fga double precision,
  fg_pct double precision,
  three_made double precision,
  three_att double precision,
  three_pct double precision,
  captured_at timestamptz not null,
  source_version text not null default 'NCAAB_CAUSAL_MATCHUPS_V3',
  primary key(event_id,player_id,opponent_team_id)
);
create index if not exists ncaab_opponent_matchups_pair_idx on public.ncaab_opponent_matchups_v3(player_id,opponent_team_id,game_date);
alter table public.ncaab_causal_diagnostics_v1 enable row level security;
alter table public.ncaab_game_context_v2 enable row level security;
alter table public.ncaab_opponent_matchups_v3 enable row level security;
revoke all on public.ncaab_causal_diagnostics_v1 from anon,authenticated;
revoke all on public.ncaab_game_context_v2 from anon,authenticated;
revoke all on public.ncaab_opponent_matchups_v3 from anon,authenticated;
grant select,insert,update on public.ncaab_causal_diagnostics_v1 to service_role;
grant select,insert,update on public.ncaab_game_context_v2 to service_role;
grant select,insert,update on public.ncaab_opponent_matchups_v3 to service_role;
comment on table public.ncaab_causal_diagnostics_v1 is 'NCAAB postgame causal hypotheses from frozen prediction plus ESPN PBP/boxscore. Never authorizes model changes.';
comment on table public.ncaab_game_context_v2 is 'Stored ESPN NCAAB summary payload for postgame research only.';
comment on table public.ncaab_opponent_matchups_v3 is 'NCAAB player-vs-opponent-team observations; this is not direct defender assignment.';
