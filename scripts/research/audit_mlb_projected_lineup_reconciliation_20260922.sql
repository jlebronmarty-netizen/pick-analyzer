-- Read-only historical reconciliation. Do not repeat as routine CI: aggregate scan may be expensive.
-- Explicitly reviewed inputs only; no provider calls, model fit, external outcomes or writes.
with daily as materialized (
select coalesce(mlbam_batter_id,source_batter_id) batter,game_date,
count(distinct(game_pk,at_bat_number)) pa,
count(distinct(game_pk,at_bat_number)) filter(where events in ('single','double','triple','home_run')) hits,
count(distinct(game_pk,at_bat_number)) filter(where events in ('walk','intent_walk')) walks,
count(distinct(game_pk,at_bat_number)) filter(where events='home_run') hr
from pick2_raw_mlb_statcast_pitches where game_year=2025 and game_type='R' and game_date between '2025-03-02' and '2025-08-30' and events is not null and events<>'' group by 1,2),
replay as (
select t.game_pk,t.team,t.batter,t.pa_30d,t.hits_30d,t.walks_30d,t.hr_30d,coalesce(sum(d.pa),0) pa,coalesce(sum(d.hits),0) hits,coalesce(sum(d.walks),0) walks,coalesce(sum(d.hr),0) hr
from mlb_totals_v11e_projected_lineup_players_2025_v1 t left join daily d on d.batter=t.batter and d.game_date>=t.game_date-30 and d.game_date<t.game_date group by t.game_pk,t.team,t.batter,t.pa_30d,t.hits_30d,t.walks_30d,t.hr_30d)
select count(*) checked,count(*) filter(where pa_30d<>pa) pa_mismatch,count(*) filter(where hits_30d<>hits) hits_mismatch,count(*) filter(where walks_30d<>walks) walks_mismatch,count(*) filter(where hr_30d<>hr) hr_mismatch from replay;
