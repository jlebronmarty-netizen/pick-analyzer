-- NHL probable-goalie coverage and timing; READ ONLY.
-- A source observed after the original frozen decision must never be inserted
-- retroactively into its features. Postgame boxscore names never imply a
-- pregame confirmed starter.
with probable as (
 select s.sports_date,s.captured_at,g->>'eventId' event_id,
 (g->>'scheduledAt')::timestamptz tip,
 g->'homeProbable'->>'displayName' home_name,
 g->'awayProbable'->>'displayName' away_name,
 coalesce((g->>'confirmedHome')::boolean,false) confirmed_home,
 coalesce((g->>'confirmedAway')::boolean,false) confirmed_away
 from public.nhl_espn_goalie_probables_v1 s
 cross join lateral jsonb_array_elements(s.games) g
 where s.source_version='NHL_ESPN_FREE_PROBABLE_V5'
)
select count(*) source_games,
count(*) filter(where home_name is not null and away_name is not null) paired_probables,
count(*) filter(where confirmed_home and confirmed_away) paired_confirmed,
count(*) filter(where p.captured_at<=p.tip-interval '1 hour') valid_late_pregame,
round(avg(extract(epoch from(p.tip-p.captured_at))/3600)::numeric,2) mean_hours_before_puckdrop,
count(*) filter(where sh.event_id is not null) with_early_shadow,
count(*) filter(where sh.event_id is not null and p.captured_at>sh.frozen_at) late_after_early_freeze,
count(*) filter(where sh.event_id is not null and p.captured_at<=sh.frozen_at) available_at_early_freeze,
round(avg(extract(epoch from(p.captured_at-sh.frozen_at))/3600)::numeric,2) mean_hours_after_early_freeze
from probable p left join public.nhl_challenger_shadow_v1 sh using(event_id);
