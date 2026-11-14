-- Isolated raw GOAT NBA archive; no official model or betting tables are touched.
create table if not exists public.nba_goat_season_archive_v1 (
  season integer not null,
  provider_game_id bigint not null,
  dataset_key text not null,
  provider text not null default 'balldontlie',
  source_captured_at timestamptz not null default now(),
  game_date date,
  response_sha256 text not null,
  data_count integer not null,
  payload jsonb not null,
  primary key (season,provider_game_id,dataset_key),
  constraint nba_goat_archive_season_check check (season between 1946 and 2100),
  constraint nba_goat_archive_count_check check (data_count >= 0),
  constraint nba_goat_archive_dataset_check check (length(dataset_key) between 1 and 80)
);
create index if not exists nba_goat_season_archive_date_idx on public.nba_goat_season_archive_v1(season,game_date);
alter table public.nba_goat_season_archive_v1 enable row level security;
revoke all on public.nba_goat_season_archive_v1 from anon,authenticated;
comment on table public.nba_goat_season_archive_v1 is 'Raw provenance snapshots from NBA GOAT season backfill, separate from models and picks. Service role only.';
