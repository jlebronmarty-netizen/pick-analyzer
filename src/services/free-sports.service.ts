import 'server-only';
import {createHash} from 'node:crypto';
import {cache} from 'react';
import {cohort,issueForecasts,LEAGUES,metrics,resolve,SPORT_LEAGUES,SPORT_NAMES,tennisCohort,type Fixture,type Forecast,type League,type LeagueReport,type Observation,type Sport} from '@/lib/free-sports/model';
import {NFLVERSE_SCHEDULE,parseBsn,parseNflverse,type BsnEvent} from '@/lib/free-sports/sources';
import {runTennisSourcePreflight} from './tennis-source-preflight.service.mjs';
import type {SportModelCard} from '@/lib/sport-model-overview';

const RUNS='free_sports_runs_v1',FORECASTS='free_sports_forecasts_v1',RESULTS='free_sports_results_v1';
const BSN_SELECT='id,start_time,home_team_id,away_team_id,home_team,away_team,status,home_score,away_score,metadata';
type LedgerForecast={event_id:string;start_at:string;forecast:Forecast};
type RunEvidence={history:number;upcoming:Fixture[];sha256:string;records:number;providerCalls:number;maxHttpRequests:number;unpriced:number;modelFacts?:[string,string,string,string,string][]};
type Admin=(typeof import('@/lib/supabase-admin'))['supabaseAdmin'];
const admin=async()=> (await import('@/lib/supabase-admin')).supabaseAdmin;
const hash=(x:Uint8Array|string)=>createHash('sha256').update(x).digest('hex');
const pageSize=500;

// Abort on cap instead of producing stats from a silently truncated ledger.
async function readPages<T>(db:Admin,table:string,columns:string,league:League){
 const rows:T[]=[];
 for(let page=0;page<40;page++){
  const q=db.from(table).select(columns).eq('league',league).order('event_id');
  if(table===RESULTS)q.order('start_at').order('a_id').order('b_id').order('outcome');
  const {data,error}=await q.range(page*pageSize,(page+1)*pageSize-1);
  if(error||!data)throw Error('LEDGER_READ_FAILED');
  rows.push(...data as T[]);
  if(data.length<pageSize)return rows;
 }
 throw Error('LEDGER_PAGE_CAP');
}
async function fetchBody(url:string){
 const signal=AbortSignal.timeout(20000);
 const request={redirect:'manual',cache:'no-store',signal,headers:{Accept:'text/csv'}} as const;
 let providerCalls=1,response=await fetch(url,request);
 if([301,302,303,307,308].includes(response.status)){
  const loc=response.headers.get('location');
  if(!loc)throw Error('SOURCE_INVALID_REDIRECT');
  const redirect=new URL(loc,url);
  if(url!==NFLVERSE_SCHEDULE||redirect.origin!=='https://release-assets.githubusercontent.com'||
     !redirect.pathname.startsWith('/github-production-release-asset/'))throw Error('SOURCE_INVALID_REDIRECT');
  await response.body?.cancel().catch(()=>{});
  providerCalls++;
  response=await fetch(redirect,request);
 }
 if(!response.ok)throw Error('SOURCE_HTTP_'+response.status);
 const cap=8*1024*1024;
 if(Number(response.headers.get('content-length'))>cap||!response.body)throw Error('SOURCE_BODY_LIMIT');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];
 let total=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>cap)throw Error('SOURCE_BODY_LIMIT');chunks.push(value);}
 }finally{await reader.cancel().catch(()=>{});}
 return {body:Buffer.concat(chunks,total),providerCalls};
}
async function collect(db:Admin,league:League,source:string,year:number){
 if(league==='BSN'){
  const {data,error}=await db.from('sport_events').select(BSN_SELECT).eq('sport_key','basketball_bsn').order('id').limit(1000);
  if(error||!data||data.length>=1000)throw Error('BSN_ARCHIVE_UNAVAILABLE_OR_LIMIT');
  const observedAt=new Date().toISOString(),rows=data as BsnEvent[];
  return {observedAt,sha256:hash(JSON.stringify(rows)),events:parseBsn(rows,observedAt),providerCalls:0};
 }
 if(league!=='NFL'||source!==NFLVERSE_SCHEDULE)throw Error('SOURCE_NOT_APPROVED');
 const {body,providerCalls}=await fetchBody(source),observedAt=new Date().toISOString();
 return {observedAt,sha256:hash(body),events:parseNflverse(body.toString('utf8'),observedAt,year),providerCalls};
}
async function runLeague(db:Admin,league:League,clock:Date){
 const slot=new Date(Math.floor(clock.getTime()/14400000)*14400000).toISOString();
 if(league==='ATP')return runTennisSourcePreflight();
 if(league!=='NFL')return {league,state:'WAITING_APPROVED_SOURCE',providerCalls:0};
 const year=clock.getUTCFullYear()-(clock.getUTCMonth()<2?1:0);
 const request={url:NFLVERSE_SCHEDULE,year};
 const claim=await db.from(RUNS).insert({league,slot,source:request.url}).select('id').single();
 if(claim.error?.code==='23505')return {league,state:'SKIPPED_ALREADY_CLAIMED'};
 if(claim.error||!claim.data)throw Error('CLAIM_FAILED');
 const p_run=claim.data.id as number;
 const maxHttpRequests=2;
 try{
  const existing=await readPages<LedgerForecast>(db,FORECASTS,'event_id,start_at,forecast',league);
  const indexed=new Map(existing.map(r=>[r.event_id,r.forecast]));
  const {events,observedAt,sha256,providerCalls}=await collect(db,league,request.url,request.year);
  const issuedAt=new Date().toISOString();
  const predictions=issueForecasts(league,events,observedAt,issuedAt).filter(f=>!indexed.has(f.event.id));
  const results=events.flatMap(e=>{
   const prev=indexed.get(e.id);
   if(!prev)return [];
   const a=e.a.id,b=e.b.id,x=prev.event.a.id,y=prev.event.b.id;
   const changed=e.start!==prev.event.start||!(a===x&&b===y||a===y&&b===x);
   const outcome=changed?'IDENTITY_CHANGED':e.state==='FINAL'?e.winner:e.state==='TIE'||e.state==='EXCLUDED'?e.state:null;
   return outcome?[{event_id:e.id,start_at:e.start,a_id:a,b_id:b,outcome}]:[];
  });
  const upcoming=events.filter(e=>e.state==='PRE'&&e.start>issuedAt&&Date.parse(e.start)<=Date.parse(issuedAt)+(league==='NFL'?10:7)*86400000);
  const evidence:RunEvidence={history:events.filter(e=>e.state==='FINAL').length,upcoming,sha256,records:events.length,providerCalls,maxHttpRequests,unpriced:upcoming.filter(e=>!e.quote).length,
   ...(predictions.length?{modelFacts:events.flatMap((e):[string,string,string,string,string][]=>e.state==='FINAL'&&e.winner&&e.start.slice(0,10)<issuedAt.slice(0,10)?[[e.id,e.start,e.a.id,e.b.id,e.winner]]:[])}:{})};
  const finished=await db.rpc('finish_free_sports_run_v1',{p_run,p_state:'OK',p_observed:observedAt,p_evidence:evidence,p_forecasts:predictions,p_results:results});
  if(finished.error)throw Error('COMMIT_FAILED');
  return {league,state:'OK',providerCalls,history:evidence.history,upcoming:upcoming.length,newForecasts:finished.data};
 }catch(err){
  const code=err instanceof Error&&/^(SOURCE_HTTP_\d+|SOURCE_BODY_LIMIT|[A-Z_]+)$/.test(err.message)?err.message:'SOURCE_OR_LEDGER_FAILED';
  const finished=await db.rpc('finish_free_sports_run_v1',{p_run,p_state:'ERROR',p_observed:null,p_evidence:{code,maxHttpRequests},p_forecasts:[],p_results:[]});
  return {league,state:'ERROR',code:finished.error?'CHECK_RUN_LEDGER':code};
 }
}
export async function runFreeSports(){
 const db=await admin(),clock=new Date();
 const results=await Promise.allSettled(LEAGUES.map(league=>runLeague(db,league,clock)));
 return results.map((r,i)=>r.status==='fulfilled'?r.value:{league:LEAGUES[i],state:'ERROR',code:'CLAIM_FAILED'});
}

export const getFreeLeagueReport=cache(async(league:League):Promise<LeagueReport>=>{
 const now=new Date().toISOString();
 try{
  const db=await admin();
  const [recent,forecasts,results]=await Promise.all([
   db.from(RUNS).select('observed_at,state,evidence').eq('league',league).eq('state','OK').order('id',{ascending:false}).limit(1).maybeSingle(),
   readPages<LedgerForecast>(db,FORECASTS,'event_id,start_at,forecast',league),
   readPages<Observation>(db,RESULTS,'event_id,start_at,a_id,b_id,outcome,observed_at',league)
  ]);
  if(recent.error)throw Error('RUN_READ_FAILED');
  const evidence=recent.data?.evidence as RunEvidence|undefined, observedAt=recent.data?.observed_at as string|undefined;
  const byEvent=new Map<string,Observation[]>();
  for(const r of results){const a=byEvent.get(r.event_id)??[];a.push({...r,observed_at:new Date(r.observed_at).toISOString()});byEvent.set(r.event_id,a);}
  const rows=forecasts.map(f=>resolve(f.forecast,byEvent.get(f.event_id)??[],now));
  const fresh=!!observedAt&&Date.now()-Date.parse(observedAt)<5*3600000;
  const upcoming=fresh?(evidence?.upcoming??[]).filter(e=>e.start>now).map(e=>({...e,quote:null})):[];
  return {league,status:evidence&&!('captureOnly' in evidence)?'AVAILABLE':'WAITING',sourceAt:evidence&&'captureOnly' in evidence?null:observedAt??null,history:evidence?.history??0,upcoming,rows,metrics:metrics(rows)};
 }catch{return {league,status:'UNAVAILABLE',sourceAt:null,history:0,upcoming:[],rows:[],metrics:metrics([])};}
});
export const getFreeSportsReports=cache(async()=>Promise.all(LEAGUES.map(getFreeLeagueReport)));
export const freeSportCards=(reports:LeagueReport[]):SportModelCard[]=>
 (Object.keys(SPORT_LEAGUES) as Sport[]).map(sport=>{
  const leagues=reports.filter(r=>(SPORT_LEAGUES[sport] as readonly League[]).includes(r.league));
  return {key:sport,label:SPORT_NAMES[sport],href:'/sports-shadow/'+sport,classification:'SHADOW / RESEARCH · FREE',metricLabel:'Ganador del partido',
   cohorts:sport==='tennis'?[tennisCohort(leagues)]:leagues.map(cohort)};
 });
