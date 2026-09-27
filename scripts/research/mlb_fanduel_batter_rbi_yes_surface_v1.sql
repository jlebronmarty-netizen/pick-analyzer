-- MLB_FANDUEL_BATTER_RBI_YES_SURFACE_V1
-- Research-only reproducible 2025 development replay.
-- Frozen before reading results: lines 0.5/1.5 YES; threshold 0.00..2.00 step .05;
-- gates accuracy>=.75, n>=60, months>=5, worst_month>=.65, lift>=.05.
-- Same-date history forbidden.

with pg as (
  select g.game_date,g.canonical_game_id,a.canonical_batter_id,
         count(*) filter(where a.plate_appearance) as pa,
         coalesce(sum(a.rbi),0)::int as rbi
  from public.historical_baseball_batter_appearances a
  join public.historical_baseball_games g on g.canonical_game_id=a.canonical_game_id
  where g.season='2025' and a.canonical_batter_id is not null
  group by g.game_date,g.canonical_game_id,a.canonical_batter_id
), joined as (
  select t.game_date,t.canonical_game_id,t.canonical_batter_id,t.rbi,
         h.pa h_pa,h.rbi h_rbi,
         row_number() over(partition by t.canonical_game_id,t.canonical_batter_id order by h.game_date desc,h.canonical_game_id desc) h_rn
  from pg t join pg h
    on h.canonical_batter_id=t.canonical_batter_id
   and h.game_date<t.game_date
), pred as (
  select game_date,canonical_game_id,canonical_batter_id,max(rbi) actual_rbi,
         count(*) prior_games,
         0.50*((sum(h_rbi)::numeric/nullif(sum(h_pa)::numeric,0))*avg(h_pa::numeric) filter(where h_rn<=10))
         +0.50*(avg(h_rbi::numeric) filter(where h_rn<=10)) projection
  from joined group by game_date,canonical_game_id,canonical_batter_id
  having count(*)>=10 and sum(h_pa)>0
), grid as (
  select l.line,t.threshold,p.*,(p.projection>=t.threshold) selected,
         (p.actual_rbi>l.line) won,to_char(p.game_date,'YYYY-MM') month_key
  from pred p cross join (values(0.5::numeric),(1.5::numeric)) l(line)
  cross join generate_series(0.00,2.00,0.05) t(threshold)
), a as (
  select line,threshold,count(*) filter(where selected) n,
         count(*) filter(where selected and won) wins,
         avg(won::int::numeric) filter(where selected) accuracy,
         avg(won::int::numeric) baseline
  from grid group by line,threshold
), m as (
  select line,threshold,month_key,count(*) filter(where selected) month_n,
         avg(won::int::numeric) filter(where selected) month_accuracy
  from grid group by line,threshold,month_key
), s as (
  select line,threshold,count(*) filter(where month_n>0) months,
         min(month_accuracy) filter(where month_n>0) worst_month,
         min(month_n) filter(where month_n>0) min_month_n
  from m group by line,threshold
), candidates as (
  select a.*,s.months,s.worst_month,s.min_month_n,a.accuracy-a.baseline lift,
         (a.accuracy>=.75 and a.n>=60 and s.months>=5 and s.worst_month>=.65 and a.accuracy-a.baseline>=.05) signal_gate
  from a join s using(line,threshold)
)
select * from candidates
where signal_gate
order by line,n desc,lift desc,accuracy desc,threshold asc;
