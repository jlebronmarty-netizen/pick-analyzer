import 'server-only';
import {gameMetrics} from '@/lib/data-quality/game-metrics.mjs';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {readNbaDecisionBoard} from '@/services/nba-decision-board.service';
import {planNbaShadowFreeze,settleNbaShadowForecast,concordantPlayerFinal,pendingOvertimeDispute,latestArchivedFinal} from '@/lib/nba/decision-learning-core.mjs';
import {verifiedArchivedPlayerFinal} from '@/lib/nba/decision-archived-final-core.mjs';

function rows(res:any,label:string){if(res.error)throw new Error(label);return res.data??[];}
function dayPR(date:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
async function writeIgnoreDuplicates(table:string,values:any[],id:string){
 let written=0;
 for(let i=0;i<values.length;i+=100){
  const batch=values.slice(i,i+100);
  const result=await db.from(table).upsert(batch,{onConflict:id,ignoreDuplicates:true}).abortSignal(AbortSignal.timeout(12000));
  if(result.error)throw new Error('NBA_DECISION_APPEND_FAILED');
  written+=batch.length; // attempted idempotent inserts, not actual inserted count
 }
 return written;
}
export async function freezeNbaDecisionShadow(now=new Date()){
 const board=await readNbaDecisionBoard({now});
 const plan=planNbaShadowFreeze(board,now.toISOString());
 if(plan.status!=='SHADOW_PREVIEW_FREEZE_PLAN')return {status:plan.status,provider_calls:0,writes:0};
 if(plan.rows.length>1500) return {status:'NBA_DECISION_FREEZE_REVIEW_BOUND',candidates:plan.rows.length,provider_calls:0,writes:0};
 if(!plan.rows.length)return {status:'NO_ELIGIBLE_SHADOW_FORECASTS',excluded:plan.excluded,provider_calls:0,writes:0};
 const attempts=await writeIgnoreDuplicates('nba_decision_shadow_forecasts_v1',plan.rows,'forecast_id');
 return {status:'FORECAST_EVIDENCE_PERSISTED',attempted_idempotent_rows:attempts,
  eligible_before_cap:plan.eligible_before_cap,freeze_cap:plan.cap,
  excluded:plan.excluded,provider_calls:0,official_model_writes:0,calibrated_picks:0};
}
async function loadFinal(gameId:number,day:string,asOf:string){
 const response=await db.from('nba_market_schedules_v1').select('snapshot_id,source_received_at,payload')
  .eq('date_local',day).lte('source_received_at',asOf).lte('recorded_at',asOf).order('source_received_at',{ascending:false}).order('snapshot_id').limit(2)
  .abortSignal(AbortSignal.timeout(10000));
 const evidence=rows(response,'NBA_DECISION_FINAL_SOURCE_UNAVAILABLE');
 return latestArchivedFinal(evidence,gameId,day,asOf);
}
export async function settleNbaDecisionShadow(now=new Date()){
 const before=new Date(now.getTime()-3*60*60000).toISOString();
 const after=new Date(now.getTime()-21*24*3600000).toISOString();
 // Two bounded, fair lanes: prevent stale player stats from blocking newly settled games.
 // This query EXCLUDES already settled rows in SQL; no 1000-row table-scan ceiling.
 const [oldest,newest]=await Promise.all(['oldest','newest'].map(p_order=>
  db.rpc('read_nba_decision_unsettled_v1',{
   p_after:after,p_before:before,p_order,p_limit:350
  }).abortSignal(AbortSignal.timeout(12000))));
 const candidates=[...rows(oldest,'NBA_DECISION_PENDING_OLD_READ_FAILED'),
   ...rows(newest,'NBA_DECISION_PENDING_NEW_READ_FAILED')];
 const seen=new Set<string>();
 const pending=candidates.filter((f:any)=>{
  if(seen.has(f.forecast_id))return false;seen.add(f.forecast_id);return true;
 });
 if(!pending.length)return {status:'NO_UNSETTLED_SHADOW_FORECASTS',provider_calls:0,writes:0};
 const gameMap=new Map<string,any>();
 for(const f of pending){
  const key=f.game_date_local+'|'+f.game_id;
  if(!gameMap.has(key))gameMap.set(key,await loadFinal(Number(f.game_id),f.game_date_local,now.toISOString()));
 }
 const wanted=[...new Set(pending.filter((f:any)=>f.market==='props').map((f:any)=>Number(f.player_id)).filter(Number.isSafeInteger))];
 const games=[...new Set(pending.filter((f:any)=>f.market==='props').map((f:any)=>Number(f.game_id)).filter(Number.isSafeInteger))];
 const playerRows:any[]=[];
 if(wanted.length&&games.length){
  // One bounded query per game avoids losing a contradictory compact row to a global limit.
  for(const gameId of games){
   const result=await db.from('nba_goat_player_game_research_v1')
    .select('provider_game_id,player_id,source_captured_at,minutes_played,pts,reb,ast,fg3m')
    .eq('provider_game_id',gameId).in('player_id',wanted).lte('materialized_at',now.toISOString())
    .lte('source_captured_at',now.toISOString()).limit(wanted.length+1).abortSignal(AbortSignal.timeout(10000));
   const observed=rows(result,'NBA_DECISION_PLAYER_RESULT_UNAVAILABLE');
   if(observed.length>wanted.length)throw Error('NBA_DECISION_DUPLICATE_PLAYER_RESULTS');
   playerRows.push(...observed);
  }
 }
 // Zero-provider-call fallback: archived operational boxscores may predate
 // the separate GOAT compact research materialization.
 // Never use a partial/identity-conflicted game or zero-minute player.
 const archivedFinals=new Map<string,any>();
 for(let i=0;i<games.length;i+=16){
  const batch=games.slice(i,i+16);
  const r=await db.from('nba_game_context_v2')
   .select('provider_game_id,player_stats,player_stats_captured_at')
   .in('provider_game_id',batch).not('player_stats','is',null)
   .lte('player_stats_captured_at',now.toISOString())
   .limit(batch.length+1).abortSignal(AbortSignal.timeout(10000));
  const contexts=rows(r,'NBA_DECISION_CONTEXT_FINAL_UNAVAILABLE');
  if(contexts.length>batch.length)continue;
  for(const context of contexts){
   if(contexts.filter((x:any)=>x.provider_game_id===context.provider_game_id).length!==1)continue;
   const gameId=Number(context.provider_game_id);
   const gameRecord=[...gameMap.entries()].find(([k,v])=>v&&k.endsWith('|'+gameId))?.[1];
   if(!gameRecord)continue;
   const verified=verifiedArchivedPlayerFinal({
    context,final:gameRecord.game,providerGameId:gameId,allowPartialComponents:true
   });
   if(!verified)continue;
   for(const [playerId,stat] of verified.rows)
    archivedFinals.set(gameId+'|'+playerId,{...stat,source_captured_at:verified.capturedAt});
  }
 }
 const results=[];
 let awaitingVerifiedProps=0;
 const disputedOvertime:string[]=[];
 const disputed:{forecastId:string;gameId:number;playerId:number;statistic:string}[]=[];
 for(const f of pending){
  const final=gameMap.get(f.game_date_local+'|'+f.game_id);
  if(!final)continue;
  if(pendingOvertimeDispute(f,final.game)){disputedOvertime.push(f.forecast_id);continue;}
  const matches=f.market==='props'?playerRows.filter(x=>Number(x.player_id)===Number(f.player_id)&&Number(x.provider_game_id)===Number(f.game_id)):[];
  if(matches.length>1){disputed.push({forecastId:f.forecast_id,gameId:f.game_id,playerId:f.player_id,statistic:f.statistic});continue;}
  const compact=matches[0]??null;
  const original=archivedFinals.get(f.game_id+'|'+f.player_id);
  const stat=f.market==='props'?concordantPlayerFinal(f.statistic,compact,original):null;
  if(f.market==='props' && compact&&original&&!stat)disputed.push({forecastId:f.forecast_id,gameId:f.game_id,playerId:f.player_id,statistic:f.statistic});
  if(f.market==='props'&&!stat){awaitingVerifiedProps++;continue;}
  const out=settleNbaShadowForecast(f,{game:final.game,sourceReceivedAt:final.receivedAt,
    playerStat:stat??null,playerStatReceivedAt:stat?.source_captured_at??null});
  if(out)results.push({...out,evidence:{...out.evidence,source_snapshot_id:final.snapshotId,
    ...(f.market==='props'?{player_stat_table:'nba_game_context_v2',compact_corroborated:Boolean(compact)}:{})}});
 }
 if(!results.length)return {status:'RESULTS_NOT_ARCHIVED_YET',pending:pending.length,disputed_overtime:disputedOvertime,disputed_props:disputed,awaiting_verified_props:awaitingVerifiedProps,provider_calls:0,writes:0};
 const attempts=await writeIgnoreDuplicates('nba_decision_shadow_outcomes_v1',results,'forecast_id');
 return {status:'STATISTICAL_OUTCOMES_PERSISTED',pending_seen:pending.length,
   attempted_idempotent_rows:attempts,awaiting_final_or_player_stats:pending.length-results.length,
   disputed_overtime:disputedOvertime,disputed_props:disputed,awaiting_verified_props:awaitingVerifiedProps,queue_pending_checked:pending.length,
   provider_calls:0,official_model_writes:0};
}
export async function readNbaDecisionLearningStatus(){
 const since=new Date(Date.now()-90*86400000).toISOString();
 const result=await db.rpc('read_nba_decision_learning_metrics_v1',{p_since:since})
   .abortSignal(AbortSignal.timeout(15000));
 if(result.error||!result.data||typeof result.data!=='object')
  throw new Error('NBA_DECISION_LEARNING_METRICS_UNAVAILABLE');
 // The existing RPC clusters challengers by game, but its baseline MAE and hit rate
 // give every contract equal weight. Keep the original contract measures for comparison.
 const until=new Date().toISOString();
 const groups=new Map<string,any[]>();
 let complete=false;
 for(let start=0;start<20000;start+=1000){
  const page=await db.from('nba_decision_shadow_outcomes_v1')
   .select('forecast_id,absolute_error,statistical_result,f:nba_decision_shadow_forecasts_v1!inner(game_id,model_version,market,period,statistic,decision_at)')
   .gte('f.decision_at',since).lte('settled_at',until).order('forecast_id')
   .range(start,start+999).abortSignal(AbortSignal.timeout(10000));
  const data=rows(page,'NBA_DECISION_GAME_METRICS_UNAVAILABLE');
  for(const o of data){
   const f=o.f,key=JSON.stringify([f.model_version,f.market,f.period,f.statistic??'']);
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key)!.push({gameId:f.game_id,result:o.statistical_result,error:o.absolute_error==null?null:Number(o.absolute_error)});
  }
  if(data.length<1000){complete=true;break;}
 }
 const baseline=(result.data.baseline??[]).map((r:any)=>{
  const records=groups.get(JSON.stringify([r.modelVersion,r.market,r.period,r.statistic??'']))??[];
  const g=gameMetrics(records),matched=complete&&records.length===r.scoredContracts&&g.uniqueGames===r.uniqueGames;
  return {...r,contractMae:r.mae,contractHitRate:r.hitRate,mae:matched?g.mae:null,
    hitRate:matched&&g.decisionGames>=30?g.hitRate:null,decisionGames:g.decisionGames,
    metricBasis:matched?'EQUAL_WEIGHT_PER_GAME':'GAME_METRICS_PENDING'};
 });
 const m=result.data;
 return {version:'NBA_DECISION_STATISTICAL_SHADOW_V2',status:m.status,
  frozenRowsSeen:Number(m.frozen_rows??0),outcomesSeen:Number(m.outcomes_rows??0),
  lastFrozenAt:m.last_frozen_at??null,lastSettledAt:m.last_settled_at??null,
  metrics:baseline,challengerMetrics:m.challengers??[],
  fullHistoryExhaustive:complete,periodSince:since,
  uncertaintyMethod:m.method,provider_calls:0,model_promotions:0};
}
