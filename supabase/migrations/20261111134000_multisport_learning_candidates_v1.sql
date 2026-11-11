create table if not exists public.model_learning_candidates_v1 (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  model_version text not null,
  hypothesis_key text not null,
  title text not null,
  state text not null check (state in ('PATTERN','CHALLENGER_TEST','VALIDATED_CANDIDATE','APPROVED','REJECTED')),
  baseline_sample integer not null default 0 check (baseline_sample >= 0),
  validation_sample integer not null default 0 check (validation_sample >= 0),
  holdout_sample integer not null default 0 check (holdout_sample >= 0),
  baseline_metric jsonb not null default '{}'::jsonb,
  challenger_metric jsonb not null default '{}'::jsonb,
  validation_evidence jsonb not null default '{}'::jsonb,
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text,
  unique (sport, model_version, hypothesis_key)
);

alter table public.model_learning_candidates_v1 enable row level security;
revoke all on public.model_learning_candidates_v1 from anon, authenticated;
grant select, insert, update on public.model_learning_candidates_v1 to service_role;

comment on table public.model_learning_candidates_v1 is
'Multisport model-learning review queue. Diagnostic/challenger evidence only. VALIDATED_CANDIDATE does not authorize production model changes; APPROVED/REJECTED are human review states.';
