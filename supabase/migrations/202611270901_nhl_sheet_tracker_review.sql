-- Proposed only. Private ledger, read-only service role, no active writer.
create schema nhl_sheet_v1;
revoke all on schema nhl_sheet_v1 from public,anon,authenticated,service_role;
grant usage on schema nhl_sheet_v1 to service_role;
create table nhl_sheet_v1.receipts (
 id bigint generated always as identity primary key,
 source text not null check(source in ('sheet','pick')),
 strategy text not null check(length(strategy)>0),
 event_id text not null, home_id bigint not null, away_id bigint not null check(home_id<>away_id),
 market text not null check(market in ('ml','spread','total')), book text not null,
 label text not null check(length(label)>0),jurisdiction text not null,rule_id text not null,period text not null,
 side text not null,line numeric not null check(line between -100 and 100),
 odds int not null check(odds between -650 and -100 or odds between 100 and 100000),
 band int generated always as (case when odds < -250 then -650 else -250 end) stored,
 position int, evaluated int, quoted_at timestamptz not null,
 cut_at timestamptz not null default statement_timestamp(),recorded_at timestamptz not null default clock_timestamp(), starts_at timestamptz not null,
 check(home_id>0 and away_id>0 and length(rule_id)>0 and length(jurisdiction)>0),
 check((market='ml' and line=0 and side in ('home','away')) or
       (market='spread' and side in ('home','away')) or (market='total' and side in ('under','over') and line>=0)),
 check((source='sheet' and position is not null and position between 1 and 10 and evaluated is not null and evaluated between 0 and 9)
    or (source='pick' and position is null and evaluated is null)),
 check(quoted_at<=cut_at and cut_at<=recorded_at and recorded_at<starts_at),
 unique(source,strategy,event_id,market,book,jurisdiction,rule_id,period,side,line,band)
);
create index receipts_match on nhl_sheet_v1.receipts(event_id,market,book,period,source,recorded_at);
create table nhl_sheet_v1.grades (
 receipt_id bigint primary key references nhl_sheet_v1.receipts,
 result text not null check(result in ('win','loss','push','void','dnp')),
 evidence_id text not null check(length(evidence_id)>0), observed_at timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp()
);
create function nhl_sheet_v1.freeze_time() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 new.recorded_at:=clock_timestamp();
 if tg_table_name='grades' then
  if not exists(select 1 from nhl_sheet_v1.receipts r where r.id=new.receipt_id and
    r.starts_at<new.observed_at and new.observed_at<=new.recorded_at) then raise exception 'invalid final chronology'; end if;
 end if;
 return new;
end $$;
create function nhl_sheet_v1.immutable() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'immutable NHL ledger'; end $$;
create trigger assign_server_time before insert on nhl_sheet_v1.receipts for each row execute function nhl_sheet_v1.freeze_time();
create trigger assign_server_time before insert on nhl_sheet_v1.grades for each row execute function nhl_sheet_v1.freeze_time();
create trigger immutable before update or delete or truncate on nhl_sheet_v1.receipts for each statement execute function nhl_sheet_v1.immutable();
create trigger immutable before update or delete or truncate on nhl_sheet_v1.grades for each statement execute function nhl_sheet_v1.immutable();
alter table nhl_sheet_v1.receipts enable row level security;
alter table nhl_sheet_v1.grades enable row level security;

create view nhl_sheet_v1.outcomes with(security_invoker=true) as
select r.*,g.result,
 case g.result when 'win' then case when odds>0 then odds/100.0 else 100.0/abs(odds) end
 when 'loss' then -1 when 'push' then 0 end profit
from nhl_sheet_v1.receipts r left join nhl_sheet_v1.grades g on g.receipt_id=r.id;

-- Compare each Pick strategy separately. Multiple sides at the first eligible
-- timestamp within one strategy are ambiguous and yield no pair.
create view nhl_sheet_v1.pairs with(security_invoker=true) as
with candidates as (
 select s.id sheet_id,p.id pick_id,p.strategy pick_strategy,
 dense_rank() over(partition by s.id,p.strategy order by p.recorded_at) seq,
 count(*) over(partition by s.id,p.strategy,p.recorded_at) simultaneous
 from nhl_sheet_v1.receipts s join nhl_sheet_v1.receipts p using
 (event_id,home_id,away_id,starts_at,book,jurisdiction,rule_id,label,period,market)
 where s.source='sheet' and p.source='pick' and p.recorded_at<=s.cut_at
 and p.line=case when s.market='spread' and p.side<>s.side then -s.line else s.line end
)
select c.sheet_id,c.pick_id,c.pick_strategy,s.side sheet_side,p.side pick_side,
 s.result sheet_result,p.result pick_result,s.profit sheet_profit,p.profit pick_profit
from candidates c join nhl_sheet_v1.outcomes s on s.id=c.sheet_id
join nhl_sheet_v1.outcomes p on p.id=c.pick_id
where seq=1 and simultaneous=1 and s.result in ('win','loss') and p.result in ('win','loss');

create view nhl_sheet_v1.cohorts with(security_invoker=true) as
select o.*,r.rank_type,r.rank_n,t.grain,t.bucket from nhl_sheet_v1.outcomes o
cross join lateral (select 'position' rank_type,position rank_n union all
 select 'top',n from unnest(array[1,3,5,7,10]) n where position<=n) r
cross join lateral (select (starts_at at time zone 'America/Puerto_Rico')::date d) local_day
cross join lateral(values ('day',d),('week',date_trunc('week',d::timestamp)::date),
 ('month',date_trunc('month',d::timestamp)::date),('all',null::date)) t(grain,bucket)
where source='sheet';
create view nhl_sheet_v1.performance with(security_invoker=true) as
select strategy,market,period,band,side,evaluated,rank_type,rank_n,grain,bucket,
 grouping(market,period,band,side,evaluated) grouping_mask,count(*) contracts,count(*) filter(where result is null) pending,
 count(*) filter(where result in ('win','loss')) decided,
 avg((result='win')::int) filter(where result in ('win','loss')) accuracy,count(profit) stake_units,
 coalesce(sum(greatest(profit,0)) filter(where profit is not null),0) won_units,
 coalesce(sum(greatest(-profit,0)) filter(where profit is not null),0) lost_units,
 coalesce(sum(profit),0) net_units,avg(profit) roi
from nhl_sheet_v1.cohorts group by strategy,rank_type,rank_n,grain,bucket,cube(market,period,band,side,evaluated);
create view nhl_sheet_v1.paired_performance with(security_invoker=true) as
select strategy,p.pick_strategy,market,period,band,side,evaluated,rank_type,rank_n,grain,bucket,
 grouping(market,period,band,side,evaluated) grouping_mask,count(*) pairs,avg((sheet_result='win')::int) sheet_accuracy, avg((pick_result='win')::int) pick_accuracy,
 avg(sheet_profit) sheet_roi,avg(pick_profit) pick_roi
from nhl_sheet_v1.cohorts c join nhl_sheet_v1.pairs p on p.sheet_id=c.id
group by strategy,p.pick_strategy,rank_type,rank_n,grain,bucket,cube(market,period,band,side,evaluated);
revoke all on all tables in schema nhl_sheet_v1 from public,anon,authenticated,service_role;
revoke all on all sequences in schema nhl_sheet_v1 from public,anon,authenticated,service_role;
revoke all on all functions in schema nhl_sheet_v1 from public,anon,authenticated,service_role;
grant select on all tables in schema nhl_sheet_v1 to service_role;
-- Abort the migration transaction if the effective role graph grants extra access.
do $$
declare rel record; role_name text; privilege text; column_name text;
begin
 for rel in select c.oid,c.relkind,c.relrowsecurity,c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='nhl_sheet_v1' and c.relkind in ('r','v') loop
  if rel.relkind='r' and not rel.relrowsecurity or rel.relkind='v' and not coalesce(rel.reloptions @> array['security_invoker=true'],false) then raise exception 'invalid relation protection'; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   foreach privilege in array array['SELECT','SELECT WITH GRANT OPTION','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
    if has_table_privilege(role_name,rel.oid,privilege) <> (role_name='service_role' and privilege='SELECT') then raise exception 'unexpected effective table ACL'; end if;
   end loop;
   for column_name in select attname from pg_attribute where attrelid=rel.oid and attnum>0 and not attisdropped loop
    foreach privilege in array array['SELECT','SELECT WITH GRANT OPTION','INSERT','UPDATE','REFERENCES'] loop
     if has_column_privilege(role_name,rel.oid,column_name,privilege) <> (role_name='service_role' and privilege='SELECT') then raise exception 'unexpected effective column ACL'; end if;
    end loop;
   end loop;
  end loop;
 end loop;
end $$;
