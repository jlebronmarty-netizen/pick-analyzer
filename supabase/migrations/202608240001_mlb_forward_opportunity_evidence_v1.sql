create table if not exists public.mlb_forward_opportunity_evidence (
  id uuid primary key,
  deterministic_identity text not null unique,
  sport_key text not null default 'baseball_mlb',
  event_id text not null references public.sport_events(id) on delete cascade,
  prediction_history_id uuid references public.prediction_history(id) on delete set null,
  market text not null check (market in ('moneyline', 'spread', 'run_line', 'total')),
  selection text not null,
  line numeric,
  sportsbook text not null,
  odds integer not null,
  odds_timestamp timestamptz not null,
  odds_snapshot_id text references public.sports_odds_snapshots(id) on delete restrict,
  generated_at timestamptz not null,
  captured_at timestamptz not null,
  raw_model_probability numeric not null check (raw_model_probability >= 0 and raw_model_probability <= 1),
  calibrated_probability numeric not null check (calibrated_probability >= 0 and calibrated_probability <= 1),
  calibration_delta numeric not null,
  raw_model_version text not null,
  calibration_version text not null,
  calibration_artifact_digest text,
  methodology_version text not null,
  feature_snapshot_id uuid,
  source_lineage jsonb not null default '{}'::jsonb,
  opportunity_evidence jsonb not null default '{}'::jsonb,
  evidence_cutoff_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists mlb_forward_opportunity_evidence_event_idx
  on public.mlb_forward_opportunity_evidence (event_id, market, selection, line, sportsbook, odds_timestamp);

create index if not exists mlb_forward_opportunity_evidence_lookup_idx
  on public.mlb_forward_opportunity_evidence (sport_key, event_id, generated_at, evidence_cutoff_at);

create index if not exists mlb_forward_opportunity_evidence_lineage_gin_idx
  on public.mlb_forward_opportunity_evidence using gin (source_lineage);

comment on table public.mlb_forward_opportunity_evidence is
  'Append-only MLB forward opportunity evidence for research ledger pairing. Separate from mutable prediction_history current-state rows and not product-visible.';

comment on column public.mlb_forward_opportunity_evidence.deterministic_identity is
  'Immutable opportunity identity: sport, event, market, selection, exact line, sportsbook, odds, odds timestamp, odds snapshot, feature snapshot, raw model version, calibration version, methodology and explicit probability pair.';

create or replace function public.prevent_mlb_forward_opportunity_evidence_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'mlb_forward_opportunity_evidence is append-only; immutable evidence rows may not be updated';
end;
$$;

drop trigger if exists mlb_forward_opportunity_evidence_no_update on public.mlb_forward_opportunity_evidence;
create trigger mlb_forward_opportunity_evidence_no_update
  before update on public.mlb_forward_opportunity_evidence
  for each row
  execute function public.prevent_mlb_forward_opportunity_evidence_update();

alter table public.mlb_forward_opportunity_evidence enable row level security;

drop policy if exists "mlb_forward_opportunity_evidence_service_role_insert_select"
  on public.mlb_forward_opportunity_evidence;
create policy "mlb_forward_opportunity_evidence_service_role_insert_select"
  on public.mlb_forward_opportunity_evidence
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.mlb_forward_opportunity_evidence from anon, authenticated;
grant select, insert on public.mlb_forward_opportunity_evidence to service_role;

alter table if exists public.mlb_forward_research_ledger
  add column if not exists opportunity_evidence_id uuid
  references public.mlb_forward_opportunity_evidence(id) on delete restrict;

create index if not exists mlb_forward_research_ledger_opportunity_evidence_idx
  on public.mlb_forward_research_ledger (opportunity_evidence_id);
