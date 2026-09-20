
do $$
begin
  if to_regclass('public.mlb_ml_pregame_starter_evidence_v1_date_idx') is not null
     and to_regclass('public.mlb_ml_pregame_starter_evidence_date_idx') is not null then
    execute 'drop index public.mlb_ml_pregame_starter_evidence_date_idx';
  end if;
end
$$;
