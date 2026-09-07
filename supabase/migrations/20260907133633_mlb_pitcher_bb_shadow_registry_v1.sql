-- Register MLB_PITCHER_BB_V1 in the native Pick Analyzer model registry.
-- Candidate/shadow/validated only. No Champion promotion or betting activation.

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
    'target','pitcher_walks_allowed',
    'market_family','pitcher_walks',
    'dataset','mlb_pitcher_bb_backtest_rows_v1_mv',
    'minimum_prior_appearances',3,
    'ordered_features',jsonb_build_array('expected_bf_x_pitcher_bb_rate'),
    'expected_bf_definition','prior_plate_appearances / prior_appearances',
    'as_of_contract','source_game_date < target_game_date',
    'excluded_inputs',jsonb_build_array('opponent_bb_rate','target_game_outcomes','postgame_fields','sportsbook_odds','closing_lines','future_games'),
    'feature_selection_note','VALIDATION selected pitcher weight 1.0 and opponent weight 0.0; opponent BB tendency excluded from V1',
    'label_policy',jsonb_build_object(
      'canonical_bb','Statcast walk + intentional_walk events; excludes HBP',
      'legacy_semantics','historical target_walks field equals canonical BB + HBP',
      'legacy_2025_reconciliation','4473/4473 exact, zero mismatches'
    )
  );

  insert into public.pick2_model_feature_sets(id,deterministic_identity,sport_key,feature_set_version,feature_domains,leakage_policy,input_contract,created_at)
  values(gen_random_uuid(),
    'baseball_mlb::feature_set::MLB_PITCHER_BB_FEATURE_SET_V1::'||encode(digest(v_contract::text,'sha256'),'hex'),
    'baseball_mlb','MLB_PITCHER_BB_FEATURE_SET_V1','["starter","statcast"]'::jsonb,
    'source_game_date_lt_target_game_date',v_contract,now())
  on conflict (sport_key,feature_set_version) do nothing;
  select id into v_feature_set_id from public.pick2_model_feature_sets
    where sport_key='baseball_mlb' and feature_set_version='MLB_PITCHER_BB_FEATURE_SET_V1';

  insert into public.pick2_model_registry(id,model_family,sport_key,target,purpose,status,created_at,updated_at)
  values(gen_random_uuid(),'pitcher_walks','baseball_mlb','pitcher_walks_allowed','sports_probability_research','candidate',now(),now())
  on conflict (sport_key,model_family,target) do nothing;
  select id into v_model_id from public.pick2_model_registry
    where sport_key='baseball_mlb' and model_family='pitcher_walks' and target='pitcher_walks_allowed';

  v_hyper := jsonb_build_object(
    'point_model',jsonb_build_object('type','linear_regression','selection_rule','VALIDATION selected pitcher-only component',
      'intercept',1.02751690958322,'coefficient_expected_bf_x_pitcher_bb_rate',0.395408983049705),
    'probability_model',jsonb_build_object('type','empirical_train_only_binned_calibration','projection_source','point_model',
      'bin_width_bb',0.25,'minimum_calibration_bin_n',20,'eligible_lines',jsonb_build_array(0.5,1.5,2.5,3.5),
      'calibration_surface','mlb_pitcher_bb_probability_calibration_v1_mv'),
    'minimum_prior_appearances',3,
    'activation','SHADOW_RESEARCH_ONLY_NO_BETTING_MARKET'
  );

  v_metrics := jsonb_build_object(
    'point',jsonb_build_object(
      'validation_2025',jsonb_build_object('n',781,'mae',1.0265716028287,'rmse',1.26800089998954,'bias',-0.0589372054084876),
      'sealed_test_2025',jsonb_build_object('n',696,'mae',0.960657158514918,'rmse',1.17709626569727,'bias',0.0724131137084618),
      'external_oos_2026',jsonb_build_object('n',3485,'mae',1.00658112129638,'rmse',1.27019810097165,'bias',-0.0461336012949939)
    ),
    'probability',jsonb_build_object(
      'eligible_lines',jsonb_build_array(0.5,1.5,2.5,3.5),
      'validation_2025',jsonb_build_object('evaluation_points',3124,'relative_brier_skill_pct',2.29648823871683),
      'sealed_test_2025',jsonb_build_object('evaluation_points',2764,'baseline_brier',0.160499792257081,'model_brier',0.1563724100641,'relative_brier_skill_pct',2.57158101885304,'calibration_bias',0.0216231603637653),
      'external_oos_2026',jsonb_build_object('evaluation_points',13648,'baseline_brier',0.165678990934334,'model_brier',0.160990106425357,'relative_brier_skill_pct',2.83010204403989,'calibration_bias',-0.0092107065381523,'minimum_runtime_bin_n',112)
    ),
    'semantic_audit',jsonb_build_object('legacy_2025_rows',4473,'legacy_reconciled',4473,'legacy_mismatches',0)
  );

  insert into public.pick2_model_versions(id,deterministic_identity,model_id,feature_set_id,model_version,role,status,
    training_window,validation_window,sealed_holdout_window,hyperparameters,artifact_uri,artifact_digest,metrics,created_at,promoted_at)
  values(gen_random_uuid(),
    'baseball_mlb::model_version::MLB_PITCHER_BB_V1::'||encode(digest((v_hyper||v_metrics)::text,'sha256'),'hex'),
    v_model_id,v_feature_set_id,'MLB_PITCHER_BB_V1','shadow','validated',
    '{"season":2025,"start":"2025-04-01","end":"2025-07-31","split":"TRAIN"}'::jsonb,
    '{"season":2025,"start":"2025-08-01","end":"2025-08-31","split":"VALIDATION"}'::jsonb,
    '{"season":2025,"start":"2025-09-01","end":"2025-09-28","split":"TEST","external_oos":{"season":2026,"start":"2026-03-31","end":"2026-09-03"}}'::jsonb,
    v_hyper,null,encode(digest(('MLB_PITCHER_BB_V1|'||v_hyper::text||'|'||v_metrics::text),'sha256'),'hex'),v_metrics,now(),null)
  on conflict (model_id,model_version) do nothing;
  select id into v_version_id from public.pick2_model_versions where model_id=v_model_id and model_version='MLB_PITCHER_BB_V1';

  insert into public.pick2_model_training_runs(id,deterministic_identity,model_version_id,sport_key,target,training_window,feature_set_version,row_counts,hyperparameters,artifact_digest,status,created_at,completed_at)
  values(gen_random_uuid(),'baseball_mlb::training::MLB_PITCHER_BB_V1::2025_TRAIN',v_version_id,'baseball_mlb','pitcher_walks_allowed',
    '{"start":"2025-04-01","end":"2025-07-31","split":"TRAIN"}'::jsonb,'MLB_PITCHER_BB_FEATURE_SET_V1',
    '{"train_rows":2572,"validation_rows":781,"sealed_test_rows":696,"external_oos_2026_rows":3485}'::jsonb,
    '{"point_component":"pitcher_only","probability_bin_width":0.25,"minimum_prior_appearances":3}'::jsonb,
    encode(digest('MLB_PITCHER_BB_V1_TRAIN_2025','sha256'),'hex'),'completed',now(),now())
  on conflict (deterministic_identity) do nothing;

  insert into public.pick2_model_validation_runs(id,deterministic_identity,model_version_id,validation_window,sealed_holdout,metrics,calibration_metrics,status,created_at)
  values(gen_random_uuid(),'baseball_mlb::validation::MLB_PITCHER_BB_V1::SEALED_TEST_2025',v_version_id,
    '{"start":"2025-09-01","end":"2025-09-28","split":"TEST"}'::jsonb,true,
    '{"point":{"n":696,"mae":0.960657158514918,"rmse":1.17709626569727,"bias":0.0724131137084618}}'::jsonb,
    '{"eligible_lines":[0.5,1.5,2.5,3.5],"evaluation_points":2764,"baseline_brier":0.160499792257081,"model_brier":0.1563724100641,"relative_brier_skill_pct":2.57158101885304}'::jsonb,
    'completed',now()) on conflict (deterministic_identity) do nothing;

  insert into public.pick2_model_validation_runs(id,deterministic_identity,model_version_id,validation_window,sealed_holdout,metrics,calibration_metrics,status,created_at)
  values(gen_random_uuid(),'baseball_mlb::validation::MLB_PITCHER_BB_V1::EXTERNAL_OOS_2026',v_version_id,
    '{"season":2026,"start":"2026-03-31","end":"2026-09-03","type":"external_oos"}'::jsonb,true,
    '{"point":{"n":3485,"mae":1.00658112129638,"rmse":1.27019810097165,"bias":-0.0461336012949939}}'::jsonb,
    '{"eligible_lines":[0.5,1.5,2.5,3.5],"evaluation_points":13648,"baseline_brier":0.165678990934334,"model_brier":0.160990106425357,"relative_brier_skill_pct":2.83010204403989,"minimum_runtime_bin_n":112}'::jsonb,
    'completed',now()) on conflict (deterministic_identity) do nothing;
end $$;