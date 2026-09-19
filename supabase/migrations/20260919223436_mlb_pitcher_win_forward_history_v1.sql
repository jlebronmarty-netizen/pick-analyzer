create table if not exists public.mlb_pitcher_win_forward_team_history_v1 (
  season smallint not null,
  game_pk bigint not null,
  game_date date not null,
  team text not null,
  opponent text not null,
  is_home boolean not null,
  runs_for integer not null,
  runs_against integer not null,
  win integer not null check (win in (0,1)),
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season,game_pk,team)
);

create index if not exists mlb_pitcher_win_forward_team_history_lookup_idx
  on public.mlb_pitcher_win_forward_team_history_v1(season,team,game_date,game_pk);

insert into public.mlb_pitcher_win_forward_team_history_v1
  (season,game_pk,game_date,team,opponent,is_home,runs_for,runs_against,win,source)
select
  season,game_pk,game_date,
  case when team='CHW' then 'CWS' when team='ARI' then 'AZ' else team end,
  case when opponent='CHW' then 'CWS' when opponent='ARI' then 'AZ' else opponent end,
  is_home,runs_for,runs_against,win,'XYEAR_SEED_V1'
from public.mlb_ml_xyear_team_game_v1
where season=2026
on conflict (season,game_pk,team) do nothing;

create table if not exists public.mlb_pitcher_win_forward_starter_history_v1 (
  season smallint not null,
  game_pk bigint not null,
  game_date date not null,
  starter_side text not null check (starter_side in ('home','away')),
  starter_mlbam_id bigint not null,
  y_win integer null check (y_win in (0,1)),
  starter_source text not null,
  outcome_source text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season,game_pk,starter_side)
);

create index if not exists mlb_pitcher_win_forward_starter_lookup_idx
  on public.mlb_pitcher_win_forward_starter_history_v1(season,starter_mlbam_id,game_date,game_pk);

insert into public.mlb_pitcher_win_forward_starter_history_v1
  (season,game_pk,game_date,starter_side,starter_mlbam_id,y_win,starter_source,outcome_source)
select
  season,game_pk,game_date,starter_side,starter_mlbam_id,y_win,
  'PITCHER_WIN_REVISIT_BASE_V1',
  case when y_win is null then null else 'REVISIT_LABEL' end
from public.mlb_pitcher_win_revisit_base_v1
where season=2026 and starter_mlbam_id is not null
on conflict (season,game_pk,starter_side) do nothing;

create or replace function public.sync_mlb_pitcher_win_forward_team_history_v1(p_target_date date)
returns table(inserted_rows integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_inserted integer := 0;
begin
  with games as (
    select
      p.game_year::smallint as season,
      p.game_pk,
      min(p.game_date)::date as game_date,
      case when min(p.source_home_team)='CHW' then 'CWS'
           when min(p.source_home_team)='ARI' then 'AZ'
           else min(p.source_home_team) end as home_team,
      case when min(p.source_away_team)='CHW' then 'CWS'
           when min(p.source_away_team)='ARI' then 'AZ'
           else min(p.source_away_team) end as away_team,
      max(p.post_home_score)::int as home_score,
      max(p.post_away_score)::int as away_score
    from public.pick2_raw_mlb_statcast_pitches p
    where p.game_year=2026
      and p.game_type='R'
      and p.game_date=p_target_date
    group by p.game_year,p.game_pk
  ),
  rows_to_insert as (
    select season,game_pk,game_date,home_team team,away_team opponent,true is_home,
           home_score runs_for,away_score runs_against,
           (home_score>away_score)::int win
    from games
    where home_score is not null and away_score is not null
    union all
    select season,game_pk,game_date,away_team,home_team,false,
           away_score,home_score,(away_score>home_score)::int
    from games
    where home_score is not null and away_score is not null
  ),
  ins as (
    insert into public.mlb_pitcher_win_forward_team_history_v1
      (season,game_pk,game_date,team,opponent,is_home,runs_for,runs_against,win,source,updated_at)
    select season,game_pk,game_date,team,opponent,is_home,runs_for,runs_against,win,
           'RAW_STATCAST_DAILY_SYNC_V1',now()
    from rows_to_insert
    on conflict (season,game_pk,team) do update
      set runs_for=excluded.runs_for,
          runs_against=excluded.runs_against,
          win=excluded.win,
          opponent=excluded.opponent,
          is_home=excluded.is_home,
          source=excluded.source,
          updated_at=now()
    returning 1
  )
  select count(*) into v_inserted from ins;

  return query select v_inserted;
end;
$$;

alter table public.mlb_pitcher_win_forward_team_history_v1 enable row level security;
alter table public.mlb_pitcher_win_forward_starter_history_v1 enable row level security;
revoke all on table public.mlb_pitcher_win_forward_team_history_v1 from anon,authenticated;
revoke all on table public.mlb_pitcher_win_forward_starter_history_v1 from anon,authenticated;
grant select on table public.mlb_pitcher_win_forward_team_history_v1 to service_role;
grant select,insert,update on table public.mlb_pitcher_win_forward_starter_history_v1 to service_role;
grant execute on function public.sync_mlb_pitcher_win_forward_team_history_v1(date) to service_role;

comment on table public.mlb_pitcher_win_forward_team_history_v1 is
'Research-only compact 2026 team-game history for frozen Pitcher Record a Win forward scoring. Seeded from xyear and incrementally synced from final raw Statcast only.';

comment on table public.mlb_pitcher_win_forward_starter_history_v1 is
'Research-only pregame starter ledger for frozen Pitcher Record a Win forward scoring. Outcomes are filled only after final games from MLB official decisions.';
