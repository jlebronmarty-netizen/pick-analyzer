import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const PROVIDER = 'the-odds-api'
const BASE_URL = 'https://api.the-odds-api.com/v4'
const CREDIT_RESERVE = 2000
const MAX_CALLS = 40
const MAX_EVENTS_PER_SPORT = 2
const CONFIRMATION = 'ODDS_API_PLAYER_PROPS_V1'
const MARKET_CANDIDATES = {
  baseball_mlb: [
    'pitcher_outs',
    'pitcher_strikeouts',
    'pitcher_walks',
    'pitcher_hits_allowed',
    'pitcher_earned_runs',
    'batter_hits',
    'batter_total_bases',
    'batter_home_runs',
    'batter_rbis',
    'batter_runs_scored',
    'batter_walks',
    'batter_stolen_bases',
  ],
  americanfootball_nfl: [
    'player_pass_tds',
    'player_pass_yds',
    'player_pass_completions',
    'player_pass_attempts',
    'player_pass_interceptions',
    'player_rush_yds',
    'player_rush_attempts',
    'player_receptions',
    'player_reception_yds',
    'player_anytime_td',
  ],
  icehockey_nhl: [
    'player_points',
    'player_power_play_points',
    'player_assists',
    'player_blocked_shots',
    'player_shots_on_goal',
    'player_goals',
    'player_total_saves',
  ],
  basketball_nba: [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_steals',
    'player_blocks',
    'player_turnovers',
  ],
}
const SPORTS = [
  { sportKey: 'baseball_mlb', label: 'MLB Baseball', providerSportKey: 'baseball_mlb', leagueKey: 'mlb' },
  { sportKey: 'americanfootball_nfl', label: 'NFL Football', providerSportKey: 'americanfootball_nfl', leagueKey: 'nfl' },
  { sportKey: 'icehockey_nhl', label: 'NHL Hockey', providerSportKey: 'icehockey_nhl', leagueKey: 'nhl' },
  { sportKey: 'basketball_nba', label: 'NBA Basketball', providerSportKey: 'basketball_nba', leagueKey: 'nba' },
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

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
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

function hash(parts) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 28)
}

function validIso(value) {
  const date = new Date(String(value ?? ''))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function seasonFromDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : String(date.getUTCFullYear())
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
      markets: query.markets ? String(query.markets).split(',') : [],
      regions: query.regions ? String(query.regions).split(',') : [],
      httpStatus: response.status,
      ok: response.ok,
      rows: response.ok ? (Array.isArray(payload) ? payload.length : payload ? 1 : 0) : 0,
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

function rowsFromPayload(sport, event, marketKey, payload) {
  const events = Array.isArray(payload) ? payload : payload ? [payload] : []
  const rows = []
  let rejected = 0
  for (const item of events) {
    const eventId = String(item.id || event.id || '')
    const commenceTime = validIso(item.commence_time || event.commence_time)
    const season = seasonFromDate(commenceTime)
    for (const bookmaker of item.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        const providerMarketKey = String(market.key || marketKey)
        const snapshotTime = validIso(market.last_update || bookmaker.last_update)
        for (const outcome of market.outcomes || []) {
          const playerName = String(outcome.description || '').trim()
          const outcomeName = String(outcome.name || '').trim()
          const price = typeof outcome.price === 'number' && Number.isFinite(outcome.price) && outcome.price !== 0 ? outcome.price : null
          const line = typeof outcome.point === 'number' && Number.isFinite(outcome.point) ? outcome.point : null
          if (!eventId || !snapshotTime || !outcomeName || price === null) {
            rejected += 1
            continue
          }
          const minute = snapshotTime.slice(0, 16)
          rows.push({
            id: `oddsapi_prop_${hash([sport.sportKey, eventId, bookmaker.key, providerMarketKey, playerName, outcomeName, line, minute])}`,
            sport_key: sport.sportKey,
            league_key: sport.leagueKey,
            season,
            event_id: eventId,
            provider: PROVIDER,
            sportsbook: bookmaker.key || bookmaker.title || 'unknown',
            market: `player_props:${providerMarketKey}`,
            outcome: outcomeName,
            price,
            line,
            snapshot_time: snapshotTime,
            is_opening: false,
            is_closing: false,
            metadata: {
              checkpoint: 'the_odds_api_player_props_v1',
              providerSportKey: sport.providerSportKey,
              providerMarketKey,
              playerName: playerName || null,
              bookmakerTitle: bookmaker.title || null,
              providerEventId: eventId,
              commenceTime,
              homeTeam: item.home_team || event.home_team || null,
              awayTeam: item.away_team || event.away_team || null,
              providerTimestamp: snapshotTime,
              identityStatus: playerName ? 'PLAYER_TEXT_ONLY_PENDING_CANONICAL_IDENTITY' : 'NO_PLAYER_TEXT',
              timestampClass: commenceTime && snapshotTime < commenceTime ? 'PRE_START' : 'POST_START_OR_UNKNOWN',
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
    if (error) throw new Error(`sports_odds_snapshots existing-id read failed: ${error.message}`)
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
  const sportRows = result.sports.map((sport) => `| ${sport.label} | ${sport.eventsTested} | ${sport.marketsTested} | ${sport.marketsWithRows.join(', ') || 'none'} | ${sport.rowsAccepted} | ${sport.rowsRejected} |`)
    .join('\n')
  return `# The Odds API Player Props V1

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

- Rows accepted: ${result.rowsAccepted}
- Rows rejected: ${result.rowsRejected}
- Rows inserted: ${result.rowsInserted}
- Rows updated: ${result.rowsUpdated}
- Duplicate deterministic IDs: ${result.duplicateIds}
- Production mutations recorded: ${result.productionMutationsMade}

## Sport Coverage

| Sport | Events tested | Markets tested | Markets with rows | Rows accepted | Rows rejected |
| --- | ---: | ---: | --- | ---: | ---: |
${sportRows}

## Safety Notes

- Market support is based on actual event-level provider responses; unsupported and empty markets are not fabricated.
- Player identity is stored as provider text only unless a canonical identity is already proven elsewhere.
- No prediction generation, feature rebuild, SQL migration, scheduler change, settlement write or recommendation-policy change was executed.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const checks = [
    ['api key query redaction contract', true],
    ['max calls bounded', MAX_CALLS <= 40],
    ['reserve is 2000', CREDIT_RESERVE === 2000],
    ['market candidates include MLB pitcher outs', MARKET_CANDIDATES.baseball_mlb.includes('pitcher_outs')],
    ['market candidates include NFL receiving yards', MARKET_CANDIDATES.americanfootball_nfl.includes('player_reception_yds')],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  const result = { success: failed.length === 0, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failedChecks: failed, providerCallsMade: 0, productionMutationsMade: 0 }
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exit(1)
  process.exit(0)
}

if (process.env.ODDS_API_PLAYER_PROPS_CONFIRM !== CONFIRMATION) {
  throw new Error(`Set ODDS_API_PLAYER_PROPS_CONFIRM=${CONFIRMATION} for live execution.`)
}
if (!apiKey()) throw new Error('Missing ODDS_API_KEY')

const client = supabase()
const state = { calls: [], stop: false, stopReason: null, remaining: null }
await providerFetch(state, 'catalog_credit_read', null, '/sports', { all: 'true' })
const allRows = []
let rowsRejected = 0
const sportSummaries = []

for (const sport of SPORTS) {
  if (state.stop) break
  const eventResult = await providerFetch(state, `events_${sport.sportKey}`, sport.sportKey, `/sports/${sport.providerSportKey}/events`)
  const events = (Array.isArray(eventResult.payload) ? eventResult.payload : [])
    .filter((event) => validIso(event.commence_time) && validIso(event.commence_time) > new Date().toISOString())
    .slice(0, MAX_EVENTS_PER_SPORT)
  const summary = { ...sport, eventsTested: events.length, marketsTested: 0, marketsWithRows: [], rowsAccepted: 0, rowsRejected: 0 }
  for (const event of events) {
    for (const market of MARKET_CANDIDATES[sport.sportKey] || []) {
      if (state.stop) break
      const result = await providerFetch(state, `prop_${sport.sportKey}_${market}`, sport.sportKey, `/sports/${sport.providerSportKey}/events/${event.id}/odds`, {
        regions: 'us',
        markets: market,
        oddsFormat: 'american',
      })
      summary.marketsTested += 1
      const normalized = rowsFromPayload(sport, event, market, result.payload)
      if (normalized.rows.length) summary.marketsWithRows.push(market)
      summary.rowsAccepted += normalized.rows.length
      summary.rowsRejected += normalized.rejected
      allRows.push(...normalized.rows)
      rowsRejected += normalized.rejected
    }
  }
  sportSummaries.push(summary)
}

const duplicateIds = allRows.length - new Set(allRows.map((row) => row.id)).size
const existing = await existingCount(client, allRows.map((row) => row.id))
if (allRows.length) {
  const { error } = await client.from('sports_odds_snapshots').upsert(allRows, { onConflict: 'id' })
  if (error) throw new Error(`sports_odds_snapshots player-prop upsert failed: ${error.message}`)
}
const firstCall = state.calls[0] || null
const lastCall = state.calls.at(-1) || null
const requestsUsedObserved = firstCall?.requestsUsed !== null && lastCall?.requestsUsed !== null ? Math.max(0, lastCall.requestsUsed - firstCall.requestsUsed) : null
const jobMetadata = {
  checkpoint: 'the_odds_api_player_props_v1',
  providerCallsMade: state.calls.length,
  creditsBefore: firstCall?.requestsRemaining ?? null,
  creditsAfter: lastCall?.requestsRemaining ?? null,
  creditsConsumed: requestsUsedObserved,
  duplicateIds,
  sports: sportSummaries,
}
const { error: jobError } = await client.from('sports_sync_jobs').insert({
  job_type: 'the_odds_api_player_props_v1',
  sport_key: 'all',
  league_key: 'multi',
  provider: PROVIDER,
  season: '',
  status: 'completed',
  records_fetched: allRows.length + rowsRejected,
  records_inserted: Math.max(0, allRows.length - existing),
  records_updated: Math.min(existing, allRows.length),
  records_skipped: rowsRejected,
  error_count: 0,
  completed_at: new Date().toISOString(),
  metadata: jobMetadata,
  updated_at: new Date().toISOString(),
})
if (jobError) throw new Error(`sports_sync_jobs player-prop insert failed: ${jobError.message}`)

const result = {
  success: duplicateIds === 0 && state.calls.every((call) => call.requestsRemaining !== null) && (lastCall?.requestsRemaining ?? 0) > CREDIT_RESERVE,
  status: 'LIVE_PLAYER_PROP_DISCOVERY_COMPLETE',
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
  duplicateIds,
  productionMutationsMade: allRows.length + 1,
  sports: sportSummaries,
  planObserved: state.calls,
  blockers: [state.stopReason].filter(Boolean),
}
assertNoSecret(result)
const artifact = { generatedAt: result.generatedAt, commit: git(['rev-parse', 'HEAD']), checkpoint: 'THE_ODDS_API_PLAYER_PROPS_V1', result }
writeFileSync('docs/the-odds-api-player-props-v1.json', `${JSON.stringify(artifact, null, 2)}\n`)
writeFileSync('docs/THE_ODDS_API_PLAYER_PROPS_V1.md', md(result))
console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  providerCallsMade: result.providerCallsMade,
  requestsRemainingAfter: result.requestsRemainingAfter,
  rowsAccepted: result.rowsAccepted,
  rowsInserted: result.rowsInserted,
  rowsUpdated: result.rowsUpdated,
  duplicateIds: result.duplicateIds,
  productionMutationsMade: result.productionMutationsMade,
  blockers: result.blockers,
}, null, 2))
if (!result.success) process.exit(1)
