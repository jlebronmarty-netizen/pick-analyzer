create table public.mlb_pitcher_win_revisit_base_v1 as
with retro_starters as (
  select
    gm.game_pk,
    g.game_date,
    p.team_side as starter_side,
    p.pitcher_source_id::text as starter_identity,
    null::bigint as starter_mlbam_id,
    p.pitcher_name,
    case when p.decision='win' then 1 else 0 end::integer as y_win,
    'RETROSHEET_EXACT_DECISION'::text as outcome_lineage,
    (to_jsonb(f) - 'actual_winner') as payload
  from public.historical_baseball_pitcher_appearances p
  join public.historical_baseball_games g
    on g.canonical_game_id=p.canonical_game_id
  join public.mlb_ml_game_map_2025_v3 gm
    on gm.canonical_game_id=g.canonical_game_id
  join public.mlb_ml_xyear_features_v1 f
    on f.season=2025 and f.game_pk=gm.game_pk
  where p.starter=true
    and g.season='2025'
    and f.feature_cutoff_date < f.game_date
),
mlbam_starters as (
  select
    f.game_pk,
    f.game_date,
    'home'::text as starter_side,
    f.home_sp_mlbam_id::text as starter_identity,
    f.home_sp_mlbam_id::bigint as starter_mlbam_id,
    null::text as pitcher_name,
    null::integer as y_win,
    'MLB_LIVE_FEED_DECISION_PENDING'::text as outcome_lineage,
    (to_jsonb(f) - 'actual_winner') as payload
  from public.mlb_ml_xyear_features_v1 f
  where f.season=2026
    and f.game_date <= date '2026-09-18'
    and f.feature_cutoff_date < f.game_date
    and f.home_sp_mlbam_id is not null

  union all

  select
    f.game_pk,
    f.game_date,
    'away'::text as starter_side,
    f.away_sp_mlbam_id::text as starter_identity,
    f.away_sp_mlbam_id::bigint as starter_mlbam_id,
    null::text as pitcher_name,
    null::integer as y_win,
    'MLB_LIVE_FEED_DECISION_PENDING'::text as outcome_lineage,
    (to_jsonb(f) - 'actual_winner') as payload
  from public.mlb_ml_xyear_features_v1 f
  where f.season=2026
    and f.game_date <= date '2026-09-18'
    and f.feature_cutoff_date < f.game_date
    and f.away_sp_mlbam_id is not null
)
select
  2025::smallint as season,
  game_pk,game_date,starter_side,starter_identity,starter_mlbam_id,pitcher_name,
  y_win,outcome_lineage,payload,
  'HISTORICAL_SEEN_DEVELOPMENT'::text as development_class,
  true::boolean as research_only
from retro_starters

union all

select
  2026::smallint as season,
  game_pk,game_date,starter_side,starter_identity,starter_mlbam_id,pitcher_name,
  y_win,outcome_lineage,payload,
  'HISTORICAL_SEEN_DEVELOPMENT'::text as development_class,
  true::boolean as research_only
from mlbam_starters;

alter table public.mlb_pitcher_win_revisit_base_v1
  add primary key (season,game_pk,starter_side),
  add constraint mlb_pitcher_win_revisit_side_ck check (starter_side in ('home','away')),
  add constraint mlb_pitcher_win_revisit_cutoff_ck check (game_date <= date '2026-09-18'),
  add constraint mlb_pitcher_win_revisit_class_ck check (development_class='HISTORICAL_SEEN_DEVELOPMENT'),
  add constraint mlb_pitcher_win_revisit_research_ck check (research_only=true),
  add constraint mlb_pitcher_win_revisit_no_actual_winner_ck check (not (payload ? 'actual_winner')),
  add constraint mlb_pitcher_win_revisit_2025_label_ck check (season <> 2025 or y_win in (0,1)),
  add constraint mlb_pitcher_win_revisit_2026_identity_ck check (season <> 2026 or starter_mlbam_id is not null);

create index mlb_pitcher_win_revisit_base_game_date_idx
  on public.mlb_pitcher_win_revisit_base_v1(game_date);

create index mlb_pitcher_win_revisit_base_starter_idx
  on public.mlb_pitcher_win_revisit_base_v1(season,starter_identity,game_date);

alter table public.mlb_pitcher_win_revisit_base_v1 enable row level security;
revoke all on table public.mlb_pitcher_win_revisit_base_v1 from anon,authenticated;
grant select on table public.mlb_pitcher_win_revisit_base_v1 to service_role;

comment on table public.mlb_pitcher_win_revisit_base_v1 is
'Research-only second-pass Pitcher Record a Win surface. 2025 labels are exact Retrosheet pitcher decisions; 2026 starter MLBAM identities await official MLB live-feed decisions. Payload excludes actual_winner and requires strict-prior feature cutoff.';

comment on column public.mlb_pitcher_win_revisit_base_v1.y_win is
'Postgame outcome label only. 2025 exact from Retrosheet; 2026 intentionally null until official MLB decisions are joined outside the pregame payload.';
