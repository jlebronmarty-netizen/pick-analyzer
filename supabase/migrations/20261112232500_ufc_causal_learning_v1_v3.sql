create table if not exists public.ufc_causal_diagnostics_v1 (
  prediction_id text primary key,
  bout_id text not null,
  event_id text not null,
  model text,
  selected_fighter_id text,
  selected_fighter_name text,
  probability double precision,
  outcome text not null,
  observed_labels jsonb not null default '[]'::jsonb,
  observed_evidence jsonb not null default '{}'::jsonb,
  evidence_quality text not null default 'LOW' check (evidence_quality in ('LOW','MEDIUM','HIGH')),
  causal_status text not null default 'HYPOTHESIS_ONLY' check (causal_status in ('HYPOTHESIS_ONLY','CORROBORATED','VALIDATED_PATTERN')),
  analyzed_at timestamptz not null default now()
);
create table if not exists public.ufc_event_context_v2 (
  event_id text primary key,
  summary_payload jsonb not null,
  captured_at timestamptz not null,
  provider text not null default 'espn',
  source_version text not null default 'UFC_CAUSAL_CONTEXT_V2',
  updated_at timestamptz not null default now()
);
create table if not exists public.ufc_h2h_observations_v3 (
  bout_id text primary key,
  event_id text not null,
  fight_date date,
  fighter_a_id text not null,
  fighter_b_id text not null,
  fighter_a_name text,
  fighter_b_name text,
  winner_id text,
  method text,
  round integer,
  time_text text,
  captured_at timestamptz not null,
  source_version text not null default 'UFC_CAUSAL_H2H_V3'
);
create index if not exists ufc_h2h_pair_idx on public.ufc_h2h_observations_v3(fighter_a_id,fighter_b_id,fight_date);
alter table public.ufc_causal_diagnostics_v1 enable row level security;
alter table public.ufc_event_context_v2 enable row level security;
alter table public.ufc_h2h_observations_v3 enable row level security;
revoke all on public.ufc_causal_diagnostics_v1 from anon,authenticated;
revoke all on public.ufc_event_context_v2 from anon,authenticated;
revoke all on public.ufc_h2h_observations_v3 from anon,authenticated;
grant select,insert,update on public.ufc_causal_diagnostics_v1 to service_role;
grant select,insert,update on public.ufc_event_context_v2 to service_role;
grant select,insert,update on public.ufc_h2h_observations_v3 to service_role;
comment on table public.ufc_h2h_observations_v3 is 'Direct UFC fighter-vs-fighter H2H outcomes; method/round stored only when provider confirms them.';
