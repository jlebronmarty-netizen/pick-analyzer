create table public.mlb_f1_3way_revisit_base_v1 as
select season,game_pk,game_date,home_f1,away_f1,
  case when home_f1>away_f1 then 'HOME' when home_f1<away_f1 then 'AWAY' else 'DRAW' end::text as y_class,
  payload,outcome_lineage,'HISTORICAL_SEEN_DEVELOPMENT'::text as development_class,true::boolean as research_only
from public.mlb_f1_ml_revisit_base_v1
where game_date<=date '2026-09-18' and home_f1 is not null and away_f1 is not null;

alter table public.mlb_f1_3way_revisit_base_v1
  add primary key(season,game_pk),
  add constraint mlb_f1_3way_revisit_class_ck check(y_class in ('HOME','AWAY','DRAW')),
  add constraint mlb_f1_3way_revisit_cutoff_ck check(game_date<=date '2026-09-18'),
  add constraint mlb_f1_3way_revisit_dev_class_ck check(development_class='HISTORICAL_SEEN_DEVELOPMENT'),
  add constraint mlb_f1_3way_revisit_research_ck check(research_only=true),
  add constraint mlb_f1_3way_revisit_no_actual_winner_ck check(not(payload?'actual_winner'));
create index mlb_f1_3way_revisit_date_idx on public.mlb_f1_3way_revisit_base_v1(game_date);
alter table public.mlb_f1_3way_revisit_base_v1 enable row level security;
revoke all on table public.mlb_f1_3way_revisit_base_v1 from anon,authenticated;
grant select on table public.mlb_f1_3way_revisit_base_v1 to service_role;
