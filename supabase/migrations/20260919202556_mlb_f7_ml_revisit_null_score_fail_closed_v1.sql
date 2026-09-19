delete from public.mlb_f7_ml_revisit_base_v1
where home_f7 is null or away_f7 is null;

alter table public.mlb_f7_ml_revisit_base_v1
  add constraint mlb_f7_ml_revisit_score_not_null_ck
  check (home_f7 is not null and away_f7 is not null);

comment on constraint mlb_f7_ml_revisit_score_not_null_ck
  on public.mlb_f7_ml_revisit_base_v1 is
'Fail-closed: exclude games lacking a complete Statcast F7 score instead of treating them as pushes or imputing outcomes.';
