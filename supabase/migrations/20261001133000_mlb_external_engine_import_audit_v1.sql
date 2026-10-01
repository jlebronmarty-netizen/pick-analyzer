create table if not exists public.mlb_external_engine_import_audit_v1 (
  id text primary key,
  engine text not null,
  model_id text not null,
  target_date date not null,
  repo text not null,
  repo_ref text not null default 'main',
  manifest_path text not null,
  manifest_sha256 text null,
  csv_path text not null,
  csv_sha256 text not null,
  settlement_path text null,
  settlement_sha256 text null,
  artifact_status text not null,
  rows_imported integer not null default 0,
  rows_settled integer not null default 0,
  rows_void integer not null default 0,
  verification jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  research_only boolean not null default true check (research_only=true),
  production_eligible boolean not null default false check (production_eligible=false),
  official_picks_eligible boolean not null default false check (official_picks_eligible=false),
  apostar_enabled boolean not null default false check (apostar_enabled=false),
  unique(engine,model_id,target_date,manifest_path,csv_sha256)
);

create index if not exists mlb_external_engine_import_audit_model_idx
  on public.mlb_external_engine_import_audit_v1(engine,model_id,target_date);

alter table public.mlb_external_engine_import_audit_v1 enable row level security;
revoke all on table public.mlb_external_engine_import_audit_v1 from anon,authenticated;
grant select,insert,update on table public.mlb_external_engine_import_audit_v1 to service_role;

comment on table public.mlb_external_engine_import_audit_v1 is
'Research-only provenance audit for immutable Pick Edge / Equilizer GitHub artifacts imported into the MLB 2026 forward master ledger.';
