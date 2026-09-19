create table public.mlb_f5_ml_revisit_base_v1 as
with sc as (
  select game_year::smallint as season, game_pk, game_date,
         post_home_score::int as home_f5, post_away_score::int as away_f5
  from (
    select p.*,
      row_number() over (
        partition by game_pk
        order by inning desc,
                 case when lower(inning_topbot) in ('bot','bottom') then 1 else 0 end desc,
                 at_bat_number desc,pitch_number desc,created_at desc
      ) rn
    from public.pick2_raw_mlb_statcast_pitches p
    where game_year in (2025,2026)
      and inning<=5
      and game_date<=date '2026-09-18'
  ) x
  where rn=1
),
rs as (
  select canonical_game_id,
         (score_after->>'home')::int as home_f5,
         (score_after->>'away')::int as away_f5
  from (
    select p.*,
      row_number() over (
        partition by canonical_game_id
        order by inning desc,
                 case when lower(half)='bottom' then 1 else 0 end desc,
                 source_line desc
      ) rn
    from public.historical_baseball_plays p
    where inning<=5
  ) x
  where rn=1
),
y2025 as (
  select f.game_pk,f.game_date,sc.home_f5,sc.away_f5,
    case when sc.home_f5>sc.away_f5 then 1
         when sc.home_f5<sc.away_f5 then 0
         else null end::integer as y_home,
    (to_jsonb(f)-'actual_winner') as payload
  from public.mlb_ml_xyear_features_v1 f
  join public.mlb_ml_game_map_2025_v3 m on m.game_pk=f.game_pk
  join sc on sc.season=2025 and sc.game_pk=f.game_pk
  join rs on rs.canonical_game_id=m.canonical_game_id
  where f.season=2025
    and f.feature_cutoff_date<f.game_date
    and sc.home_f5=rs.home_f5
    and sc.away_f5=rs.away_f5
    and sc.home_f5 is not null and sc.away_f5 is not null
),
y2026 as (
  select f.game_pk,f.game_date,sc.home_f5,sc.away_f5,
    case when sc.home_f5>sc.away_f5 then 1
         when sc.home_f5<sc.away_f5 then 0
         else null end::integer as y_home,
    (to_jsonb(f)-'actual_winner') as payload
  from public.mlb_ml_xyear_features_v1 f
  join sc on sc.season=2026 and sc.game_pk=f.game_pk
  where f.season=2026
    and f.game_date<=date '2026-09-18'
    and f.feature_cutoff_date<f.game_date
    and sc.home_f5 is not null and sc.away_f5 is not null
)
select 2025::smallint as season,game_pk,game_date,home_f5,away_f5,y_home,payload,
  'STATCAST_RETROSHEET_EXACT_F5'::text as outcome_lineage,
  'HISTORICAL_SEEN_DEVELOPMENT'::text as development_class,
  true::boolean as research_only
from y2025
union all
select 2026::smallint as season,game_pk,game_date,home_f5,away_f5,y_home,payload,
  'STATCAST_F5'::text as outcome_lineage,
  'HISTORICAL_SEEN_DEVELOPMENT'::text as development_class,
  true::boolean as research_only
from y2026;

alter table public.mlb_f5_ml_revisit_base_v1
  add primary key(season,game_pk),
  add constraint mlb_f5_ml_revisit_cutoff_ck check(game_date<=date '2026-09-18'),
  add constraint mlb_f5_ml_revisit_score_not_null_ck check(home_f5 is not null and away_f5 is not null),
  add constraint mlb_f5_ml_revisit_y_ck check(y_home in (0,1) or y_home is null),
  add constraint mlb_f5_ml_revisit_class_ck check(development_class='HISTORICAL_SEEN_DEVELOPMENT'),
  add constraint mlb_f5_ml_revisit_research_ck check(research_only=true),
  add constraint mlb_f5_ml_revisit_no_actual_winner_ck check(not(payload?'actual_winner'));

create index mlb_f5_ml_revisit_base_date_idx on public.mlb_f5_ml_revisit_base_v1(game_date);
alter table public.mlb_f5_ml_revisit_base_v1 enable row level security;
revoke all on table public.mlb_f5_ml_revisit_base_v1 from anon,authenticated;
grant select on table public.mlb_f5_ml_revisit_base_v1 to service_role;

comment on table public.mlb_f5_ml_revisit_base_v1 is
'Research-only F5 Moneyline revisit surface. 2025 requires exact Statcast/Retrosheet F5 score agreement; 2026 uses complete Statcast F5 scores only. Missing scores are excluded fail-closed. Ties are pushes and y_home is null.';
