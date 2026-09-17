#!/usr/bin/env node

const EXPECTED_BRANCH = 'research/pa13-pitcher-er-build-probe-20260917'
const SPORT_KEY = 'baseball_mlb'
const MARKET = 'pitcher_earned_runs'
const PROVIDER_EVENT_ID = 'b9c3b50472005c67c30de323cd8a5396'

if (process.env.VERCEL !== '1' || process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH) {
  console.log(JSON.stringify({ status: 'SKIPPED_NOT_EXACT_PREVIEW_BRANCH' }))
  process.exit(0)
}

const apiKey = process.env.THE_ODDS_API_KEY?.trim() ?? ''
if (!apiKey) {
  console.log(JSON.stringify({ status: 'BLOCKED_MISSING_API_KEY', apiKeyExposed: false }))
  process.exit(0)
}

const url = new URL(`https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/events/${PROVIDER_EVENT_ID}/odds`)
url.searchParams.set('apiKey', apiKey)
url.searchParams.set('regions', 'us')
url.searchParams.set('markets', MARKET)
url.searchParams.set('oddsFormat', 'american')

const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
const payloadText = await response.text()
let payload = null
try { payload = JSON.parse(payloadText) } catch {}

const h = (name) => response.headers.get(name)
if (!response.ok) {
  console.log(JSON.stringify({
    status: 'PROBE_HTTP_ERROR',
    provider: 'the-odds-api',
    market: MARKET,
    providerEventId: PROVIDER_EVENT_ID,
    httpStatus: response.status,
    requestsLast: h('x-requests-last'),
    requestsRemaining: h('x-requests-remaining'),
    requestsUsed: h('x-requests-used'),
    providerMessage: payload?.message ?? null,
    providerErrorCode: payload?.error_code ?? null,
    researchOnly: true,
    apiKeyExposed: false,
    supabaseWrites: 0,
    officialPicksModified: false,
    apostarActivated: false
  }))
  process.exit(0)
}

const quotes=[]
for (const bookmaker of payload?.bookmakers ?? []) {
  for (const market of bookmaker?.markets ?? []) {
    if (market?.key !== MARKET) continue
    for (const outcome of market?.outcomes ?? []) {
      const price=Number(outcome?.price)
      const line=Number(outcome?.point)
      if (!Number.isFinite(price)||!Number.isFinite(line)) continue
      quotes.push({
        sportsbook:String(bookmaker?.key ?? bookmaker?.title ?? 'unknown'),
        sportsbookTitle:String(bookmaker?.title ?? bookmaker?.key ?? 'unknown'),
        marketLastUpdate:market?.last_update ?? bookmaker?.last_update ?? null,
        player:String(outcome?.description ?? outcome?.name ?? ''),
        selection:String(outcome?.name ?? ''),
        line,
        price
      })
    }
  }
}

console.log('PA13_PROBE_RESULT='+JSON.stringify({
  status:quotes.length?'AVAILABLE':'NO_QUOTES_RETURNED',
  contractCandidate:'PA13_PITCHER_ER_CURRENT_PROVIDER_PROBE/1.0.0',
  provider:'the-odds-api',
  market:MARKET,
  providerEventId:PROVIDER_EVENT_ID,
  httpStatus:response.status,
  commenceTime:payload?.commence_time ?? null,
  homeTeam:payload?.home_team ?? null,
  awayTeam:payload?.away_team ?? null,
  bookmakerCount:new Set(quotes.map(q=>q.sportsbook)).size,
  quoteCount:quotes.length,
  playerCount:new Set(quotes.map(q=>q.player).filter(Boolean)).size,
  lines:[...new Set(quotes.map(q=>q.line))].sort((a,b)=>a-b),
  books:[...new Set(quotes.map(q=>q.sportsbook))].sort(),
  quotes,
  requestsLast:h('x-requests-last'),
  requestsRemaining:h('x-requests-remaining'),
  requestsUsed:h('x-requests-used'),
  researchOnly:true,
  historicalPricingCertified:false,
  roiCertified:false,
  clvCertified:false,
  evCertified:false,
  supabaseWrites:0,
  officialPicksModified:false,
  apostarActivated:false,
  apiKeyExposed:false
}))
