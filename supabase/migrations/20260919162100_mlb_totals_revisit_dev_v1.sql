-- MLB Totals second-pass revisit development surface.
-- Research-only. No provider calls, no historical Odds API credit spend,
-- no Official Picks writes, no APOSTAR activation, no production promotion.
-- Governed by MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0.

create table public.mlb_totals_revisit_market_2026_v1 as
with stored_toa_extension as (
  select distinct on (m.game_pk)
    m.game_pk,
    g.game_date,
    g.home_team,
    g.away_team,
    q.line::numeric as close_total,
    q.over_price::numeric as close_over_price,
    q.under_price::numeric as close_under_price,
    q.latest_snapshot_at as close_snapshot_at,
    extract(epoch from (m.start_time - q.latest_snapshot_at))::integer as seconds_before_start,
    'the-odds-api'::text as provider,
    'CrossBookConsensus'::text as sportsbook,
    'stored_last_paired_per_book_mode_line_median_price_v1'::text as snapshot_policy,
    q.book_count::integer as source_book_count,
    'STORED_THE_ODDS_API_CROSSBOOK_CONSENSUS_V1'::text as market_lineage,
    true::boolean as research_only
  from public.mlb_ml_sdi_event_game_map_2026_v1 m
  join public.mlb_ml_xyear_game_v1 g
    on g.season=2026 and g.game_pk=m.game_pk
  cross join lateral (
    with paired as (
      select
        s.sportsbook,
        s.snapshot_time,
        s.line::numeric as line,
        max(s.price::numeric) filter (where lower(s.outcome)='over') as over_price,
        max(s.price::numeric) filter (where lower(s.outcome)='under') as under_price
      from public.sports_odds_snapshots s
      where s.sport_key='baseball_mlb'
        and s.event_id=m.event_id
        and s.market='total'
        and s.provider='the-odds-api'
        and s.snapshot_time < m.start_time
        and abs(s.price) >= 100
      group by s.sportsbook,s.snapshot_time,s.line
      having count(*) filter (where lower(s.outcome)='over') > 0
         and count(*) filter (where lower(s.outcome)='under') > 0
    ),
    latest as (
      select distinct on (sportsbook)
        sportsbook,snapshot_time,line,over_price,under_price
      from paired
      order by sportsbook,snapshot_time desc,line
    ),
    med as (
      select percentile_cont(0.5) within group (order by line) as median_line
      from latest
    ),
    ranked_lines as (
      select
        l.line,
        count(*) as book_count,
        abs(l.line-(select median_line from med)) as median_distance
      from latest l
      group by l.line
      order by book_count desc, median_distance asc, l.line asc
      limit 1
    )
    select
      r.line,
      r.book_count,
      percentile_cont(0.5) within group (order by l.over_price)
        filter (where l.line=r.line) as over_price,
      percentile_cont(0.5) within group (order by l.under_price)
        filter (where l.line=r.line) as under_price,
      max(l.snapshot_time) filter (where l.line=r.line) as latest_snapshot_at
    from ranked_lines r
    cross join latest l
    group by r.line,r.book_count
  ) q
  where g.game_date between date '2026-08-14' and date '2026-09-18'
  order by m.game_pk,q.latest_snapshot_at desc
)
select
  m.game_pk,
  m.game_date,
  m.home_team,
  m.away_team,
  m.close_total,
  m.close_over_price,
  m.close_under_price,
  m.close_snapshot_at,
  m.seconds_before_start,
  m.provider,
  m.sportsbook,
  m.snapshot_policy,
  null::integer as source_book_count,
  'SPORTSDATAIO_CONSENSUS_LEGACY_V37'::text as market_lineage,
  true::boolean as research_only
from public.mlb_totals_market_2026_v1 m
union all
select *
from stored_toa_extension;

alter table public.mlb_totals_revisit_market_2026_v1
  add primary key (game_pk),
  add constraint mlb_totals_revisit_market_2026_cutoff_ck
    check (game_date <= date '2026-09-18'),
  add constraint mlb_totals_revisit_market_2026_research_ck
    check (research_only = true);

create index mlb_totals_revisit_market_2026_date_idx
  on public.mlb_totals_revisit_market_2026_v1(game_date);

comment on table public.mlb_totals_revisit_market_2026_v1 is
'Research-only Totals revisit market layer. Preserves legacy V37 SportsDataIO Consensus rows through 2026-08-13 and extends only from already-stored The Odds API pregame snapshots using deterministic cross-book consensus. No provider calls or historical credits.';

create table public.mlb_totals_revisit_dev_rows_v1 as
select
  2025::smallint as season,
  f.game_pk,
  f.game_date,
  (
    (to_jsonb(f) - 'actual_winner')
    || jsonb_build_object(
      'team_strength',c.team_strength,
      'recent_form',c.recent_form,
      'offense',c.offense,
      'starter',c.starter,
      'bullpen',c.bullpen,
      'lineup_matchup',c.lineup_matchup,
      'home_away',c.home_away,
      'history',c.history,
      'fatigue_travel',c.fatigue_travel,
      'defense_context',c.defense_context,
      'close_total',m.close_total,
      'close_over_price',m.close_over_price,
      'close_under_price',m.close_under_price
    )
  ) as payload,
  t.total_runs::double precision as y_total_runs,
  (t.total_runs::double precision-m.close_total::double precision) as y_close_margin,
  case
    when t.total_runs::double precision > m.close_total::double precision then 1
    when t.total_runs::double precision < m.close_total::double precision then 0
    else null
  end::integer as close_over_label,
  'SBR_2025_CLOSE_CONSENSUS'::text as market_lineage,
  'HISTORICAL_SEEN_DEVELOPMENT'::text as development_class,
  true::boolean as research_only
from public.mlb_ml_xyear_features_v1 f
join public.mlb_ml_xyear_game_components_z_v1 c
  on c.season=2025 and c.branch='PREGAME' and c.game_pk=f.game_pk
join public.mlb_totals_market_2025_v1 m
  on m.game_pk=f.game_pk
join public.mlb_totals_targets_v1 t
  on t.season=2025 and t.game_pk=f.game_pk
where f.season=2025
  and f.feature_cutoff_date < f.game_date

union all

select
  2026::smallint as season,
  f.game_pk,
  f.game_date,
  (
    (to_jsonb(f) - 'actual_winner')
    || jsonb_build_object(
      'team_strength',c.team_strength,
      'recent_form',c.recent_form,
      'offense',c.offense,
      'starter',c.starter,
      'bullpen',c.bullpen,
      'lineup_matchup',c.lineup_matchup,
      'home_away',c.home_away,
      'history',c.history,
      'fatigue_travel',c.fatigue_travel,
      'defense_context',c.defense_context,
      'close_total',m.close_total,
      'close_over_price',m.close_over_price,
      'close_under_price',m.close_under_price
    )
  ) as payload,
  (g.home_score+g.away_score)::double precision as y_total_runs,
  ((g.home_score+g.away_score)::double precision-m.close_total::double precision) as y_close_margin,
  case
    when (g.home_score+g.away_score)::double precision > m.close_total::double precision then 1
    when (g.home_score+g.away_score)::double precision < m.close_total::double precision then 0
    else null
  end::integer as close_over_label,
  m.market_lineage,
  'HISTORICAL_SEEN_DEVELOPMENT'::text as development_class,
  true::boolean as research_only
from public.mlb_ml_xyear_features_v1 f
join public.mlb_ml_xyear_game_components_z_v1 c
  on c.season=2026 and c.branch='PREGAME' and c.game_pk=f.game_pk
join public.mlb_totals_revisit_market_2026_v1 m
  on m.game_pk=f.game_pk
join public.mlb_ml_xyear_game_v1 g
  on g.season=2026 and g.game_pk=f.game_pk
where f.season=2026
  and f.feature_cutoff_date < f.game_date
  and f.game_date <= date '2026-09-18';

alter table public.mlb_totals_revisit_dev_rows_v1
  add primary key (season,game_pk),
  add constraint mlb_totals_revisit_dev_cutoff_ck
    check (game_date <= date '2026-09-18'),
  add constraint mlb_totals_revisit_dev_class_ck
    check (development_class='HISTORICAL_SEEN_DEVELOPMENT'),
  add constraint mlb_totals_revisit_dev_research_ck
    check (research_only=true),
  add constraint mlb_totals_revisit_no_actual_winner_ck
    check (not (payload ? 'actual_winner'));

create index mlb_totals_revisit_dev_date_idx
  on public.mlb_totals_revisit_dev_rows_v1(game_date);

alter table public.mlb_totals_revisit_market_2026_v1 enable row level security;
alter table public.mlb_totals_revisit_dev_rows_v1 enable row level security;

revoke all on table public.mlb_totals_revisit_market_2026_v1 from anon,authenticated;
revoke all on table public.mlb_totals_revisit_dev_rows_v1 from anon,authenticated;
grant select on table public.mlb_totals_revisit_dev_rows_v1 to service_role;

comment on table public.mlb_totals_revisit_dev_rows_v1 is
'Research-only historical-seen development surface for Totals second pass. Payload excludes actual_winner; all feature rows require feature_cutoff_date < game_date; 2026 is capped by the frozen 2026-09-18 historical boundary.';

comment on column public.mlb_totals_revisit_dev_rows_v1.close_over_label is
'Postgame label only. Never include in the pregame payload or production inference.';
