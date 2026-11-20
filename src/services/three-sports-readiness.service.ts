import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {getSoccerShadowReport} from '@/services/soccer-shadow-read.service';
import {threeSportsReadiness} from '@/lib/three-sports-readiness.mjs';

// All source reads are from existing services / saved database evidence.
// The soccer bridge is a pre-existing read-only endpoint, not a sports API.
// No raw UFC response, tokens, personal credentials or fixture-level bets exposed.
export async function getThreeSportsReadiness(){
 const nowIso=new Date().toISOString();
 const [soccer,run,forecasts,results,quotes,tennis,atpPred,atpResults]=await Promise.all([
  getSoccerShadowReport(),
  db.from('ufc_free_runs_v1').select('started_at,status,provider_calls,detail')
   .order('started_at',{ascending:false}).limit(1),
  db.from('ufc_free_predictions_v1').select('id,bout_id,scheduled_at,captured_at,body')
   .order('id',{ascending:true}).limit(200),
  db.from('ufc_free_results_v1').select('bout_id').order('id',{ascending:true}).limit(200),
  db.from('ufc_free_quotes_v1').select('bout_id').order('id',{ascending:true}).limit(600),
  db.from('free_sports_runs_v1').select(
   'requested_at,observed_at,state,captureOnly:evidence->captureOnly,normalized:evidence->normalized'
   ).eq('league','ATP').order('requested_at',{ascending:false}).limit(32),
  db.from('free_sports_forecasts_v1').select('event_id',{count:'exact',head:true}).eq('league','ATP'),
  db.from('free_sports_results_v1').select('event_id',{count:'exact',head:true}).eq('league','ATP')
 ]);
 if([run,forecasts,results,quotes,tennis,atpPred,atpResults].some(x=>x.error))throw Error('THREE_SPORTS_SOURCE_READ_FAILED');
 if((forecasts.data??[]).length>=200||(results.data??[]).length>=200||
  (quotes.data??[]).length>=600||(tennis.data??[]).length>=32)
  throw Error('THREE_SPORTS_SOURCE_SCAN_CAPPED');
 const report=threeSportsReadiness({
  soccer,
  ufc:{latestRun:run.data?.[0]??null,
   predictions:forecasts.data??[],results:results.data??[],quotes:quotes.data??[]},
  atp:{runs:tennis.data??[],forecastCount:atpPred.count??0,
   resultCount:atpResults.count??0},
  nowIso
 });
 return report;
}
