-- MLB_FANDUEL_BATTER_TOTAL_BASES_YES_VOLUME_V1
-- READ ONLY / 2025 development only.
-- Frozen grid 3.00..5.00 by .05 before results.
with base as (
  select game_pk,game_date,batter,total_bases,plate_appearances
  from public.mlb_statcast_batter_total_bases_game_mv
  where season=2025 and plate_appearances>0
), daily as (
  select batter,game_date,count(*) games_on_date,sum(plate_appearances)::float8 pa
  from base group by batter,game_date
), hist as (
  select d.*,sum(games_on_date) over w prior_games,sum(pa) over w prior_pa
  from daily d
  window w as (partition by batter order by game_date rows between unbounded preceding and 1 preceding)
), rows as (
  select b.*,h.prior_pa/nullif(h.prior_games,0) prior_pa_per_game,to_char(b.game_date,'YYYY-MM') mon
  from base b join hist h using(batter,game_date)
  where b.game_date>=date '2025-05-01' and h.prior_games>=10 and h.prior_pa>0
), lines as (
  select * from (values(1.5::numeric),(2.5::numeric),(3.5::numeric),(4.5::numeric)) v(line)
), cuts as (
  select generate_series(3.00,5.00,0.05)::numeric pa_cut
), grid as (
  select l.line,c.pa_cut,r.*,(r.prior_pa_per_game>=c.pa_cut) selected,(r.total_bases>l.line) won
  from rows r cross join lines l cross join cuts c
), a as (
  select line,pa_cut,count(*) filter(where selected) n,
         avg(won::int::numeric) filter(where selected) accuracy,
         avg(won::int::numeric) baseline
  from grid group by line,pa_cut
), m as (
  select line,pa_cut,mon,count(*) filter(where selected) month_n,
         avg(won::int::numeric) filter(where selected) month_accuracy
  from grid group by line,pa_cut,mon
), s as (
  select line,pa_cut,count(*) filter(where month_n>0) months,
         min(month_accuracy) filter(where month_n>0) worst_month
  from m group by line,pa_cut
)
select a.*,s.months,s.worst_month,a.accuracy-a.baseline lift
from a join s using(line,pa_cut)
where a.n>=60 and a.accuracy>=.75 and s.months>=5 and s.worst_month>=.65 and a.accuracy-a.baseline>=.05
order by line,n desc,lift desc,accuracy desc,pa_cut asc;
