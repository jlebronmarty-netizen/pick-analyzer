create index if not exists historical_raw_retrosheet_er_lookup_v1_idx
  on public.historical_raw_records (season, game_reference, source_line)
  where source = 'retrosheet'
    and record_type = 'data'
    and (parsed_fields ->> 0) = 'data'
    and (parsed_fields ->> 1) = 'er';

create materialized view public.mlb_pitcher_er_frozen_2025_runtime_v1 as
with labels as (
  select
    'retrosheet:mlb:game:' || game_reference as canonical_game_id,
    parsed_fields ->> 2 as pitcher_source_id,
    (parsed_fields ->> 3)::double precision as actual_er
  from public.historical_raw_records
  where source = 'retrosheet'
    and season = '2025'
    and record_type = 'data'
    and (parsed_fields ->> 0) = 'data'
    and (parsed_fields ->> 1) = 'er'
),
base as (
  select
    e.canonical_game_id,
    e.target_game_pk,
    e.game_date,
    e.fixed_split,
    e.pitcher_source_id,
    e.mlbam_pitcher_id,
    e.pitcher_name,
    e.pitcher_k_rate::double precision as pitcher_k_rate,
    l.actual_er
  from public.mlb_pitcher_prop_backtest_2025_v1_enriched e
  join labels l
    on l.canonical_game_id = e.canonical_game_id
   and l.pitcher_source_id = e.pitcher_source_id
  where e.target_outs > 0
    and e.fixed_split in ('TRAIN','VALIDATION','TEST')
    and e.pitcher_k_rate is not null
    and e.feature_version = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
    and e.pitcher_as_of_date < e.game_date
    and e.opponent_as_of_date < e.game_date
    and e.matchup_as_of_date < e.game_date
),
historical as (
  select
    b.*,
    count(*) over (
      partition by b.pitcher_source_id
      order by b.game_date
      groups between unbounded preceding and 1 preceding
    )::integer as prior_start_count,
    avg(b.actual_er) over (
      partition by b.pitcher_source_id
      order by b.game_date
      groups between unbounded preceding and 1 preceding
    )::double precision as prior_er_all
  from base b
),
modeled as (
  select *
  from historical
  where prior_start_count >= 3
    and prior_er_all is not null
)
select
  m.*,
  (
    1.90273530551357
    + 0.227085168912444 * m.prior_er_all
    + 0.653408289475203
    - 3.0156054216154 * m.pitcher_k_rate
  )::double precision as frozen_prediction,
  (
    m.actual_er - (
      1.90273530551357
      + 0.227085168912444 * m.prior_er_all
      + 0.653408289475203
      - 3.0156054216154 * m.pitcher_k_rate
    )
  )::double precision as frozen_residual
from modeled m;

create unique index mlb_pitcher_er_frozen_2025_runtime_v1_uidx
  on public.mlb_pitcher_er_frozen_2025_runtime_v1 (canonical_game_id, pitcher_source_id);

create index mlb_pitcher_er_frozen_2025_runtime_v1_split_idx
  on public.mlb_pitcher_er_frozen_2025_runtime_v1 (fixed_split);

revoke all on table public.mlb_pitcher_er_frozen_2025_runtime_v1 from anon, authenticated;
grant select on table public.mlb_pitcher_er_frozen_2025_runtime_v1 to service_role;
grant all on table public.mlb_pitcher_er_frozen_2025_runtime_v1 to postgres;
