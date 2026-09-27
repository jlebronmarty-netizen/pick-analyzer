-- MLB_FANDUEL_BATTER_SINGLES_YES_SURFACE_V1
-- READ ONLY / 2025 development only.
with base as (
  select game_pk,game_date,batter,plate_appearances,singles
  from public.mlb_statcast_batter_sdt_game_mv
  where season=2025 and plate_appearances>0
), daily as (
  select batter,game_date,count(*) games_on_date,sum(plate_appearances)::float8 pa,sum(singles)::float8 singles
  from base group by batter,game_date
), hist as (
  select d.*,sum(games_on_date) over w prior_games,sum(pa) over w prior_pa,sum(singles) over w prior_singles
  from daily d
  window w as (partition by batter order by game_date rows between unbounded preceding and 1 preceding)
), rows as (
  select b.*,h.prior_games,h.prior_pa,h.prior_singles,
         (h.prior_singles/nullif(h.prior_pa,0))*(h.prior_pa/nullif(h.prior_games,0)) projection,
         to_char(b.game_date,'YYYY-MM') mon
  from base b join hist h using(batter,game_date)
  where b.game_date>=date '2025-05-01' and h.prior_games>=10 and h.prior_pa>0
), cuts as (
  select generate_series(0.10,1.50,0.05)::numeric threshold
), grid as (
  select c.threshold,r.*,(r.projection>=c.threshold) selected,(r.singles>0.5) won
  from rows r cross join cuts c
), a as (
  select threshold,count(*) filter(where selected) n,
         avg(won::int::numeric) filter(where selected) accuracy,
         avg(won::int::numeric) baseline
  from grid group by threshold
), m as (
  select threshold,mon,count(*) filter(where selected) month_n,
         avg(won::int::numeric) filter(where selected) month_accuracy
  from grid group by threshold,mon
), s as (
  select threshold,count(*) filter(where month_n>0) months,min(month_accuracy) filter(where month_n>0) worst_month
  from m group by threshold
)
select a.*,s.months,s.worst_month,a.accuracy-a.baseline lift
from a join s using(threshold)
where a.n>=60 and a.accuracy>=.75 and s.months>=5 and s.worst_month>=.65 and a.accuracy-a.baseline>=.05
order by n desc,lift desc,accuracy desc,threshold asc;
