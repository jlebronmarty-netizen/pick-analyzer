create materialized view if not exists public.mlb_statcast_batter_sdt_game_mv as
select
  p.game_year::integer as season,
  p.game_pk::bigint as game_pk,
  min(p.game_date)::date as game_date,
  coalesce(p.mlbam_batter_id, p.source_batter_id)::bigint as batter,
  count(distinct p.at_bat_number) filter (where p.events is not null)::integer as plate_appearances,
  count(*) filter (where p.events = 'single')::integer as singles,
  count(*) filter (where p.events = 'double')::integer as doubles,
  count(*) filter (where p.events = 'triple')::integer as triples
from public.pick2_raw_mlb_statcast_pitches p
where p.game_type = 'R'
  and coalesce(p.mlbam_batter_id, p.source_batter_id) is not null
group by p.game_year, p.game_pk, coalesce(p.mlbam_batter_id, p.source_batter_id)
with data;

create unique index if not exists mlb_statcast_batter_sdt_game_mv_uidx
  on public.mlb_statcast_batter_sdt_game_mv (season, game_pk, batter);

create index if not exists mlb_statcast_batter_sdt_game_mv_batter_date_idx
  on public.mlb_statcast_batter_sdt_game_mv (season, batter, game_date);

revoke all on table public.mlb_statcast_batter_sdt_game_mv from anon, authenticated;
grant select on table public.mlb_statcast_batter_sdt_game_mv to service_role;
grant all on table public.mlb_statcast_batter_sdt_game_mv to postgres;

create or replace function public.refresh_mlb_statcast_batter_prop_rollups()
returns void
language plpgsql
security definer
set search_path to 'public'
set statement_timeout to '5min'
as $function$
begin
  refresh materialized view public.mlb_statcast_batter_total_bases_game_mv;
  refresh materialized view public.mlb_statcast_batter_sdt_game_mv;
end;
$function$;

alter table public.mlb_approved_prop_daily_v1
  drop constraint if exists mlb_approved_prop_daily_v1_status_chk;

alter table public.mlb_approved_prop_daily_v1
  add constraint mlb_approved_prop_daily_v1_status_chk
  check (status in (
    'QUALIFIES_MARKET_VERIFIED',
    'MODEL_QUALIFIES_MARKET_NOT_VERIFIED',
    'NO_PLAY',
    'NO_EVALUABLE',
    'RUNTIME_PARITY_NOT_CERTIFIED'
  ));
