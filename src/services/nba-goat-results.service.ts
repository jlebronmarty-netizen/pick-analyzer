import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NBA_GOAT_POLICY} from '@/lib/nba/goat-provider-policy.mjs';
import {finalGamesFromSchedules,normalizedGameResult,settleGoatContract} from '@/lib/nba/goat-results-core.mjs';
const SPORT='basketball_nba',ORIGIN='CURRENT_ERA_SHADOW',JOB='nba_goat_result_reconcile_v1',SETTLEMENT='nba_goat_statistical_settlement_v1';
function rows(r:any){if(r.error)throw Error('NBA_GOAT_RESULTS_READ_FAILED');return r.data??[];}
function datePR(v:string){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));}
export async function reconcileNbaGoatShadowResults(){
 const started=Date.now();
 const pendingR=await db.from('prediction_history').select('id,game_id,commence_time,home_team,away_team,team,selection,market,line,odds,result,settled_at,manual_adjustment,feature_snapshot').eq('sport_key',SPORT).eq('prediction_origin',ORIGIN).order('commence_time').limit(1000);
 const history=rows(pendingR),goatPending=history.filter((p:any)=>(p.result==null||p.result==='pending')&&!p.settled_at&&!p.manual_adjustment&&p.feature_snapshot?.goatProviderPolicy===NBA_GOAT_POLICY&&p.feature_snapshot?.marketContractEvidence?.statisticalScopeVerified===true);
 if(history.length>=1000)throw Error('NBA_GOAT_RESULTS_HISTORY_SCAN_LIMIT');
 if(!goatPending.length)return {status:'NO_GOAT_PENDING',events_reconciled:0,settled:0,provider_calls:0,database_writes:0};
 const ids=[...new Set(goatPending.map((p:any)=>p.game_id).filter((x:any)=>typeof x==='string'&&x.startsWith('bdl_nba_')))] as string[];
 const dates=[...new Set(goatPending.map((p:any)=>p.commence_time&&Number.isFinite(Date.parse(p.commence_time))?datePR(p.commence_time):null).filter(Boolean))] as string[];
 if(!ids.length||!dates.length)return {status:'NO_PROVIDER_EVENT_IDS',events_reconciled:0,settled:0,provider_calls:0,database_writes:0};
 const [ev,schedules]=await Promise.all([
  db.from('sport_events').select('id,home_team,away_team,start_time,status,metadata').eq('sport_key',SPORT).in('id',ids),
  db.from('nba_market_schedules_v1').select('snapshot_id,date_local,source_received_at,payload').in('date_local',dates).order('source_received_at',{ascending:false}).limit(200),
 ]);
 const events=rows(ev),eventMap=new Map<string,any>(events.map((e:any)=>[e.id,e] as [string,any])),finals=finalGamesFromSchedules(rows(schedules));
 const finalByEvent=new Map<string,any>();
 for(const g of finals){const e=eventMap.get('bdl_nba_'+String(g.id));if(!e)continue;try{finalByEvent.set(e.id,{event:e,result:normalizedGameResult(g,e)});}catch{}}
 if(!finalByEvent.size)return {status:'NO_NEW_FINALS',events_reconciled:0,settled:0,provider_calls:0,database_writes:0};
 const job=await db.from('sports_sync_jobs').insert({job_type:JOB,sport_key:SPORT,league_key:'nba',provider:'balldontlie',status:'running',metadata:{policy:NBA_GOAT_POLICY,settlementVersion:SETTLEMENT,source:'nba_market_schedules_v1'}}).select('id').single();
 if(job.error)throw Error('NBA_GOAT_RESULTS_JOB_START_FAILED');
 let writes=0,settled=0,wins=0,losses=0,pushes=0;const resultIds=new Map<string,string>();
 try{
  for(const item of finalByEvent.values()){
   const meta={...(item.event.metadata??{}),result_source:'balldontlie_schedule_archive',provider_game_id:String(item.result.providerGameId),provider_datetime:item.result.providerDatetime,provider_postseason:item.result.postseason,provider_ist_stage:item.result.istStage,result_reconciled_at:new Date().toISOString()};
   const u=await db.from('sport_events').update({status:'completed',home_score:item.result.homeScore,away_score:item.result.awayScore,overtime:item.result.overtime,metadata:meta}).eq('id',item.event.id).eq('sport_key',SPORT);
   if(u.error)throw Error('NBA_GOAT_EVENT_RESULT_WRITE_FAILED');writes++;
   const gr=await db.from('game_results').upsert({sport_key:SPORT,game_id:item.event.id,home_team:item.event.home_team,away_team:item.event.away_team,home_score:item.result.homeScore,away_score:item.result.awayScore,winner:item.result.winner,commence_time:item.event.start_time},{onConflict:'game_id,sport_key'}).select('id').single();
   if(gr.error||!gr.data?.id)throw Error('NBA_GOAT_GAME_RESULT_WRITE_FAILED');writes++;resultIds.set(item.event.id,gr.data.id);
  }
  for(const p of goatPending){
   const item=finalByEvent.get(p.game_id);if(!item)continue;
   let decision;try{decision=settleGoatContract(p,{homeTeam:item.event.home_team,awayTeam:item.event.away_team,homeScore:item.result.homeScore,awayScore:item.result.awayScore});}catch{continue;}
   const evidence=p.feature_snapshot?.marketContractEvidence??null;
   const upd=await db.from('prediction_history').update({result:decision.outcome,status:decision.outcome,lifecycle_status:'settled',settled_at:new Date().toISOString(),result_id:resultIds.get(p.game_id)??null,settlement_source:'balldontlie_schedule_archive',settlement_version:SETTLEMENT,settlement_details:{statisticalOnly:true,sportsbookSettlement:false,market:p.market,selection:p.team??p.selection,line:p.line,odds:p.odds,actual:decision.actual,marketContractEvidence:evidence,goatProviderPolicy:NBA_GOAT_POLICY}}).eq('id',p.id).eq('prediction_origin',ORIGIN).is('settled_at',null);
   if(upd.error)throw Error('NBA_GOAT_SHADOW_SETTLEMENT_WRITE_FAILED');writes++;settled++;
   if(decision.outcome==='win')wins++;else if(decision.outcome==='loss')losses++;else if(decision.outcome==='push')pushes++;
  }
  const done=await db.from('sports_sync_jobs').update({status:'completed',completed_at:new Date().toISOString(),records_fetched:finalByEvent.size,records_updated:writes,records_inserted:settled,duration_ms:Date.now()-started,metadata:{policy:NBA_GOAT_POLICY,settlementVersion:SETTLEMENT,eventsReconciled:finalByEvent.size,settled,wins,losses,pushes,providerCalls:0,legacyRowsTouched:0}}).eq('id',job.data.id);
  if(done.error)throw Error('NBA_GOAT_RESULTS_JOB_FINALIZE_FAILED');
  return {status:'RECONCILED',events_reconciled:finalByEvent.size,settled,wins,losses,pushes,provider_calls:0,database_writes:writes};
 }catch(e){await db.from('sports_sync_jobs').update({status:'failed',completed_at:new Date().toISOString(),error_count:1,last_error:e instanceof Error?e.message:'NBA_GOAT_RESULTS_FAILED',duration_ms:Date.now()-started}).eq('id',job.data.id);throw e;}
}
