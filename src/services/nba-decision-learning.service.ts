import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {readNbaDecisionBoard} from '@/services/nba-decision-board.service';
import {planNbaShadowFreeze,settleNbaShadowForecast} from '@/lib/nba/decision-learning-core.mjs';

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
async function loadFinal(gameId:number,day:string){
 const response=await db.from('nba_market_schedules_v1').select('snapshot_id,source_received_at,payload')
  .eq('date_local',day).order('source_received_at',{ascending:false}).limit(25)
  .abortSignal(AbortSignal.timeout(10000));
 const evidence=rows(response,'NBA_DECISION_FINAL_SOURCE_UNAVAILABLE');
 for(const e of evidence){
  const final=(e.payload?.data?.games??[]).find((g:any)=>Number(g?.id)===gameId&&g?.status_state==='final');
  if(final&&new Date(e.source_received_at).getTime()>Date.parse(final.datetime))
   return {game:final,receivedAt:e.source_received_at,snapshotId:e.snapshot_id};
 }
 return null;
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
 if(!pending.length)return {status:'ALL_FROZEN_RESULTS_ALREADY_SETTLED',provider_calls:0,writes:0};
 const gameMap=new Map<string,any>();
 for(const f of pending){
  const key=f.game_date_local+'|'+f.game_id;
  if(!gameMap.has(key))gameMap.set(key,await loadFinal(Number(f.game_id),f.game_date_local));
 }
 const wanted=[...new Set(pending.filter((f:any)=>f.market==='props').map((f:any)=>Number(f.player_id)).filter(Number.isSafeInteger))];
 const games=[...new Set(pending.filter((f:any)=>f.market==='props').map((f:any)=>Number(f.game_id)).filter(Number.isSafeInteger))];
 const playerRows:any[]=[];
 if(wanted.length&&games.length){
  const t=await db.from('nba_goat_player_game_research_v1')
    .select('provider_game_id,player_id,source_captured_at,pts,reb,ast,fg3m')
    .in('provider_game_id',games).in('player_id',wanted)
    .limit(1000).abortSignal(AbortSignal.timeout(10000));
  playerRows.push(...rows(t,'NBA_DECISION_PLAYER_RESULT_UNAVAILABLE'));
 }
 const results=[];
 for(const f of pending){
  const final=gameMap.get(f.game_date_local+'|'+f.game_id);
  if(!final)continue;
  const stat=f.market==='props'?playerRows.find(x=>Number(x.player_id)===Number(f.player_id)&&Number(x.provider_game_id)===Number(f.game_id)):null;
  const out=settleNbaShadowForecast(f,{game:final.game,sourceReceivedAt:final.receivedAt,
    playerStat:stat??null,playerStatReceivedAt:stat?.source_captured_at??null});
  if(out)results.push({...out,evidence:{...out.evidence,source_snapshot_id:final.snapshotId}});
 }
 if(!results.length)return {status:'RESULTS_NOT_ARCHIVED_YET',pending:pending.length,provider_calls:0,writes:0};
 const attempts=await writeIgnoreDuplicates('nba_decision_shadow_outcomes_v1',results,'forecast_id');
 return {status:'STATISTICAL_OUTCOMES_PERSISTED',pending_seen:pending.length,
   attempted_idempotent_rows:attempts,awaiting_final_or_player_stats:pending.length-results.length,
   queue_pending_checked:pending.length,
   provider_calls:0,official_model_writes:0};
}
export async function readNbaDecisionLearningStatus(){
 const since=new Date(Date.now()-90*86400000).toISOString();
 const result=await db.rpc('read_nba_decision_learning_metrics_v1',{p_since:since})
   .abortSignal(AbortSignal.timeout(15000));
 if(result.error||!result.data||typeof result.data!=='object')
  throw new Error('NBA_DECISION_LEARNING_METRICS_UNAVAILABLE');
 const m=result.data;
 return {version:'NBA_DECISION_STATISTICAL_SHADOW_V2',status:m.status,
  frozenRowsSeen:Number(m.frozen_rows??0),outcomesSeen:Number(m.outcomes_rows??0),
  lastFrozenAt:m.last_frozen_at??null,lastSettledAt:m.last_settled_at??null,
  metrics:m.baseline??[],challengerMetrics:m.challengers??[],
  fullHistoryExhaustive:true,periodSince:since,
  uncertaintyMethod:m.method,provider_calls:0,model_promotions:0};
}
