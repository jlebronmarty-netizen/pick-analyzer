import 'server-only';
import {supabaseAdmin} from '@/lib/supabase-admin';
import {runNbaPeriodBacktest} from '@/lib/nba/period-research-core.mjs';

export async function readNbaPeriodResearch() {
  // One archival DB read only. No external provider calls and no forecast/model writes.
  const result=await supabaseAdmin.from('nba_market_sync_runs_v1')
    .select('run_id,started_at,status,summary')
    .like('slot','research:history:%').eq('status','completed')
    .order('started_at',{ascending:false}).limit(1)
    .abortSignal(AbortSignal.timeout(12000)).maybeSingle();
  if(result.error||!result.data)throw new Error('NBA_PERIOD_ARCHIVED_HISTORY_UNAVAILABLE');
  const source=result.data.summary?.history_capture;
  if(!source||source.complete!==true||!Array.isArray(source.games))
    throw new Error('NBA_PERIOD_ARCHIVE_COMPLETENESS_UNVERIFIED');
  const report=runNbaPeriodBacktest(source.games);
  return {...report,archived_evidence:{
    run_id:result.data.run_id,received_at:source.received_at??null,
    provider:'balldontlie',capture_version:source.capture_version??null,
    response_sha256s:Array.isArray(source.response_sha256s)?source.response_sha256s:[],
    provider_calls_for_this_report:0,db_writes_for_this_report:0,
  }};
}
