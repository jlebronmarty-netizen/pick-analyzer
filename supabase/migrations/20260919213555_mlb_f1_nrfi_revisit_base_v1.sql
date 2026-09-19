create table public.mlb_f1_nrfi_revisit_base_v1 as
select
  season,
  game_pk,
  game_date,
  home_f1,
  away_f1,
  case when home_f1=0 and away_f1=0 then 1 else 0 end::integer as y_nrfi,
  (payload->>'home_sp_mlbam_id')::bigint as home_sp_mlbam_id,
  (payload->>'away_sp_mlbam_id')::bigint as away_sp_mlbam_id,
  payload,
  outcome_lineage,
  'HISTORICAL_SEEN_DEVELOPMENT'::text as development_class,
  true::boolean as research_only
from public.mlb_f1_ml_revisit_base_v1
where game_date<=date '2026-09-18'
  and home_f1 is not null
  and away_f1 is not null
  and nullif(payload->>'home_sp_mlbam_id','') is not null
  and nullif(payload->>'away_sp_mlbam_id','') is not null;

alter table public.mlb_f1_nrfi_revisit_base_v1
  add primary key(season,game_pk),
  add constraint mlb_f1_nrfi_revisit_y_ck check(y_nrfi in (0,1)),
  add constraint mlb_f1_nrfi_revisit_cutoff_ck check(game_date<=date '2026-09-18'),
  add constraint mlb_f1_nrfi_revisit_score_ck check(home_f1 is not null and away_f1 is not null),
  add constraint mlb_f1_nrfi_revisit_ids_ck check(home_sp_mlbam_id is not null and away_sp_mlbam_id is not null),
  add constraint mlb_f1_nrfi_revisit_class_ck check(development_class='HISTORICAL_SEEN_DEVELOPMENT'),
  add constraint mlb_f1_nrfi_revisit_research_ck check(research_only=true),
  add constraint mlb_f1_nrfi_revisit_no_actual_winner_ck check(not(payload?'actual_winner'));

create index mlb_f1_nrfi_revisit_date_idx on public.mlb_f1_nrfi_revisit_base_v1(game_date);
create index mlb_f1_nrfi_revisit_home_sp_idx on public.mlb_f1_nrfi_revisit_base_v1(season,home_sp_mlbam_id,game_date);
create index mlb_f1_nrfi_revisit_away_sp_idx on public.mlb_f1_nrfi_revisit_base_v1(season,away_sp_mlbam_id,game_date);

alter table public.mlb_f1_nrfi_revisit_base_v1 enable row level security;
revoke all on table public.mlb_f1_nrfi_revisit_base_v1 from anon,authenticated;
grant select on table public.mlb_f1_nrfi_revisit_base_v1 to service_role;

comment on table public.mlb_f1_nrfi_revisit_base_v1 is
'Research-only F1 NRFI/YRFI second-pass surface derived from certified F1 scores. Includes exact starter MLBAM IDs so strictly-prior first-inning scoreless rates can be derived without fuzzy identity matching.';
