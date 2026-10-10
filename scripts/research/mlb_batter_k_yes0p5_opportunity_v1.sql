-- MLB_BATTER_K_YES0P5_OPPORTUNITY_V1
-- DEVELOPMENT ONLY: 2025. Exact side token is YES.
with base as (
  select game_pk,game_date,batter,strikeouts,plate_appearances
  from public.mlb_statcast_batter_game_logs
  where season=2025 and plate_appearances>0
),
daily as (
  select batter,game_date,count(*) games_on_date,
         sum(plate_appearances)::float8 pa,
         sum(strikeouts)::float8 k
  from base
  group by batter,game_date
),
features as (
  select d.*,
         sum(games_on_date) over w prior_games,
         sum(pa) over w prior_pa,
         sum(k) over w prior_k
  from daily d
  window w as (
    partition by batter order by game_date
    rows between unbounded preceding and 1 preceding
  )
),
rows as (
  select b.*,f.prior_games,
         f.prior_k/nullif(f.prior_pa,0) prior_k_per_pa,
         f.prior_pa/nullif(f.prior_games,0) prior_pa_per_game
  from base b
  join features f using(batter,game_date)
  where b.game_date>=date '2025-05-01'
    and f.prior_games>=10
    and f.prior_pa>0
)
select
  count(*) filter(where prior_k_per_pa>=0.30 and prior_pa_per_game>=3.75) n,
  count(*) filter(where prior_k_per_pa>=0.30 and prior_pa_per_game>=3.75 and strikeouts>0.5) wins,
  avg((strikeouts>0.5)::int::float8)
    filter(where prior_k_per_pa>=0.30 and prior_pa_per_game>=3.75) accuracy,
  avg((strikeouts>0.5)::int::float8) baseline
from rows;
