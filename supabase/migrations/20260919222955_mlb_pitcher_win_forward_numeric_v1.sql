create or replace view public.mlb_pitcher_win_forward_team_game_v1 as
with recent_game as (
  select
    p.game_year::integer as season,
    p.game_pk::bigint as game_pk,
    min(p.game_date)::date as game_date,
    min(p.source_home_team)::text as home_team,
    min(p.source_away_team)::text as away_team,
    max(p.post_home_score) filter (where p.post_home_score is not null)::integer as home_score,
    max(p.post_away_score) filter (where p.post_away_score is not null)::integer as away_score
  from public.pick2_raw_mlb_statcast_pitches p
  where p.game_year=2026
    and p.game_type='R'
    and p.game_date>=date '2026-09-18'
  group by p.game_year,p.game_pk
),
recent_team as (
  select season,game_pk,game_date,home_team as team,away_team as opponent,true as is_home,
         home_score as runs_for,away_score as runs_against,
         case when home_score is null or away_score is null then null
              when home_score>away_score then 1 else 0 end::integer as win,
         'RAW_STATCAST_FORWARD'::text as source_lineage
  from recent_game
  union all
  select season,game_pk,game_date,away_team as team,home_team as opponent,false as is_home,
         away_score as runs_for,home_score as runs_against,
         case when home_score is null or away_score is null then null
              when away_score>home_score then 1 else 0 end::integer as win,
         'RAW_STATCAST_FORWARD'::text as source_lineage
  from recent_game
)
select season,game_pk,game_date,team,opponent,is_home,runs_for,runs_against,win,
       'XYEAR_CERTIFIED_THROUGH_2026_09_17'::text as source_lineage
from public.mlb_ml_xyear_team_game_v1
where season=2026 and game_date<=date '2026-09-17'
union all
select season,game_pk,game_date,team,opponent,is_home,runs_for,runs_against,win,source_lineage
from recent_team;

comment on view public.mlb_pitcher_win_forward_team_game_v1 is
'Research-only team-game history for Pitcher Win prospective scoring. Certified xyear through 2026-09-17 plus dynamic raw Statcast results from 2026-09-18 onward. Runtime must use only game_date strictly before target date and must fail closed if prior-day history is not ready.';

create table public.mlb_pitcher_win_forward_tracker_v1 (
  id uuid primary key default gen_random_uuid(),
  tracking_date date not null,
  game_pk bigint not null,
  start_time timestamptz not null,
  home_team text not null,
  away_team text not null,
  starter_mlbam_id bigint not null,
  pitcher_name text not null,
  starter_side text not null check (starter_side in ('home','away')),
  team text not null,
  opponent text not null,
  model_version text not null,
  model_contract text not null,
  feature_contract text not null,
  threshold double precision not null,
  p_win double precision not null check (p_win>=0 and p_win<=1),
  selected_no boolean not null,
  feature_snapshot jsonb not null,
  model_files jsonb not null,
  frozen_at timestamptz not null,
  outcome_status text not null default 'OPEN'
    check (outcome_status in ('OPEN','SETTLED')),
  starter_recorded_win boolean,
  selection_result text
    check (selection_result is null or selection_result in ('WIN','LOSS','NOT_SELECTED')),
  decision_winner_mlbam_id bigint,
  graded_at timestamptz,
  research_only boolean not null default true check (research_only=true),
  production_eligible boolean not null default false check (production_eligible=false),
  official_picks_eligible boolean not null default false check (official_picks_eligible=false),
  apostar_enabled boolean not null default false check (apostar_enabled=false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mlb_pitcher_win_forward_date_ck check (tracking_date>=date '2026-09-20'),
  constraint mlb_pitcher_win_forward_unique unique (tracking_date,game_pk,starter_mlbam_id,model_version)
);

create index mlb_pitcher_win_forward_tracker_date_idx
  on public.mlb_pitcher_win_forward_tracker_v1(tracking_date,start_time);

create index mlb_pitcher_win_forward_tracker_open_idx
  on public.mlb_pitcher_win_forward_tracker_v1(tracking_date,outcome_status)
  where outcome_status='OPEN';

alter table public.mlb_pitcher_win_forward_tracker_v1 enable row level security;
revoke all on table public.mlb_pitcher_win_forward_tracker_v1 from anon,authenticated;
grant select,insert,update on table public.mlb_pitcher_win_forward_tracker_v1 to service_role;

comment on table public.mlb_pitcher_win_forward_tracker_v1 is
'Research-only prospective ledger for frozen Pitcher Record a Win NO selections. No Official Picks, APOSTAR, or production eligibility. Features and model threshold are frozen before first pitch; outcomes are written only after final decisions.';
