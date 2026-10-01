-- MLB_BATTER_TOTAL_BASES_U1P5_LOW_VOLUME_V1
-- DEVELOPMENT ONLY: 2025. 2026 must remain unopened while selecting threshold.
with base as (
  select game_pk,game_date,batter,total_bases,plate_appearances
  from public.mlb_statcast_batter_total_bases_game_mv
  where season=2025 and plate_appearances>0
),
daily as (
  select batter,game_date,count(*) games_on_date,sum(plate_appearances)::float8 pa
  from base
  group by batter,game_date
),
features as (
  select d.*,
    sum(games_on_date) over w prior_games,
    sum(pa) over w prior_pa
  from daily d
  window w as (
    partition by batter order by game_date
    rows between unbounded preceding and 1 preceding
  )
),
rows as (
  select b.*,f.prior_games,
         f.prior_pa/nullif(f.prior_games,0) prior_pa_per_game,
         to_char(b.game_date,'YYYY-MM') as month_key
  from base b join features f using(batter,game_date)
  where b.game_date>=date '2025-05-01'
    and f.prior_games>=10
    and f.prior_pa>0
)
select
  count(*) filter(where prior_pa_per_game<=3.50) n,
  count(*) filter(where prior_pa_per_game<=3.50 and total_bases<1.5) wins,
  avg((total_bases<1.5)::int::float8) filter(where prior_pa_per_game<=3.50) accuracy,
  avg((total_bases<1.5)::int::float8) baseline
from rows;
