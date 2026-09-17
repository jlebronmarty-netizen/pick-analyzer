#!/usr/bin/env node

const PROJECT_ID = 'prj_hmkAkzUTe3b7M7yedvshGl5L9rP7'
const TEAM_ID = 'team_5NEeiCoWmTBO4kAkgKZwoQmN'
const SPORT_KEY = 'baseball_mlb'
const MARKET = 'pitcher_earned_runs'
const REGION = 'us'
const PROVIDER_EVENT_ID = process.env.PA13_PROVIDER_EVENT_ID?.trim() ?? ''
const VERCEL_TOKEN = process.env.VERCEL_TOKEN?.trim() ?? ''

function fail(message) {
  console.error(JSON.stringify({ status: 'BLOCKED', message }))
  process.exit(1)
}

if (!VERCEL_TOKEN) fail('VERCEL_TOKEN unavailable')
if (!PROVIDER_EVENT_ID) fail('PA13_PROVIDER_EVENT_ID unavailable')

const envUrl = new URL(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env`)
envUrl.searchParams.set('teamId', TEAM_ID)
envUrl.searchParams.set('decrypt', 'true')
const envResponse = await fetch(envUrl, {
  headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
})
if (!envResponse.ok) fail(`Vercel env read HTTP ${envResponse.status}`)
const envPayload = await envResponse.json()
const envs = Array.isArray(envPayload?.envs) ? envPayload.envs : []
const keyRow = envs.find((row) => String(row?.key ?? '') === 'THE_ODDS_API_KEY' && String(row?.value ?? '').trim())
if (!keyRow) fail('THE_ODDS_API_KEY not available from Vercel project env')
const apiKey = String(keyRow.value).trim()

const oddsUrl = new URL(`https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/events/${encodeURIComponent(PROVIDER_EVENT_ID)}/odds`)
oddsUrl.searchParams.set('apiKey', apiKey)
oddsUrl.searchParams.set('regions', REGION)
oddsUrl.searchParams.set('markets', MARKET)
oddsUrl.searchParams.set('oddsFormat', 'american')

const response = await fetch(oddsUrl, {
  headers: { Accept: 'application/json' },
})
const requestsLast = response.headers.get('x-requests-last')
const requestsRemaining = response.headers.get('x-requests-remaining')
const requestsUsed = response.headers.get('x-requests-used')
const payloadText = await response.text()
let payload = null
try { payload = JSON.parse(payloadText) } catch {}

if (!response.ok) {
  console.log(JSON.stringify({
    status: 'PROBE_HTTP_ERROR',
    market: MARKET,
    providerEventId: PROVIDER_EVENT_ID,
    httpStatus: response.status,
    requestsLast,
    requestsRemaining,
    requestsUsed,
    providerMessage: payload?.message ?? null,
    providerErrorCode: payload?.error_code ?? null,
    apiKeyExposed: false,
  }, null, 2))
  process.exit(0)
}

const quotes = []
for (const bookmaker of payload?.bookmakers ?? []) {
  for (const market of bookmaker?.markets ?? []) {
    if (market?.key !== MARKET) continue
    for (const outcome of market?.outcomes ?? []) {
      const price = Number(outcome?.price)
      const point = Number(outcome?.point)
      if (!Number.isFinite(price) || !Number.isFinite(point)) continue
      quotes.push({
        sportsbook: String(bookmaker?.key ?? bookmaker?.title ?? 'unknown'),
        sportsbookTitle: String(bookmaker?.title ?? bookmaker?.key ?? 'unknown'),
        bookmakerLastUpdate: bookmaker?.last_update ?? null,
        marketLastUpdate: market?.last_update ?? null,
        player: String(outcome?.description ?? outcome?.name ?? ''),
        selection: String(outcome?.name ?? ''),
        line: point,
        price,
      })
    }
  }
}

const books = [...new Set(quotes.map((row) => row.sportsbook))]
const players = [...new Set(quotes.map((row) => row.player).filter(Boolean))]
const lines = [...new Set(quotes.map((row) => row.line))].sort((a, b) => a - b)

console.log(JSON.stringify({
  status: quotes.length ? 'AVAILABLE' : 'NO_QUOTES_RETURNED',
  contractCandidate: 'PA13_PITCHER_ER_CURRENT_PROVIDER_PROBE/1.0.0',
  provider: 'the-odds-api',
  sportKey: SPORT_KEY,
  market: MARKET,
  region: REGION,
  providerEventId: PROVIDER_EVENT_ID,
  httpStatus: response.status,
  commenceTime: payload?.commence_time ?? null,
  homeTeam: payload?.home_team ?? null,
  awayTeam: payload?.away_team ?? null,
  bookmakerCount: books.length,
  quoteCount: quotes.length,
  playerCount: players.length,
  lines,
  books,
  quotes,
  requestsLast,
  requestsRemaining,
  requestsUsed,
  researchOnly: true,
  historicalPricingCertified: false,
  roiCertified: false,
  clvCertified: false,
  evCertified: false,
  supabaseWrites: 0,
  officialPicksModified: false,
  apostarActivated: false,
  apiKeyExposed: false,
}, null, 2))
