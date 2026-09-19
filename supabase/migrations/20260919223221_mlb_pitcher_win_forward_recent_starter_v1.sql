create or replace view public.mlb_pitcher_win_forward_recent_starter_v1 as
with ordered as (
  select
    p.game_year::integer as season,
    p.game_pk::bigint as game_pk,
    p.game_date::date as game_date,
    case when p.inning_topbot='Top' then p.source_home_team else p.source_away_team end::text as team,
    case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end::text as opponent,
    coalesce(p.mlbam_pitcher_id,p.source_pitcher_id)::bigint as pitcher_mlbam_id,
    row_number() over (
      partition by p.game_pk,
        case when p.inning_topbot='Top' then p.source_home_team else p.source_away_team end
      order by p.inning,p.at_bat_number,p.pitch_number
    ) as pitch_order
  from public.pick2_raw_mlb_statcast_pitches p
  where p.game_year=2026
    and p.game_type='R'
    and p.game_date>=date '2026-09-18'
)
select season,game_pk,game_date,team,opponent,pitcher_mlbam_id
from ordered
where pitch_order=1;

comment on view public.mlb_pitcher_win_forward_recent_starter_v1 is
'Research-only recent actual starter identity from the first Statcast pitcher for each team/game, used for prospective Pitcher Win prior-decision history from 2026-09-18 onward.';
