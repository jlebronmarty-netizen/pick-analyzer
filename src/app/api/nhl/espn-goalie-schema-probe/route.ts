import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=35;
const SOURCE='https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=20261115';
const keys=(x:unknown)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x as Record<string,unknown>).slice(0,40):[];
const trim=(v:unknown)=>typeof v==='string'?v.slice(0,120):typeof v==='number'||typeof v==='boolean'?v:null;
function goalieFieldPaths(root:unknown){
 const matches:Record<string,unknown>[]=[];
 const seen=new Set<object>();
 const walk=(v:unknown,path:string,depth:number)=>{
  if(depth>7||matches.length>=45||!v||typeof v!=='object'||seen.has(v))return;
  seen.add(v);
  if(Array.isArray(v)){v.slice(0,8).forEach((x,i)=>walk(x,path+'['+i+']',depth+1));return;}
  for(const [k,val] of Object.entries(v as Record<string,unknown>)){
   const next=path+'.'+k;
   if(/goalie|goaltender|probable|starter|confirm|athlete|notes|headline/i.test(k)){
    if(val&&typeof val==='object')matches.push({path:next,keys:keys(val),
     sampleValues:Object.fromEntries(Object.entries(val as Record<string,unknown>)
      .filter(([name,value])=>/name|status|type|id|display|confirmed|short/i.test(name)&&typeof value!=='object')
      .slice(0,8).map(([name,value])=>[name,trim(value)]))});
    else matches.push({path:next,sample:trim(val)});
   }
   if(val&&typeof val==='object')walk(val,next,depth+1);
  }
 };
 walk(root,'$',0);return matches.slice(0,45);
}
// One-shot schema probe only. Not callable on production; no writes, retries, or API keys.
export async function GET(){
 if(process.env.VERCEL_ENV!=='preview')
  return NextResponse.json({status:'NOT_AVAILABLE'},{status:404});
 try{
  const resp=await fetch(SOURCE,{redirect:'error',cache:'no-store',
   headers:{Accept:'application/json'},signal:AbortSignal.timeout(14000)});
  if(!resp.ok||!(resp.headers.get('content-type')??'').includes('application/json')||
     Number(resp.headers.get('content-length')??0)>3000000)
   return NextResponse.json({status:'ESPN_SOURCE_UNVERIFIED',httpStatus:resp.status,
    providerCalls:1,databaseWrites:0},{status:502});
  const raw=await resp.text();
  if(Buffer.byteLength(raw,'utf8')>3000000)
   return NextResponse.json({status:'ESPN_RESPONSE_TOO_LARGE',providerCalls:1,databaseWrites:0},{status:502});
  const json=JSON.parse(raw);
  const events=Array.isArray(json?.events)?json.events:[];
  return NextResponse.json({
   status:'SCHEMA_ONLY_UNVERIFIED_STARTER',source:'ESPN_PUBLIC_NHL_SCOREBOARD',
   sourceSportsDate:'2026-11-15',receivedAt:new Date().toISOString(),
   providerCalls:1,databaseWrites:0,modelWeightsChanged:false,
   sourceKeySet:keys(json),eventCount:events.length,
   games:events.slice(0,8).map((e:any)=>({
    eventId:trim(e.id),eventName:trim(e.name),date:trim(e.date),
    status:trim(e.status?.type?.name),competitionKeys:keys(e.competitions?.[0]),
    competitorKeys:keys(e.competitions?.[0]?.competitors?.[0]),
    goalieRelatedPaths:goalieFieldPaths(e)
   })),
   notes:'Diagnostic only. Post-start JSON is NOT proof of pregame goalie confirmation. No direct starter IDs accepted until verified source timestamps and team crosswalk.'
  },{headers:{'Cache-Control':'private, no-store'}});
 }catch{
  return NextResponse.json({status:'ESPN_SOURCE_UNAVAILABLE',
   providerCalls:1,databaseWrites:0},{status:502});
 }
}
