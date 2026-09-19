create table public.mlb_f7_3way_revisit_base_v1 as
select
  season,
  game_pk,
  game_date,
  home_f7,
  away_f7,
  case
    when home_f7 > away_f7 then 'HOME'
    when home_f7 < away_f7 then 'AWAY'
    else 'DRAW'
  end::text as y_class,
  payload,
  outcome_lineage,
  'HISTORICAL_SEEN_DEVELOPMENT'::text as development_class,
  true::boolean as research_only
from public.mlb_f7_ml_revisit_base_v1
where game_date <= date '2026-09-18'
  and home_f7 is not null
  and away_f7 is not null;

alter table public.mlb_f7_3way_revisit_base_v1
  add primary key(season,game_pk),
  add constraint mlb_f7_3way_revisit_class_ck check(y_class in ('HOME','AWAY','DRAW')),
  add constraint mlb_f7_3way_revisit_cutoff_ck check(game_date<=date '2026-09-18'),
  add constraint mlb_f7_3way_revisit_score_not_null_ck check(home_f7 is not null and away_f7 is not null),
  add constraint mlb_f7_3way_revisit_dev_class_ck check(development_class='HISTORICAL_SEEN_DEVELOPMENT'),
  add constraint mlb_f7_3way_revisit_research_ck check(research_only=true),
  add constraint mlb_f7_3way_revisit_no_actual_winner_ck check(not(payload?'actual_winner'));

create index mlb_f7_3way_revisit_date_idx
  on public.mlb_f7_3way_revisit_base_v1(game_date);

alter table public.mlb_f7_3way_revisit_base_v1 enable row level security;
revoke all on table public.mlb_f7_3way_revisit_base_v1 from anon,authenticated;
grant select on table public.mlb_f7_3way_revisit_base_v1 to service_role;

comment on table public.mlb_f7_3way_revisit_base_v1 is
'Research-only First 7 Innings 3-Way Moneyline revisit surface derived from the certified fail-closed F7 score corpus. Outcomes HOME/AWAY/DRAW; pregame payload excludes actual_winner.';
