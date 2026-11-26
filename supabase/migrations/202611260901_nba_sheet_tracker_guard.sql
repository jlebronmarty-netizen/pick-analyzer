-- Apply after 202611240901. No existing snapshot payload is rewritten.
create function public.nba_sheet_server_time_v1() returns trigger
language plpgsql set search_path = pg_catalog as $$
declare card jsonb;
begin
 if tg_op <> 'INSERT' then raise exception 'immutable NBA snapshot'; end if;
 new.captured_at := clock_timestamp();
 if jsonb_typeof(new.payload->'cards') is distinct from 'array' or jsonb_array_length(new.payload->'cards')=0 then raise exception 'cards required'; end if;
 for card in select * from jsonb_array_elements(new.payload->'cards') loop
   if card->>'start' is null or (card->>'start')::timestamptz <= new.captured_at then raise exception 'pregame only'; end if;
   if new.payload->>'version'='NBA_SHEET_LAB_V1' and
    (card->>'captured' is null or (card->>'captured')::timestamptz>new.captured_at or card->>'expires' is null or (card->>'expires')::timestamptz<=new.captured_at or
     (card->'original'->>'recordedAt')::timestamptz>new.captured_at) then raise exception 'invalid contract cutoff'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(new.payload->'cards') c group by c->>'quoteId' having count(*)>1 or c->>'quoteId' is null) then raise exception 'invalid quote identity'; end if;
 return new;
end $$;
create trigger nba_sheet_clock_v1 before insert or update or delete on public.nba_cheat_snapshots_v1
for each row execute function public.nba_sheet_server_time_v1();
create table public.nba_sheet_grades_v1 (
 snapshot_id text not null references public.nba_cheat_snapshots_v1,
 quote_id text not null,
 result text not null check(result in ('win','loss','push','void','dnp')),
 value numeric,
 pick_result text check(pick_result in ('win','loss','push','void','dnp')),
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(snapshot_id,quote_id),
 check ((result in ('win','loss','push')) = (value is not null))
);
create function public.nba_sheet_grade_guard_v1() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare card jsonb;
begin
 if tg_op <> 'INSERT' then raise exception 'immutable NBA grade'; end if;
 select c into card from public.nba_cheat_snapshots_v1 s cross join lateral jsonb_array_elements(s.payload->'cards') c
 where s.snapshot_id=new.snapshot_id and c->>'quoteId'=new.quote_id;
 if card is null or (card->>'start')::timestamptz>clock_timestamp() then raise exception 'unmatched or unstarted contract'; end if;
 if new.pick_result is not null and coalesce(jsonb_typeof(card->'original'),'null') <> 'object' then raise exception 'missing frozen original'; end if;
 new.recorded_at:=clock_timestamp();return new;
end $$;
create trigger nba_sheet_grade_guard before insert or update or delete on public.nba_sheet_grades_v1 for each row execute function public.nba_sheet_grade_guard_v1();
alter table public.nba_sheet_grades_v1 enable row level security;
revoke all on public.nba_sheet_grades_v1 from public,anon,authenticated,service_role;
grant insert, select on public.nba_sheet_grades_v1 to service_role;
create view public.nba_sheet_accuracy_v1 with (security_invoker=true) as
with rows as (
 select s.payload->>'method' methodology,s.payload->>'scope' scope,s.payload->>'band' odds_band,c->>'statistic' market,c->>'period' period,c->>'quoteId' quote,
 g.result,g.pick_result,row_number() over(partition by s.payload->>'method',s.payload->>'scope',s.payload->>'band',c->>'quoteId' order by s.captured_at,s.snapshot_id) rn
 from public.nba_cheat_snapshots_v1 s cross join lateral jsonb_array_elements(s.payload->'cards') c
 left join public.nba_sheet_grades_v1 g on g.snapshot_id=s.snapshot_id and g.quote_id=c->>'quoteId'
 where s.payload->>'version'='NBA_SHEET_LAB_V1'
)
select methodology,scope,odds_band,market,period,count(*) contracts,count(*) filter(where result is null) pending,
 count(*) filter(where result='push') pushes,count(*) filter(where result='dnp') dnp,count(*) filter(where result='void') voids,
 count(*) filter(where result in ('win','loss')) decided,avg((result='win')::int) filter(where result in ('win','loss')) accuracy,
 count(*) filter(where result in ('win','loss') and pick_result in ('win','loss')) pairs,
 avg((result='win')::int) filter(where result in ('win','loss') and pick_result in ('win','loss')) paired_sheet_accuracy,
 avg((pick_result='win')::int) filter(where result in ('win','loss') and pick_result in ('win','loss')) paired_pick_accuracy
from rows where rn=1 group by methodology,scope,odds_band,market,period;
revoke all on public.nba_sheet_accuracy_v1 from public,anon,authenticated;
grant select on public.nba_sheet_accuracy_v1 to service_role;
