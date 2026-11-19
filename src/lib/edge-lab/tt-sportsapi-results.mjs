// SportsAPI.app v2 free plan TT Elite Series results only.
// Never changes/feeds the forecasting model, odds, or official picks.
// Docs: /v2/search?q=TT%20Elite%20Series&type=league and
//       /v2/fixtures?date=YYYY-MM-DD&league=<verified-id>
import {playerKey} from './engines.mjs';

const iso=x=>{const ms=Date.parse(String(x??''));return Number.isFinite(ms)?new Date(ms).toISOString():null;};
const int=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const label=x=>typeof x==='string'&&x.length>=3&&x.length<=120&&x.trim()===x?x:null;
const day=x=>iso(x)?.slice(0,10)??null;

export function sportsApiTtLeagueId(body){
 if(!Array.isArray(body?.data)||body?.meta?.hasNextPage===true)return null;
 const hits=body.data.filter(x=>x?.type==='league'&&x.sport==='table-tennis'&&
  String(x.name??'').toLowerCase().trim()==='tt elite series'&&int(x.id)!==null&&x.id>0);
 return hits.length===1?hits[0].id:null;
}

function extractSetScores(home,away,homeSets,awaySets){
 const h=home?.periods,a=away?.periods;
 if(!h||!a||typeof h!=='object'||typeof a!=='object')return {pointsComplete:false,setPoints:[],totalPoints:null};
 const hk=Object.keys(h).filter(x=>/^period[1-5]$/.test(x)),ak=Object.keys(a).filter(x=>/^period[1-5]$/.test(x));
 const all=[...new Set([...hk,...ak])].sort((x,y)=>Number(x.slice(6))-Number(y.slice(6)));
 if(all.length<3||all.length>5||hk.length!==all.length||ak.length!==all.length||all.some((k,i)=>k!=='period'+(i+1)))
  return {pointsComplete:false,setPoints:[],totalPoints:null};
 const points=[];let winsH=0,winsA=0,total=0;
 for(const k of all){
  const x=int(h[k]),y=int(a[k]);
  if(x===null||y===null||x===y||Math.max(x,y)<11||Math.abs(x-y)<2||
     (Math.max(x,y)!==11&&Math.abs(x-y)!==2))
   return {pointsComplete:false,setPoints:[],totalPoints:null};
  points.push([x,y]);if(x>y)winsH++;else winsA++;total+=x+y;
 }
 if(winsH!==homeSets||winsA!==awaySets)return {pointsComplete:false,setPoints:[],totalPoints:null};
 return {pointsComplete:true,setPoints:points,totalPoints:total};
}

export function sportsApiTtFinals(body,{leagueId,capturedAt,requestedDay}){
 if(!Number.isSafeInteger(leagueId)||leagueId<=0||!iso(capturedAt)||!/^\d{4}-\d{2}-\d{2}$/.test(requestedDay))
  throw Error('SPORTSAPI_TT_INPUT_INVALID');
 if(!Array.isArray(body?.data)||body?.meta?.hasNextPage!==false||
    body?.meta?.complete===false||body?.meta?.date!==requestedDay)
  throw Error('SPORTSAPI_TT_RESPONSE_INCOMPLETE');
 const rows=[],excluded={},seen=new Set(),counts=new Map();
 for(const item of body.data){
  if(item?.sport==='table-tennis'&&item?.league?.id===leagueId&&int(item.id)!==null)
   counts.set(item.id,(counts.get(item.id)??0)+1);
 }
 for(const x of body.data){
  if(x?.sport!=='table-tennis'||x?.league?.id!==leagueId||String(x.league?.name??'').toLowerCase().trim()!=='tt elite series')continue;
  if(x.status?.type!=='finished')continue;
  const id=int(x.id),at=iso(x.startTime),home=label(x.home?.name),away=label(x.away?.name);
  const hs=int(x.homeScore?.current),as=int(x.awayScore?.current);
  let why=null;
  if(id===null||id===0||!at||!home||!away||playerKey(home)===playerKey(away))why='BAD_IDENTITY';
  else if(day(at)!==requestedDay)why='CHANGED_UTC_DAY';
  else if(Date.parse(at)>=Date.parse(capturedAt))why='NOT_YET_PLAYED';
  else if(hs===null||as===null||!((hs===3&&as<3)||(as===3&&hs<3)))why='INVALID_DECISIVE_SETS';
  else if(x.winner&&x.winner!==(hs>as?'home':'away'))why='WINNER_CONFLICT';
  else if(counts.get(id)!==1||seen.has(id))why='DUPLICATE_FIXTURE_ID';
  if(why){excluded[why]=(excluded[why]??0)+1;continue;}
  seen.add(id);
  const points=extractSetScores(x.homeScore,x.awayScore,hs,as);
  rows.push({source:'sportsapi:tt-elite',sourceMatchId:String(id),
   scheduledAt:at,playerA:home,playerB:away,setsA:hs,setsB:as,
   capturedAt:iso(capturedAt),...points});
 }
 return {rows,excluded,providerCount:body.data.length,verifiedCount:rows.length};
}

// SportsAPI sometimes publishes "Brud S." instead of "Szymon Brud".
// Resolve only an exact two-token full name or exact surname + first initial.
// No approximate edit distance, common nickname dictionary, or time-only match.
const nameTokens=value=>{
 if(typeof value!=='string'||value.length>120)return [];
 const norm=value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[łŁ]/g,'l').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 return norm?norm.split(/\s+/):[];
};
export function sportsApiTtPlayerMatches(frozen,reported){
 const f=nameTokens(frozen),r=nameTokens(reported);
 if(f.length<2||r.length<2)return false;
 if(f.length===r.length&&[...f].sort().join('|')===[...r].sort().join('|'))return true;
 if(f.length!==2||r.length!==2||r[0].length<3||r[1].length!==1||f.some(t=>t.length<2))return false;
 return (r[0]===f[0]&&r[1]===f[1][0])||(r[0]===f[1]&&r[1]===f[0][0]);
}
export function sportsApiTtMatchesFrozenEvent(f,x){
 const scheduled=Date.parse(String(f?.scheduled_at??'')),at=Date.parse(String(x?.scheduledAt??''));
 if(!Number.isFinite(scheduled)||!Number.isFinite(at)||Math.abs(scheduled-at)>300000)return false;
 return (sportsApiTtPlayerMatches(f.participant_a,x.playerA)&&sportsApiTtPlayerMatches(f.participant_b,x.playerB))||
  (sportsApiTtPlayerMatches(f.participant_a,x.playerB)&&sportsApiTtPlayerMatches(f.participant_b,x.playerA));
}

// A provider final is eligible only when it belongs to exactly one frozen
// event, and that event matches exactly one provider final. Cross-book IDs
// are never assumed identical. All conflicting aliases remain unresolved.
export function sportsApiTtUniqueAssignments(forecasts,finals){
 if(!Array.isArray(forecasts)||!Array.isArray(finals))throw Error('SPORTSAPI_TT_ASSIGNMENT_INPUT');
 const events=new Map(),conflicted=new Set();
 for(const f of forecasts){
  if(f?.sport!=='TT'||!['FORECAST','PROJECTION'].includes(f.status))continue;
  const id=f.event_id;
  if(typeof id!=='string'||!id)continue;
  const prev=events.get(id);
  if(prev&&(prev.scheduled_at!==f.scheduled_at||
   prev.participant_a!==f.participant_a||prev.participant_b!==f.participant_b)){
   conflicted.add(id);continue;
  }
  if(!prev)events.set(id,f);
 }
 for(const id of conflicted)events.delete(id);
 const proposed=new Map(),finalUse=new Map();
 let ambiguousEvents=conflicted.size;
 for(const [id,f] of events){
  const matches=finals.filter(r=>sportsApiTtMatchesFrozenEvent(f,r));
  if(matches.length>1){ambiguousEvents++;continue;}
  if(matches.length!==1)continue;
  const match=matches[0],sourceKey=match.source+':'+match.sourceMatchId;
  proposed.set(id,match);
  finalUse.set(sourceKey,(finalUse.get(sourceKey)??0)+1);
 }
 const byEvent=new Map();
 for(const [id,r] of proposed){
  if(finalUse.get(r.source+':'+r.sourceMatchId)!==1){ambiguousEvents++;continue;}
  byEvent.set(id,[r]);
 }
 return {byEvent,matchedEvents:byEvent.size,ambiguousEvents};
}

export function ttSportsApiOutcome(f,finals){
 const scheduled=Date.parse(String(f?.scheduled_at??'')),issued=Date.parse(String(f?.emitted_at??''));
 if(!Number.isFinite(scheduled)||!Number.isFinite(issued)||issued>=scheduled||!Array.isArray(finals))
  return {status:'PENDING'};
 const matches=finals.filter(x=>sportsApiTtMatchesFrozenEvent(f,x));
 if(!matches.length)return {status:'PENDING'};
 if(matches.length!==1)return {status:'DISPUTE',reason:'SPORTSAPI_AMBIGUOUS_CROSS_BOOK_MATCH'};
 const x=matches[0],observed=Date.parse(x.capturedAt);
 if(!Number.isFinite(observed)||observed<=issued||observed<=Date.parse(x.scheduledAt))
  return {status:'DISPUTE',reason:'SPORTSAPI_FINAL_TIMING_INVALID'};
 const same=sportsApiTtPlayerMatches(f.participant_a,x.playerA)&&sportsApiTtPlayerMatches(f.participant_b,x.playerB);
 if(f.market==='MONEYLINE'){
  if(!['A','B'].includes(f.selection))return {status:'NOT_VERIFIABLE',reason:'INVALID_SELECTION'};
  const winner=(x.setsA>x.setsB)===same?'A':'B';
  return {status:f.selection===winner?'W':'L',actual_label:winner,
   verification:'SPORTSAPI_FINISHED_DECISIVE_SETS',source:'sportsapi.app',final:x};
 }
 if(f.market==='SETS_ODD_EVEN'){
  if(!['ODD','EVEN'].includes(f.selection))return {status:'NOT_VERIFIABLE',reason:'INVALID_SELECTION'};
  const parity=(x.setsA+x.setsB)%2?'ODD':'EVEN';
  return {status:f.selection===parity?'W':'L',actual_label:parity,
   verification:'SPORTSAPI_FINISHED_DECISIVE_SETS',source:'sportsapi.app',final:x};
 }
 if(f.market==='TOTAL_POINTS'){
  if(!x.pointsComplete||!Number.isSafeInteger(x.totalPoints))return {status:'PENDING'};
  if(f.status==='PROJECTION'&&Number.isFinite(f.projection))
   return {status:'NUMERIC',actual:x.totalPoints,absolute_error:Math.abs(f.projection-x.totalPoints),
    verification:'SPORTSAPI_COMPLETE_SET_POINTS',source:'sportsapi.app',final:x};
  if(!Number.isFinite(f.line)||!['OVER','UNDER'].includes(f.selection))return {status:'PENDING'};
  const actual=x.totalPoints;
  if(actual===f.line)return {status:'PUSH',actual,absolute_error:Number.isFinite(f.projection)?Math.abs(f.projection-actual):null,
    verification:'SPORTSAPI_COMPLETE_SET_POINTS',source:'sportsapi.app',final:x};
  return {status:f.selection===(actual>f.line?'OVER':'UNDER')?'W':'L',actual,
   absolute_error:Number.isFinite(f.projection)?Math.abs(f.projection-actual):null,
   verification:'SPORTSAPI_COMPLETE_SET_POINTS',source:'sportsapi.app',final:x};
 }
 return {status:'PENDING'};
}

export function ttSportsApiTargetDays(forecasts,outcomes,nowIso,maxDays=2){
 const now=Date.parse(nowIso);
 if(!Number.isFinite(now)||!Number.isSafeInteger(maxDays)||maxDays<0||maxDays>2)throw Error('SPORTSAPI_TT_DAY_PLAN_INVALID');
 const done=new Set(outcomes.map(o=>o.forecast_id)),counts=new Map(),seen=new Set();
 for(const f of forecasts){
  if(f.sport!=='TT'||!['FORECAST','PROJECTION'].includes(f.status)||done.has(f.id))continue;
  const t=Date.parse(f.scheduled_at);
  // Free retention is 7 UTC days; leave a full day of slack to prevent borderline 403.
  if(!Number.isFinite(t)||t>now-3600000||t<now-6*86400000||seen.has(f.event_id))continue;
  seen.add(f.event_id);
  const d=new Date(t).toISOString().slice(0,10);counts.set(d,(counts.get(d)??0)+1);
 }
 return [...counts].sort((a,b)=>b[1]-a[1]||b[0].localeCompare(a[0])).slice(0,maxDays).map(([d])=>d);
}
