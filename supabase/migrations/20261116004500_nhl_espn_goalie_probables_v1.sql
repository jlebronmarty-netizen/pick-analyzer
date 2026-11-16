-- Immutable pregame ESPN NHL probable goalie observations only. NOT confirmed starters.
create table if not exists public.nhl_espn_goalie_probables_v1(
 id text primary key,
 sports_date date not null unique,
 captured_at timestamptz not null,
 source_url text not null,
 source_version text not null,
 raw_sha256 text not null,
 games jsonb not null,
 game_count integer not null,
 is_confirmed_starter boolean not null default false,
 used_by_official_model boolean not null default false,
 created_at timestamptz not null default now(),
 constraint nhl_espn_source_url_check check (source_url ~ '^https://site[.]api[.]espn[.]com/apis/site/v2/sports/hockey/nhl/scoreboard[?]dates=2026[0-9]{4}$'),
 constraint nhl_espn_id_check check (id ~ '^[0-9a-f]{64}$'),
 constraint nhl_espn_sha_check check (raw_sha256 ~ '^[0-9a-f]{64}$'),
 constraint nhl_espn_version_check check (source_version='NHL_ESPN_FREE_PROBABLE_V5'),
 constraint nhl_espn_game_count_check check (game_count between 1 and 16 and jsonb_typeof(games)='array' and jsonb_array_length(games)=game_count),
 constraint nhl_espn_nopromotion check (is_confirmed_starter=false and used_by_official_model=false),
 constraint nhl_espn_time_check check (created_at >= captured_at - interval '10 seconds' and created_at <= captured_at + interval '90 seconds')
);
create index if not exists nhl_espn_goalie_observed_idx on public.nhl_espn_goalie_probables_v1(captured_at desc);
alter table public.nhl_espn_goalie_probables_v1 enable row level security;
revoke all on public.nhl_espn_goalie_probables_v1 from anon,authenticated;
revoke update,delete,truncate on public.nhl_espn_goalie_probables_v1 from service_role;
grant select,insert on public.nhl_espn_goalie_probables_v1 to service_role;
comment on table public.nhl_espn_goalie_probables_v1 is
'Append-only free ESPN probable goalie snapshots observed pregame. ESPN athlete IDs are not NHL IDs. Never auto-confirm goalies or modify predictions.';
