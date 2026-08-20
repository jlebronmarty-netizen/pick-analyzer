create table if not exists public.mlb_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  deterministic_key text not null unique,
  sport_key text not null default 'baseball_mlb',
  league_key text not null default 'mlb',
  event_id text not null references public.sport_events(id) on delete cascade,
  snapshot_type text not null check (snapshot_type in ('MORNING', 'FINAL_PREGAME', 'CURRENT_PROBE')),
  snapshot_timestamp timestamptz not null,
  target_event_start_time timestamptz not null,
  temporal_status text not null check (temporal_status in ('PREGAME', 'POST_START', 'UNKNOWN')),
  provider_authority jsonb not null default '{}'::jsonb,
  source_lineage jsonb not null default '{}'::jsonb,
  components jsonb not null default '{}'::jsonb,
  feature_values jsonb not null default '{}'::jsonb,
  feature_lineage jsonb not null default '{}'::jsonb,
  completeness jsonb not null default '{}'::jsonb,
  missing_components jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  provider_calls jsonb not null default '{}'::jsonb,
  production_eligible boolean not null default false,
  shadow_only boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mlb_context_snapshots_event_type_idx
  on public.mlb_context_snapshots (event_id, snapshot_type, snapshot_timestamp desc);

create index if not exists mlb_context_snapshots_sport_time_idx
  on public.mlb_context_snapshots (sport_key, league_key, target_event_start_time);

create index if not exists mlb_context_snapshots_components_gin_idx
  on public.mlb_context_snapshots using gin (components);

create index if not exists mlb_context_snapshots_completeness_gin_idx
  on public.mlb_context_snapshots using gin (completeness);

comment on table public.mlb_context_snapshots is
  'MLB-01 pregame context lineage snapshots. Additive shadow evidence only; does not alter prediction probabilities, recommendations, settlement or learning.';

comment on column public.mlb_context_snapshots.deterministic_key is
  'Stable event/snapshot/version key used for idempotent context evidence writes.';

comment on column public.mlb_context_snapshots.provider_authority is
  'Approved source contract for MLB context domains. SportsDataIO must remain rollback-only/excluded.';

comment on column public.mlb_context_snapshots.production_eligible is
  'Always false for MLB-01 context lineage certification; product eligibility is governed separately.';

alter table public.mlb_context_snapshots enable row level security;

drop policy if exists "mlb_context_snapshots_service_role_all" on public.mlb_context_snapshots;
create policy "mlb_context_snapshots_service_role_all"
  on public.mlb_context_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
