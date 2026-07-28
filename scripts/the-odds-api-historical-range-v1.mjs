import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const BASE_URL = 'https://api.the-odds-api.com/v4'
const PROVIDER = 'the-odds-api'
const CREDIT_RESERVE = 2000
const MAX_CALLS = 30
const CONFIRMATION = 'ODDS_API_HISTORICAL_RANGE_V1'
const SPORTS = [
  { sportKey: 'baseball_mlb', label: 'MLB Baseball', providerSportKey: 'baseball_mlb', currentSeasonStart: '2026-03-01T12:00:00Z' },
  { sportKey: 'americanfootball_nfl', label: 'NFL Football', providerSportKey: 'americanfootball_nfl', currentSeasonStart: '2025-09-01T12:00:00Z' },
  { sportKey: 'icehockey_nhl', label: 'NHL Hockey', providerSportKey: 'icehockey_nhl', currentSeasonStart: '2025-10-01T12:00:00Z' },
  { sportKey: 'basketball_nba', label: 'NBA Basketball', providerSportKey: 'basketball_nba', currentSeasonStart: '2025-10-01T12:00:00Z' },
  { sportKey: 'mma_ufc', label: 'UFC', providerSportKey: 'mma_mixed_martial_arts', currentSeasonStart: '2026-01-01T12:00:00Z' },
]
const PROBE_DATES = [
  '2026-07-27T12:00:00Z',
  '2026-04-01T12:00:00Z',
  '2025-10-15T12:00:00Z',
  '2025-04-01T12:00:00Z',
  '2024-04-01T12:00:00Z',
]

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

async function providerFetch(state, label, sportKey, path, query = {}) {
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
  const endpoint = safeParams.toString() ? `${path}?${safeParams}` : path
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
      sportKey,
      endpoint,
      historicalTimestamp: query.date || null,
      markets: query.markets ? String(query.markets).split(',') : [],
      regions: query.regions ? String(query.regions).split(',') : [],
      httpStatus: response.status,
      ok: response.ok,
      rows: response.ok ? (Array.isArray(payload?.data) ? payload.data.length : Array.isArray(payload) ? payload.length : payload ? 1 : 0) : 0,
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

function assertNoSecret(value) {
  const rendered = JSON.stringify(value)
  if (rendered.includes('apiKey=')) throw new Error('Artifact contains secret-bearing apiKey query material.')
  const key = apiKey()
  if (key && rendered.includes(key)) throw new Error('Artifact contains the raw provider key.')
}

function summarizePayload(payload) {
  const data = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
  const bookmakers = new Set()
  const markets = new Set()
  for (const event of data) {
    for (const bookmaker of event.bookmakers || []) {
      bookmakers.add(bookmaker.key)
      for (const market of bookmaker.markets || []) markets.add(market.key)
    }
  }
  return {
    events: data.length,
    bookmakers: Array.from(bookmakers).sort(),
    markets: Array.from(markets).sort(),
  }
}

function md(result) {
  const rows = result.sports.map((sport) => `| ${sport.label} | ${sport.status} | ${sport.earliestProvenTimestamp || 'none'} | ${sport.latestProvenTimestamp || 'none'} | ${sport.averageCreditsPerProbe ?? 'n/a'} | ${sport.fullSeasonCoreEstimateCredits ?? 'n/a'} | ${sport.blockers.join(', ') || 'none'} |`).join('\n')
  return `# The Odds API Historical Range Discovery V1

Generated: ${result.generatedAt}

Commit: \`${git(['rev-parse', 'HEAD'])}\`

Status: ${result.status}

## Credit Safety

- Provider calls made: ${result.providerCallsMade}
- Requests remaining before: ${result.requestsRemainingBefore ?? 'unavailable'}
- Requests remaining after: ${result.requestsRemainingAfter ?? 'unavailable'}
- Requests used observed: ${result.requestsUsedObserved ?? 'unavailable'}
- Required reserve: ${result.creditReserve}
- Rows persisted: 0

## Historical Capability

| Sport | Status | Earliest proven | Latest proven | Avg credits/probe | Full-season core estimate | Blockers |
| --- | --- | --- | --- | ---: | ---: | --- |
${rows}

## Safety Notes

- This checkpoint performs range and cost discovery only; no historical odds snapshots are imported.
- Historical event and market availability are based on actual provider responses for bounded sample timestamps.
- Full-season estimates are planning estimates from observed probe costs, not execution approval.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const checks = [
    ['max calls bounded', MAX_CALLS <= 30],
    ['reserve is 2000', CREDIT_RESERVE === 2000],
    ['historical probes include MLB', SPORTS.some((sport) => sport.sportKey === 'baseball_mlb')],
    ['probe dates are bounded', PROBE_DATES.length <= 5],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  const result = { success: failed.length === 0, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failedChecks: failed, providerCallsMade: 0, productionMutationsMade: 0 }
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exit(1)
  process.exit(0)
}

if (process.env.ODDS_API_HISTORICAL_RANGE_CONFIRM !== CONFIRMATION) {
  throw new Error(`Set ODDS_API_HISTORICAL_RANGE_CONFIRM=${CONFIRMATION} for live execution.`)
}
if (!apiKey()) throw new Error('Missing ODDS_API_KEY')

const state = { calls: [], stop: false, stopReason: null, remaining: null }
await providerFetch(state, 'catalog_credit_read', null, '/sports', { all: 'true' })
const sportResults = []
for (const sport of SPORTS) {
  const probes = []
  for (const date of PROBE_DATES) {
    if (state.stop) break
    const { payload, call } = await providerFetch(state, `historical_core_${sport.sportKey}`, sport.sportKey, `/historical/sports/${sport.providerSportKey}/odds`, {
      regions: 'us',
      markets: 'h2h',
      oddsFormat: 'american',
      date,
    })
    probes.push({ date, call, summary: summarizePayload(payload) })
  }
  const successful = probes.filter((probe) => probe.call?.ok)
  const withRows = successful.filter((probe) => probe.summary.events > 0)
  const creditCosts = probes.map((probe) => probe.call?.requestsLast).filter((value) => typeof value === 'number')
  const averageCredits = creditCosts.length ? Number((creditCosts.reduce((sum, value) => sum + value, 0) / creditCosts.length).toFixed(2)) : null
  sportResults.push({
    sportKey: sport.sportKey,
    label: sport.label,
    providerSportKey: sport.providerSportKey,
    status: successful.length ? (withRows.length ? 'HISTORICAL_CAPABLE_WITH_ROWS' : 'HISTORICAL_ENDPOINT_AVAILABLE_NO_ROWS_IN_PROBES') : 'HISTORICAL_BLOCKED_OR_UNAVAILABLE',
    earliestProvenTimestamp: withRows.map((probe) => probe.date).sort()[0] || null,
    latestProvenTimestamp: withRows.map((probe) => probe.date).sort().at(-1) || null,
    probes: probes.map((probe) => ({
      date: probe.date,
      httpStatus: probe.call?.httpStatus ?? null,
      ok: Boolean(probe.call?.ok),
      requestsLast: probe.call?.requestsLast ?? null,
      events: probe.summary.events,
      bookmakerCount: probe.summary.bookmakers.length,
      markets: probe.summary.markets,
      error: probe.call?.error ?? null,
    })),
    averageCreditsPerProbe: averageCredits,
    fullSeasonCoreEstimateCredits: averageCredits === null ? null : Math.ceil(6 * 180 * averageCredits),
    blockers: [
      successful.length ? null : 'NO_SUCCESSFUL_HISTORICAL_PROBE',
      withRows.length ? null : 'NO_HISTORICAL_ROWS_IN_SAMPLE_DATES',
    ].filter(Boolean),
  })
  if (state.stop) break
}

const firstCall = state.calls[0] || null
const lastCall = state.calls.at(-1) || null
const requestsUsedObserved = firstCall?.requestsUsed !== null && lastCall?.requestsUsed !== null ? Math.max(0, lastCall.requestsUsed - firstCall.requestsUsed) : null
const result = {
  success: state.calls.every((call) => call.requestsRemaining !== null) && (lastCall?.requestsRemaining ?? 0) > CREDIT_RESERVE,
  status: 'LIVE_HISTORICAL_RANGE_DISCOVERY_COMPLETE',
  generatedAt: new Date().toISOString(),
  provider: PROVIDER,
  providerCallsMade: state.calls.length,
  requestsRemainingBefore: firstCall?.requestsRemaining ?? null,
  requestsRemainingAfter: lastCall?.requestsRemaining ?? null,
  requestsUsedObserved,
  creditReserve: CREDIT_RESERVE,
  rowsPersisted: 0,
  productionMutationsMade: 0,
  sports: sportResults,
  planObserved: state.calls,
  blockers: [state.stopReason].filter(Boolean),
}
assertNoSecret(result)
const artifact = { generatedAt: result.generatedAt, commit: git(['rev-parse', 'HEAD']), checkpoint: 'THE_ODDS_API_HISTORICAL_RANGE_DISCOVERY_V1', result }
writeFileSync('docs/the-odds-api-historical-range-v1.json', `${JSON.stringify(artifact, null, 2)}\n`)
writeFileSync('docs/THE_ODDS_API_HISTORICAL_RANGE_V1.md', md(result))
console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  providerCallsMade: result.providerCallsMade,
  requestsRemainingAfter: result.requestsRemainingAfter,
  requestsUsedObserved: result.requestsUsedObserved,
  historicalCapableSports: result.sports.filter((sport) => sport.status === 'HISTORICAL_CAPABLE_WITH_ROWS').length,
  blockers: result.blockers,
}, null, 2))
if (!result.success) process.exit(1)
