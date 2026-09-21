import { createHash } from 'node:crypto'

const BASE='https://api.the-odds-api.com/v4'
const SPORT='baseball_mlb'
const CREDIT_RESERVE=2000
const MAX_CALLS=2
const CONFIRM='ODDS_API_HISTORICAL_PERIOD_MARKET_DISCOVERY_V1'
const DATE='2025-09-01T16:05:00Z'
const TARGET={home:'Washington Nationals',away:'Miami Marlins'}

function key(){return (process.env.THE_ODDS_API_KEY||'').trim()}
function headerNumber(headers,name){
  const raw=headers.get(name); if(raw===null)return null
  const n=Number(raw); return Number.isFinite(n)?n:null
}
function sanitize(value){
  const raw=typeof value==='string'?value:JSON.stringify(value??'')
  return raw.replace(/apiKey=[^&\s"]+/gi,'apiKey=[REDACTED]').slice(0,400)
}
async function get(path,query,calls){
  if(calls.length>=MAX_CALLS)throw Error('HARD_CALL_BUDGET_REACHED')
  const prior=calls.at(-1)?.remaining
  if(typeof prior==='number'&&prior<=CREDIT_RESERVE)throw Error('CREDIT_RESERVE_REACHED')
  const u=new URL(BASE+path)
  u.searchParams.set('apiKey',key())
  for(const [k,v] of Object.entries(query))u.searchParams.set(k,String(v))
  const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(15000)})
  const text=await r.text(); let payload=null
  try{payload=text?JSON.parse(text):null}catch{payload=text}
  const call={
    path,ok:r.ok,status:r.status,
    last:headerNumber(r.headers,'x-requests-last'),
    remaining:headerNumber(r.headers,'x-requests-remaining'),
    used:headerNumber(r.headers,'x-requests-used'),
    error:r.ok?null:sanitize(payload),
  }
  calls.push(call)
  if(call.remaining===null)throw Error('CREDIT_HEADERS_UNAVAILABLE')
  if(!r.ok)throw Error('PROVIDER_HTTP_'+r.status)
  return payload
}
function marketKeys(payload){
  const books=Array.isArray(payload?.bookmakers)?payload.bookmakers:[]
  const keys=new Set()
  for(const b of books)for(const m of b.markets??[])if(m?.key)keys.add(String(m.key))
  return [...keys].sort()
}
function digest(x){return createHash('sha256').update(JSON.stringify(x)).digest('hex')}

if(process.argv.includes('--validate')){
  const checks=[
    ['max calls exactly 2',MAX_CALLS===2],
    ['reserve 2000',CREDIT_RESERVE===2000],
    ['2025 timestamp',DATE.startsWith('2025-')],
    ['target matchup set',Boolean(TARGET.home&&TARGET.away)],
  ]
  const failed=checks.filter(([,ok])=>!ok).map(([n])=>n)
  console.log(JSON.stringify({success:!failed.length,providerCallsMade:0,checks:checks.length,failed},null,2))
  process.exit(failed.length?1:0)
}
if(process.env.ODDS_API_HISTORICAL_PERIOD_DISCOVERY_CONFIRM!==CONFIRM)throw Error('CONFIRMATION_REQUIRED')
if(!key())throw Error('THE_ODDS_API_KEY_REQUIRED')

const calls=[]
const eventsPayload=await get('/historical/sports/'+SPORT+'/events',{date:DATE},calls)
const events=Array.isArray(eventsPayload?.data)?eventsPayload.data:[]
const event=events.find(e=>e?.home_team===TARGET.home&&e?.away_team===TARGET.away)
if(!event?.id)throw Error('TARGET_EVENT_NOT_FOUND')
if(calls.at(-1).remaining<=CREDIT_RESERVE)throw Error('CREDIT_RESERVE_REACHED_AFTER_EVENT_DISCOVERY')

const marketsPayload=await get('/historical/sports/'+SPORT+'/events/'+encodeURIComponent(event.id)+'/markets',{
  date:DATE,regions:'us',dateFormat:'iso'
},calls)
const keys=marketKeys(marketsPayload)
const wanted=keys.filter(k=>
  /(?:1st_[1357]_innings|team_totals|alternate_team_totals)/.test(k)
)
const result={
  success:true,
  mode:'ODDS_API_HISTORICAL_PERIOD_MARKET_DISCOVERY_V1',
  date:DATE,
  target:TARGET,
  providerEventId:event.id,
  commenceTime:event.commence_time??null,
  providerCallsMade:calls.length,
  creditsObserved:calls.reduce((s,c)=>s+(Number(c.last)||0),0),
  requestsRemainingAfter:calls.at(-1)?.remaining??null,
  creditReserve:CREDIT_RESERVE,
  allMarketKeys:keys,
  targetMarketKeys:wanted,
  eventDigest:digest({id:event.id,home:event.home_team,away:event.away_team,commence:event.commence_time}),
  rowsPersisted:0,
  productionMutationsMade:0,
  historicalOddsRequested:false,
}
const rendered=JSON.stringify(result)
if(rendered.includes(key()))throw Error('SECRET_LEAK')
console.log(JSON.stringify(result,null,2))
