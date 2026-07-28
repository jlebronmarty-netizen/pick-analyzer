import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const PROVIDER = 'the-odds-api'
const BASE_URL = 'https://api.the-odds-api.com/v4'
const CONFIRM_AUDIT = 'MULTI_SPORT_RESULTS_CROSSWALK_FOUNDATION_V1'
const CONFIRM_PERSIST = 'MULTI_SPORT_RESULTS_CROSSWALK_FOUNDATION_V1_PERSIST'
const CREDIT_RESERVE = 2000
const MAX_CALLS = 10

const TARGETS = [
  { sportKey: 'basketball_nba', label: 'NBA', providerSportKey: 'basketball_nba', daysFrom: 3, competition: 'nba' },
  { sportKey: 'americanfootball_nfl', label: 'NFL', providerSportKey: 'americanfootball_nfl', daysFrom: 3, competition: 'nfl' },
  { sportKey: 'icehockey_nhl', label: 'NHL', providerSportKey: 'icehockey_nhl', daysFrom: 3, competition: 'nhl' },
  { sportKey: 'soccer', label: 'Soccer aggregate', providerSportKey: 'soccer', daysFrom: 3, competition: 'soccer_aggregate' },
  { sportKey: 'mma_ufc', label: 'UFC/MMA', providerSportKey: 'mma_mixed_martial_arts', daysFrom: 3, competition: 'ufc' },
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
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
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

function assertNoSecret(value) {
  const rendered = JSON.stringify(value)
  const key = apiKey()
  if (rendered.includes('apiKey=')) throw new Error('Artifact contains apiKey query text.')
  if (key && rendered.includes(key)) throw new Error('Artifact contains the raw provider key.')
}

function scoreFor(event, teamName) {
  const row = Array.isArray(event.scores) ? event.scores.find((score) => score.name === teamName) : null
  const parsed = Number(row?.score)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeResult(target, event) {
  if (!event?.completed) return null
  const homeScore = scoreFor(event, event.home_team)
  const awayScore = scoreFor(event, event.away_team)
  if (homeScore === null || awayScore === null) return null
  return {
    sport_key: target.sportKey,
    game_id: String(event.id),
    home_team: String(event.home_team),
    away_team: String(event.away_team),
    home_score: homeScore,
    away_score: awayScore,
    winner: homeScore === awayScore ? 'draw' : homeScore > awayScore ? String(event.home_team) : String(event.away_team),
    commence_time: new Date(event.commence_time).toISOString(),
  }
}

async function providerFetch(state, target) {
  if (state.calls.length >= MAX_CALLS) {
    state.stopReason = state.stopReason ?? 'HARD_CALL_BUDGET_REACHED'
    return { payload: [], call: null }
  }
  if (state.remaining !== null && state.remaining <= CREDIT_RESERVE) {
    state.stopReason = 'CREDIT_RESERVE_REACHED'
    return { payload: [], call: null }
  }

  const url = new URL(`${BASE_URL}/sports/${target.providerSportKey}/scores`)
  url.searchParams.set('apiKey', apiKey())
  url.searchParams.set('daysFrom', String(target.daysFrom))
  const endpoint = `/sports/${target.providerSportKey}/scores?daysFrom=${target.daysFrom}`
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
      sportKey: target.sportKey,
      competition: target.competition,
      endpoint,
      httpStatus: response.status,
      ok: response.ok,
      rows: response.ok && Array.isArray(payload) ? payload.length : 0,
      requestsRemaining: headerNumber(response.headers, 'x-requests-remaining'),
      requestsUsed: headerNumber(response.headers, 'x-requests-used'),
      requestsLast: headerNumber(response.headers, 'x-requests-last'),
      error: response.ok ? null : sanitize(payload),
    }
    state.calls.push(call)
    state.remaining = call.requestsRemaining
    if (call.requestsRemaining === null) state.stopReason = 'CREDIT_HEADERS_UNAVAILABLE'
    if (call.requestsRemaining !== null && call.requestsRemaining <= CREDIT_RESERVE) state.stopReason = 'CREDIT_RESERVE_REACHED'
    return { payload: response.ok ? payload : [], call }
  } finally {
    clearTimeout(timeout)
  }
}

async function countBy(client, table, sportKey, build) {
  let query = client.from(table).select('id', { count: 'exact', head: true })
  if (sportKey) query = query.eq('sport_key', sportKey)
  if (build) query = build(query)
  const { count, error } = await query
  if (error) return { count: null, error: error.message }
  return { count: count ?? 0, error: null }
}

async function storedEvidence(client, sportKey) {
  const [odds, mappings, canonicalEvents, results, predictions] = await Promise.all([
    countBy(client, 'sports_odds_snapshots', sportKey, (query) => query.eq('provider', PROVIDER)),
    countBy(client, 'provider_entity_mappings', sportKey, (query) => query.eq('provider', PROVIDER).eq('entity_type', 'event')),
    countBy(client, 'sport_events', sportKey),
    countBy(client, 'game_results', sportKey),
    countBy(client, 'prediction_history', sportKey),
  ])
  return { odds, mappings, canonicalEvents, results, predictions }
}

async function existingRows(client, rows) {
  if (!rows.length) return new Map()
  const { data, error } = await client
    .from('game_results')
    .select('game_id,sport_key,home_team,away_team,home_score,away_score,winner,commence_time')
    .in('game_id', rows.map((row) => row.game_id))
  if (error) throw new Error(`game_results existing read failed: ${error.message}`)
  return new Map((data ?? []).map((row) => [`${row.sport_key}:${row.game_id}`, row]))
}

function sameResult(a, b) {
  return b && a.home_team === b.home_team && a.away_team === b.away_team && a.home_score === b.home_score && a.away_score === b.away_score && a.winner === b.winner
}

async function persistResults(client, rows) {
  const existing = await existingRows(client, rows)
  const inserts = rows.filter((row) => !existing.has(`${row.sport_key}:${row.game_id}`))
  const updates = rows.filter((row) => existing.has(`${row.sport_key}:${row.game_id}`) && !sameResult(row, existing.get(`${row.sport_key}:${row.game_id}`)))
  const reused = rows.length - inserts.length - updates.length

  if (inserts.length) {
    const { error } = await client.from('game_results').insert(inserts)
    if (error) throw new Error(`game_results insert failed: ${error.message}`)
  }
  for (const row of updates) {
    const { error } = await client.from('game_results').update({
      home_team: row.home_team,
      away_team: row.away_team,
      home_score: row.home_score,
      away_score: row.away_score,
      winner: row.winner,
      commence_time: row.commence_time,
    }).eq('sport_key', row.sport_key).eq('game_id', row.game_id)
    if (error) throw new Error(`game_results update failed for ${row.game_id}: ${error.message}`)
  }
  return { inserted: inserts.length, updated: updates.length, reused }
}

function md(result) {
  const rows = result.sports.map((sport) => `| ${sport.label} | ${sport.providerSportKey} | ${sport.httpStatus ?? 'not called'} | ${sport.eventsReturned} | ${sport.completedRows} | ${sport.rowsInserted} | ${sport.rowsUpdated} | ${sport.stored.odds.count ?? 'unknown'} | ${sport.stored.canonicalEvents.count ?? 'unknown'} | ${sport.stored.results.count ?? 'unknown'} | ${sport.lifecycleState} |`).join('\n')
  return `# Multi-Sport Results Crosswalk Foundation V1

Generated: ${result.generatedAt}

Commit: \`${git(['rev-parse', 'HEAD'])}\`

Status: ${result.status}

## Execution

- Provider calls made: ${result.providerCallsMade}
- Production mutations made: ${result.productionMutationsMade}
- Requests remaining before: ${result.requestsRemainingBefore ?? 'unavailable'}
- Requests remaining after: ${result.requestsRemainingAfter ?? 'unavailable'}
- Required reserve: ${result.creditReserve}
- Persist mode: ${result.persist}

## Sport Evidence

| Sport | Provider key | Score HTTP | Score events | Completed rows | Inserted | Updated | Stored odds | Canonical events | Stored results | Lifecycle state |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows}

## Safety Notes

- Provider-native event mappings are not treated as certified canonical crosswalks.
- Completed score rows are persisted only when The Odds API marks an event completed and supplies numeric home/away scores.
- No predictions, recommendations, model weights, thresholds, epochs, feature rebuilds or learning weights are changed.
- Sports without exact canonical event/result chains remain blocked from Preview prediction activation.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const checks = [
    ['targets are bounded', TARGETS.length <= 5],
    ['call budget is bounded', MAX_CALLS <= 10],
    ['credit reserve is preserved', CREDIT_RESERVE === 2000],
    ['persist confirmation is distinct', CONFIRM_PERSIST !== CONFIRM_AUDIT],
    ['UFC daysFrom uses provider-safe cap', TARGETS.find((target) => target.sportKey === 'mma_ufc')?.daysFrom === 3],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  const result = { success: failed.length === 0, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failedChecks: failed, providerCallsMade: 0, productionMutationsMade: 0 }
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exit(1)
  process.exit(0)
}

const persist = process.argv.includes('--persist')
const confirmation = process.env.MULTI_SPORT_RESULTS_CROSSWALK_CONFIRM
if (confirmation !== (persist ? CONFIRM_PERSIST : CONFIRM_AUDIT)) {
  throw new Error(`Set MULTI_SPORT_RESULTS_CROSSWALK_CONFIRM=${persist ? CONFIRM_PERSIST : CONFIRM_AUDIT} for this execution.`)
}
if (!apiKey()) throw new Error('Missing ODDS_API_KEY')

const client = supabase()
const state = { calls: [], remaining: null, stopReason: null }
const sportResults = []
let totalInserted = 0
let totalUpdated = 0
let totalReused = 0

for (const target of TARGETS) {
  if (state.stopReason) break
  const storedBefore = await storedEvidence(client, target.sportKey)
  const { payload, call } = await providerFetch(state, target)
  const providerEvents = Array.isArray(payload) ? payload : []
  const completedRows = providerEvents.map((event) => normalizeResult(target, event)).filter(Boolean)
  const persistence = persist ? await persistResults(client, completedRows) : { inserted: 0, updated: 0, reused: 0 }
  totalInserted += persistence.inserted
  totalUpdated += persistence.updated
  totalReused += persistence.reused
  const storedAfter = await storedEvidence(client, target.sportKey)
  const canonicalMappings = storedBefore.mappings.count && storedBefore.canonicalEvents.count
    ? Math.min(storedBefore.mappings.count, storedBefore.canonicalEvents.count)
    : 0
  const lifecycleState = completedRows.length && canonicalMappings
    ? 'FOUNDATION_WITH_RESULTS_PENDING_CHAIN_CERTIFICATION'
    : storedBefore.odds.count
      ? 'FOUNDATION_BLOCKED_BY_RESULT_OR_CANONICAL_CROSSWALK'
      : 'BLOCKED_NO_STORED_ODDS_FOUNDATION'
  sportResults.push({
    ...target,
    httpStatus: call?.httpStatus ?? null,
    eventsReturned: call?.rows ?? 0,
    completedRows: completedRows.length,
    rowsInserted: persistence.inserted,
    rowsUpdated: persistence.updated,
    rowsReused: persistence.reused,
    stored: storedAfter,
    storedBefore,
    lifecycleState,
    blockers: [
      storedAfter.odds.count ? null : 'STORED_ODDS_EMPTY',
      storedAfter.canonicalEvents.count ? null : 'CANONICAL_EVENTS_EMPTY',
      storedAfter.results.count ? null : 'COMPLETED_RESULTS_EMPTY',
      canonicalMappings ? null : 'EXACT_CANONICAL_CROSSWALK_NOT_PROVEN',
    ].filter(Boolean),
  })
}

if (persist) {
  const { error } = await client.from('sports_sync_jobs').insert({
    job_type: 'multi_sport_results_crosswalk_foundation_v1',
    sport_key: 'all',
    league_key: 'multi',
    provider: PROVIDER,
    season: '',
    status: 'completed',
    records_fetched: sportResults.reduce((sum, sport) => sum + sport.eventsReturned, 0),
    records_inserted: totalInserted,
    records_updated: totalUpdated,
    records_skipped: totalReused,
    error_count: 0,
    completed_at: new Date().toISOString(),
    metadata: {
      checkpoint: 'multi_sport_results_crosswalk_foundation_v1',
      providerCallsMade: state.calls.length,
      rowsInserted: totalInserted,
      rowsUpdated: totalUpdated,
      rowsReused: totalReused,
      stopReason: state.stopReason,
    },
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`sports_sync_jobs insert failed: ${error.message}`)
}

const first = state.calls[0] ?? null
const last = state.calls.at(-1) ?? null
const result = {
  success: true,
  status: 'MULTI_SPORT_RESULTS_CROSSWALK_FOUNDATION_COMPLETE',
  generatedAt: new Date().toISOString(),
  provider: PROVIDER,
  persist,
  providerCallsMade: state.calls.length,
  productionMutationsMade: totalInserted + totalUpdated + (persist ? 1 : 0),
  remoteMutationsMade: totalInserted + totalUpdated + (persist ? 1 : 0),
  rowsInserted: totalInserted,
  rowsUpdated: totalUpdated,
  rowsReused: totalReused,
  creditReserve: CREDIT_RESERVE,
  requestsRemainingBefore: first?.requestsRemaining ?? null,
  requestsRemainingAfter: last?.requestsRemaining ?? null,
  requestsUsedObserved: first?.requestsUsed !== null && last?.requestsUsed !== null ? Math.max(0, Number(last.requestsUsed) - Number(first.requestsUsed)) : null,
  sports: sportResults,
  planObserved: state.calls,
  stopReason: state.stopReason,
  blockers: Array.from(new Set(sportResults.flatMap((sport) => sport.blockers))),
}
assertNoSecret(result)
const artifact = { generatedAt: result.generatedAt, commit: git(['rev-parse', 'HEAD']), checkpoint: 'MULTI_SPORT_RESULTS_CROSSWALK_FOUNDATION_V1', result }
writeFileSync('docs/multi-sport-results-crosswalk-foundation-v1.json', `${JSON.stringify(artifact, null, 2)}\n`)
writeFileSync('docs/MULTI_SPORT_RESULTS_CROSSWALK_FOUNDATION_V1.md', md(result))
console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  providerCallsMade: result.providerCallsMade,
  productionMutationsMade: result.productionMutationsMade,
  rowsInserted: result.rowsInserted,
  rowsUpdated: result.rowsUpdated,
  requestsRemainingAfter: result.requestsRemainingAfter,
  blockers: result.blockers,
}, null, 2))
