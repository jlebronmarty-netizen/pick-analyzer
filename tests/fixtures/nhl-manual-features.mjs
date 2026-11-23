// Synthetic presentation/contract fixture, never provider evidence.
export function manualFeature({eventId='nhl:2026020350',generated='2026-11-23T15:00:00.000Z',scheduled='2026-11-24T00:00:00.000Z',date='2026-11-23'}={}) {
  const team=abbrev=>({abbrev,
    season:{record:'10-8-2',gp:20,points:22,gf_pg:2.75,ga_pg:3.1,through_date:'2026-11-22'},
    last10:{record:'5-4-1',gp:10,complete:true,sequence_verified:true,gf_pg:2.5,ga_pg:3,shots_for_pg:29,shots_against_pg:31,periods:[{period:1,gp:10,gf_pg:.8,ga_pg:1,shots_for_pg:9,shots_against_pg:10,goals_coverage:10,shots_coverage:10}]},
    recent_event_ids:['nhl:2026020342'],
    special_teams:{pp_pct:.2,pk_pct:.8,is_current_gp_match:false,captured_at:'2026-11-22T12:00:00.000Z'},
    rest:{days_off:1,back_to_back:false,verified:true},
    reported_goalie:{name:'Portero de prueba',status:'PROBABLE',checked_at:generated},
  });
  return {schema_version:'NHL_MANUAL_FEATURES_V1',event_id:eventId,scheduled_at:scheduled,available_as_of:generated,local_date:date,
    scope:'PROSPECTIVE_RESEARCH_INPUTS',forecast_probability:null,official_pick:false,model_promoted:false,
    teams:{away:team('MIN'),home:team('VGK')},coverage:{both_last10_complete:true,both_goalies_confirmed:false,standings_current:true,standings_through:'2026-11-22'},
    provenance:{publication_at:generated},note:'Synthetic test fixture'};
}
export function manualRow({feature=manualFeature(),available='2026-11-23T16:00:00.000Z',run='manual-test-001'}={}) {
  return {event_id:feature.event_id,available_as_of:available,scheduled_at:feature.scheduled_at,source_snapshot_sha256:'a'.repeat(64),source_run_id:run,
    feature_payload:feature,schema_version:feature.schema_version,inserted_at:available};
}
