import {NextRequest} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;

const LEAGUES={NCAAB:'basketball_ncaab',NCAAF:'americanfootball_ncaaf'} as const;
const MIN_REMAINING_BEFORE=2002;
const urlFor=(key:string,path:string)=>'https://api.the-odds-api.com/v4/sports/'+key+'/'+path;
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
const integerHeader=(response:Response,key:string)=>{const n=Number(response.headers.get(key));return response.headers.get(key)!==null&&Number.isInteger(n)&&n>=0?n:null};
const validMarket=(v:unknown)=>typeof v==='string'&&['spreads','totals'].includes(v);
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
async function get(url:string,key:string){
 return fetch(url,{method:'GET',headers:{'x-api-key':key,Accept:'application/json'},
  redirect:'error',cache:'no-store',signal:AbortSignal.timeout(11000)});
}
export async function GET(req:NextRequest){
 if(process.env.VERCEL_ENV!=='preview')return reply({status:'PREVIEW_ONLY',provider_calls:0},404);
 if(!req.headers.get('x-vercel-oidc-token'))return reply({status:'PRIVATE_VERCEL_AUTH_REQUIRED',provider_calls:0},401);
 const q=req.nextUrl.searchParams;
 if([...q.keys()].some(x=>!['league','_vercel_share'].includes(x))||q.getAll('league').length!==1||
    !['NCAAB','NCAAF'].includes(q.get('league')??''))return reply({status:'INVALID_QUERY',provider_calls:0},400);
 const league=q.get('league') as keyof typeof LEAGUES,providerKey=LEAGUES[league];
 // Deliberately use only the previously audited 20,000-credit account, not the
 // separate ODDS_API_KEY whose higher-level application reserve blocks usage.
 const key=process.env.THE_ODDS_API_KEY?.trim();
 if(!key)return reply({status:'AUDITED_ACCOUNT_NOT_CONFIGURED',provider_calls:0},503);
 let budget:Response;
 try{budget=await get(urlFor(providerKey,'events'),key)}
 catch{return reply({status:'FREE_PREFLIGHT_UNAVAILABLE',provider_calls:1,priced_calls:0},503)}
 const before=integerHeader(budget,'x-requests-remaining');
 if(!budget.ok||before===null||before<MIN_REMAINING_BEFORE)
   return reply({status:'CREDIT_GATE_BLOCKED',league,free_preflight_http:budget.status,
    remaining_before:before,required_before:MIN_REMAINING_BEFORE,provider_calls:1,priced_calls:0},409);
 const url=urlFor(providerKey,'odds')+'?regions=us&markets=spreads%2Ctotals&oddsFormat=american';
 let response:Response;
 try{response=await get(url,key)}
 catch{return reply({status:'ODDS_FETCH_UNAVAILABLE',league,provider_calls:2,priced_calls:1,credit_cost:'UNKNOWN'},503)}
 const after=integerHeader(response,'x-requests-remaining');
 const charged=integerHeader(response,'x-requests-last');
 if(!response.ok)return reply({status:'PROVIDER_DENIED',league,http:response.status,provider_calls:2,priced_calls:1,remaining_after:after,credit_cost:charged},502);
 if(Number(response.headers.get('content-length')??0)>1000000)return reply({status:'TOO_LARGE',provider_calls:2,priced_calls:1,credit_cost:charged},502);
 let rows:unknown;
 try{const raw=await response.text();if(raw.length>1000000)throw Error('size');rows=JSON.parse(raw)}
 catch{return reply({status:'INVALID_BODY',league,provider_calls:2,priced_calls:1,credit_cost:charged},502)}
 if(!Array.isArray(rows)||rows.length>500)return reply({status:'UNEXPECTED_BODY',league,provider_calls:2,priced_calls:1,credit_cost:charged},502);
 let pairs=0,withSpreads=0,withTotals=0;
 const books=new Set<string>(),sample:Array<Record<string,unknown>>=[];
 for(const unknownEvent of rows){
  if(!unknownEvent||typeof unknownEvent!=='object')continue;
  const event=unknownEvent as {id?:string;sport_key?:string;home_team?:string;away_team?:string;commence_time?:string;bookmakers?:unknown[]};
  if(event.sport_key!==providerKey||typeof event.id!=='string'||typeof event.home_team!=='string'||
     typeof event.away_team!=='string'||!Number.isFinite(Date.parse(event.commence_time??'')))continue;
  const markets=new Set<string>();
  for(const rawBook of Array.isArray(event.bookmakers)?event.bookmakers:[]){
   if(!rawBook||typeof rawBook!=='object')continue;
   const book=rawBook as {key?:string;markets?:unknown[]};
   if(typeof book.key!=='string')continue;
   books.add(book.key);
   for(const rawMarket of Array.isArray(book.markets)?book.markets:[]){
    if(!rawMarket||typeof rawMarket!=='object')continue;
    const market=rawMarket as {key?:string;last_update?:string;outcomes?:unknown[]};
    if(!validMarket(market.key)||!Array.isArray(market.outcomes))continue;
    const eligible=market.outcomes.filter(o=>o&&typeof o==='object'&&
      finite((o as {point?:unknown}).point)&&finite((o as {price?:unknown}).price));
    if(eligible.length<2)continue;
    pairs++;markets.add(market.key!);
    if(sample.length<6)sample.push({event_id:event.id,scheduled_at:event.commence_time,
     home:event.home_team,away:event.away_team,bookmaker:book.key,market:market.key,
     market_last_update:market.last_update??null,
     outcomes:eligible.slice(0,2).map(o=>({side:(o as {name?:string}).name,
      line:(o as {point:number}).point,american_price:(o as {price:number}).price}))});
   }
  }
  withSpreads+=Number(markets.has('spreads'));withTotals+=Number(markets.has('totals'));
 }
 return reply({status:'CONTROLLED_MARKET_QUOTES_OBSERVED',league,source:'The Odds API',
   captured_at:new Date().toISOString(),provider_calls:2,free_preflight_calls:1,
   priced_calls:1,documented_max_cost_credits:2,actual_cost_credits:charged,
   credits_remaining_before:before,credits_remaining_after:after,
   provider_events:rows.length,events_with_spread:withSpreads,events_with_total:withTotals,
   valid_quote_pairs:pairs,bookmakers:[...books].sort(),sample,
   db_writes:0,model_changes:0,execution_available:false,regional_price_verified:false,
   warning:'Observación privada de cuotas, sin crosswalk de identidad, validación de reglas ni valor apostable. No implica EV ni ROI.'});
}
