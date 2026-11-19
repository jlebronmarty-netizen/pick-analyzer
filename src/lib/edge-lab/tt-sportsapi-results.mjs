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
 const points=[],winsH=0,winsA=0;let total=0;
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
 const rows=[],excluded={},seen=new Set();
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
  else if(seen.has(id))why='DUPLICATE_FIXTURE_ID';
  if(why){excluded[why]=(excluded[why]??0)+1;continue;}
  seen.add(id);
  const points=extractSetScores(x.homeScore,x.awayScore,hs,as);
  rows.push({source:'sportsapi:tt-elite',sourceMatchId:String(id),
   scheduledAt:at,playerA:home,playerB:away,setsA:hs,setsB:as,
   capturedAt:iso(capturedAt),...points});
 }
 return {rows,excluded,providerCount:body.data.length,verifiedCount:rows.length};
}

export function ttSportsApiOutcome(f,finals){
 const scheduled=Date.parse(String(f?.scheduled_at??'')),issued=Date.parse(String(f?.emitted_at??''));
 if(!Number.isFinite(scheduled)||!Number.isFinite(issued)||issued>=scheduled||!Array.isArray(finals))
  return {status:'PENDING'};
 const a=playerKey(f.participant_a),b=playerKey(f.participant_b);
 const matches=finals.filter(x=>Math.abs(Date.parse(x.scheduledAt)-scheduled)<=300000&&
  ((playerKey(x.playerA)===a&&playerKey(x.playerB)===b)||
   (playerKey(x.playerA)===b&&playerKey(x.playerB)===a)));
 if(!matches.length)return {status:'PENDING'};
 if(matches.length!==1)return {status:'DISPUTE',reason:'SPORTSAPI_AMBIGUOUS_CROSS_BOOK_MATCH'};
 const x=matches[0],observed=Date.parse(x.capturedAt);
 if(!Number.isFinite(observed)||observed<=issued||observed<=Date.parse(x.scheduledAt))
  return {status:'DISPUTE',reason:'SPORTSAPI_FINAL_TIMING_INVALID'};
 const same=playerKey(x.playerA)===a;
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
