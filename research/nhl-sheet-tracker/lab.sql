-- Disposable PostgreSQL only. No connection from the NHL application.
create schema nhl_sheet_lab;
create table nhl_sheet_lab.entries (
 id bigint generated always as identity primary key,
 event_id text not null, subject text not null, method text not null, market text not null,
 period text not null, side text not null, line numeric not null, book text not null, rule_id text not null,
 band int not null, odds int not null, position int not null check(position between 1 and 10),
 quoted_at timestamptz not null, recorded_at timestamptz not null default clock_timestamp(),
 starts_at timestamptz not null, check(quoted_at<=recorded_at and recorded_at<starts_at),
 check(abs(odds)>=100 and ((band=-250 and odds>=-250) or (band=-650 and odds between -650 and -251))),
 unique(method,band,event_id,subject,market,period,side,line,book,rule_id)
);
create table nhl_sheet_lab.grades (
 entry_id bigint primary key references nhl_sheet_lab.entries,
 result text not null check(result in ('win','loss','push','void','dnp')),
 evidence_id text not null check(length(evidence_id)>0)
);
alter table nhl_sheet_lab.entries enable row level security;
alter table nhl_sheet_lab.grades enable row level security;
create function nhl_sheet_lab.immutable() returns trigger language plpgsql as $$
begin raise exception 'immutable'; end $$;
create trigger immutable before update or delete or truncate on nhl_sheet_lab.entries
 for each statement execute function nhl_sheet_lab.immutable();
create trigger immutable before update or delete or truncate on nhl_sheet_lab.grades
 for each statement execute function nhl_sheet_lab.immutable();
revoke all on schema nhl_sheet_lab from public,anon,authenticated,service_role;
grant usage on schema nhl_sheet_lab to service_role;
revoke all on all tables in schema nhl_sheet_lab from public,anon,authenticated,service_role;
grant select on all tables in schema nhl_sheet_lab to service_role;

-- A paired Pick forecast must independently identify the same archived contract
-- and have been frozen prospectively. Both sources use its verified outcome.
create table nhl_sheet_lab.pick_receipts (
 event_id text not null, subject text not null, market text not null, period text not null,
 side text not null,line numeric not null,book text not null,rule_id text not null,
 odds int not null check(abs(odds)>=100),recorded_at timestamptz not null default clock_timestamp(),
 starts_at timestamptz not null, check(recorded_at<starts_at),
 primary key(event_id,subject,market,period,side,line,book,rule_id,starts_at)
);
alter table nhl_sheet_lab.pick_receipts enable row level security;
create trigger immutable before update or delete or truncate on nhl_sheet_lab.pick_receipts
 for each statement execute function nhl_sheet_lab.immutable();
revoke all on nhl_sheet_lab.pick_receipts from public,anon,authenticated,service_role;
grant select on nhl_sheet_lab.pick_receipts to service_role;
create view nhl_sheet_lab.performance with(security_invoker=true) as
with settled as (
 select e.*,g.result,p.odds pick_odds,
 case g.result when 'win' then case when e.odds>0 then e.odds/100.0 else 100.0/abs(e.odds) end
 when 'loss' then -1 when 'push' then 0 end profit
 from nhl_sheet_lab.entries e left join nhl_sheet_lab.grades g on e.id=g.entry_id
 left join nhl_sheet_lab.pick_receipts p using(event_id,subject,market,period,side,line,book,rule_id,starts_at)
)
select method,market,period,band,side,rank_type,rank_n,count(*) contracts,
 count(*) filter(where result is null) pending,count(profit) stake_units,
 avg((result='win')::int) filter(where result in ('win','loss')) accuracy,
 sum(greatest(profit,0)) filter(where profit is not null) won_units,
 sum(greatest(-profit,0)) filter(where profit is not null) lost_units,sum(profit) net_units,avg(profit) roi,
 count(pick_odds) filter(where result in ('win','loss')) equivalent_decisions,
 avg(case when result='win' then case when pick_odds>0 then pick_odds/100.0 else 100.0/abs(pick_odds) end
 when result='loss' then -1 end) filter(where pick_odds is not null and result in ('win','loss')) paired_pick_roi,
 avg(profit) filter(where pick_odds is not null and result in ('win','loss')) paired_sheet_roi
from settled cross join lateral (select 'position' rank_type,position rank_n union all
 select 'top',n from unnest(array[1,3,5,7,10]) n where position<=n) r
group by method,market,period,band,side,rank_type,rank_n;
revoke all on nhl_sheet_lab.performance from public,anon,authenticated,service_role;
grant select on nhl_sheet_lab.performance to service_role;
create function nhl_sheet_lab.server_clock() returns trigger language plpgsql as $$
begin new.recorded_at := clock_timestamp(); return new; end $$;
create trigger server_clock before insert on nhl_sheet_lab.entries for each row execute function nhl_sheet_lab.server_clock();
create trigger server_clock before insert on nhl_sheet_lab.pick_receipts for each row execute function nhl_sheet_lab.server_clock();
create function nhl_sheet_lab.grade_time() returns trigger language plpgsql as $$
begin
 if not exists(select 1 from nhl_sheet_lab.entries where id=new.entry_id and starts_at<clock_timestamp()) then
  raise exception 'event has not started';
 end if;
 return new;
end $$;
create trigger grade_time before insert on nhl_sheet_lab.grades for each row execute function nhl_sheet_lab.grade_time();
