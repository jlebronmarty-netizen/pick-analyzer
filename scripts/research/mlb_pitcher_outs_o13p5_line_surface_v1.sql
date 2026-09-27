-- MLB_PITCHER_OUTS_O13P5_LINE_SURFACE_V1
-- READ ONLY. Exact line 13.5.
-- Development 2025; frozen threshold grid 12..20 by .25.
-- Strict prior-date lineage; no same-date history.
with base as (
  select game_pk,game_date,pitcher,outs
  from public.mlb_ml_xyear_pitcher_game_v1
  where season=2025 and starter=true
), joined as (
  select t.game_pk,t.game_date,t.pitcher,t.outs,
         h.game_date h_date,h.game_pk h_game,h.outs h_outs,
         row_number() over(partition by t.game_pk,t.pitcher order by h.game_date desc,h.game_pk desc) h_rn
  from base t
  join base h on h.pitcher=t.pitcher and h.game_date<t.game_date
), pred as (
  select game_pk,game_date,pitcher,max(outs) actual_outs,count(*) prior_starts,
         0.50*avg(h_outs::numeric)+0.50*avg(h_outs::numeric) filter(where h_rn<=5) projection,
         to_char(game_date,'YYYY-MM') mon
  from joined
  group by game_pk,game_date,pitcher
  having count(*)>=5
), cuts as (
  select generate_series(12.00,20.00,0.25)::numeric threshold
), sides as (
  select unnest(array['OVER','UNDER']) side
), grid as (
  select c.threshold,s.side,p.*,
         case when s.side='OVER' then p.projection>=c.threshold else p.projection<=c.threshold end selected,
         case when s.side='OVER' then p.actual_outs>13.5 else p.actual_outs<13.5 end won
  from pred p cross join cuts c cross join sides s
), a as (
  select side,threshold,count(*) filter(where selected) n,
         count(*) filter(where selected and won) wins,
         avg(won::int::numeric) filter(where selected) accuracy,
         avg(won::int::numeric) baseline
  from grid group by side,threshold
), m as (
  select side,threshold,mon,count(*) filter(where selected) month_n,
         avg(won::int::numeric) filter(where selected) month_accuracy
  from grid group by side,threshold,mon
), st as (
  select side,threshold,count(*) filter(where month_n>0) months,
         min(month_accuracy) filter(where month_n>0) worst_month,
         min(month_n) filter(where month_n>0) min_month_n
  from m group by side,threshold
), passers as (
  select a.*,st.months,st.worst_month,st.min_month_n,a.accuracy-a.baseline lift
  from a join st using(side,threshold)
  where a.n>=60 and a.accuracy>=.75 and st.months>=5 and st.worst_month>=.65 and a.accuracy-a.baseline>=.05
)
select * from passers
order by side,n desc,lift desc,accuracy desc,threshold asc;
