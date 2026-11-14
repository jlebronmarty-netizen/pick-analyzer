-- Isolated, SMALL metadata index for NBA GOAT 2026 historical payload files.
-- Keep large compressed raw JSON in PRIVATE Supabase Storage, not the PostgreSQL disk.
-- The private bucket "nba-goat-2026-private" must be provisioned separately via Storage API/dashboard.
create table if not exists public.nba_goat_season_archive_v1 (
  season integer not null,
  provider_game_id bigint not null,
  dataset_key text not null,
  provider text not null default 'balldontlie',
  source_captured_at timestamptz not null default now(),
  game_date date,
  response_sha256 text not null,
  data_count integer not null,
  storage_bucket text not null default 'nba-goat-2026-private',
  storage_object_path text not null,
  compressed_bytes bigint not null,
  json_bytes bigint not null,
  primary key (season,provider_game_id,dataset_key),
  constraint nba_goat_archive_season_check check (season between 1946 and 2100),
  constraint nba_goat_archive_count_check check (data_count >= 0),
  constraint nba_goat_archive_bytes_check check (compressed_bytes > 0 and json_bytes > 0),
  constraint nba_goat_archive_sha_check check (response_sha256 ~ '^[0-9a-f]{64}$'),
  constraint nba_goat_archive_dataset_check check (length(dataset_key) between 1 and 80),
  constraint nba_goat_archive_bucket_check check (storage_bucket = 'nba-goat-2026-private')
);
create index if not exists nba_goat_season_archive_date_idx
  on public.nba_goat_season_archive_v1(season,game_date);
alter table public.nba_goat_season_archive_v1 enable row level security;
revoke all on public.nba_goat_season_archive_v1 from anon,authenticated;
comment on table public.nba_goat_season_archive_v1 is
  'NBA GOAT season backfill metadata only. Original gzipped JSON is in a private Storage bucket; service role only. No model or pick writes.';
