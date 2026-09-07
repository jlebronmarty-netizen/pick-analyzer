-- MLB pitcher prop historical backtest dataset v1.
-- Read-only research surfaces. No sportsbook/provider calls and no Official Pick writes.

create materialized view public.mlb_pitcher_identity_crosswalk_2025_v1 as
with stat_names as (
  select
    coalesce(p.mlbam_pitcher_id, p.source_pitcher_id) as mlbam_pitcher_id,
    p.source_player_name,
    translate(
      lower(trim(both from case
        when p.source_player_name like '%,%'
          then trim(both from split_part(p.source_player_name, ',', 2)) || ' ' || trim(both from split_part(p.source_player_name, ',', 1))
        else p.source_player_name
      end)),
      'áéíóúüñ', 'aeiouun'
    ) as normalized_name
  from public.pick2_raw_mlb_statcast_pitches p
  where p.game_year = 2025
    and coalesce(p.mlbam_pitcher_id, p.source_pitcher_id) is not null
    and p.source_player_name is not null
  group by
    coalesce(p.mlbam_pitcher_id, p.source_pitcher_id),
    p.source_player_name,
    translate(
      lower(trim(both from case
        when p.source_player_name like '%,%'
          then trim(both from split_part(p.source_player_name, ',', 2)) || ' ' || trim(both from split_part(p.source_player_name, ',', 1))
        else p.source_player_name
      end)),
      'áéíóúüñ', 'aeiouun'
    )
), historical_starters as (
  select distinct
    p.pitcher_source_id,
    p.pitcher_name,
    translate(lower(trim(both from p.pitcher_name)), 'áéíóúüñ', 'aeiouun') as normalized_name
  from public.historical_baseball_pitcher_appearances p
  join public.historical_baseball_games g
    on g.canonical_game_id = p.canonical_game_id
  where g.season = '2025'
    and p.starter = true
)
select
  h.pitcher_source_id,
  h.pitcher_name,
  h.normalized_name,
  case
    when h.pitcher_source_id = 'garcl007' then 677651::bigint
    when h.pitcher_source_id = 'trivl001' then 642152::bigint
    when h.pitcher_source_id = 'ortil003' then 682847::bigint
    else min(s.mlbam_pitcher_id)
  end as mlbam_pitcher_id,
  case
    when h.pitcher_source_id = any (array['garcl007'::text, 'trivl001'::text, 'ortil003'::text])
      then 'EXPLICIT_TEAM_DATE_NAME_EXCEPTION'::text
    else 'NORMALIZED_EXACT_NAME'::text
  end as mapping_method,
  count(distinct s.mlbam_pitcher_id)::integer as normalized_candidate_count
from historical_starters h
left join stat_names s
  on s.normalized_name = h.normalized_name
group by h.pitcher_source_id, h.pitcher_name, h.normalized_name;

create unique index mlb_pitcher_identity_crosswalk_2025_v1_source_uidx
  on public.mlb_pitcher_identity_crosswalk_2025_v1 (pitcher_source_id);
create index mlb_pitcher_identity_crosswalk_2025_v1_mlbam_idx
  on public.mlb_pitcher_identity_crosswalk_2025_v1 (mlbam_pitcher_id);

revoke all on public.mlb_pitcher_identity_crosswalk_2025_v1 from public, anon, authenticated;
grant select on public.mlb_pitcher_identity_crosswalk_2025_v1 to service_role;

create materialized view public.mlb_pitcher_prop_backtest_2025_v1 as
with team_alias(retro, canonical) as (
  values
    ('ANA'::text,'LAA'::text), ('ARI'::text,'ARI'::text), ('ATH'::text,'ATH'::text),
    ('ATL'::text,'ATL'::text), ('BAL'::text,'BAL'::text), ('BOS'::text,'BOS'::text),
    ('CHA'::text,'CHW'::text), ('CHN'::text,'CHC'::text), ('CIN'::text,'CIN'::text),
    ('CLE'::text,'CLE'::text), ('COL'::text,'COL'::text), ('DET'::text,'DET'::text),
    ('HOU'::text,'HOU'::text), ('KCA'::text,'KC'::text), ('LAN'::text,'LAD'::text),
    ('MIA'::text,'MIA'::text), ('MIL'::text,'MIL'::text), ('MIN'::text,'MIN'::text),
    ('NYA'::text,'NYY'::text), ('NYN'::text,'NYM'::text), ('PHI'::text,'PHI'::text),
    ('PIT'::text,'PIT'::text), ('SDN'::text,'SD'::text), ('SEA'::text,'SEA'::text),
    ('SFN'::text,'SF'::text), ('SLN'::text,'STL'::text), ('TBA'::text,'TB'::text),
    ('TEX'::text,'TEX'::text), ('TOR'::text,'TOR'::text), ('WAS'::text,'WSH'::text)
), historical_labels as (
  select
    p.id as historical_appearance_id,
    p.canonical_game_id,
    p.pitcher_source_id,
    p.pitcher_name,
    p.team_side,
    g.game_date,
    g.home_team as home_team_retro,
    g.away_team as away_team_retro,
    case when p.team_side = 'home' then g.home_team else g.away_team end as pitcher_team_retro,
    case when p.team_side = 'home' then g.away_team else g.home_team end as opponent_team_retro,
    p.outs as target_outs,
    p.batters_faced as target_batters_faced,
    p.hits as target_hits_allowed,
    p.walks as target_walks,
    p.strikeouts as target_strikeouts,
    p.runs as target_runs_allowed,
    p.pitch_count as target_pitch_count
  from public.historical_baseball_pitcher_appearances p
  join public.historical_baseball_games g
    on g.canonical_game_id = p.canonical_game_id
  where g.season = '2025'
    and p.starter = true
    and g.game_date >= date '2025-04-01'
), mapped_labels as (
  select
    h.*,
    x.mlbam_pitcher_id,
    x.mapping_method,
    pa.canonical as pitcher_team_abbr,
    oa.canonical as opponent_team_abbr
  from historical_labels h
  join public.mlb_pitcher_identity_crosswalk_2025_v1 x
    on x.pitcher_source_id = h.pitcher_source_id
  join team_alias pa on pa.retro = h.pitcher_team_retro
  join team_alias oa on oa.retro = h.opponent_team_retro
  where x.mlbam_pitcher_id is not null
), with_team_ids as (
  select
    m.*,
    pt.id as pitcher_team_id,
    ot.id as opponent_team_id
  from mapped_labels m
  join public.sports_teams pt
    on pt.sport_key = 'baseball_mlb'
   and pt.league_key = 'mlb'
   and pt.abbreviation = m.pitcher_team_abbr
  join public.sports_teams ot
    on ot.sport_key = 'baseball_mlb'
   and ot.league_key = 'mlb'
   and ot.abbreviation = m.opponent_team_abbr
)
select
  m.historical_appearance_id,
  m.canonical_game_id,
  p.target_game_pk,
  m.game_date,
  case
    when m.game_date < date '2025-08-01' then 'TRAIN'::text
    when m.game_date < date '2025-09-01' then 'VALIDATION'::text
    else 'TEST'::text
  end as fixed_split,
  m.pitcher_source_id,
  m.mlbam_pitcher_id,
  m.pitcher_name,
  m.mapping_method,
  m.team_side,
  m.pitcher_team_abbr,
  m.opponent_team_abbr,
  m.pitcher_team_id,
  m.opponent_team_id,
  p.id as pitcher_feature_id,
  o.id as opponent_team_feature_id,
  mt.id as matchup_feature_id,
  p.feature_version,
  p.as_of_date as pitcher_as_of_date,
  o.as_of_date as opponent_as_of_date,
  mt.as_of_date as matchup_as_of_date,
  m.target_strikeouts,
  m.target_outs,
  m.target_walks,
  m.target_hits_allowed,
  m.target_runs_allowed,
  m.target_pitch_count,
  m.target_batters_faced,
  p.k_rate as pitcher_k_rate,
  p.bb_rate as pitcher_bb_rate,
  p.k_minus_bb_rate as pitcher_k_minus_bb_rate,
  p.whiff_rate as pitcher_whiff_rate,
  p.csw_rate as pitcher_csw_rate,
  p.strike_rate as pitcher_strike_rate,
  p.swing_rate as pitcher_swing_rate,
  p.avg_release_speed as pitcher_avg_release_speed,
  p.velocity_l1 as pitcher_velocity_l1,
  p.velocity_l3 as pitcher_velocity_l3,
  p.velocity_l5 as pitcher_velocity_l5,
  p.velocity_delta as pitcher_velocity_delta,
  p.previous_pitch_count,
  p.days_rest,
  nullif(p.sample_sizes ->> 'sample_size', '')::integer as pitcher_prior_appearances,
  nullif(p.sample_sizes ->> 'pitches', '')::integer as pitcher_prior_pitches,
  nullif(p.sample_sizes ->> 'plate_appearances', '')::integer as pitcher_prior_plate_appearances,
  nullif(p.first_inning_performance ->> 'k_rate', '')::numeric as pitcher_first_inning_k_rate,
  nullif(p.first_inning_performance ->> 'bb_rate', '')::numeric as pitcher_first_inning_bb_rate,
  nullif(p.first_inning_performance ->> 'pitch_count_per_appearance', '')::numeric as pitcher_first_inning_pitch_count_avg,
  o.recent_k_rate as opponent_recent_k_rate,
  o.recent_bb_rate as opponent_recent_bb_rate,
  o.recent_runs_per_game as opponent_recent_runs_per_game,
  o.recent_iso as opponent_recent_iso,
  nullif(o.sample_sizes ->> 'sample_size', '')::integer as opponent_prior_games,
  nullif(o.sample_sizes ->> 'pitches', '')::integer as opponent_prior_pitches,
  nullif(o.sample_sizes ->> 'plate_appearances', '')::integer as opponent_prior_plate_appearances,
  nullif(o.lineup_proxy ->> 'batter_count', '')::integer as opponent_lineup_proxy_batter_count,
  p.pitch_mix,
  p.pitch_mix_change,
  p.handedness_splits as pitcher_handedness_context,
  p.first_inning_performance,
  p.sample_sizes as pitcher_sample_sizes,
  p.source_window as pitcher_source_window,
  o.handedness_splits as opponent_handedness_context,
  o.lineup_proxy as opponent_lineup_proxy,
  o.sample_sizes as opponent_sample_sizes,
  o.source_window as opponent_source_window,
  mt.pitcher_batter_mix as matchup_pitcher_batter_mix,
  mt.handedness_context as matchup_handedness_context,
  mt.lineup_context as matchup_lineup_context,
  mt.sample_sizes as matchup_sample_sizes,
  mt.source_window as matchup_source_window
from with_team_ids m
join public.pick2_mlb_pitcher_daily_features p
  on p.mlbam_pitcher_id = m.mlbam_pitcher_id
 and p.feature_date = m.game_date
join public.pick2_mlb_team_daily_features o
  on o.target_game_pk = p.target_game_pk
 and o.team_id = m.opponent_team_id
join public.pick2_mlb_matchup_daily_features mt
  on mt.target_game_pk = p.target_game_pk
where p.as_of_date < m.game_date
  and o.as_of_date < m.game_date
  and mt.as_of_date < m.game_date;

create unique index mlb_pitcher_prop_backtest_2025_v1_appearance_uidx
  on public.mlb_pitcher_prop_backtest_2025_v1 (historical_appearance_id);
create index mlb_pitcher_prop_backtest_2025_v1_date_idx
  on public.mlb_pitcher_prop_backtest_2025_v1 (game_date, fixed_split);
create index mlb_pitcher_prop_backtest_2025_v1_pitcher_idx
  on public.mlb_pitcher_prop_backtest_2025_v1 (mlbam_pitcher_id, game_date);

revoke all on public.mlb_pitcher_prop_backtest_2025_v1 from public, anon, authenticated;
grant select on public.mlb_pitcher_prop_backtest_2025_v1 to service_role;
