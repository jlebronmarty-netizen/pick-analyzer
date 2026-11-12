create table if not exists public.nba_causal_diagnostics_v1 (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null unique references public.prediction_history(id) on delete cascade,
  game_id text not null,
  model_version text,
  market text not null,
  selection text not null,
  predicted_probability double precision,
  outcome text not null,
  actual_margin double precision,
  brier double precision,
  q1_margin double precision,
  q2_margin double precision,
  q3_margin double precision,
  q4_margin double precision,
  halftime_margin double precision,
  second_half_margin double precision,
  max_quarter_deficit double precision,
  max_quarter_advantage double precision,
  evidence_quality text not null check (evidence_quality in ('LOW','MEDIUM','HIGH')),
  observed_labels jsonb not null default '[]'::jsonb,
  observed_evidence jsonb not null default '{}'::jsonb,
  causal_status text not null default 'HYPOTHESIS_ONLY' check (causal_status in ('HYPOTHESIS_ONLY','CORROBORATED','VALIDATED_PATTERN')),
  source_snapshot_ids jsonb not null default '[]'::jsonb,
  analyzed_at timestamptz not null default now()
);
create index if not exists nba_causal_diagnostics_v1_game_idx on public.nba_causal_diagnostics_v1(game_id);
create index if not exists nba_causal_diagnostics_v1_outcome_idx on public.nba_causal_diagnostics_v1(outcome);
alter table public.nba_causal_diagnostics_v1 enable row level security;
revoke all on public.nba_causal_diagnostics_v1 from anon, authenticated;
grant select, insert, update on public.nba_causal_diagnostics_v1 to service_role;
comment on table public.nba_causal_diagnostics_v1 is
'NBA postgame diagnostic hypotheses derived only from frozen prediction and stored final/quarter evidence. Labels are not causal proof and do not authorize model changes.';
