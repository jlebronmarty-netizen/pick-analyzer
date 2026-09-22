import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const BASE = 'https://api.the-odds-api.com/v4'
const SPORT = 'baseball_mlb'
const MARKET = 'spreads_1st_5_innings'
const CREDIT_RESERVE = 2000
const MAX_PROVIDER_CALLS = 27
const MAX_OBSERVED_CREDITS = 243
const CONFIRM = 'MLB_F5_SPREAD_LINE_SAMPLE_V1'
const ROUTE_VERSION = 'f5-spread-line-sample-v1'
const DATES = [
  '2025-05-15T15:00:00Z',
  '2025-06-15T15:00:00Z',
  '2025-08-15T15:00:00Z',
]
const GAMES_PER_DATE = 8

function secret(){ return process.env.CRON_SECRET?.trim() ?? '' }
function authorized(request: NextRequest){
  const expected=secret()
  return Boolean(expected) && request.headers.get('x-pick-analyzer-cron-secret')===expected
}
function apiKey(){ return process.env.THE_ODDS_API_KEY?.trim() ?? '' }
function hn(h:Headers,n:string){ const r=h.get(n); if(r===null)return null; const v=Number(r); return Number.isFinite(v)?v:null }
function sub60(iso:string){ return new Date(new Date(iso).getTime()-60*60_000).toISOString().replace('.000Z','Z') }
function num(v:unknown){ const n=Number(v); return Number.isFinite(n)?n:null }

function summarize(payload:any, home:string, away:string){
  const event=payload?.data && typeof payload.data==='object' ? payload.data : payload
  const books=Array.isArray(event?.bookmakers)?event.bookmakers:[]
  const rows:any[]=[]
  for(const book of books){
    const markets=Array.isArray(book?.markets)?book.markets:[]
    const m=markets.find((x:any)=>x?.key===MARKET)
    if(!m) continue
    const outcomes=Array.isArray(m?.outcomes)?m.outcomes:[]
    const h=outcomes.find((x:any)=>x?.name===home)
    const a=outcomes.find((x:any)=>x?.name===away)
    const hp=num(h?.point), ap=num(a?.point)
    if(hp===null || ap===null) continue
    rows.push({book:String(book?.key??book?.title??'unknown'),homePoint:hp,awayPoint:ap})
  }
  const freq:Record<string,number>={}
  for(const r of rows){ const k=`${r.homePoint}/${r.awayPoint}`; freq[k]=(freq[k]??0)+1 }
  return {
    bookCount:rows.length,
    uniqueHomePoints:[...new Set(rows.map(r=>r.homePoint))].sort((a,b)=>a-b),
    uniqueAwayPoints:[...new Set(rows.map(r=>r.awayPoint))].sort((a,b)=>a-b),
    pointPairFrequency:Object.entries(freq).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),
    rows,
  }
}

export async function GET(request:NextRequest){
  if(process.env.VERCEL_ENV!=='production') return NextResponse.json({success:false,status:'BLOCKED_NON_PRODUCTION',routeVersion:ROUTE_VERSION},{status:403})
  if(!secret()) return NextResponse.json({success:false,status:'BLOCKED_MISSING_CRON_SECRET',routeVersion:ROUTE_VERSION},{status:503})
  if(!authorized(request)) return NextResponse.json({success:false,status:'UNAUTHORIZED',routeVersion:ROUTE_VERSION},{status:401})
  if(request.nextUrl.searchParams.get('confirm')!==CONFIRM) return NextResponse.json({success:false,status:'CONFIRMATION_REQUIRED',routeVersion:ROUTE_VERSION},{status:403})
  const key=apiKey()
  if(!key) return NextResponse.json({success:false,status:'BLOCKED_MISSING_THE_ODDS_API_KEY',routeVersion:ROUTE_VERSION,providerCallsMade:0,creditsObserved:0},{status:503})

  const calls:any[]=[]
  const get=async(path:string,query:Record<string,string>)=>{
    if(calls.length>=MAX_PROVIDER_CALLS) throw new Error('HARD_CALL_BUDGET_REACHED')
    const prior=calls.at(-1)?.remaining
    if(typeof prior==='number' && prior<=CREDIT_RESERVE) throw new Error('CREDIT_RESERVE_REACHED')
    const u=new URL(BASE+path); u.searchParams.set('apiKey',key); for(const [k,v] of Object.entries(query))u.searchParams.set(k,v)
    const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(20000)})
    const t=await r.text(); let p:any=null; try{p=t?JSON.parse(t):null}catch{}
    const call={path,status:r.status,ok:r.ok,last:hn(r.headers,'x-requests-last'),remaining:hn(r.headers,'x-requests-remaining'),used:hn(r.headers,'x-requests-used')}
    calls.push(call)
    const used=calls.reduce((s,x)=>s+(x.last??0),0)
    if(used>MAX_OBSERVED_CREDITS) throw new Error('CREDIT_BUDGET_EXCEEDED')
    if(call.remaining===null) throw new Error('CREDIT_HEADERS_UNAVAILABLE')
    if(!r.ok) throw new Error(`PROVIDER_HTTP_${r.status}`)
    return p
  }

  try{
    const games:any[]=[]
    for(const date of DATES){
      const evp=await get(`/historical/sports/${SPORT}/events`,{date})
      const events=(Array.isArray(evp?.data)?evp.data:[])
        .filter((e:any)=>e?.id && e?.commence_time && e?.home_team && e?.away_team)
        .sort((a:any,b:any)=>String(a.commence_time).localeCompare(String(b.commence_time)))
        .slice(0,GAMES_PER_DATE)
      for(const e of events){
        const snapshotAt=sub60(String(e.commence_time))
        const odds=await get(`/historical/sports/${SPORT}/events/${encodeURIComponent(String(e.id))}/odds`,{
          date:snapshotAt,regions:'us',markets:MARKET,dateFormat:'iso',oddsFormat:'american'
        })
        games.push({
          discoveryDate:date.slice(0,10),
          providerEventId:String(e.id),
          away:String(e.away_team),
          home:String(e.home_team),
          commenceTime:e.commence_time,
          snapshotAt,
          market:summarize(odds,String(e.home_team),String(e.away_team)),
        })
      }
    }
    const pairFreq:Record<string,number>={}
    let bookRows=0
    for(const g of games){
      for(const [pair,count] of g.market.pointPairFrequency){
        pairFreq[pair]=(pairFreq[pair]??0)+Number(count)
      }
      bookRows+=g.market.bookCount
    }
    return NextResponse.json({
      success:true,status:'PASS',routeVersion:ROUTE_VERSION,mode:'MLB_F5_SPREAD_LINE_SAMPLE_V1',
      market:MARKET,dates:DATES,targetGames:DATES.length*GAMES_PER_DATE,observedGames:games.length,
      aggregatePointPairFrequency:Object.entries(pairFreq).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),
      totalBookRows:bookRows,games,
      providerCallsMade:calls.length,
      creditsObserved:calls.reduce((s,x)=>s+(x.last??0),0),
      requestsRemainingAfter:calls.at(-1)?.remaining??null,
      creditReserve:CREDIT_RESERVE,maxObservedCredits:MAX_OBSERVED_CREDITS,calls,
      rowsPersisted:0,productionMutationsMade:0,researchOnly:true,
    })
  }catch(error){
    return NextResponse.json({
      success:false,status:'FAILED',routeVersion:ROUTE_VERSION,
      providerCallsMade:calls.length,creditsObserved:calls.reduce((s,x)=>s+(x.last??0),0),
      requestsRemainingAfter:calls.at(-1)?.remaining??null,creditReserve:CREDIT_RESERVE,maxObservedCredits:MAX_OBSERVED_CREDITS,calls,
      error:error instanceof Error?error.message:String(error),rowsPersisted:0,productionMutationsMade:0,researchOnly:true,
    },{status:500})
  }
}
