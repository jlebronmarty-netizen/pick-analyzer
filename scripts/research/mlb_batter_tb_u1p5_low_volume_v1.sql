-- MLB_BATTER_TOTAL_BASES_U1P5_LOW_VOLUME_V1
-- READ ONLY.
-- New architecture; does not retune the frozen projection<=1.20 failure.
-- Strict target-date exclusion prevents Game 1 of a doubleheader from entering Game 2.

-- 1) DEVELOPMENT SEARCH: 2025 ONLY.
with base as (
  select game_pk,game_date,batter,total_bases,plate_appearances
  from public.mlb_statcast_batter_total_bases_game_mv
  where season=2025 and plate_appearances>0
),
daily as (
  select batter,game_date,count(*) games_on_date,sum(plate_appearances)::float8 pa
  from base group by batter,game_date
),
f as (
  select d.*,
    sum(games_on_date) over w prior_games,
    sum(pa) over w prior_pa
  from daily d
  window w as (
    partition by batter order by game_date
    rows between unbounded preceding and 1 preceding
  )
),
rows as (
  select b.*,f.prior_pa/nullif(f.prior_games,0) prior_pa_per_game,
         to_char(b.game_date,'YYYY-MM') mon
  from base b join f using(batter,game_date)
  where b.game_date>=date '2025-05-01'
    and f.prior_games>=10 and f.prior_pa>0
),
baseline as (
  select avg((total_bases<1.5)::int::float8) acc from rows
),
cuts as (
  select generate_series(2.50,4.50,0.05)::numeric pa_cut
),
cand as (
  select c.pa_cut,count(*) n,
         count(*) filter(where r.total_bases<1.5) wins,
         avg((r.total_bases<1.5)::int::float8) acc
  from cuts c join rows r on r.prior_pa_per_game<=c.pa_cut
  group by c.pa_cut
),
monthly as (
  select c.pa_cut,r.mon,count(*) n,
         avg((r.total_bases<1.5)::int::float8) acc
  from cuts c join rows r on r.prior_pa_per_game<=c.pa_cut
  group by c.pa_cut,r.mon
),
m as (
  select pa_cut,count(*) months,min(acc) worst_month
  from monthly group by pa_cut
)
select c.pa_cut,c.n,c.wins,c.acc,
       c.acc-b.acc lift,m.months,m.worst_month
from cand c cross join baseline b join m using(pa_cut)
where c.n>=60 and c.acc>=0.75 and c.acc-b.acc>=0.05
  and m.months>=5 and m.worst_month>=0.65
order by c.n desc,c.acc desc,c.pa_cut asc;

-- Frozen champion before external read: prior_pa_per_game <= 3.50.

-- 2) EXTERNAL 2026: fixed rule only.
with base as (
  select game_pk,game_date,batter,total_bases,plate_appearances
  from public.mlb_statcast_batter_total_bases_game_mv
  where season=2026 and plate_appearances>0
),
daily as (
  select batter,game_date,count(*) games_on_date,sum(plate_appearances)::float8 pa
  from base group by batter,game_date
),
f as (
  select d.*,
    sum(games_on_date) over w prior_games,
    sum(pa) over w prior_pa
  from daily d
  window w as (
    partition by batter order by game_date
    rows between unbounded preceding and 1 preceding
  )
),
rows as (
  select b.*,f.prior_pa/nullif(f.prior_games,0) prior_pa_per_game,
         to_char(b.game_date,'YYYY-MM') mon
  from base b join f using(batter,game_date)
  where b.game_date>=date '2026-05-01'
    and f.prior_games>=10 and f.prior_pa>0
)
select count(*) n,
       count(*) filter(where total_bases<1.5) wins,
       avg((total_bases<1.5)::int::float8) accuracy
from rows
where prior_pa_per_game<=3.50;

-- 3) CURRENT FORWARD READBACK: exact U1.5 UNDER only.
with quotes as (
  select distinct
    (metadata->>'canonicalGamePk')::bigint game_pk,
    (metadata->>'playerMlbamId')::bigint player_id,
    coalesce(metadata->>'canonicalPlayerName',metadata->>'providerPlayerName') player_name,
    sportsbook,price::numeric price,snapshot_time,
    (metadata->>'targetStart')::timestamptz target_start
  from public.sports_odds_snapshots
  where (snapshot_time at time zone 'America/Puerto_Rico')::date=current_date
    and provider in ('the-odds-api','balldontlie')
    and metadata->>'source' in ('MLB_APPROVED_PROP_MARKET_CAPTURE_V1','MLB_APPROVED_PROP_MARKET_CAPTURE_BDL_FALLBACK_V1')
    and market='batter_total_bases'
    and line::numeric=1.5
    and lower(outcome)='under'
    and metadata->>'playerMlbamId' is not null
    and snapshot_time < (metadata->>'targetStart')::timestamptz
),
hist_daily as (
  select batter,game_date,count(*) games_on_date,sum(plate_appearances)::float8 pa
  from public.mlb_statcast_batter_total_bases_game_mv
  where season=2026 and game_date<current_date and plate_appearances>0
  group by batter,game_date
),
hist as (
  select batter,sum(games_on_date) prior_games,sum(pa) prior_pa,max(game_date) latest_prior_date
  from hist_daily group by batter
)
select q.*,h.prior_games,h.latest_prior_date,
       h.prior_pa/nullif(h.prior_games,0) prior_pa_per_game
from quotes q
join hist h on h.batter=q.player_id
where h.prior_games>=10
  and h.prior_pa/nullif(h.prior_games,0)<=3.50
order by q.game_pk,q.player_name,q.price desc;
