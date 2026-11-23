SELECT transaction_timestamp() captured_at,
jsonb_build_object(
 'v2_classifications',(SELECT jsonb_object_agg(classification,n) FROM (SELECT record->>'classification' classification,count(*) n FROM nba_v2_shadow.forecasts GROUP BY 1)c),
 'v2_natural_forecasts',(SELECT count(*) FROM nba_v2_shadow.forecasts f JOIN nba_v2_shadow.cycles c ON c.id=f.cycle_id WHERE c.kind='freeze'),
 'v2_unique_pending_games',(SELECT count(DISTINCT f.game_id) FROM nba_v2_shadow.forecasts f WHERE NOT EXISTS(SELECT FROM nba_v2_shadow.judgments j WHERE j.forecast_id=f.id AND j.record?'result')),
 'goat_by_version',(SELECT jsonb_agg(v) FROM (SELECT model_version,count(*) n,count(*) FILTER(WHERE production_eligible IS TRUE) production_eligible,count(*) FILTER(WHERE recommended_pick IS TRUE) recommended,count(*) FILTER(WHERE stake<>0) nonzero_stake FROM public.prediction_history WHERE sport_key='basketball_nba' AND prediction_origin='CURRENT_ERA_SHADOW' AND feature_snapshot->>'goatProviderPolicy'='NBA_GOAT_ARCHIVE_SHADOW_V1' GROUP BY model_version)v),
 'ncaab_flags',(SELECT jsonb_build_object('rows',count(*),'official',count(*) FILTER(WHERE official_pick),'production_eligible',count(*) FILTER(WHERE production_eligible)) FROM public.ncaab_calibration_shadow_v1)
) flags;
