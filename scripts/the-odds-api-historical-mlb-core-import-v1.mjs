import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const PROVIDER = 'the-odds-api'
const BASE_URL = 'https://api.the-odds-api.com/v4'
const CREDIT_RESERVE = 2000
const MAX_CALLS = 8
const CONFIRMATION = 'ODDS_API_HISTORICAL_MLB_CORE_IMPORT_V1'
const SPORT = { sportKey: 'baseball_mlb', leagueKey: 'mlb', label: 'MLB Baseball', providerSportKey: 'baseball_mlb' }
const HISTORICAL_DATES = [
  '2026-04-01T12:00:00Z',
  '2026-05-15T12:00:00Z',
  '2026-06-15T12:00:00Z',
  '2026-07-15T12:00:00Z',
  '2026-07-27T12:00:00Z',
]
const MARKETS = ['h2h', 'spreads', 'totals']

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function apiKey() {
  return (process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY || '').trim()
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function hash(parts) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 28)
}

function headerNumber(headers, name) {
  const value = headers.get(name)
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sanitize(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return raw.replace(/apiKey=[^&\s"]+/gi, 'apiKey=[REDACTED]').replace(/"apiKey"\s*:\s*"[^"]+"/gi, '"apiKey":"[REDACTED]"').slice(0, 500)
}

function validIso(value) {
  const date = new Date(String(value ?? ''))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function seasonFromDate(value) {
  const iso = validIso(value)
  return iso ? String(new Date(iso).getUTCFullYear()) : ''
}

function canonicalMarket(providerMarket) {
  if (providerMarket === 'h2h') return 'moneyline'
  if (providerMarket === 'spreads') return 'spread'
  if (providerMarket === 'totals') return 'total'
  return providerMarket
}

async function providerFetch(state, label, path, query) {
  if (state.stop || state.calls.length >= MAX_CALLS) {
    state.stop = true
    state.stopReason ||= 'HARD_CALL_BUDGET_REACHED'
    return { payload: null, call: null }
  }
  if (state.remaining !== null && state.remaining <= CREDIT_RESERVE) {
    state.stop = true
    state.stopReason = 'CREDIT_RESERVE_REACHED'
    return { payload: null, call: null }
  }
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('apiKey', apiKey())
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  const safeParams = new URLSearchParams(query)
  const endpoint = `${path}?${safeParams}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
    const text = await response.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = text
    }
    const call = {
      label,
      sportKey: SPORT.sportKey,
      endpoint,
      historicalTimestamp: query.date,
      markets: String(query.markets || '').split(',').filter(Boolean),
      regions: String(query.regions || '').split(',').filter(Boolean),
      httpStatus: response.status,
      ok: response.ok,
      rows: response.ok ? (Array.isArray(payload?.data) ? payload.data.length : 0) : 0,
      requestsRemaining: headerNumber(response.headers, 'x-requests-remaining'),
      requestsUsed: headerNumber(response.headers, 'x-requests-used'),
      requestsLast: headerNumber(response.headers, 'x-requests-last'),
      error: response.ok ? null : sanitize(payload),
    }
    state.calls.push(call)
    state.remaining = call.requestsRemaining
    if (call.requestsRemaining === null) {
      state.stop = true
      state.stopReason = 'CREDIT_HEADERS_UNAVAILABLE'
    }
    return { payload: response.ok ? payload : null, call }
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeRows(payload, requestedDate) {
  const snapshotTime = validIso(payload?.timestamp) || requestedDate
  const rows = []
  let rejected = 0
  for (const event of payload?.data || []) {
    const eventId = String(event.id || '')
    const commenceTime = validIso(event.commence_time)
    for (const bookmaker of event.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        const providerMarket = String(market.key || '')
        for (const outcome of market.outcomes || []) {
          const outcomeName = String(outcome.name || '').trim()
          const price = typeof outcome.price === 'number' && Number.isFinite(outcome.price) && outcome.price !== 0 ? outcome.price : null
          const line = typeof outcome.point === 'number' && Number.isFinite(outcome.point) ? outcome.point : null
          if (!eventId || !providerMarket || !outcomeName || price === null) {
            rejected += 1
            continue
          }
          const timestampClass = commenceTime && snapshotTime < commenceTime ? 'PRE_START' : commenceTime && snapshotTime >= commenceTime ? 'POST_START' : 'INVALID_TIMESTAMP'
          rows.push({
            id: `oddsapi_hist_${hash([SPORT.sportKey, eventId, bookmaker.key, providerMarket, outcomeName, line, snapshotTime])}`,
            sport_key: SPORT.sportKey,
            league_key: SPORT.leagueKey,
            season: seasonFromDate(commenceTime || snapshotTime),
            event_id: eventId,
            provider: PROVIDER,
            sportsbook: bookmaker.key || bookmaker.title || 'unknown',
            market: canonicalMarket(providerMarket),
            outcome: outcomeName,
            price,
            line,
            snapshot_time: snapshotTime,
            is_opening: false,
            is_closing: false,
            metadata: {
              checkpoint: 'the_odds_api_historical_mlb_core_import_v1',
              providerSportKey: SPORT.providerSportKey,
              providerMarketKey: providerMarket,
              providerEventId: eventId,
              requestedHistoricalTimestamp: requestedDate,
              providerTimestamp: snapshotTime,
              commenceTime,
              timestampClass,
              sourceEndpointFamily: 'historical_odds',
              homeTeam: event.home_team || null,
              awayTeam: event.away_team || null,
            },
            updated_at: new Date().toISOString(),
          })
        }
      }
    }
  }
  return { rows, rejected }
}

async function existingCount(client, ids) {
  let count = 0
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    const { data, error } = await client.from('sports_odds_snapshots').select('id').in('id', chunk)
    if (error) throw new Error(`sports_odds_snapshots historical existing-id read failed: ${error.message}`)
    count += data?.length || 0
  }
  return count
}

function assertNoSecret(value) {
  const rendered = JSON.stringify(value)
  if (rendered.includes('apiKey=')) throw new Error('Artifact contains secret-bearing apiKey query material.')
  const key = apiKey()
  if (key && rendered.includes(key)) throw new Error('Artifact contains the raw provider key.')
}

function md(result) {
  return `# The Odds API Historical MLB Core Import V1

Generated: ${result.generatedAt}

Commit: \`${git(['rev-parse', 'HEAD'])}\`

Status: ${result.status}

## Credit Safety

- Provider calls made: ${result.providerCallsMade}
- Requests remaining before: ${result.requestsRemainingBefore ?? 'unavailable'}
- Requests remaining after: ${result.requestsRemainingAfter ?? 'unavailable'}
- Requests used observed: ${result.requestsUsedObserved ?? 'unavailable'}
- Required reserve: ${result.creditReserve}

## Persistence

- Historical dates requested: ${HISTORICAL_DATES.join(', ')}
- Markets requested: ${MARKETS.join(', ')}
- Rows accepted: ${result.rowsAccepted}
- Rows rejected: ${result.rowsRejected}
- Rows inserted: ${result.rowsInserted}
- Rows updated: ${result.rowsUpdated}
- Pre-start rows: ${result.timestampClasses.PRE_START}
- Post-start rows: ${result.timestampClasses.POST_START}
- Invalid timestamp rows: ${result.timestampClasses.INVALID_TIMESTAMP}
- Duplicate deterministic IDs: ${result.duplicateIds}
- Production mutations recorded: ${result.productionMutationsMade}

## Safety Notes

- This is a narrow MLB current-season historical core-market import, not broad historical execution.
- Rows are timestamp-classified; only PRE_START rows are eligible for pregame feature and closing-candidate use.
- No prediction generation, feature rebuild, SQL migration, scheduler change, settlement write or recommendation-policy change was executed.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const checks = [
    ['max calls bounded', MAX_CALLS <= 8],
    ['reserve is 2000', CREDIT_RESERVE === 2000],
    ['markets are core only', MARKETS.join(',') === 'h2h,spreads,totals'],
    ['historical date count bounded', HISTORICAL_DATES.length <= 5],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  const result = { success: failed.length === 0, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failedChecks: failed, providerCallsMade: 0, productionMutationsMade: 0 }
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exit(1)
  process.exit(0)
}

if (process.env.ODDS_API_HISTORICAL_MLB_CORE_CONFIRM !== CONFIRMATION) {
  throw new Error(`Set ODDS_API_HISTORICAL_MLB_CORE_CONFIRM=${CONFIRMATION} for live execution.`)
}
if (!apiKey()) throw new Error('Missing ODDS_API_KEY')

const client = supabase()
const state = { calls: [], stop: false, stopReason: null, remaining: null }
const allRows = []
let rowsRejected = 0
const byDate = []

await providerFetch(state, 'catalog_credit_read', '/sports', { all: 'true' })
for (const date of HISTORICAL_DATES) {
  if (state.stop) break
  const { payload, call } = await providerFetch(state, `historical_mlb_core_${date}`, `/historical/sports/${SPORT.providerSportKey}/odds`, {
    regions: 'us',
    markets: MARKETS.join(','),
    oddsFormat: 'american',
    date,
  })
  const normalized = normalizeRows(payload, date)
  allRows.push(...normalized.rows)
  rowsRejected += normalized.rejected
  byDate.push({ date, httpStatus: call?.httpStatus ?? null, requestsLast: call?.requestsLast ?? null, events: call?.rows ?? 0, rowsAccepted: normalized.rows.length, rowsRejected: normalized.rejected })
}

const duplicateIds = allRows.length - new Set(allRows.map((row) => row.id)).size
const existing = await existingCount(client, allRows.map((row) => row.id))
if (allRows.length) {
  const { error } = await client.from('sports_odds_snapshots').upsert(allRows, { onConflict: 'id' })
  if (error) throw new Error(`sports_odds_snapshots historical upsert failed: ${error.message}`)
}
const timestampClasses = allRows.reduce((acc, row) => {
  const value = String(row.metadata.timestampClass || 'INVALID_TIMESTAMP')
  acc[value] = (acc[value] || 0) + 1
  return acc
}, { PRE_START: 0, POST_START: 0, INVALID_TIMESTAMP: 0 })
const firstCall = state.calls[0] || null
const lastCall = state.calls.at(-1) || null
const requestsUsedObserved = firstCall?.requestsUsed !== null && lastCall?.requestsUsed !== null ? Math.max(0, lastCall.requestsUsed - firstCall.requestsUsed) : null
const metadata = {
  checkpoint: 'the_odds_api_historical_mlb_core_import_v1',
  providerCallsMade: state.calls.length,
  creditsBefore: firstCall?.requestsRemaining ?? null,
  creditsAfter: lastCall?.requestsRemaining ?? null,
  creditsConsumed: requestsUsedObserved,
  dates: byDate,
  marketsRequested: MARKETS,
  timestampClasses,
  duplicateIds,
}
const { error: jobError } = await client.from('sports_sync_jobs').insert({
  job_type: 'the_odds_api_historical_mlb_core_import_v1',
  sport_key: SPORT.sportKey,
  league_key: SPORT.leagueKey,
  provider: PROVIDER,
  season: '2026',
  status: 'completed',
  records_fetched: allRows.length + rowsRejected,
  records_inserted: Math.max(0, allRows.length - existing),
  records_updated: Math.min(existing, allRows.length),
  records_skipped: rowsRejected,
  error_count: 0,
  completed_at: new Date().toISOString(),
  metadata,
  updated_at: new Date().toISOString(),
})
if (jobError) throw new Error(`sports_sync_jobs historical insert failed: ${jobError.message}`)

const result = {
  success: duplicateIds === 0 && state.calls.every((call) => call.requestsRemaining !== null) && (lastCall?.requestsRemaining ?? 0) > CREDIT_RESERVE,
  status: 'LIVE_HISTORICAL_MLB_CORE_IMPORT_COMPLETE',
  generatedAt: new Date().toISOString(),
  provider: PROVIDER,
  providerCallsMade: state.calls.length,
  requestsRemainingBefore: firstCall?.requestsRemaining ?? null,
  requestsRemainingAfter: lastCall?.requestsRemaining ?? null,
  requestsUsedObserved,
  creditReserve: CREDIT_RESERVE,
  rowsAccepted: allRows.length,
  rowsRejected,
  rowsInserted: Math.max(0, allRows.length - existing),
  rowsUpdated: Math.min(existing, allRows.length),
  timestampClasses,
  duplicateIds,
  productionMutationsMade: allRows.length + 1,
  byDate,
  planObserved: state.calls,
  blockers: [state.stopReason].filter(Boolean),
}
assertNoSecret(result)
const artifact = { generatedAt: result.generatedAt, commit: git(['rev-parse', 'HEAD']), checkpoint: 'THE_ODDS_API_HISTORICAL_MLB_CORE_IMPORT_V1', result }
writeFileSync('docs/the-odds-api-historical-mlb-core-import-v1.json', `${JSON.stringify(artifact, null, 2)}\n`)
writeFileSync('docs/THE_ODDS_API_HISTORICAL_MLB_CORE_IMPORT_V1.md', md(result))
console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  providerCallsMade: result.providerCallsMade,
  requestsRemainingAfter: result.requestsRemainingAfter,
  requestsUsedObserved: result.requestsUsedObserved,
  rowsAccepted: result.rowsAccepted,
  rowsInserted: result.rowsInserted,
  rowsUpdated: result.rowsUpdated,
  preStartRows: result.timestampClasses.PRE_START,
  postStartRows: result.timestampClasses.POST_START,
  duplicateIds: result.duplicateIds,
  productionMutationsMade: result.productionMutationsMade,
  blockers: result.blockers,
}, null, 2))
if (!result.success) process.exit(1)
