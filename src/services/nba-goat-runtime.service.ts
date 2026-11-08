import 'server-only';
import {createHash} from 'node:crypto';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NBA_GOAT_PROVIDER,NBA_GOAT_POLICY,nbaGoatQuoteChecks,nbaGoatGate,isExactGoatModelMatch} from '@/lib/nba/goat-provider-policy.mjs';
const SPORT='basketball_nba',ORIGIN='CURRENT_ERA_SHADOW';
function rows(r:any){if(r.error)throw Error('NBA_GOAT_READ_FAILED');return r.data??[];}
async function load(){
 const checkedAt=new Date().toISOString(),year=new Date().getUTCMonth()>=9?new Date().getUTCFullYear():new Date().getUTCFullYear()-1,season=`${year}-${String(year+1).slice(-2)}`;
 const [ev,od,st,ph,jobs,archive]=await Promise.all([
 db.from('sport_events').select('id,sport_key,league_key,season,home_team,away_team,start_time,status,metadata').eq('sport_key',SPORT).eq('season',season).gte('start_time',checkedAt).order('start_time').limit(25),
 db.from('sports_odds_snapshots').select('id,event_id,provider,sportsbook,market,outcome,price,line,snapshot_time,provider_timestamp,metadata').eq('sport_key',SPORT).eq('provider',NBA_GOAT_PROVIDER).gte('snapshot_time',new Date(Date.now()-1800000).toISOString()).order('snapshot_time',{ascending:false}).limit(2000),
 db.from('team_stats').select('team_name,season,updated_at').eq('sport_key',SPORT).eq('season',String(year)),
 db.from('prediction_history').select('id,game_id,market,team,line,sportsbook,model_version,result,created_at,prediction_origin').eq('sport_key',SPORT).eq('prediction_origin',ORIGIN).order('id').limit(1000),
 db.from('sports_sync_jobs').select('id,job_type,status,started_at,records_inserted,metadata').eq('sport_key',SPORT).in('job_type',['nba_current_era_shadow_scheduler_canary_v1','nba_goat_shadow_v1']).order('started_at',{ascending:false}).limit(1000),
 db.from('nba_market_sync_runs_v1').select('status,completed_at,summary').order('started_at',{ascending:false}).limit(1),
 ]);
 const events=rows(ev),quotes=rows(od),stats=rows(st),history=rows(ph),runs=rows(jobs),lastArchive=rows(archive)[0]??null;
 if(events.length>=25)throw Error('NBA_GOAT_EVENT_WINDOW_REVIEW_REQUIRED');
 if(history.length>=1000||runs.length>=1000||quotes.length>=2000)throw Error('NBA_GOAT_SCAN_LIMIT_REVIEW_REQUIRED');
 const eventMap=new Map<string,any>(events.map((e:any)=>[e.id,e] as [string,any])),seen=new Set<string>(),candidates:any[]=[];
 for(const q of quotes){const e=eventMap.get(q.event_id);if(!e)continue;const k=[q.event_id,q.market,q.outcome,q.line,q.sportsbook].join('|');if(seen.has(k))continue;seen.add(k);candidates.push({event:e,quote:q,check:nbaGoatQuoteChecks(e,q,checkedAt)});}
 const today=checkedAt.slice(0,10),pending=history.filter((p:any)=>!p.result||p.result==='pending').length,rowsToday=history.filter((p:any)=>String(p.created_at).slice(0,10)===today).length;
 const completed=runs.filter((r:any)=>r.status==='completed'),repaired=completed.filter((r:any)=>r.metadata?.runPurpose==='REPAIRED_RUNTIME_VERIFICATION_RUN').length,canaryRows=completed.reduce((n:number,r:any)=>n+Number(r.records_inserted??r.metadata?.insertedCount??0),0);
 const freshNames=new Set(stats.filter((s:any)=>Number.isFinite(Date.parse(s.updated_at))&&Date.parse(s.updated_at)<=Date.parse(checkedAt)&&Date.parse(checkedAt)-Date.parse(s.updated_at)<=48*3600000).map((s:any)=>s.team_name));
 const missingTeams=[...new Set(events.flatMap((e:any)=>[e.home_team,e.away_team]).filter((name:string)=>!freshNames.has(name)))];
 const enabled=process.env.NBA_CURRENT_ERA_SHADOW_SCHEDULER_ENABLED==='true',continuousEnabled=process.env.NBA_CURRENT_ERA_SHADOW_CONTINUOUS_ENABLED==='true',repairEnabled=process.env.NBA_CURRENT_ERA_SHADOW_REPAIRED_VERIFICATION_ENABLED==='true';
 const priceCount=candidates.filter(c=>c.check.priceEligible).length,contractCount=candidates.filter(c=>c.check.writeEligible).length;
 const gate=nbaGoatGate({enabled,continuousEnabled,repairEnabled,pending,rowsToday,statsCurrent:events.length>0&&missingTeams.length===0,priceCount,contractCount,completedRuns:completed.length,repairedRuns:repaired,canaryRows});
 const status={module:NBA_GOAT_POLICY,provider:NBA_GOAT_PROVIDER,checked_at:checkedAt,season,read_only:true,provider_calls:0,database_writes:0,legacy_provider_fallback:false,scheduler_enabled:enabled,continuous_enabled:continuousEnabled,events:events.length,quotes_examined:candidates.length,fresh_pregame_quotes:priceCount,verified_contract_quotes:contractCount,team_stats_rows:stats.length,missing_current_team_stats:missingTeams,pending_original_shadow:pending,rows_emitted_today:rowsToday,last_archive:lastArchive,gate,classification:gate.allowed?'NBA_GOAT_SHADOW_PREREQUISITES_READY':'NBA_GOAT_ODDS_CONNECTED_MODEL_BLOCKED',issues:candidates.reduce((a:Record<string,number>,c:any)=>{for(const k of [...c.check.issues,...c.check.writeIssues])a[k]=(a[k]??0)+1;return a;},{}),note:'GOAT prices are not predictions. Historical providers and pending outcomes are preserved; no Official Picks or sportsbook settlement.'};
 return {status,candidates,history,runs};
}
export async function getNbaGoatRuntimeStatus(){return (await load()).status;}
export async function runNbaGoatShadowScheduler(){
 const {status,candidates,history}=await load();
 if(!status.gate.allowed)return {...status,read_only:false,predictions_inserted:0,provider_calls:0,finalClassification:status.classification};
 // The existing post-archive cron is the only caller. No duplicate network refresh.
 const slot=Math.floor(Date.now()/1800000),h=createHash('sha256').update(`${NBA_GOAT_POLICY}:${slot}`).digest('hex'),runId=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
 const claim=await db.from('sports_sync_jobs').insert({id:runId,job_type:'nba_goat_shadow_v1',sport_key:SPORT,league_key:'nba',provider:NBA_GOAT_PROVIDER,status:'running',metadata:{policy:NBA_GOAT_POLICY,slot}});
 if(claim.error){if(claim.error.code==='23505')return {...status,finalClassification:'ALREADY_CLAIMED',predictions_inserted:0};throw Error('NBA_GOAT_CLAIM_FAILED');}
 let inserted=0;const reasons:Record<string,number>={};
 try{
  const {generateNbaPredictions}=await import('./nba-prediction-engine.service');
  const {buildNbaCurrentEraShadowPredictionRow}=await import('./nba-current-era-shadow-canary.service');
  const {savePredictionHistory}=await import('./prediction-history.service');
  const result=await generateNbaPredictions({persist:false,limit:25});
  const eventCounts=new Map<string,number>(),marketCounts=new Map<string,number>();for(const p of history){eventCounts.set(p.game_id,(eventCounts.get(p.game_id)??0)+1);const k=p.game_id+'|'+p.market;marketCounts.set(k,(marketCounts.get(k)??0)+1);}
  for(const c of candidates){if(inserted>=status.gate.perRunWriteCap)break;if(!c.check.writeEligible)continue;
   const e=c.event,q=c.quote,key=e.id+'|'+q.market;if((eventCounts.get(e.id)??0)>=6||(marketCounts.get(key)??0)>=3)continue;
   if(history.some((p:any)=>p.game_id===e.id&&p.market===q.market&&p.team===q.outcome&&(p.line??null)===(q.line??null)&&p.sportsbook===q.sportsbook))continue;
   const model=result.predictions.find(p=>isExactGoatModelMatch(p,e,q));if(!model){reasons.EXACT_MODEL_OUTPUT_UNAVAILABLE=(reasons.EXACT_MODEL_OUTPUT_UNAVAILABLE??0)+1;continue;}
   const refreshed=nbaGoatQuoteChecks(e,q);if(!refreshed.writeEligible)continue;
   const row=buildNbaCurrentEraShadowPredictionRow({event:e,odds:q,generatedAt:new Date().toISOString(),modelPrediction:model});
   row.feature_snapshot={...row.feature_snapshot,goatProviderPolicy:NBA_GOAT_POLICY,marketContractEvidence:q.metadata};
   const saved=await savePredictionHistory([row]);inserted+=saved.saved??0;if(saved.saved){eventCounts.set(e.id,(eventCounts.get(e.id)??0)+1);marketCounts.set(key,(marketCounts.get(key)??0)+1);}
  }
  const summary={policy:NBA_GOAT_POLICY,provider:NBA_GOAT_PROVIDER,providerCalls:0,insertedCount:inserted,reasons,runPurpose:status.gate.continuous?'CONTINUOUS_SHADOW_EVIDENCE_RUN':status.gate.repair?'REPAIRED_RUNTIME_VERIFICATION_RUN':'GOAT_CANARY',officialPickDelta:0,modelFormulaChanged:false};
  const saved=await db.from('sports_sync_jobs').update({status:'completed',completed_at:new Date().toISOString(),records_inserted:inserted,metadata:summary}).eq('id',runId);if(saved.error)throw Error('NBA_GOAT_AUDIT_FAILED');
  return {success:true,finalClassification:inserted?'NBA_GOAT_SHADOW_SUCCESS':'NO_EXACT_MODEL_MATCH',...summary};
 }catch{await db.from('sports_sync_jobs').update({status:'failed',completed_at:new Date().toISOString(),last_error:'NBA_GOAT_SHADOW_EXECUTION_FAILED',records_inserted:inserted}).eq('id',runId);throw Error('NBA_GOAT_SHADOW_EXECUTION_FAILED');}
}
