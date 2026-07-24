create table if not exists universal_market_registry (
  id text primary key,
  sport_key text not null,
  league_key text,
  event_id text not null,
  market_family text not null,
  market_type text not null,
  canonical_market_key text not null,
  provider text,
  provider_market_key text,
  sportsbook text,
  selection text,
  outcome text,
  line numeric,
  price numeric,
  snapshot_time timestamptz,
  cutoff_at timestamptz,
  push_support boolean not null default false,
  outcome_count integer not null default 2,
  settlement_support text not null default 'BLOCKED',
  prediction_support text not null default 'BLOCKED',
  learning_support text not null default 'BLOCKED',
  readiness text not null default 'COLLECT_ONLY',
  blockers jsonb not null default '[]'::jsonb,
  source_snapshot_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (readiness in ('COLLECT_ONLY', 'NORMALIZED', 'SETTLEMENT_READY', 'FEATURE_READY', 'PREDICTION_READY', 'SHADOW_READY', 'PRODUCTION_READY', 'BLOCKED'))
);

create index if not exists universal_market_registry_event_idx
  on universal_market_registry (sport_key, league_key, event_id, canonical_market_key, snapshot_time desc);

create index if not exists universal_market_registry_readiness_idx
  on universal_market_registry (sport_key, readiness, market_family, snapshot_time desc);

grant all privileges on table universal_market_registry to service_role;
grant select on table universal_market_registry to authenticated;
