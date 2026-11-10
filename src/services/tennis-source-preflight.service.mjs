import 'server-only';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {TENNIS_HOST,TENNIS_URL,parseUpcoming} from '../../scripts/tennis-free/source-contract.mjs';

const table='free_sports_runs_v1';
const sourceVersion='TENNIS_RAPIDAPI_PREFLIGHT_V2_DIAGNOSTIC';
const admin=async()=> (await import('../lib/supabase-admin')).supabaseAdmin;
export function safeSourceError(err){
 if(err?.name==='TimeoutError')return 'SOURCE_TIMEOUT';
 if(err?.name==='AbortError')return 'SOURCE_ABORTED';
 if(err?.name==='SyntaxError')return 'SOURCE_INVALID_JSON';
 const cause=err?.cause?.code;
 if(['ENOTFOUND','EAI_AGAIN','ECONNRESET','ECONNREFUSED','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(cause))return 'SOURCE_'+cause;
 return err instanceof Error&&/^[A-Z_0-9]+$/.test(err.message)?err.message:'SOURCE_TRANSPORT_ERROR';
}
const shortError=safeSourceError;
const keyValid=key=>typeof key==='string'&&/^[A-Za-z0-9_-]{16,256}$/.test(key);
async function bodyLimited(response){
 if(!response.body||Number(response.headers.get('content-length'))>2097152)throw Error('BODY_LIMIT');
 const stream=response.body.getReader(),chunks=[];let bytes=0;
 try{while(true){const {value,done}=await stream.read();if(done)break;bytes+=value.byteLength;if(bytes>2097152)throw Error('BODY_LIMIT');chunks.push(value);}}
 finally{await stream.cancel().catch(()=>{});}
 return Buffer.concat(chunks,bytes);
}
export async function runTennisSourcePreflight(){
 const key=process.env.TENNIS_RAPIDAPI_KEY?.trim();
 if(!key)return {league:'ATP',state:'KEY_REQUIRED',providerCalls:0};
 if(!keyValid(key))return {league:'ATP',state:'KEY_FORMAT_INVALID',providerCalls:0};
 const db=await admin(),deployment=process.env.VERCEL_DEPLOYMENT_ID??'local';
 const latest=await db.from(table).select('slot,evidence').eq('league','ATP').eq('source',TENNIS_URL).order('id',{ascending:false}).limit(1).maybeSingle();
 if(latest.error)throw Error('SOURCE_LEDGER_READ_FAILED');
 if(latest.data?.evidence?.accessDenied===true&&latest.data.evidence.deployment===deployment)
  return {league:'ATP',state:'ACCESS_REVIEW_REQUIRED',providerCalls:0};
 const day=new Date().toISOString().slice(0,10);
 const previous=latest.data;
 // Preserve the first receipt. Exactly one diagnostic retry is allowed for
 // an unknown pre-HTTP transport failure, never an HTTP denial or a schema error.
 const diagnostic=previous?.slot?.slice(0,10)===day&&previous.evidence?.code==='SOURCE_FAILED'&&
  previous.evidence.httpStatus==null&&previous.evidence.sourceVersion==='TENNIS_RAPIDAPI_PREFLIGHT_V1';
 const slot=day+(diagnostic?'T01:00:00.000Z':'T00:00:00.000Z');
 const claim=await db.from(table).insert({league:'ATP',slot,source:TENNIS_URL}).select('id').single();
 if(claim.error?.code==='23505')return {league:'ATP',state:'PREFLIGHT_ALREADY_CLAIMED_TODAY',providerCalls:0};
 if(claim.error||!claim.data)throw Error('SOURCE_CLAIM_FAILED');
 const started=Date.now();
 const evidence={captureOnly:true,sourceVersion,deployment,diagnosticRetry:diagnostic,history:0,upcoming:[],providerCalls:1,maxHttpRequests:1,forecastsIssued:0,records:0,unpriced:0};
 let observed=null, state='ERROR';
 try{
  const response=await fetch(TENNIS_URL,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(25000),headers:{Accept:'application/json','X-RapidAPI-Host':TENNIS_HOST,'X-RapidAPI-Key':key}});
  evidence.httpStatus=response.status;
  if(!response.ok){evidence.accessDenied=[401,403,429].includes(response.status);await response.body?.cancel().catch(()=>{});throw Error('HTTP_'+response.status);}
  const buffer=await bodyLimited(response);observed=new Date().toISOString();
  evidence.sha256=createHash('sha256').update(buffer).digest('hex');
  evidence.payloadGzip=gzipSync(buffer).toString('base64');
  const body=JSON.parse(buffer.toString('utf8'));
  try{
   const parsed=parseUpcoming(body,observed);
   evidence.schemaStatus='CANDIDATE_SCHEMA_PASS';
   evidence.fixtureCount=parsed.events.length;evidence.rejectedCount=parsed.rejected.length;
   evidence.byTour={atp:parsed.events.filter(r=>r.key.startsWith('atp:')).length,wta:parsed.events.filter(r=>r.key.startsWith('wta:')).length};
   evidence.pricedCount=parsed.events.filter(r=>r.price).length;
   evidence.normalized=parsed;
  }catch(err){evidence.schemaStatus=shortError(err);}
  // A source capture is not a model activation or a prediction.
  state='OK';
 }catch(err){evidence.code=shortError(err);}
 evidence.elapsedMs=Date.now()-started;
 const completed=await db.rpc('finish_free_sports_run_v1',{p_run:claim.data.id,p_state:state,p_observed:observed,p_evidence:evidence,p_forecasts:[],p_results:[]});
 if(completed.error)throw Error('SOURCE_COMMIT_FAILED');
 return {league:'ATP',state:state==='OK'?'SOURCE_CAPTURED_MODEL_DISABLED':'SOURCE_REVIEW_REQUIRED',schema:evidence.schemaStatus??null,providerCalls:1,forecastsIssued:0};
}
export async function getTennisSourceHealth(){
 try{
  const db=await admin(),last=await db.from(table).select('observed_at,state,evidence').eq('league','ATP').eq('source',TENNIS_URL).order('id',{ascending:false}).limit(1).maybeSingle();
  if(last.error)throw Error('SOURCE_LEDGER_READ_FAILED');
  const e=last.data?.evidence;
  return {status:!e?'WAITING_CREDENTIAL_OR_FIRST_RUN':e.schemaStatus==='CANDIDATE_SCHEMA_PASS'?'CAPTURED_PENDING_HISTORY_AND_TERMS':'SOURCE_REVIEW_REQUIRED',
   capturedAt:last.data?.observed_at??null,httpStatus:e?.httpStatus??null,schema:e?.schemaStatus??null,error:e?.code??null,elapsedMs:e?.elapsedMs??null,fixtures:e?.fixtureCount??null,priced:e?.pricedCount??null,tours:e?.byTour??null,
   configured:!!process.env.TENNIS_RAPIDAPI_KEY?.trim(),keyFormatValid:keyValid(process.env.TENNIS_RAPIDAPI_KEY?.trim()),modelActive:false,forecastsIssued:0,providerCalls:0,databaseWrites:0,limit:'One regular preflight per UTC day; one additional diagnostic only for the preserved V1 pre-HTTP failure. No HTTP-denial retries.'};
 }catch{return {status:'UNAVAILABLE',configured:!!process.env.TENNIS_RAPIDAPI_KEY?.trim(),keyFormatValid:keyValid(process.env.TENNIS_RAPIDAPI_KEY?.trim()),modelActive:false,forecastsIssued:0,providerCalls:0,databaseWrites:0};}
}
