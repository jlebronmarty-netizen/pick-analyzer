import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {readNbaDecisionBoard} from '@/services/nba-decision-board.service';
import {planNbaShadowFreeze,settleNbaShadowForecast,summarizeShadowLearning} from '@/lib/nba/decision-learning-core.mjs';

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
 const latest=new Date(now.getTime()-3*60*60000).toISOString();
 const earliest=new Date(now.getTime()-8*24*3600000).toISOString();
 const r=await db.from('nba_decision_shadow_forecasts_v1')
  .select('forecast_id,model_version,game_id,game_start_at,game_date_local,market,period,side,statistic,player_id,line,projection')
  .lte('game_start_at',latest).gte('game_start_at',earliest)
  .order('game_start_at',{ascending:false}).limit(1000).abortSignal(AbortSignal.timeout(11000));
 const frozen=rows(r,'NBA_DECISION_FORECASTS_UNAVAILABLE');
 if(frozen.length>=1000)return {status:'SHADOW_EVALUATION_SCAN_LIMIT',provider_calls:0,writes:0};
 if(!frozen.length)return {status:'NO_FROZEN_SHADOW_ROWS',provider_calls:0,writes:0};
 const existing=new Set<string>();
 for(let i=0;i<frozen.length;i+=100){
  const ids=frozen.slice(i,i+100).map((x:any)=>x.forecast_id);
  const t=await db.from('nba_decision_shadow_outcomes_v1').select('forecast_id').in('forecast_id',ids)
    .abortSignal(AbortSignal.timeout(8000));
  for(const row of rows(t,'NBA_DECISION_OUTCOME_EXISTING_READ_FAILED'))existing.add(row.forecast_id);
 }
 const pending=frozen.filter((f:any)=>!existing.has(f.forecast_id)).slice(0,350);
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
   provider_calls:0,official_model_writes:0};
}
export async function readNbaDecisionLearningStatus(){
 const [f,o]=await Promise.all([
  db.from('nba_decision_shadow_forecasts_v1')
   .select('forecast_id,model_version,market,period,game_id').order('inserted_at',{ascending:false}).limit(1000),
  db.from('nba_decision_shadow_outcomes_v1')
   .select('forecast_id,actual,absolute_error,statistical_result').order('settled_at',{ascending:false}).limit(1000)
 ]);
 const forecasts=rows(f,'NBA_DECISION_SHADOW_STATUS_FORECASTS'),outcomes=rows(o,'NBA_DECISION_SHADOW_STATUS_OUTCOMES');
 return {version:'NBA_DECISION_STATISTICAL_SHADOW_V1',frozenRowsSeen:forecasts.length,outcomesSeen:outcomes.length,
  metrics:summarizeShadowLearning(forecasts,outcomes),
  fullHistoryExhaustive:forecasts.length<1000&&outcomes.length<1000,
  provider_calls:0,model_promotions:0};
}
