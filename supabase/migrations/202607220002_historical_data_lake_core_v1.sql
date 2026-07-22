create extension if not exists pgcrypto;

create table if not exists historical_source_registry (
  id text primary key,
  source text not null,
  sport_key text not null,
  league_key text not null,
  season text not null,
  filename text not null,
  relative_path text not null,
  extension text,
  checksum_sha256 text not null,
  bytes bigint not null,
  encoding text,
  line_endings text,
  parser_version text not null,
  imported boolean not null default false,
  status text not null default 'discovered',
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('discovered', 'ready', 'imported', 'quarantined', 'unexpected', 'unreadable', 'superseded'))
);

create unique index if not exists historical_source_registry_checksum_idx
  on historical_source_registry (source, sport_key, league_key, season, checksum_sha256);

create index if not exists historical_source_registry_season_idx
  on historical_source_registry (source, sport_key, league_key, season, status);

create table if not exists historical_import_registry (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  sport_key text not null,
  league_key text not null,
  season text not null,
  import_version text not null,
  parser_version text not null,
  mode text not null,
  status text not null default 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  source_count integer not null default 0,
  file_count integer not null default 0,
  game_count integer not null default 0,
  player_count integer not null default 0,
  raw_record_count bigint not null default 0,
  normalized_record_count bigint not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  checksum_sha256 text,
  checkpoint jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  provider_calls_made integer not null default 0,
  remote_mutations_made integer not null default 0,
  historical_only boolean not null default true,
  postgame_known boolean not null default true,
  training_eligible boolean not null default false,
  pregame_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mode in ('PLAN', 'DRY_RUN', 'IMPORT', 'VALIDATE', 'RESUME', 'REPROCESS_FILE')),
  check (status in ('pending', 'running', 'completed', 'partial', 'failed', 'canceled', 'timed_out'))
);

create index if not exists historical_import_registry_status_idx
  on historical_import_registry (source, sport_key, league_key, season, status, started_at desc);

create table if not exists historical_raw_records (
  id text primary key,
  source_registry_id text not null references historical_source_registry(id),
  import_id uuid references historical_import_registry(id),
  source text not null,
  sport_key text not null,
  league_key text not null,
  season text not null,
  source_filename text not null,
  source_line integer not null,
  game_reference text,
  record_type text not null,
  raw_line text not null,
  parsed_fields jsonb not null default '[]'::jsonb,
  parser_version text not null,
  checksum_sha256 text not null,
  historical_only boolean not null default true,
  postgame_known boolean not null default true,
  training_eligible boolean not null default false,
  pregame_eligible boolean not null default false,
  validation_status text not null default 'parsed',
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (validation_status in ('parsed', 'warning', 'quarantined', 'unknown_type'))
);

create unique index if not exists historical_raw_records_source_line_idx
  on historical_raw_records (source_registry_id, source_line, checksum_sha256);

create index if not exists historical_raw_records_game_idx
  on historical_raw_records (sport_key, league_key, season, game_reference, record_type);

create table if not exists historical_import_checkpoints (
  id text primary key,
  import_id uuid references historical_import_registry(id),
  source_registry_id text references historical_source_registry(id),
  checkpoint_level text not null,
  checkpoint_key text not null,
  status text not null default 'pending',
  last_source_line integer,
  record_count bigint not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  checksum_sha256 text,
  started_at timestamptz,
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (checkpoint_level in ('file', 'game', 'raw_parse', 'normalization', 'validation')),
  check (status in ('pending', 'running', 'completed', 'partial', 'failed', 'quarantined', 'skipped'))
);

create unique index if not exists historical_import_checkpoints_unique_idx
  on historical_import_checkpoints (import_id, checkpoint_level, checkpoint_key);

create table if not exists historical_identity_foundation (
  id text primary key,
  source text not null,
  sport_key text not null,
  league_key text not null,
  season text not null,
  identity_type text not null,
  source_identifier text not null,
  canonical_identifier text,
  display_name text,
  confidence numeric,
  status text not null default 'unresolved',
  evidence jsonb not null default '{}'::jsonb,
  source_registry_id text references historical_source_registry(id),
  first_seen_import_id uuid references historical_import_registry(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (identity_type in ('team', 'player', 'event')),
  check (status in ('resolved', 'unresolved', 'ambiguous', 'quarantined'))
);

create unique index if not exists historical_identity_foundation_unique_idx
  on historical_identity_foundation (source, sport_key, league_key, season, identity_type, source_identifier);

grant all privileges on table historical_source_registry to service_role;
grant all privileges on table historical_import_registry to service_role;
grant all privileges on table historical_raw_records to service_role;
grant all privileges on table historical_import_checkpoints to service_role;
grant all privileges on table historical_identity_foundation to service_role;

grant select on table historical_source_registry to authenticated;
grant select on table historical_import_registry to authenticated;
grant select on table historical_raw_records to authenticated;
grant select on table historical_import_checkpoints to authenticated;
grant select on table historical_identity_foundation to authenticated;
