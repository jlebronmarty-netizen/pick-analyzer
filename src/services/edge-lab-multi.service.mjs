import 'server-only';
import {createClient} from '@supabase/supabase-js';import {randomUUID} from 'node:crypto';
import {COHORT_MULTI,digest,normalizeTtResults,canonicalTtHistory,ttForecasts,ttOutcome,parseMlbSchedule,mlbForecasts,mlbOutcome,multiMetrics} from '../lib/edge-lab/multisport.mjs';
const GATEWAY='https://sports-edge-hub.vercel.app/api/table-tennis/source-gateway';
const T={sources:'edge_lab_multi_sources_v1',forecasts:'edge_lab_multi_forecasts_v1',outcomes:'edge_lab_multi_outcomes_v1',finals:'edge_lab_tt_finals_v1',runs:'edge_lab_multi_runs_v1',locks:'edge_lab_multi_locks_v1',budget:'edge_lab_tt_request_budget_v1'};
function dbClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||new URL(url).hostname!=='ynuocvexviorgdjrfthw.supabase.co'||!key)throw Error('DESTINATION_NOT_CONFIGURED');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
function checked(r,stage){if(r.error)throw Error('DB_'+stage+'_'+(/^[A-Z0-9]+$/.test(r.error.code??'')?r.error.code:'FAILED'));return r.data;}
async function readAll(db,table,sport){if(!Object.values(T).includes(table))throw Error('INVALID_TABLE');let rows=[];for(let offset=0;offset<20000;offset+=500){let q=db.from(table).select('*').order('id').range(offset,offset+499);if(sport)q=q.eq('sport',sport);const page=checked(await q,'READ');rows.push(...page);if(page.length<500)return rows;}throw Error('READ_LIMIT_REACHED');}
async function insertRows(db,table,rows,conflict='id'){let inserted=0;for(let i=0;i<rows.length;i+=100)inserted+=checked(await db.from(table).upsert(rows.slice(i,i+100),{onConflict:conflict,ignoreDuplicates:true}).select('id'),'INSERT').length;return inserted;}
export async function gatewayRequest(request,action,page=1){
 const token=request.headers.get('x-vercel-oidc-token');if(!token)throw Error('SERVICE_IDENTITY_UNAVAILABLE');
 const r=await fetch(GATEWAY,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(24000),headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({action,page})});
 const text=await r.text();if(text.length>3200000)throw Error('GATEWAY_RESPONSE_TOO_LARGE');let b;try{b=JSON.parse(text);}catch{throw Error('GATEWAY_NOT_JSON');}if(!r.ok||!['CONFIGURED','SOURCE_RETRIEVED'].includes(b.status))throw Error(/^[A-Z0-9_]+$/.test(b.status??'')?b.status:'GATEWAY_FAILED');return b;
}
export async function checkTtSource(request){try{const b=await gatewayRequest(request,'health');return {status:b.status,checked_at:b.checked_at,provider:b.provider,database_dependency:b.database_dependency,provider_calls:0};}catch(e){return {status:e.message,provider_calls:0,available:false};}}
async function paidRead(db,request,action,page,summary){const budget=checked(await db.rpc('edge_lab_tt_claim_request_v1'),'BUDGET');summary.local_budget=budget;summary.provider_attempts++;return gatewayRequest(request,action,page);}
async function settle(db,rows,existingOutcomes,resolve,summary){const done=new Set(existingOutcomes.map(x=>x.forecast_id));for(const f of rows){if(f.status==='ABSTAIN'||done.has(f.id)||Date.parse(f.scheduled_at)>Date.now())continue;const result=resolve(f);if(result.status==='PENDING'){summary.pending_without_final=(summary.pending_without_final??0)+1;continue;}
 summary.outcomes_inserted+=await insertRows(db,T.outcomes,[{id:f.id,forecast_id:f.id,status:result.status,checked_at:new Date().toISOString(),actual:typeof result.actual==='number'?result.actual:null,absolute_error:result.absolute_error??null,payload:{...result,statistical_only:true,sportsbook_settlement:false}}],'forecast_id');}}
async function collectTt(db,request,summary){
 const health=await gatewayRequest(request,'health');summary.provider_configured=health.status==='CONFIGURED';
 let allIncoming=[];for(let page=1;page<=2;page++){
  if(page>1)await new Promise(r=>setTimeout(r,1200));const response=await paidRead(db,request,'results',page,summary),parsed=normalizeTtResults(response.data,response.received_at);
  allIncoming.push(...parsed.rows);summary.result_pages.push({page,received:parsed.received,normalized:parsed.rows.length,rejected:parsed.rejected,has_next:parsed.hasNextPage,pagination_verified:parsed.paginationVerified});summary.provider_rate_window=response.rate_window;
  if(!parsed.paginationVerified)summary.warnings.push('RESULT_PAGINATION_UNVERIFIED');if(!parsed.hasNextPage)break;if(page===2)summary.warnings.push('RESULT_WINDOW_LIMITED_TO_200');
 }
 const incoming=allIncoming.map(r=>({id:digest([r.source,r.sourceMatchId,r.contentDigest]),source_event_id:r.sourceMatchId,source:r.source,scheduled_at:r.scheduledAt,captured_at:r.capturedAt,content_digest:r.contentDigest,payload:r}));summary.finals_inserted=await insertRows(db,T.finals,incoming);
 const stored=await readAll(db,T.finals),history=canonicalTtHistory(stored.map(r=>r.payload));summary.history_finals=history.finals.length;summary.history_conflicts=history.conflicts;summary.history_latest=history.finals.length?history.finals.map(r=>r.scheduledAt).sort().at(-1):null;
 const existing=await readAll(db,T.forecasts,'TT'),outcomes=await readAll(db,T.outcomes);
 await settle(db,existing,outcomes,f=>ttOutcome(f,history.finals),summary);
 const response=await paidRead(db,request,'prematch',1,summary),asOf=new Date().toISOString();
 const rawEvents=Array.isArray(response.data.events)?response.data.events:Array.isArray(response.data.results)?response.data.results:null;if(!rawEvents)throw Error('TT_PREMATCH_SCHEMA_CHANGED');
 const minimal=rawEvents.map(e=>({eventId:e.eventId??e.id,home:e.home,away:e.away,startTime:e.startTime,league:e.league,gameStatus:e.gameStatus,inPlay:e.inPlay,isLive:e.isLive,live:e.live,markets:(e.markets??[]).filter(m=>m.period==='FULL_TIME').map(m=>({canonicalMarket:m.canonicalMarket??m.type,period:m.period,line:m.line,suspended:m.suspended}))}));
 const input={source_url:response.source_url,provider_received_at:response.received_at,prematch_digest:digest(response.data),events:minimal,history_ids:stored.map(r=>r.id),history_conflicts:history.conflicts,pagination:response.data.pagination??null};const sourceId=digest(input);
 await insertRows(db,T.sources,[{id:sourceId,sport:'TT',source:'PulseScore / Tipsport finals / NetBet prematch',captured_at:asOf,payload:input}]);
 const forecasts=ttForecasts({events:minimal,pagination:response.data.pagination},history.finals,asOf,sourceId);summary.source_events=forecasts.source_events;summary.skipped=forecasts.skipped;summary.prematch_has_next=forecasts.hasNextPage;
 summary.forecasts_inserted=await insertRows(db,T.forecasts,forecasts.rows);summary.forecasts_reused=forecasts.rows.length-summary.forecasts_inserted;summary.status_counts=Object.fromEntries(['FORECAST','PROJECTION','ABSTAIN'].map(s=>[s,forecasts.rows.filter(r=>r.status===s).length]));
 if(forecasts.hasNextPage)summary.warnings.push('PREMATCH_WINDOW_LIMITED_TO_100');if(history.conflicts.length)summary.warnings.push('CONFLICTED_FINALS_EXCLUDED');if(forecasts.skipped.length)summary.warnings.push('SOME_EVENTS_NOT_VERIFIABLE');
 if(!history.finals.length&&allIncoming.length===0)summary.warnings.push('NO_VERIFIED_FINALS_AVAILABLE');
 return summary.warnings.some(w=>!['RESULT_WINDOW_LIMITED_TO_200','PREMATCH_WINDOW_LIMITED_TO_100'].includes(w))?'PARTIAL':'SUCCESS';
}
async function getMlb(url){if(!url.startsWith('https://statsapi.mlb.com/api/v1/schedule?'))throw Error('SOURCE_NOT_ALLOWED');const r=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('MLB_SOURCE_HTTP_'+r.status);const text=await r.text();if(text.length>12000000)throw Error('MLB_SOURCE_TOO_LARGE');return {games:parseMlbSchedule(JSON.parse(text)),digest:digest(text),url};}
async function collectMlb(db,summary){
 const now=new Date(),today=now.toISOString().slice(0,10),end=new Date(now.getTime()+7*86400000).toISOString().slice(0,10),year=now.getUTCFullYear();
 const schedule=await getMlb(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${today}&endDate=${end}`);summary.provider_attempts++;summary.schedule_games=schedule.games.length;summary.coverage=[today,end];
 const existing=await readAll(db,T.forecasts,'MLB'),outcomes=await readAll(db,T.outcomes),done=new Set(outcomes.map(r=>r.forecast_id));
 const needsHistory=schedule.games.some(g=>g.state==='Preview'&&g.gameType==='R')||existing.some(f=>f.status!=='ABSTAIN'&&!done.has(f.id));
 const history=needsHistory?await getMlb(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=${year}&gameType=R`):{games:[],digest:null};if(needsHistory)summary.provider_attempts++;summary.history_games=history.games.length;
 const input={source:'MLB StatsAPI',schedule_url:schedule.url,schedule_digest:schedule.digest,coverage:summary.coverage,schedule:schedule.games,regular_history:history.games,history_digest:history.digest};const sourceId=digest(input),asOf=new Date().toISOString();
 await insertRows(db,T.sources,[{id:sourceId,sport:'MLB',source:'MLB StatsAPI',captured_at:asOf,payload:input}]);
 const batch=mlbForecasts(schedule.games,history.games,asOf,sourceId);summary.forecasts_inserted=await insertRows(db,T.forecasts,batch.rows);summary.forecasts_reused=batch.rows.length-summary.forecasts_inserted;summary.skipped=batch.skipped;summary.status_counts=Object.fromEntries(['FORECAST','PROJECTION','ABSTAIN'].map(s=>[s,batch.rows.filter(r=>r.status===s).length]));
 const byId=new Map([...history.games,...schedule.games].map(g=>[g.id,g]));await settle(db,existing,outcomes,f=>mlbOutcome(f,byId.get(f.event_id.replace('mlb:',''))),summary);
 summary.operational_state=schedule.games.length?'CALENDAR_RETRIEVED':'NO_SCHEDULED_GAMES_IN_WINDOW';summary.phase='REGULAR_SEASON_ONLY';return batch.skipped.length?'PARTIAL':'SUCCESS';
}
export async function runMultiSports(request){
 if(process.env.VERCEL_ENV!=='production')throw Error('PRODUCTION_ONLY');const db=dbClient(),results=[];
 for(const sport of ['TT','MLB']){
  if(sport==='MLB' && process.env.MLB_OFFSEASON_PAUSED==='true'){results.push({sport,status:'OFFSEASON_PAUSED',provider_attempts:0});continue;}
  const id=randomUUID(),claimed=checked(await db.rpc('edge_lab_multi_claim_v1',{p_sport:sport,p_run:id}),'CLAIM');if(!claimed){results.push({sport,status:'NOT_DUE_OR_LOCKED'});continue;}
  const summary={cohort:COHORT_MULTI,sport,provider_attempts:0,result_pages:[],forecasts_inserted:0,forecasts_reused:0,outcomes_inserted:0,warnings:[],errors:[],nhl_touched:false,official_picks_written:false};let status='FAILED';
  try{status=sport==='TT'?await collectTt(db,request,summary):await collectMlb(db,summary);}catch(e){const error=/^[A-Z0-9_]+$/.test(e.message)?e.message:'MULTISPORT_OPERATION_FAILED';summary.errors.push(error);status=/KEY_MISSING|UNAUTHORIZED|AUTH_FAILED|BUDGET|QUOTA|PLAN_RESTRICTED|IDENTITY_UNAVAILABLE/.test(error)?'BLOCKED':'FAILED';}
  finally{checked(await db.from(T.runs).update({status,finished_at:new Date().toISOString(),summary}).eq('id',id),'FINISH');checked(await db.from(T.locks).update({lease_until:new Date().toISOString()}).eq('sport',sport).eq('run_id',id),'RELEASE');}
  results.push({sport,status,...summary});
 }
 return {checked_at:new Date().toISOString(),results};
}
export async function readMultiSports(){
 const db=dbClient(),forecasts=await readAll(db,T.forecasts),outcomes=await readAll(db,T.outcomes),byId=new Map(outcomes.map(r=>[r.forecast_id,r]));
 const rows=forecasts.map(r=>({...r,outcome:byId.get(r.id)??null})).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)||a.market.localeCompare(b.market));
 const runs=checked(await db.from(T.runs).select('*').order('started_at',{ascending:false}).limit(15),'RUNS');const budget=checked(await db.from(T.budget).select('*').order('month',{ascending:false}).limit(1),'BUDGET_READ');
 const days=[...new Set(rows.map(r=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'}).format(new Date(r.emitted_at))))];
 return {cohort:COHORT_MULTI,checked_at:new Date().toISOString(),rows,metrics:multiMetrics(rows),daily:days.flatMap(date=>multiMetrics(rows.filter(r=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'}).format(new Date(r.emitted_at))===date)).map(m=>({date,...m}))),runs,budget,states:['TT','MLB'].map(sport=>({sport,last_run:runs.find(r=>r.sport===sport)??null})),nhl:'EXCLUDED_OTHER_CHAT',ncaaf:'FROZEN_PYTHON_ENGINE_REVIEW_PENDING'};
}
