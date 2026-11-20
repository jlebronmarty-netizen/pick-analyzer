import {NextRequest} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=20;
const KEYS={NCAAB:'basketball_ncaab',NCAAF:'americanfootball_ncaaf'} as const;
const respond=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
const validName=(s:unknown)=>typeof s==='string'&&s.length>0&&s.length<=100&&!/[<>]/.test(s);
export async function GET(req:NextRequest){
 if(process.env.VERCEL_ENV!=='preview')return respond({status:'PREVIEW_ONLY',provider_calls:0},404);
 if(!req.headers.get('x-vercel-oidc-token'))return respond({status:'PRIVATE_VERCEL_AUTH_REQUIRED',provider_calls:0},401);
 const q=req.nextUrl.searchParams;
 if([...q.keys()].some(k=>k!=='league'&&k!=='_vercel_share')||q.getAll('league').length!==1||
  !['NCAAB','NCAAF'].includes(q.get('league')??''))return respond({status:'INVALID_LEAGUE',provider_calls:0},400);
 const league=q.get('league') as keyof typeof KEYS,key=process.env.THE_ODDS_API_KEY?.trim()||process.env.ODDS_API_KEY?.trim();
 if(!key)return respond({status:'KEY_NOT_CONFIGURED',provider_calls:0},503);
 // Provider documentation marks /sports/{sport}/events as free of quota charges.
 // No odds, scores or history endpoints. No retries or mutations.
 const url='https://api.the-odds-api.com/v4/sports/'+KEYS[league]+'/events';
 let response:Response;
 try{response=await fetch(url,{method:'GET',headers:{'x-api-key':key,Accept:'application/json'},
  redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)})}
 catch{return respond({status:'PROVIDER_TRANSPORT_UNAVAILABLE',league,provider_calls:1,odds_credit_cost:'UNKNOWN'},503)}
 const remaining=response.headers.get('x-requests-remaining');
 const last=response.headers.get('x-requests-last');
 if(!response.ok)return respond({status:'PROVIDER_DENIED',league,provider_http:response.status,provider_calls:1,
  odds_credit_cost:last===null?'UNKNOWN':Number(last),remaining_credits:remaining===null?null:Number(remaining)},502);
 if(Number(response.headers.get('content-length')??0)>1000000)return respond({status:'BODY_LIMIT',league,provider_calls:1},502);
 let events:unknown;
 try{const raw=await response.text();if(raw.length>1000000)throw Error('too_large');events=JSON.parse(raw)}
 catch{return respond({status:'INVALID_OR_TOO_LARGE_RESPONSE',league,provider_calls:1},502)}
 if(!Array.isArray(events)||events.length>500)return respond({status:'UNEXPECTED_PROVIDER_RESPONSE',league,provider_calls:1},502);
 const safe=events.filter(x=>x&&typeof x==='object'&&
  (x as {sport_key?:string}).sport_key===KEYS[league]&&
  validName((x as {home_team?:unknown}).home_team)&&validName((x as {away_team?:unknown}).away_team)&&
  typeof (x as {id?:unknown}).id==='string'&&
  Number.isFinite(Date.parse(String((x as {commence_time?:unknown}).commence_time)))).map(x=>{
   const e=x as {id:string;commence_time:string;home_team:string;away_team:string};
   return {event_id:e.id,scheduled_at:e.commence_time,home:e.home_team,away:e.away_team};
  });
 return respond({status:'READ_ONLY_FREE_EVENTS',league,source:'The Odds API',endpoint:'events_no_odds',
  captured_at:new Date().toISOString(),provider_calls:1,provider_rows:events.length,validated_games:safe.length,
  sample:safe.slice(0,8),odds_quotes:0,odds_credit_cost:last===null?'NOT_REPORTED':Number(last),
  remaining_credits:remaining===null?null:Number(remaining),database_writes:0,model_changes:0,
  caveats:['Provider event identifiers are not yet crosswalked to Pick fixtures.',
    'Free event endpoint contains no market prices; spread/total ROI and EV cannot be calculated.',
    'Only one manually invoked call; no schedules or automatic refresh.']});
}
