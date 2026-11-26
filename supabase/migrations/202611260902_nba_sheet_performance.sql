-- Apply after the two reviewed NBA sheet migrations, before enabling the cron writer.
create table public.nba_sheet_entries_v1 (
 snapshot_id text not null references public.nba_cheat_snapshots_v1,
 quote_id text not null, day_local date not null, recorded_at timestamptz not null,
 methodology text not null, scope text not null, band integer not null check (band in (-250,-650)),
 position integer not null check(position between 1 and 10),
 game_id bigint not null, player_id bigint not null, market text not null, period text not null,
 side text not null check(side in ('over','under')), line numeric not null, book text not null, ot text not null,
 odds integer not null check(abs(odds)>=100), starts_at timestamptz not null, card jsonb not null,
 primary key(snapshot_id, quote_id),
 unique(methodology,scope,band,game_id,player_id,market,period,side,line,book),
 check(recorded_at<starts_at),
 check((band=-250 and odds>=-250) or (band=-650 and odds between -650 and -251))
);
alter table public.nba_sheet_entries_v1 enable row level security;
revoke all on public.nba_sheet_entries_v1 from public,anon,authenticated,service_role;
grant select on public.nba_sheet_entries_v1 to service_role;

create function public.nba_sheet_enroll_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.payload->>'version' is distinct from 'NBA_SHEET_LAB_V1' then return new; end if;
 if jsonb_array_length(new.payload->'cards')>10 then raise exception 'rank outside top ten'; end if;
 insert into public.nba_sheet_entries_v1
 select new.snapshot_id,c->>'quoteId',new.day_local,new.captured_at,new.payload->>'method',
 new.payload->>'scope',(new.payload->>'band')::int,pos,(c->>'gameId')::bigint,(c->>'playerId')::bigint,
 c->>'statistic',c->>'period',c->>'side',(c->>'line')::numeric,c->>'book',c->>'ot',
 (c->>'odds')::int,(c->>'start')::timestamptz,c
 from jsonb_array_elements(new.payload->'cards') with ordinality as cards(c,pos)
 order by pos on conflict do nothing;
 return new;
end $$;
revoke all on function public.nba_sheet_enroll_v1() from public,anon,authenticated,service_role;
create trigger nba_sheet_enroll after insert on public.nba_cheat_snapshots_v1
for each row execute function public.nba_sheet_enroll_v1();

create view public.nba_sheet_pending_v1 with(security_invoker=true) as
 select e.* from public.nba_sheet_entries_v1 e left join public.nba_sheet_grades_v1 g using(snapshot_id,quote_id)
 where g.snapshot_id is null and e.starts_at<statement_timestamp();
create view public.nba_sheet_pending_games_v1 with(security_invoker=true) as
 select game_id,day_local from public.nba_sheet_pending_v1 group by game_id,day_local;

create view public.nba_sheet_performance_v1 with(security_invoker=true) as
with graded as (
 select e.*,g.result,g.pick_result,(card->'original'->>'odds')::numeric pick_odds
 from public.nba_sheet_entries_v1 e left join public.nba_sheet_grades_v1 g using(snapshot_id,quote_id)
), unit_returns as (
 select *, case when result='win' then case when odds>0 then odds/100.0 else 100.0/abs(odds) end
                when result='loss' then -1 when result='push' then 0 end profit,
 result in ('win','loss') and pick_result in ('win','loss') as paired,
 case when pick_result='win' and abs(pick_odds)>=100 then case when pick_odds>0 then pick_odds/100.0 else 100.0/abs(pick_odds) end
      when pick_result='loss' and abs(pick_odds)>=100 then -1 end pick_profit
 from graded
), cohorts as (
 select u.*,r.rank_type,r.rank_n,t.grain,t.bucket
 from unit_returns u
 cross join lateral (select 'position' rank_type,position rank_n union all
                     select 'top',n from unnest(array[1,3,5,7,10]) n where position<=n) r
 cross join lateral (values ('day',day_local),('week',date_trunc('week',day_local::timestamp)::date),
 ('month',date_trunc('month',day_local::timestamp)::date),('all',null::date)) t(grain,bucket)
)
select methodology,scope,band,rank_type,rank_n,grain,bucket,market,period,side,
 count(*) contracts,count(*) filter(where result is null) pending,
 count(*) filter(where result='win') wins,count(*) filter(where result='loss') losses,
 count(*) filter(where result='push') pushes,count(*) filter(where result='dnp') dnp,count(*) filter(where result='void') voids,
 count(*) filter(where result in ('win','loss')) decided,avg((result='win')::int) filter(where result in ('win','loss')) accuracy,
 count(profit) stake_units,sum(greatest(profit,0)) filter(where profit is not null) won_units,
 sum(greatest(-profit,0)) filter(where profit is not null) lost_units,sum(profit) net_units,avg(profit) roi,
 count(*) filter(where paired) pairs,avg((result='win')::int) filter(where paired) paired_sheet_accuracy,
 avg((pick_result='win')::int) filter(where paired) paired_pick_accuracy,
 count(pick_profit) filter(where paired) priced_pairs,
 avg(profit) filter(where paired and pick_profit is not null) paired_sheet_roi,avg(pick_profit) filter(where paired) paired_pick_roi
from cohorts
group by methodology,scope,band,rank_type,rank_n,grain,bucket,cube(market,period,side);
revoke all on public.nba_sheet_performance_v1,public.nba_sheet_pending_v1,public.nba_sheet_pending_games_v1 from public,anon,authenticated;
grant select on public.nba_sheet_performance_v1,public.nba_sheet_pending_v1,public.nba_sheet_pending_games_v1 to service_role;
