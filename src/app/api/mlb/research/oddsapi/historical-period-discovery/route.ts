import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const BASE='https://api.the-odds-api.com/v4'
const SPORT='baseball_mlb'
const DATE='2025-09-01T19:05:00Z'
const TARGET={home:'Washington Nationals',away:'Miami Marlins'}
const RESERVE=2000
const MAX_CALLS=2
const CONFIRM='ODDS_API_HISTORICAL_PERIOD_MARKET_DISCOVERY_V1'

function apiKey(){ return process.env.THE_ODDS_API_KEY?.trim() || '' }
function headerNum(h:Headers,n:string){
  const v=h.get(n); if(v===null)return null
  const x=Number(v); return Number.isFinite(x)?x:null
}
function keys(payload:any): string[]{
  const event=payload?.data && typeof payload.data==='object' ? payload.data : payload
  const books=Array.isArray(event?.bookmakers)?event.bookmakers:[]
  const values:string[]=books.flatMap((b:any)=>Array.isArray(b?.markets)?b.markets.map((m:any)=>String(m.key||'')):[]).filter((v:string)=>Boolean(v))
  return [...new Set<string>(values)].sort()
}

export async function GET(req:NextRequest){
  if(process.env.VERCEL_ENV!=='preview') return NextResponse.json({success:false,status:'BLOCKED_NON_PREVIEW'}, {status:403})
  if(req.nextUrl.searchParams.get('confirm')!==CONFIRM) return NextResponse.json({success:false,status:'CONFIRMATION_REQUIRED'}, {status:403})
  const key=apiKey()
  if(!key) return NextResponse.json({success:false,status:'BLOCKED_MISSING_THE_ODDS_API_KEY',providerCallsMade:0,creditsObserved:0})
  const calls:any[]=[]
  const get=async(path:string,query:Record<string,string>)=>{
    if(calls.length>=MAX_CALLS)throw new Error('HARD_CALL_BUDGET_REACHED')
    const prior=calls.at(-1)?.remaining
    if(typeof prior==='number'&&prior<=RESERVE)throw new Error('CREDIT_RESERVE_REACHED')
    const u=new URL(BASE+path); u.searchParams.set('apiKey',key)
    for(const [k,v] of Object.entries(query))u.searchParams.set(k,v)
    const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(15000)})
    const txt=await r.text(); let payload:any=null
    try{payload=txt?JSON.parse(txt):null}catch{payload=txt}
    const call={path,status:r.status,ok:r.ok,last:headerNum(r.headers,'x-requests-last'),remaining:headerNum(r.headers,'x-requests-remaining'),used:headerNum(r.headers,'x-requests-used')}
    calls.push(call)
    if(call.remaining===null)throw new Error('CREDIT_HEADERS_UNAVAILABLE')
    if(!r.ok)throw new Error('PROVIDER_HTTP_'+r.status)
    return payload
  }
  try{
    const e=await get('/historical/sports/'+SPORT+'/events',{date:DATE})
    const events=Array.isArray(e?.data)?e.data:[]
    const event=events.find((x:any)=>x?.home_team===TARGET.home&&x?.away_team===TARGET.away)
    if(!event?.id) return NextResponse.json({success:false,status:'TARGET_EVENT_NOT_FOUND',providerCallsMade:calls.length,calls})
    if(calls.at(-1).remaining<=RESERVE) return NextResponse.json({success:false,status:'CREDIT_RESERVE_REACHED_AFTER_EVENT_DISCOVERY',providerCallsMade:calls.length,calls})
    const m=await get('/historical/sports/'+SPORT+'/events/'+encodeURIComponent(event.id)+'/markets',{date:DATE,regions:'us',dateFormat:'iso'})
    const all=keys(m)
    const targetKeys=all.filter((k:string)=>/(?:1st_[1357]_innings|team_totals|alternate_team_totals)/.test(k))
    return NextResponse.json({
      success:true,status:'PASS',date:DATE,target:TARGET,providerEventId:event.id,commenceTime:event.commence_time??null,
      providerCallsMade:calls.length,creditsObserved:calls.reduce((s,c)=>s+(Number(c.last)||0),0),
      requestsRemainingAfter:calls.at(-1)?.remaining??null,creditReserve:RESERVE,
      targetMarketKeys:targetKeys,allMarketKeys:all,historicalOddsRequested:false,rowsPersisted:0,productionMutationsMade:0
    })
  }catch(error){
    return NextResponse.json({success:false,status:'FAILED',providerCallsMade:calls.length,calls,error:error instanceof Error?error.message:String(error)}, {status:500})
  }
}
