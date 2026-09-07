-- Register MLB_PITCHER_K_V1 in the native Pick Analyzer model registry.
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
    'target','pitcher_strikeouts',
    'market_family','pitcher_strikeouts',
    'dataset','mlb_pitcher_prop_backtest_2025_v1_enriched',
    'external_oos_dataset','mlb_pitcher_strikeout_backtest_rows_v1_mv',
    'minimum_prior_appearances',3,
    'ordered_features',jsonb_build_array(
      'expected_bf_x_pitcher_k_rate','expected_bf_x_opponent_k_rate','pitcher_whiff_rate','pitcher_csw_rate','pitcher_strike_rate',
      'pitcher_velocity_delta','previous_pitch_count','days_rest','opponent_recent_iso','opponent_recent_runs_per_game'
    ),
    'expected_bf_definition','prior_plate_appearances / prior_appearances',
    'as_of_contract','source_game_date < target_game_date',
    'excluded_inputs',jsonb_build_array('target_game_outcomes','postgame_fields','sportsbook_odds','closing_lines','future_games'),
    'label_policy',jsonb_build_object(
      '2025','official Retrosheet starter labels',
      '2026_k_external_oos','Statcast strikeout labels; 100% exact parity vs 2025 official strikeout labels'
    )
  );

  insert into public.pick2_model_feature_sets(
    id,deterministic_identity,sport_key,feature_set_version,feature_domains,leakage_policy,input_contract,created_at
  ) values (
    gen_random_uuid(),
    'baseball_mlb::feature_set::MLB_PITCHER_K_FEATURE_SET_V1::' || encode(digest(v_contract::text,'sha256'),'hex'),
    'baseball_mlb','MLB_PITCHER_K_FEATURE_SET_V1','["starter","opponent_team","statcast"]'::jsonb,
    'source_game_date_lt_target_game_date',v_contract,now()
  ) on conflict (sport_key,feature_set_version) do nothing;

  select id into v_feature_set_id from public.pick2_model_feature_sets
  where sport_key='baseball_mlb' and feature_set_version='MLB_PITCHER_K_FEATURE_SET_V1';

  insert into public.pick2_model_registry(id,model_family,sport_key,target,purpose,status,created_at,updated_at)
  values(gen_random_uuid(),'pitcher_strikeouts','baseball_mlb','pitcher_strikeouts','sports_probability_research','candidate',now(),now())
  on conflict (sport_key,model_family,target) do nothing;

  select id into v_model_id from public.pick2_model_registry
  where sport_key='baseball_mlb' and model_family='pitcher_strikeouts' and target='pitcher_strikeouts';

  v_hyper := jsonb_build_object(
    'point_model',jsonb_build_object(
      'type','ridge_linear_regression','selection_metric','validation_mae','ridge_lambda',50,'intercept',-2.622576341,
      'coefficients',jsonb_build_object(
        'expected_bf_x_pitcher_k_rate',0.219063783,'expected_bf_x_opponent_k_rate',0.371261292,
        'pitcher_whiff_rate',8.599311891,'pitcher_csw_rate',-1.981295523,'pitcher_strike_rate',8.780276885,
        'pitcher_velocity_delta',0.012324355,'previous_pitch_count',0.007749663,'days_rest',-0.016077654,
        'opponent_recent_iso',-4.380281204,'opponent_recent_runs_per_game',0.015153048
      )
    ),
    'probability_model',jsonb_build_object(
      'type','empirical_train_only_calibration','projection_intercept',1.224497,
      'projection_coefficients',jsonb_build_object('expected_bf_x_pitcher_k_rate',0.578900,'expected_bf_x_opponent_k_rate',0.184751),
      'bin_width_k',0.5,'laplace_alpha',1,'minimum_calibration_bin_n',20,
      'eligible_lines',jsonb_build_array(2.5,3.5,4.5,5.5),'ineligible_at_or_above',6.5,
      'calibration_surface','mlb_pitcher_k_probability_calibration_v1_mv'
    ),
    'minimum_prior_appearances',3,
    'activation','SHADOW_RESEARCH_ONLY_NO_BETTING_MARKET'
  );

  v_metrics := jsonb_build_object(
    'point',jsonb_build_object(
      'validation_2025',jsonb_build_object('n',777,'mae',1.76612,'rmse',2.21513,'bias',-0.03760),
      'sealed_test_2025',jsonb_build_object('n',692,'mae',1.84950,'rmse',2.34639,'bias',-0.11316),
      'external_oos_2026',jsonb_build_object('n',3485,'mae',1.77927,'rmse',2.23031,'bias',0.02117)
    ),
    'probability_eligible_lines_2_5_to_5_5',jsonb_build_object(
      'sealed_test_2025',jsonb_build_object('evaluation_points',2768,'baseline_brier',0.193842,'model_brier',0.191554,'relative_improvement_pct',1.18,'calibration_bias',-0.00804),
      'external_oos_2026',jsonb_build_object('evaluation_points',13648,'baseline_brier',0.190573,'model_brier',0.189718,'relative_improvement_pct',0.45,'calibration_bias',0.00375)
    ),
    'probability_boundary',jsonb_build_object(
      'eligible_lines',jsonb_build_array(2.5,3.5,4.5,5.5),
      'reason','consistent Brier improvement in sealed 2025 TEST and external 2026 OOS; 6.5+ inconsistent or worse'
    )
  );

  insert into public.pick2_model_versions(
    id,deterministic_identity,model_id,feature_set_id,model_version,role,status,
    training_window,validation_window,sealed_holdout_window,hyperparameters,artifact_uri,artifact_digest,metrics,created_at,promoted_at
  ) values (
    gen_random_uuid(),
    'baseball_mlb::model_version::MLB_PITCHER_K_V1::' || encode(digest((v_hyper||v_metrics)::text,'sha256'),'hex'),
    v_model_id,v_feature_set_id,'MLB_PITCHER_K_V1','shadow','validated',
    '{"season":2025,"start":"2025-04-01","end":"2025-07-31","split":"TRAIN"}'::jsonb,
    '{"season":2025,"start":"2025-08-01","end":"2025-08-31","split":"VALIDATION"}'::jsonb,
    '{"season":2025,"start":"2025-09-01","end":"2025-09-28","split":"TEST","external_oos":{"season":2026,"start":"2026-03-31","end":"2026-09-03"}}'::jsonb,
    v_hyper,null,
    encode(digest(('MLB_PITCHER_K_V1|' || v_hyper::text || '|' || v_metrics::text),'sha256'),'hex'),
    v_metrics,now(),null
  ) on conflict (model_id,model_version) do nothing;

  select id into v_version_id from public.pick2_model_versions
  where model_id=v_model_id and model_version='MLB_PITCHER_K_V1';

  insert into public.pick2_model_training_runs(
    id,deterministic_identity,model_version_id,sport_key,target,training_window,feature_set_version,row_counts,hyperparameters,artifact_digest,status,created_at,completed_at
  ) values (
    gen_random_uuid(),'baseball_mlb::training::MLB_PITCHER_K_V1::2025_TRAIN',v_version_id,'baseball_mlb','pitcher_strikeouts',
    '{"start":"2025-04-01","end":"2025-07-31","split":"TRAIN"}'::jsonb,'MLB_PITCHER_K_FEATURE_SET_V1',
    '{"train_rows":2557,"validation_rows":777,"sealed_test_rows":692,"external_oos_2026_rows":3485}'::jsonb,
    '{"ridge_lambda":50,"point_selection_metric":"validation_mae","probability_bin_width":0.5,"minimum_prior_appearances":3}'::jsonb,
    encode(digest('MLB_PITCHER_K_V1_TRAIN_2025','sha256'),'hex'),'completed',now(),now()
  ) on conflict (deterministic_identity) do nothing;

  insert into public.pick2_model_validation_runs(
    id,deterministic_identity,model_version_id,validation_window,sealed_holdout,metrics,calibration_metrics,status,created_at
  ) values (
    gen_random_uuid(),'baseball_mlb::validation::MLB_PITCHER_K_V1::SEALED_TEST_2025',v_version_id,
    '{"start":"2025-09-01","end":"2025-09-28","split":"TEST"}'::jsonb,true,
    '{"point":{"n":692,"mae":1.84950,"rmse":2.34639,"bias":-0.11316}}'::jsonb,
    '{"eligible_lines":[2.5,3.5,4.5,5.5],"evaluation_points":2768,"baseline_brier":0.193842,"model_brier":0.191554,"relative_improvement_pct":1.18,"calibration_bias":-0.00804}'::jsonb,
    'completed',now()
  ) on conflict (deterministic_identity) do nothing;

  insert into public.pick2_model_validation_runs(
    id,deterministic_identity,model_version_id,validation_window,sealed_holdout,metrics,calibration_metrics,status,created_at
  ) values (
    gen_random_uuid(),'baseball_mlb::validation::MLB_PITCHER_K_V1::EXTERNAL_OOS_2026',v_version_id,
    '{"season":2026,"start":"2026-03-31","end":"2026-09-03","type":"external_oos"}'::jsonb,true,
    '{"point":{"n":3485,"mae":1.77927,"rmse":2.23031,"bias":0.02117}}'::jsonb,
    '{"eligible_lines":[2.5,3.5,4.5,5.5],"evaluation_points":13648,"baseline_brier":0.190573,"model_brier":0.189718,"relative_improvement_pct":0.45,"calibration_bias":0.00375}'::jsonb,
    'completed',now()
  ) on conflict (deterministic_identity) do nothing;
end $$;
