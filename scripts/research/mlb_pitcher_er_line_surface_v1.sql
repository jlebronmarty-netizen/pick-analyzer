-- MLB_PITCHER_ER_LINE_SURFACE_V1
-- READ ONLY. Exact ER labels from the frozen 2025 runtime.
-- VALIDATION selects thresholds; TEST confirms without retuning.
with e as (
  select fixed_split,actual_er,frozen_prediction
  from public.mlb_pitcher_er_frozen_2025_runtime_v1
  where fixed_split in ('VALIDATION','TEST')
),
lines(line) as (values (1.5::float8),(2.5::float8),(3.5::float8)),
thresholds(thr) as (select generate_series(0.5,5.0,0.1)::float8),
sides(side) as (values ('OVER'::text),('UNDER'::text)),
cand as (
 select l.line,s.side,t.thr,e.fixed_split,
   count(*) filter(where case when s.side='OVER' then e.frozen_prediction>=t.thr else e.frozen_prediction<=t.thr end) n,
   count(*) filter(where
      (case when s.side='OVER' then e.frozen_prediction>=t.thr else e.frozen_prediction<=t.thr end)
      and (case when s.side='OVER' then e.actual_er>l.line else e.actual_er<l.line end)
   ) wins,
   avg((case when s.side='OVER' then e.actual_er>l.line else e.actual_er<l.line end)::int::float8)
      filter(where case when s.side='OVER' then e.frozen_prediction>=t.thr else e.frozen_prediction<=t.thr end) acc,
   avg((case when s.side='OVER' then e.actual_er>l.line else e.actual_er<l.line end)::int::float8) baseline
 from e cross join lines l cross join thresholds t cross join sides s
 group by l.line,s.side,t.thr,e.fixed_split
),
v as (
 select *,acc-baseline lift
 from cand where fixed_split='VALIDATION'
),
eligible as (
 select *,row_number() over(
   partition by line,side
   order by n desc,(acc-baseline) desc,acc desc,thr asc
 ) rn
 from v
 where n>=30 and acc>=0.75 and (acc-baseline)>=0.05
),
chosen as (select * from eligible where rn=1)
select c.line,c.side,c.thr,
 c.n val_n,c.wins val_wins,c.acc val_acc,c.baseline val_base,c.acc-c.baseline val_lift,
 t.n test_n,t.wins test_wins,t.acc test_acc,t.baseline test_base,t.acc-t.baseline test_lift,
 case when t.n>=30 and t.acc>=0.75 and (t.acc-t.baseline)>=0.05
   then 'CROSS_SPLIT_PASS' else 'TEST_FAIL' end state
from chosen c
join cand t using(line,side,thr)
where t.fixed_split='TEST'
order by c.line,c.side;
