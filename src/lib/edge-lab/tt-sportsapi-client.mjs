// SportsAPI.app v2 safe client. Can be used ONLY by server-side TT settlement.
// One /v2/search + at most two /v2/fixtures calls per run.
// Key is passed solely as Authorization header; never returned or stored.
import {createHash} from 'node:crypto';
import {sportsApiTtLeagueId,sportsApiTtFinals,ttSportsApiTargetDays} from './tt-sportsapi-results.mjs';

const root='https://api.sportsapi.app';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function errorCode(status){return status===401?'AUTH_INVALID':status===403?'PLAN_NOT_ALLOWED':status===429?'QUOTA_OR_RATE_LIMIT':status>=500?'PROVIDER_UNAVAILABLE':'BAD_RESPONSE';}
export async function sportsApiTtSupplement({key,leagueId=null,forecasts,outcomes,now=new Date().toISOString(),fetchFn=fetch}){
 if(typeof key!=='string'||!key.trim()||!Array.isArray(forecasts)||!Array.isArray(outcomes))
  throw Error('SPORTSAPI_TT_NOT_CONFIGURED');
 const days=ttSportsApiTargetDays(forecasts,outcomes,now,2);
 const out={status:'NO_ELIGIBLE_RECENT_GAMES',calls:0,days,leagueId:null,finals:[],receipts:[],errors:[]};
 if(!days.length)return out;
 const get=async(path)=>{
  if(out.calls>=3)throw Error('SPORTSAPI_TT_CALL_CAP');
  const url=new URL(path,root);
  if(url.protocol!=='https:'||url.host!=='api.sportsapi.app'||!['/v2/search','/v2/fixtures'].includes(url.pathname))
   throw Error('SPORTSAPI_TT_URL_REJECTED');
  out.calls++;
  const response=await fetchFn(url.toString(),{method:'GET',redirect:'error',cache:'no-store',
    headers:{Authorization:'Bearer '+key,Accept:'application/json'},
    signal:AbortSignal.timeout(16000)});
  if(!response.ok)throw Error('SPORTSAPI_TT_'+errorCode(response.status));
  const raw=await response.text();
  if(raw.length>2000000)throw Error('SPORTSAPI_TT_BODY_LIMIT');
  let data;try{data=JSON.parse(raw);}catch{throw Error('SPORTSAPI_TT_NOT_JSON');}
  if(!data||typeof data!=='object'||'error' in data)throw Error('SPORTSAPI_TT_ENVELOPE');
  return {body:data,sourceUrl:url.toString(),capturedAt:new Date().toISOString(),sourceDigest:hash(raw)};
 };
 try{
  let id=null;
  if(leagueId!==null&&leagueId!==undefined&&String(leagueId).trim()){
   const n=Number(leagueId);if(!Number.isSafeInteger(n)||n<=0)throw Error('SPORTSAPI_TT_LEAGUE_CONFIG_INVALID');
   id=n;
  }else{
   const discovery=await get('/v2/search?q=TT%20Elite%20Series&type=league');
   id=sportsApiTtLeagueId(discovery.body);
   if(id===null)throw Error('SPORTSAPI_TT_LEAGUE_UNVERIFIED');
   out.receipts.push({kind:'SPORTSAPI_LEAGUE_DISCOVERY',sourceUrl:discovery.sourceUrl,
    capturedAt:discovery.capturedAt,sourceDigest:discovery.sourceDigest,leagueId:id,
    raw:discovery.body});
  }
  out.leagueId=id;
  for(const date of days){
   try{
    const received=await get('/v2/fixtures?date='+date+'&league='+id);
    const normalized=sportsApiTtFinals(received.body,{leagueId:id,capturedAt:received.capturedAt,requestedDay:date});
    out.finals.push(...normalized.rows);
    out.receipts.push({kind:'SPORTSAPI_TT_DAILY_FINALS',sourceUrl:received.sourceUrl,
      capturedAt:received.capturedAt,sourceDigest:received.sourceDigest,
      leagueId:id,date,raw:received.body,normalized});
   }catch(e){out.errors.push(e instanceof Error?e.message:'SPORTSAPI_TT_FETCH_FAILED');break;}
  }
  out.status=out.errors.length?'PARTIAL':out.receipts.some(x=>x.kind==='SPORTSAPI_TT_DAILY_FINALS')?'RETRIEVED':'NO_VERIFIED_FINALS';
 }catch(e){out.status='UNAVAILABLE';out.errors.push(e instanceof Error?e.message:'SPORTSAPI_TT_FETCH_FAILED');}
 // Strictly public results and source provenance. NEVER persist 'key' or headers.
 return out;
}
