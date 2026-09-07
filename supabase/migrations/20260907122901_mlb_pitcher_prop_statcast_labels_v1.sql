-- MLB pitcher prop Statcast labels v1
-- Bounded to starter identities already present in the certified strikeout backtest surface.
-- Used for exact cross-season K/hits label parity and research only.

create materialized view if not exists public.mlb_pitcher_prop_statcast_labels_v1_mv as
with keys as (
  select distinct season, target_game_pk, mlbam_pitcher_id
  from public.mlb_pitcher_strikeout_backtest_rows_v1_mv
)
select
  k.season,
  k.target_game_pk,
  k.mlbam_pitcher_id,
  min(p.game_date) as game_date,
  count(*)::int as actual_total_pitches,
  count(distinct (p.game_pk, p.at_bat_number))::int as actual_plate_appearances,
  count(*) filter (where p.events in ('strikeout','strikeout_double_play'))::int as actual_strikeouts,
  count(*) filter (where p.events in ('walk','intent_walk'))::int as actual_walks,
  count(*) filter (where p.events in ('single','double','triple','home_run'))::int as actual_hits_allowed,
  count(*) filter (where p.events='home_run')::int as actual_home_runs_allowed
from keys k
join public.pick2_raw_mlb_statcast_pitches p
  on p.game_year=k.season
 and p.game_pk=k.target_game_pk
 and coalesce(p.mlbam_pitcher_id,p.source_pitcher_id)=k.mlbam_pitcher_id
group by k.season,k.target_game_pk,k.mlbam_pitcher_id
with data;

create unique index if not exists mlb_pitcher_prop_statcast_labels_v1_uidx
  on public.mlb_pitcher_prop_statcast_labels_v1_mv(season,target_game_pk,mlbam_pitcher_id);

revoke all on public.mlb_pitcher_prop_statcast_labels_v1_mv from public, anon, authenticated;
grant select on public.mlb_pitcher_prop_statcast_labels_v1_mv to service_role;
