create table if not exists public.soccer_causal_diagnostics_v1 (
  forecast_id text primary key,
  event_id text not null,
  market text not null,
  model_version text,
  selection text,
  probability double precision,
  outcome_status text,
  observed_labels jsonb not null default '[]'::jsonb,
  observed_evidence jsonb not null default '{}'::jsonb,
  evidence_quality text not null default 'LOW' check (evidence_quality in ('LOW','MEDIUM','HIGH')),
  causal_status text not null default 'HYPOTHESIS_ONLY' check (causal_status in ('HYPOTHESIS_ONLY','CORROBORATED','VALIDATED_PATTERN')),
  analyzed_at timestamptz not null default now()
);
create table if not exists public.soccer_game_context_v2 (
  event_id text primary key,
  provider_event_id text not null,
  league_slug text not null,
  summary_payload jsonb not null,
  captured_at timestamptz not null,
  provider text not null default 'espn',
  source_version text not null default 'SOCCER_CAUSAL_CONTEXT_V2',
  updated_at timestamptz not null default now()
);
create table if not exists public.soccer_player_opponent_v3 (
  event_id text not null,
  provider_event_id text not null,
  game_date date,
  player_id text not null,
  player_name text,
  team_id text not null,
  opponent_team_id text not null,
  opponent_team_name text,
  position text,
  starter boolean,
  goals integer not null default 0,
  assists integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  captured_at timestamptz not null,
  source_version text not null default 'SOCCER_CAUSAL_MATCHUPS_V3',
  primary key(event_id,player_id,opponent_team_id)
);
create index if not exists soccer_player_opponent_pair_idx on public.soccer_player_opponent_v3(player_id,opponent_team_id,game_date);
alter table public.soccer_causal_diagnostics_v1 enable row level security;
alter table public.soccer_game_context_v2 enable row level security;
alter table public.soccer_player_opponent_v3 enable row level security;
revoke all on public.soccer_causal_diagnostics_v1 from anon,authenticated;
revoke all on public.soccer_game_context_v2 from anon,authenticated;
revoke all on public.soccer_player_opponent_v3 from anon,authenticated;
grant select,insert,update on public.soccer_causal_diagnostics_v1 to service_role;
grant select,insert,update on public.soccer_game_context_v2 to service_role;
grant select,insert,update on public.soccer_player_opponent_v3 to service_role;
comment on table public.soccer_player_opponent_v3 is 'Soccer player-vs-opponent-team observations. Does not claim direct defender assignment.';
