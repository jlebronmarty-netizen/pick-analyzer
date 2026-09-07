-- Canonical pitcher BB research surface V1.
-- IMPORTANT: actual_bb is bases on balls (walk + intentional_walk) and excludes HBP.
-- The legacy 2025 target_walks field is retained only for semantic audit and equals BB + HBP.

create materialized view if not exists public.mlb_pitcher_bb_backtest_rows_v1_mv as
select
  s.season,s.target_game_pk,s.feature_date,s.as_of_date,s.as_of_timestamp,s.feature_version,
  s.mlbam_pitcher_id,s.pitching_team,s.opponent_team,
  l.actual_walks::int as actual_bb,
  g.hit_by_pitch::int as actual_hbp,
  case when s.season=2025 then e.target_walks else null end::int as legacy_bb_plus_hbp,
  case when s.season=2025 then (e.target_walks=l.actual_walks+g.hit_by_pitch) else null end as legacy_semantic_reconciles,
  s.pitcher_bb_rate,s.opponent_bb_rate,s.pitcher_k_rate,s.pitcher_whiff_rate,s.pitcher_csw_rate,s.pitcher_strike_rate,
  s.previous_pitch_count,s.days_rest,s.prior_appearances,s.prior_pitches,s.prior_plate_appearances,
  s.prior_plate_appearances::double precision/nullif(s.prior_appearances,0) as expected_bf,
  (s.prior_plate_appearances::double precision/nullif(s.prior_appearances,0))*s.pitcher_bb_rate as expected_bf_x_pitcher_bb_rate,
  (s.prior_plate_appearances::double precision/nullif(s.prior_appearances,0))*s.opponent_bb_rate as expected_bf_x_opponent_bb_rate,
  s.source_rule,s.source_as_of_date,
  case when s.season=2026 then 'OOS_2026'
       when s.feature_date<date '2025-08-01' then 'TRAIN'
       when s.feature_date<date '2025-09-01' then 'VALIDATION'
       else 'TEST' end as split,
  (s.prior_appearances>=3) as modeling_eligible
from public.mlb_pitcher_strikeout_backtest_rows_v1_mv s
join public.mlb_pitcher_prop_statcast_labels_v1_mv l
  on l.season=s.season and l.target_game_pk=s.target_game_pk and l.mlbam_pitcher_id=s.mlbam_pitcher_id
join public.mlb_statcast_pitcher_game_logs g
  on g.season=s.season and g.game_pk=s.target_game_pk and g.pitcher=s.mlbam_pitcher_id
left join public.mlb_pitcher_prop_backtest_2025_v1_enriched e
  on s.season=2025 and e.target_game_pk=s.target_game_pk and e.mlbam_pitcher_id=s.mlbam_pitcher_id
with data;

create unique index if not exists mlb_pitcher_bb_backtest_rows_v1_mv_uidx
  on public.mlb_pitcher_bb_backtest_rows_v1_mv(season,target_game_pk,mlbam_pitcher_id);
create index if not exists mlb_pitcher_bb_backtest_rows_v1_mv_split_idx
  on public.mlb_pitcher_bb_backtest_rows_v1_mv(split,modeling_eligible,feature_date,target_game_pk);
revoke all on public.mlb_pitcher_bb_backtest_rows_v1_mv from public,anon,authenticated;
grant select on public.mlb_pitcher_bb_backtest_rows_v1_mv to service_role;

create or replace function public.refresh_mlb_pitcher_prop_research_rollups()
returns void language plpgsql security definer set search_path=public as $$
begin
  refresh materialized view public.mlb_pitcher_bb_backtest_rows_v1_mv;
end;
$$;
revoke all on function public.refresh_mlb_pitcher_prop_research_rollups() from public,anon,authenticated;
grant execute on function public.refresh_mlb_pitcher_prop_research_rollups() to service_role;