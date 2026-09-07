-- Register MLB_MONEYLINE_V1 as a validated shadow candidate under the existing native MLB Moneyline registry.
-- Preserve the current Champion unchanged. No Official Pick writes or betting activation.

do $$
declare
  v_feature_set_id uuid;
  v_model_id uuid;
  v_version_id uuid;
  v_contract jsonb;
  v_hyper jsonb;
  v_metrics jsonb;
begin
  v_contract := jsonb_build_object(
    'target','home_win_probability',
    'market_family','moneyline',
    'dataset','mlb_game_models_backtest_rows_v1_mv',
    'parent_research_version','MLB_GAME_MODELS_RESEARCH_V1',
    'ordered_features',jsonb_build_array(
      'recent_runs_per_game_diff','recent_iso_diff','recent_bb_rate_diff','recent_k_rate_diff',
      'starter_k_minus_bb_rate_diff','starter_whiff_rate_diff','starter_csw_rate_diff','starter_strike_rate_diff',
      'bullpen_k_minus_bb_rate_diff','bullpen_whiff_rate_diff','bullpen_pitches_24h_diff','bullpen_high_workload_count_diff'
    ),
    'as_of_contract','source_game_date < target_game_date',
    'excluded_inputs',jsonb_build_array('target_game_outcomes','postgame_fields','sportsbook_odds','closing_lines','future_games'),
    'label_policy',jsonb_build_object('2025','canonical Statcast final home/away score','2026_external_oos','canonical Statcast final home/away score'),
    'training_contract','TRAIN_2025_ONLY_NO_REFIT_AFTER_VALIDATION_SELECTION'
  );

  insert into public.pick2_model_feature_sets(
    id,deterministic_identity,sport_key,feature_set_version,feature_domains,leakage_policy,input_contract,created_at
  ) values (
    gen_random_uuid(),
    'baseball_mlb::feature_set::MLB_MONEYLINE_FEATURE_SET_V1::' || encode(digest(v_contract::text,'sha256'),'hex'),
    'baseball_mlb','MLB_MONEYLINE_FEATURE_SET_V1','["team","starter","bullpen","pregame"]'::jsonb,
    'source_game_date_lt_target_game_date',v_contract,now()
  ) on conflict (sport_key,feature_set_version) do nothing;

  select id into v_feature_set_id from public.pick2_model_feature_sets
  where sport_key='baseball_mlb' and feature_set_version='MLB_MONEYLINE_FEATURE_SET_V1';

  select id into v_model_id from public.pick2_model_registry
  where sport_key='baseball_mlb' and model_family='moneyline' and target='home_win_probability';

  if v_model_id is null then
    insert into public.pick2_model_registry(id,model_family,sport_key,target,purpose,status,created_at,updated_at)
    values(gen_random_uuid(),'moneyline','baseball_mlb','home_win_probability','sports_probability','candidate',now(),now())
    on conflict (sport_key,model_family,target) do nothing;

    select id into v_model_id from public.pick2_model_registry
    where sport_key='baseball_mlb' and model_family='moneyline' and target='home_win_probability';
  end if;

  v_hyper := jsonb_build_object(
    'model_type','ridge_logistic_gradient_descent_backtracking',
    'selected_lambda',50,
    'feature_names',jsonb_build_array(
      'recent_runs_per_game_diff','recent_iso_diff','recent_bb_rate_diff','recent_k_rate_diff',
      'starter_k_minus_bb_rate_diff','starter_whiff_rate_diff','starter_csw_rate_diff','starter_strike_rate_diff',
      'bullpen_k_minus_bb_rate_diff','bullpen_whiff_rate_diff','bullpen_pitches_24h_diff','bullpen_high_workload_count_diff'
    ),
    'intercept_and_standardized_weights',jsonb_build_array(
      0.18168339277502318,-0.003120530656233648,0.02598969546221286,0.10252382813255666,-0.07010807218568213,
      0.02369883760760022,-0.038797695860762614,0.0345823087741148,0.13137638333153367,0.10763942203749648,
      -0.08336630385966651,0,0
    ),
    'standardizer_means',jsonb_build_array(
      -0.030190268243243328,-0.0007585135135135139,-0.00029420405405405415,0.0013594864864864876,
      0.0011479560810810784,0.000740587837837837,0.0006193824324324321,0.001291818243243243,
      -0.0008902500000000033,-0.00026066824324324134,0,0
    ),
    'standardizer_scales',jsonb_build_array(
      1.045969716079337,0.022734593130676127,0.015095793551882756,0.03193574480573635,
      0.10049494960998595,0.06793290850319228,0.04109844506823486,0.04471827293475941,
      0.05156269418328382,0.034243710241524304,1,1
    ),
    'train_home_win_rate',0.5445945945945946,
    'artifact_sha256','f5f5f4ff00b4b11919a5ad505469d87b9244f5b2fd171290682e2a9f8911b3c2',
    'activation','SHADOW_RESEARCH_ONLY_NO_BETTING_MARKET',
    'training_contract','TRAIN_2025_ONLY_NO_REFIT_AFTER_VALIDATION_SELECTION'
  );

  v_metrics := jsonb_build_object(
    'validation_2025',jsonb_build_object('n',405,'brier',0.24777154514910082,'baseline_brier',0.2503370262154041,'brier_skill',0.010248108739998374,'actual_rate',0.5185185185185185,'predicted_rate',0.5429103209487179,'bias',0.02439180243019945),
    'sealed_test_2025',jsonb_build_object('n',364,'brier',0.24277452909063513,'baseline_brier',0.24904837492675302,'brier_skill',0.02519127393609011,'actual_rate',0.532967032967033,'predicted_rate',0.5461808716239676,'bias',0.013213838656934596),
    'external_oos_2026',jsonb_build_object('n',1951,'brier',0.2482594807548972,'baseline_brier',0.2498629488576705,'brier_skill',0.0064173904538630255,'actual_rate',0.5238339313172732,'predicted_rate',0.5449595214507492,'bias',0.021125590133476035),
    'promotion_boundary',jsonb_build_object('shadow_eligible',true,'official_pick_ready',false,'reason','positive Brier skill in VALIDATION, sealed 2025 TEST and external 2026 OOS; forward market validation still required')
  );

  insert into public.pick2_model_versions(
    id,deterministic_identity,model_id,feature_set_id,model_version,role,status,
    training_window,validation_window,sealed_holdout_window,hyperparameters,artifact_uri,artifact_digest,metrics,created_at,promoted_at
  ) values (
    gen_random_uuid(),
    'baseball_mlb::model_version::MLB_MONEYLINE_V1::f5f5f4ff00b4b11919a5ad505469d87b9244f5b2fd171290682e2a9f8911b3c2',
    v_model_id,v_feature_set_id,'MLB_MONEYLINE_V1','shadow','validated',
    '{"season":2025,"start":"2025-04-01","end":"2025-07-31","split":"TRAIN"}'::jsonb,
    '{"season":2025,"start":"2025-08-01","end":"2025-08-31","split":"VALIDATION"}'::jsonb,
    '{"season":2025,"start":"2025-09-01","end":"2025-09-28","split":"TEST","external_oos":{"season":2026,"start":"2026-03-31","end":"2026-09-03"}}'::jsonb,
    v_hyper,null,'f5f5f4ff00b4b11919a5ad505469d87b9244f5b2fd171290682e2a9f8911b3c2',v_metrics,now(),null
  ) on conflict (model_id,model_version) do nothing;

  select id into v_version_id from public.pick2_model_versions
  where model_id=v_model_id and model_version='MLB_MONEYLINE_V1';

  insert into public.pick2_model_training_runs(
    id,deterministic_identity,model_version_id,sport_key,target,training_window,feature_set_version,row_counts,hyperparameters,artifact_digest,status,created_at,completed_at
  ) values (
    gen_random_uuid(),'baseball_mlb::training::MLB_MONEYLINE_V1::2025_TRAIN',v_version_id,'baseball_mlb','home_win_probability',
    '{"start":"2025-04-01","end":"2025-07-31","split":"TRAIN"}'::jsonb,'MLB_MONEYLINE_FEATURE_SET_V1',
    '{"train_rows":1480,"validation_rows":405,"sealed_test_rows":364,"external_oos_2026_rows":1951}'::jsonb,
    '{"selected_lambda":50,"selection_metric":"validation_brier","training_contract":"TRAIN_2025_ONLY_NO_REFIT_AFTER_VALIDATION_SELECTION"}'::jsonb,
    'f5f5f4ff00b4b11919a5ad505469d87b9244f5b2fd171290682e2a9f8911b3c2','completed',now(),now()
  ) on conflict (deterministic_identity) do nothing;

  insert into public.pick2_model_validation_runs(
    id,deterministic_identity,model_version_id,validation_window,sealed_holdout,metrics,calibration_metrics,status,created_at
  ) values (
    gen_random_uuid(),'baseball_mlb::validation::MLB_MONEYLINE_V1::SEALED_TEST_2025',v_version_id,
    '{"season":2025,"start":"2025-09-01","end":"2025-09-28","split":"TEST"}'::jsonb,true,
    '{"n":364,"brier":0.24277452909063513,"baseline_brier":0.24904837492675302,"brier_skill":0.02519127393609011}'::jsonb,
    '{"actual_rate":0.532967032967033,"predicted_rate":0.5461808716239676,"bias":0.013213838656934596}'::jsonb,
    'completed',now()
  ) on conflict (deterministic_identity) do nothing;

  insert into public.pick2_model_validation_runs(
    id,deterministic_identity,model_version_id,validation_window,sealed_holdout,metrics,calibration_metrics,status,created_at
  ) values (
    gen_random_uuid(),'baseball_mlb::validation::MLB_MONEYLINE_V1::EXTERNAL_OOS_2026',v_version_id,
    '{"season":2026,"start":"2026-03-31","end":"2026-09-03","type":"external_oos"}'::jsonb,true,
    '{"n":1951,"brier":0.2482594807548972,"baseline_brier":0.2498629488576705,"brier_skill":0.0064173904538630255}'::jsonb,
    '{"actual_rate":0.5238339313172732,"predicted_rate":0.5449595214507492,"bias":0.021125590133476035}'::jsonb,
    'completed',now()
  ) on conflict (deterministic_identity) do nothing;
end $$;
