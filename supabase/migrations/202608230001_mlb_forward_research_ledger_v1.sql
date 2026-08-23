create table if not exists public.mlb_forward_research_ledger (
  id uuid primary key default gen_random_uuid(),
  deterministic_identity text not null unique,
  sport_key text not null default 'baseball_mlb',
  observation_id text not null,
  event_id text not null references public.sport_events(id) on delete cascade,
  snapshot_id uuid not null references public.mlb_context_snapshots(id) on delete restrict,
  snapshot_type text not null check (snapshot_type in ('MORNING', 'FINAL_PREGAME')),
  snapshot_timestamp timestamptz not null,
  methodology_version text not null,
  scorecard_version text not null,
  market text not null check (market in ('moneyline', 'run_line', 'total')),
  selection text not null,
  line numeric,
  sportsbook text not null,
  odds integer not null,
  odds_timestamp timestamptz not null,
  raw_probability numeric not null check (raw_probability >= 0 and raw_probability <= 1),
  calibrated_probability numeric not null check (calibrated_probability >= 0 and calibrated_probability <= 1),
  component_states jsonb not null default '{}'::jsonb,
  component_values jsonb not null default '{}'::jsonb,
  composite_score numeric,
  scorecard_completeness numeric not null check (scorecard_completeness >= 0 and scorecard_completeness <= 1),
  context_completeness numeric not null check (context_completeness >= 0 and context_completeness <= 1),
  result text check (result in ('WIN', 'LOSS', 'PUSH')),
  result_id uuid references public.game_results(id) on delete restrict,
  settled_at timestamptz,
  profit numeric,
  raw_brier numeric,
  calibrated_brier numeric,
  raw_log_loss numeric,
  calibrated_log_loss numeric,
  chat_directional_result text check (chat_directional_result in ('CORRECT', 'INCORRECT', 'NEUTRAL', 'NOT_INTERPRETABLE')),
  created_at timestamptz not null default now()
);

create index if not exists mlb_forward_research_ledger_event_idx
  on public.mlb_forward_research_ledger (event_id, snapshot_type, market, selection, line, sportsbook);

create index if not exists mlb_forward_research_ledger_cohort_idx
  on public.mlb_forward_research_ledger (scorecard_version, market, snapshot_type, created_at);

comment on table public.mlb_forward_research_ledger is
  'Research-only MLB forward observation ledger. Not product-visible, not learning/calibration source, service-role write only.';

comment on column public.mlb_forward_research_ledger.deterministic_identity is
  'Logical idempotency key: sport, event, snapshot identity, market, selection, exact line, sportsbook, methodology version and scorecard version.';

alter table public.mlb_forward_research_ledger enable row level security;

drop policy if exists "mlb_forward_research_ledger_service_role_all" on public.mlb_forward_research_ledger;
create policy "mlb_forward_research_ledger_service_role_all"
  on public.mlb_forward_research_ledger
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.mlb_forward_research_ledger from anon, authenticated;
grant select, insert, update on public.mlb_forward_research_ledger to service_role;
