import 'server-only';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {BASE,BATCH_SOURCE,SEASONS,TARGET_SEASONS,envelope,freeSeasonRange,auditGames,auditTeamStats,auditPlayers,buildTasks} from '../../scripts/bsn-free/archive-contract.mjs';
const VERSION='BSN_APISPORTS_ARCHIVE_V3_FREE_2022_2024';
const TABLE='free_sports_runs_v1',CAP=20;
const admin=async()=> (await import('../lib/supabase-admin')).supabaseAdmin;
export function bsnKeyState(){
 const key=process.env.BSN_APISPORTS_KEY?.trim();
 if(!key)return 'MISSING';
 if(/[\r\n]/.test(key))return 'INVALID_HEADER';
 try{new Headers({'x-apisports-key':key});return 'CONFIGURED';}catch{return 'INVALID_HEADER';}
}
async function ledger(db){
 const rows=[];
 for(let i=0;i<20;i++){
  const r=await db.from(TABLE).select('id,slot,source,state,code:evidence->>code').eq('league','BSN').order('id').range(i*500,i*500+499);
  if(r.error||!r.data)throw Error('ARCHIVE_LEDGER_UNAVAILABLE');rows.push(...r.data);
  if(r.data.length<500)return rows;
 }throw Error('ARCHIVE_LEDGER_CAP');
}
async function payload(db,row){
 const r=await db.from(TABLE).select('evidence').eq('id',row.id).single();
 if(r.error||!r.data?.evidence?.payloadGzip)throw Error('ARCHIVE_PAYLOAD_MISSING');
 const buffer=gunzipSync(Buffer.from(r.data.evidence.payloadGzip,'base64'));
 if(createHash('sha256').update(buffer).digest('hex')!==r.data.evidence.sha256)throw Error('ARCHIVE_HASH_MISMATCH');
 return JSON.parse(buffer.toString('utf8'));
}
async function context(db,rows){
 const catalog=rows.find(r=>r.source===BASE+'/leagues?id=76'&&r.state==='OK');
 let seasons=[];const games=[];
 if(catalog){
  const leagues=envelope(await payload(db,catalog));
  const league=leagues.find(r=>r.id===76&&r.country?.code==='PR');
  if(!league||!Array.isArray(league.seasons))throw Error('BSN_CATALOG_INVALID');
  seasons=SEASONS.filter(y=>league.seasons.some(s=>Number(s.season)===y));
 }
 const ranges=[],planErrors=new Set();
 for(const row of rows.filter(r=>r.state==='ERROR'&&['PROVIDER_REPORTED_ERRORS','FREE_SEASON_UNAVAILABLE'].includes(r.code))){
  const prefix=BASE+'/games?league=76&season=';
  if(!row.source.startsWith(prefix))continue;
  const season=Number(row.source.slice(prefix.length));
  if(!SEASONS.includes(season))continue;
  const range=freeSeasonRange(await payload(db,row),season);
  if(range){ranges.push(range);planErrors.add(row.id);}
 }
 const accessibleSeasons=TARGET_SEASONS.filter(y=>seasons.includes(y)&&ranges.every(r=>y>=r.from&&y<=r.to));
 const planExcludedSeasons=TARGET_SEASONS.filter(y=>ranges.some(r=>y<r.from||y>r.to));
 for(const year of accessibleSeasons){
  const row=rows.find(r=>r.source===BASE+'/games?league=76&season='+year&&r.state==='OK');
  if(row)games.push(...auditGames(envelope(await payload(db,row)),year).accepted);
 }
 return {seasons,accessibleSeasons,planExcludedSeasons,planErrors,games};
}
function requiresReview(rows,ctx){
 return rows.some(r=>{
  if(r.state!=='ERROR'||ctx.planErrors.has(r.id))return false;
  if(r.source!==BATCH_SOURCE)return true;
  if(r.code==='PROVIDER_RESERVE_REACHED')return false;
  // Recognize the original stopped batch only when its exact child receipt
  // supplies the verified free-plan season denial. Leave both receipts intact.
  return !['PROVIDER_REPORTED_ERRORS','FREE_SEASON_UNAVAILABLE'].includes(r.code)||!rows.some(child=>{
   const offset=Date.parse(child.slot)-Date.parse(r.slot);
   return ctx.planErrors.has(child.id)&&offset>0&&offset<=CAP;
  });
 });
}
async function finish(db,id,state,evidence,observed=null){
 const r=await db.rpc('finish_free_sports_run_v1',{p_run:id,p_state:state,p_observed:observed,p_evidence:evidence,p_forecasts:[],p_results:[]});
 if(r.error)throw Error('ARCHIVE_COMMIT_FAILED');
}
const safe=e=>e?.name==='TimeoutError'?'SOURCE_TIMEOUT':e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:'SOURCE_TRANSPORT_ERROR';
async function fetchLimited(url,key){
 if(!url.startsWith(BASE+'/'))throw Error('SOURCE_NOT_ALLOWED');
 const r=await fetch(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(25000),headers:{Accept:'application/json','x-apisports-key':key}});
 if(!r.ok){await r.body?.cancel().catch(()=>{});return {httpStatus:r.status};}
 if(!r.body||Number(r.headers.get('content-length'))>8388608)throw Error('SOURCE_BODY_LIMIT');
 const reader=r.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8388608)throw Error('SOURCE_BODY_LIMIT');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const buffer=Buffer.concat(chunks,size);
 if(buffer.includes(Buffer.from(key)))throw Error('SOURCE_SECRET_ECHO');
 const remaining=r.headers.get('x-ratelimit-requests-remaining');
 return {httpStatus:r.status,buffer,remaining:remaining!==null&&/^\d+$/.test(remaining)?Number(remaining):null};
}
export async function runBsnArchive({clock=new Date(),pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(bsnKeyState()!=='CONFIGURED')return {status:bsnKeyState(),providerCalls:0};
 const db=await admin(),before=await ledger(db);
 if(before.some(r=>r.state==='RUNNING'))return {status:'INTERRUPTED_RECEIPT_REQUIRES_REVIEW',providerCalls:0};
 const ctx=await context(db,before),attempted=new Set(before.map(r=>r.source));
 if(requiresReview(before,ctx))return {status:'SOURCE_OR_QUOTA_REVIEW_REQUIRED',providerCalls:0};
 const today=clock.toISOString().slice(0,10);
 if(before.some(r=>r.source===BATCH_SOURCE&&r.code==='PROVIDER_RESERVE_REACHED'&&r.slot.startsWith(today)))return {status:'PROVIDER_RESERVE_REACHED',providerCalls:0};
 const pending=buildTasks(ctx.seasons.length?ctx.accessibleSeasons:TARGET_SEASONS,ctx.games).filter(t=>!attempted.has(t.url));
 if(ctx.planExcludedSeasons.length===TARGET_SEASONS.length)return {status:'TARGET_SEASONS_NOT_IN_FREE_PLAN',providerCalls:0,modelActive:false};
 if(!pending.length)return {status:'CURRENT_QUEUE_CAPTURED_REVIEW_REQUIRED',providerCalls:0,modelActive:false};
 // Exactly three disjoint 8h slots/day; each reserves 20 calls. A concurrent
 // worker loses the unique claim before sending a request. Crash => review.
 const base=Math.floor(clock.getTime()/28800000)*28800000,slot=new Date(base).toISOString();
 const claim=await db.from(TABLE).insert({league:'BSN',slot,source:BATCH_SOURCE}).select('id').single();
 if(claim.error?.code==='23505')return {status:'BATCH_ALREADY_CLAIMED',providerCalls:0};
 if(claim.error||!claim.data)throw Error('ARCHIVE_CLAIM_FAILED');
 const batch={captureOnly:true,sourceVersion:VERSION,reservedCalls:CAP,providerCalls:0,forecastsIssued:0,completed:0,failures:0};
 let batchCode=null;
 try{
  for(let i=0;i<Math.min(CAP,pending.length);i++){
   if(i)await pause(6500);
   const t=pending[i];
   const receipt=await db.from(TABLE).insert({league:'BSN',slot:new Date(base+i+1).toISOString(),source:t.url}).select('id').single();
   if(receipt.error||!receipt.data)throw Error('REQUEST_CLAIM_FAILED');
   const evidence={captureOnly:true,sourceVersion:VERSION,kind:t.kind,season:t.season??null,providerCalls:1,forecastsIssued:0};
   let observed=null,state='ERROR',stop=false;
   batch.providerCalls++;
   try{
    const response=await fetchLimited(t.url,process.env.BSN_APISPORTS_KEY.trim());
    evidence.httpStatus=response.httpStatus;
    if(!response.buffer)throw Error('HTTP_'+response.httpStatus);
    observed=new Date().toISOString();
    evidence.sha256=createHash('sha256').update(response.buffer).digest('hex');
    evidence.payloadGzip=gzipSync(response.buffer).toString('base64');
    const body=JSON.parse(response.buffer.toString('utf8'));
    const range=t.kind==='games'?freeSeasonRange(body,t.season):null;
    if(range){evidence.audit={freeSeasonRange:range};throw Error('FREE_SEASON_UNAVAILABLE');}
    const records=envelope(body);
    evidence.records=records.length;
    if(t.kind==='leagues'){
     if(!records.some(r=>r.id===76&&r.country?.code==='PR'&&Array.isArray(r.seasons)))throw Error('BSN_CATALOG_INVALID');
     evidence.audit={seasons:records.find(r=>r.id===76).seasons.map(s=>s.season)};
    }else if(t.kind==='games'){
     const audit=auditGames(records,t.season);evidence.audit={accepted:audit.accepted.length,excluded:audit.excluded,coverageCertified:false};
    }else evidence.audit=t.kind==='teams'?auditTeamStats(records,t.games):auditPlayers(records,t.games);
    evidence.quotaRemaining=response.remaining;
    if(response.remaining!==null&&response.remaining<=10)stop=true;
    state='OK';batch.completed++;
   }catch(err){evidence.code=safe(err);batch.failures++;stop=true;}
   await finish(db,receipt.data.id,state,evidence,observed);
   if(stop){batchCode=evidence.code??'PROVIDER_RESERVE_REACHED';break;}
  }
 }catch(err){batchCode=safe(err);}
 batch.code=batchCode;
 await finish(db,claim.data.id,batchCode?'ERROR':'OK',batch,new Date().toISOString());
 return {status:batchCode??'BATCH_CAPTURED',providerCalls:batch.providerCalls,completed:batch.completed,failures:batch.failures,modelActive:false};
}
export async function getBsnArchiveHealth(){
 const configuration=bsnKeyState();
 try{
  const db=await admin(),rows=await ledger(db),ctx=await context(db,rows),attempted=new Set(rows.map(r=>r.source));
  const tasks=buildTasks(ctx.seasons.length?ctx.accessibleSeasons:TARGET_SEASONS,ctx.games),today=new Date().toISOString().slice(0,10);
  const remainingTasks=tasks.filter(t=>!attempted.has(t.url)).length;
  const roots=rows.filter(r=>r.source===BATCH_SOURCE);
  const last=roots.at(-1);
  return {status:rows.some(r=>r.state==='RUNNING')?'RUNNING_OR_INTERRUPTED':requiresReview(rows,ctx)?'REVIEW_REQUIRED':ctx.planExcludedSeasons.length===TARGET_SEASONS.length?'TARGET_SEASONS_NOT_IN_FREE_PLAN':ctx.games.length?(remainingTasks?'ARCHIVE_IN_PROGRESS':'ARCHIVE_CAPTURED_REVIEW_PENDING'):'WAITING_FIRST_CAPTURE',
   configuration,targetSeasons:TARGET_SEASONS,seasons:ctx.seasons,accessibleSeasons:ctx.accessibleSeasons,planExcludedSeasons:ctx.planExcludedSeasons,games:ctx.games.length,bySeason:ctx.accessibleSeasons.map(season=>({season,acceptedFinals:ctx.games.filter(g=>g.season===season).length})),
   requests:rows.filter(r=>r.source!==BATCH_SOURCE).length,failedRequests:rows.filter(r=>r.source!==BATCH_SOURCE&&r.state==='ERROR').length,
   remainingTasks,planDeniedRequests:ctx.planErrors.size,lastBatchAt:last?.slot??null,lastCode:last?.code??null,
   reservedToday:CAP*roots.filter(r=>r.slot.slice(0,10)===today).length,maxDailyCalls:60,batchCap:CAP,
   coverageCertified:false,modelActive:false,forecastsIssued:0,roi:null,providerCalls:0,databaseWrites:0};
 }catch{return {status:'ARCHIVE_UNAVAILABLE',configuration,modelActive:false,providerCalls:0,databaseWrites:0};}
}
