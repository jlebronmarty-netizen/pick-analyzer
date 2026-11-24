create table public.nba_cheat_snapshots_v1 (
  snapshot_id text primary key check (snapshot_id ~ '^[a-f0-9]{64}$'),
  day_local date not null,
  captured_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null check (captured_at < expires_at),
  payload jsonb not null check (jsonb_typeof(payload->'cards') = 'array')
);
alter table public.nba_cheat_snapshots_v1 enable row level security;
revoke all on public.nba_cheat_snapshots_v1 from public, anon, authenticated, service_role;
grant insert, select on public.nba_cheat_snapshots_v1 to service_role;
