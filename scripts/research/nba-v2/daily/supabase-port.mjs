// Uses the existing server-side service-role client. Writes use only the V2 commit and report RPCs.
export function supabasePort(db){
  const read=async q=>{
    const {data,error}=await q.abortSignal(AbortSignal.timeout(15000));
    if(error)throw Error('NBA_V2_DATABASE_READ_OR_COMMIT_FAILED: '+(error.code??'UNKNOWN'));
    return data;
  };
  return {
    review:model=>read(db.rpc('nba_v2_shadow_review',{p_model:model})),
    existing:(model,kind,slot)=>read(db.rpc('nba_v2_shadow_existing',{p_model:model,p_kind:kind,p_slot:slot})),
    commit:(kind,slot,batch)=>read(db.rpc('nba_v2_shadow_commit',{p_kind:kind,p_slot:slot,p_batch:batch})),
    due:(model,at)=>read(db.rpc('nba_v2_shadow_due',{p_model:model,p_at:at})),
    page:(cycle,after)=>read(db.rpc('nba_v2_shadow_page',{p_cycle:cycle,p_after:after})),
    cutoff:cycle=>read(db.rpc('nba_v2_shadow_cutoff',{p_cycle:cycle})),
    async saveReport(cycle,report){if(!await read(db.rpc('nba_v2_shadow_report',{p_cycle:cycle,p_report:report})))throw Error('NBA_V2_REPORT_UNPUBLISHED');},
    schedule:(day,at)=>read(db.from('nba_market_schedules_v1').select('snapshot_id,source_received_at,recorded_at,payload')
      .eq('date_local',day).lte('source_received_at',at).lte('recorded_at',at).order('source_received_at',{ascending:false}).order('snapshot_id').limit(2)),
    async playerEvidence(game,ids,at){
      const contexts=await read(db.from('nba_game_context_v2').select('provider_game_id,player_stats,player_stats_captured_at')
        .eq('provider_game_id',game).lte('player_stats_captured_at',at).limit(2));
      const compact=await read(db.from('nba_goat_player_game_research_v1').select('provider_game_id,player_id,minutes_played,ast,pts,reb,fg3m,source_captured_at,materialized_at')
        .eq('provider_game_id',game).in('player_id',ids).lte('materialized_at',at).limit(ids.length+1));
      if(compact.length>ids.length)throw Error('AMBIGUOUS_V2_COMPACT_SOURCE');
      return {contexts,compact};
    }
  };
}
