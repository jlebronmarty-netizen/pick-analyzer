-- MLB_FANDUEL_PITCHER_K_EXACT_LINE_BOARD_V1
-- READ ONLY / RESEARCH ONLY.
-- Operationalizes the already-frozen exact-line Pitcher K rules from PR #190
-- against strictly pregame FanDuel quotes captured in sports_odds_snapshots.
-- No threshold search, no retuning, no EV calculation, no line extrapolation.
--
-- Stable / retained exact-line contracts:
-- O3.5  projection >= 4.25  CROSS_YEAR_STABLE_75_PLUS
-- U6.5  projection <= 4.50  EXISTING_CERTIFIED_CONTROL
-- U7.5  projection <= 5.50  CROSS_YEAR_STABLE_75_PLUS_BASELINE_HIGH
-- U8.5  projection <= 4.75  CROSS_YEAR_STABLE_75_PLUS_BASELINE_HIGH
--
-- Diagnostic-only exact-line contracts:
-- O4.5 projection >= 6.25  POOLED_75_PLUS_2026_STABILITY_FAIL
-- O5.5 projection >= 7.75  POOLED_75_PLUS_2026_STABILITY_FAIL
-- U5.5 projection <= 4.50  POOLED_75_PLUS_2026_STABILITY_FAIL
--
-- Same-opponent history is displayed as context only and NEVER changes selection.

with params as (
  select (now() at time zone 'America/Puerto_Rico')::date as target_date
),
rules as (
  select * from (values
    (3.5::numeric,'OVER'::text,4.25::numeric,'CROSS_YEAR_STABLE_75_PLUS'::text,true,0.7594::numeric,0.7603::numeric),
    (4.5::numeric,'OVER'::text,6.25::numeric,'POOLED_75_PLUS_2026_STABILITY_FAIL'::text,false,0.7612::numeric,0.7820::numeric),
    (5.5::numeric,'OVER'::text,7.75::numeric,'POOLED_75_PLUS_2026_STABILITY_FAIL'::text,false,0.8202::numeric,0.8295::numeric),
    (5.5::numeric,'UNDER'::text,4.50::numeric,'POOLED_75_PLUS_2026_STABILITY_FAIL'::text,false,0.7593::numeric,0.7721::numeric),
    (6.5::numeric,'UNDER'::text,4.50::numeric,'EXISTING_CERTIFIED_CONTROL'::text,true,0.869788::numeric,0.8903::numeric),
    (7.5::numeric,'UNDER'::text,5.50::numeric,'CROSS_YEAR_STABLE_75_PLUS_BASELINE_HIGH'::text,true,0.9019::numeric,0.9059::numeric),
    (8.5::numeric,'UNDER'::text,4.75::numeric,'CROSS_YEAR_STABLE_75_PLUS_BASELINE_HIGH'::text,true,0.9654::numeric,0.9656::numeric)
  ) v(exact_line,side,threshold,evidence_state,stable_contract,accuracy_2025,accuracy_2026)
),
quotes_raw as (
  select
    (s.metadata->>'canonicalGamePk')::bigint as game_pk,
    coalesce((s.metadata->>'pitcherMlbamId')::bigint,(s.metadata->>'playerMlbamId')::bigint) as pitcher_id,
    coalesce(s.metadata->>'canonicalPlayerName',s.metadata->>'pitcherName',s.metadata->>'providerPlayerName') as pitcher_name,
    s.line::numeric as exact_line,
    case
      when lower(s.outcome) in ('yes','over') then 'OVER'
      when lower(s.outcome) in ('no','under') then 'UNDER'
    end as side,
    s.price::numeric as price,
    s.snapshot_time,
    (s.metadata->>'targetStart')::timestamptz as target_start,
    s.provider,
    s.metadata->>'source' as capture_source,
    row_number() over (
      partition by
        (s.metadata->>'canonicalGamePk')::bigint,
        coalesce((s.metadata->>'pitcherMlbamId')::bigint,(s.metadata->>'playerMlbamId')::bigint),
        s.line::numeric,
        case
          when lower(s.outcome) in ('yes','over') then 'OVER'
          when lower(s.outcome) in ('no','under') then 'UNDER'
        end
      order by s.snapshot_time desc, s.price desc
    ) as rn
  from public.sports_odds_snapshots s
  cross join params p
  where lower(s.sportsbook)='fanduel'
    and s.market='pitcher_strikeouts'
    and (s.snapshot_time at time zone 'America/Puerto_Rico')::date=p.target_date
    and s.line::numeric in (3.5,4.5,5.5,6.5,7.5,8.5)
    and s.snapshot_time < (s.metadata->>'targetStart')::timestamptz
    and coalesce(s.metadata->>'pitcherMlbamId',s.metadata->>'playerMlbamId') is not null
    and s.metadata->>'source' in (
      'MLB_APPROVED_PROP_MARKET_CAPTURE_V1',
      'MLB_APPROVED_PROP_MARKET_CAPTURE_BDL_FALLBACK_V1'
    )
),
quotes as (
  select q.*
  from quotes_raw q
  join rules r on r.exact_line=q.exact_line and r.side=q.side
  where q.rn=1 and q.side is not null
),
pitchers as (
  select distinct game_pk,pitcher_id,pitcher_name,target_start from quotes
),
slate as (
  select
    g.game_pk,
    g.metadata->'mlb_official_identity'->>'away_abbreviation' as away_team,
    g.metadata->'mlb_official_identity'->>'home_abbreviation' as home_team
  from public.pick2_mlb_games g
  cross join params p
  where g.game_date=p.target_date
),
hist_2026 as (
  select
    p.game_pk,p.pitcher_id,p.pitcher_name,p.target_start,
    h.game_date,h.game_pk as hist_game_pk,h.team,h.opponent,h.strikeouts,h.batters_faced,
    row_number() over (
      partition by p.pitcher_id
      order by h.game_date desc,h.game_pk desc
    ) as rn
  from pitchers p
  join public.mlb_ml_xyear_pitcher_game_v1 h
    on h.season=2026
   and h.starter=true
   and h.pitcher=p.pitcher_id
   and h.game_date < (select target_date from params)
),
projection as (
  select
    game_pk,pitcher_id,
    max(pitcher_name) as pitcher_name,
    max(target_start) as target_start,
    count(*) as prior_starts,
    sum(strikeouts)::float8 as prior_k,
    sum(batters_faced)::float8 as prior_bf,
    avg(strikeouts::float8) filter(where rn<=5) as l5_k,
    avg(batters_faced::float8) filter(where rn<=5) as l5_bf,
    greatest(
      0,
      0.60*((sum(strikeouts)::float8/nullif(sum(batters_faced)::float8,0))
        * avg(batters_faced::float8) filter(where rn<=5))
      + 0.40*(avg(strikeouts::float8) filter(where rn<=5))
    ) as projection
  from hist_2026
  group by game_pk,pitcher_id
  having count(*)>=5
),
opponent_map as (
  select
    p.game_pk,p.pitcher_id,
    case
      when h.team=s.home_team then s.away_team
      when h.team=s.away_team then s.home_team
      else null
    end as today_opponent
  from pitchers p
  join slate s using(game_pk)
  left join lateral (
    select team
    from public.mlb_ml_xyear_pitcher_game_v1 x
    where x.pitcher=p.pitcher_id
      and x.starter=true
      and x.game_date < (select target_date from params)
    order by x.game_date desc,x.game_pk desc
    limit 1
  ) h on true
),
same_opponent as (
  select
    o.game_pk,o.pitcher_id,o.today_opponent,
    count(h.*) as same_opponent_prior_starts,
    avg(h.strikeouts::numeric) as same_opponent_avg_k,
    max(h.strikeouts) filter (
      where h.game_date=(
        select max(h2.game_date)
        from public.mlb_ml_xyear_pitcher_game_v1 h2
        where h2.pitcher=o.pitcher_id
          and h2.starter=true
          and h2.opponent=o.today_opponent
          and h2.game_date < (select target_date from params)
      )
    ) as same_opponent_last_k,
    max(h.game_date) as same_opponent_last_date
  from opponent_map o
  left join public.mlb_ml_xyear_pitcher_game_v1 h
    on h.pitcher=o.pitcher_id
   and h.starter=true
   and h.season in (2025,2026)
   and h.opponent=o.today_opponent
   and h.game_date < (select target_date from params)
  group by o.game_pk,o.pitcher_id,o.today_opponent
)
select
  (select target_date from params) as tracking_date,
  s.away_team || ' @ ' || s.home_team as matchup,
  q.game_pk,q.pitcher_id,q.pitcher_name,
  q.exact_line,q.side,q.price,q.snapshot_time,q.target_start,
  q.provider,q.capture_source,
  round(p.projection::numeric,3) as projection,
  r.threshold,
  round(abs(p.projection-q.exact_line)::numeric,3) as projection_line_gap,
  r.evidence_state,
  r.stable_contract,
  r.accuracy_2025,
  r.accuracy_2026,
  so.today_opponent,
  so.same_opponent_prior_starts,
  round(so.same_opponent_avg_k,2) as same_opponent_avg_k,
  so.same_opponent_last_k,
  so.same_opponent_last_date,
  case
    when q.side='OVER' and p.projection>=r.threshold and r.stable_contract
      then 'FANDUEL_STABLE_CANDIDATE'
    when q.side='UNDER' and p.projection<=r.threshold and r.stable_contract
      then 'FANDUEL_STABLE_CANDIDATE'
    when q.side='OVER' and p.projection>=r.threshold and not r.stable_contract
      then 'DIAGNOSTIC_QUALIFIES_STABILITY_FAIL'
    when q.side='UNDER' and p.projection<=r.threshold and not r.stable_contract
      then 'DIAGNOSTIC_QUALIFIES_STABILITY_FAIL'
    else 'NO_PLAY'
  end as state
from quotes q
join projection p using(game_pk,pitcher_id)
join rules r on r.exact_line=q.exact_line and r.side=q.side
join slate s using(game_pk)
left join same_opponent so using(game_pk,pitcher_id)
order by
  case
    when (q.side='OVER' and p.projection>=r.threshold and r.stable_contract)
      or (q.side='UNDER' and p.projection<=r.threshold and r.stable_contract) then 0
    when (q.side='OVER' and p.projection>=r.threshold)
      or (q.side='UNDER' and p.projection<=r.threshold) then 1
    else 2
  end,
  projection_line_gap desc,
  q.pitcher_name,q.exact_line,q.side;
