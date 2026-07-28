import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const PROVIDER = 'the-odds-api'
const BASE_URL = 'https://api.the-odds-api.com/v4'
const CREDIT_RESERVE = 2000
const CONFIRMATION = 'ODDS_API_SCORES_RESULTS_V1'
const SPORTS = [
  { sportKey: 'americanfootball_nfl', label: 'NFL Football', providerSportKey: 'americanfootball_nfl', daysFrom: 7 },
  { sportKey: 'icehockey_nhl', label: 'NHL Hockey', providerSportKey: 'icehockey_nhl', daysFrom: 3 },
  { sportKey: 'basketball_nba', label: 'NBA Basketball', providerSportKey: 'basketball_nba', daysFrom: 3 },
  { sportKey: 'mma_ufc', label: 'UFC', providerSportKey: 'mma_mixed_martial_arts', daysFrom: 30 },
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

function scoreFor(event, teamName) {
  const row = Array.isArray(event.scores) ? event.scores.find((score) => score.name === teamName) : null
  const parsed = Number(row?.score)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeResult(sport, event) {
  if (!event.completed) return null
  const homeScore = scoreFor(event, event.home_team)
  const awayScore = scoreFor(event, event.away_team)
  if (homeScore === null || awayScore === null) return null
  return {
    sport_key: sport.sportKey,
    game_id: String(event.id),
    home_team: String(event.home_team),
    away_team: String(event.away_team),
    home_score: homeScore,
    away_score: awayScore,
    winner: homeScore === awayScore ? 'draw' : homeScore > awayScore ? String(event.home_team) : String(event.away_team),
    commence_time: new Date(event.commence_time).toISOString(),
  }
}

async function providerFetch(sport) {
  const url = new URL(`${BASE_URL}/sports/${sport.providerSportKey}/scores`)
  url.searchParams.set('apiKey', apiKey())
  url.searchParams.set('daysFrom', String(sport.daysFrom))
  const endpoint = `/sports/${sport.providerSportKey}/scores?daysFrom=${sport.daysFrom}`
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
    return {
      payload: response.ok ? payload : null,
      call: {
        sportKey: sport.sportKey,
        endpoint,
        httpStatus: response.status,
        ok: response.ok,
        rows: response.ok && Array.isArray(payload) ? payload.length : 0,
        requestsRemaining: headerNumber(response.headers, 'x-requests-remaining'),
        requestsUsed: headerNumber(response.headers, 'x-requests-used'),
        requestsLast: headerNumber(response.headers, 'x-requests-last'),
        error: response.ok ? null : sanitize(payload),
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function existingRows(client, rows) {
  if (!rows.length) return new Map()
  const { data, error } = await client.from('game_results').select('game_id, sport_key, home_team, away_team, home_score, away_score, winner, commence_time').in('game_id', rows.map((row) => row.game_id))
  if (error) throw new Error(`game_results existing read failed: ${error.message}`)
  return new Map((data || []).map((row) => [row.game_id, row]))
}

function same(a, b) {
  return b && a.home_team === b.home_team && a.away_team === b.away_team && a.home_score === b.home_score && a.away_score === b.away_score && a.winner === b.winner
}

function assertNoSecret(value) {
  const rendered = JSON.stringify(value)
  if (rendered.includes('apiKey=')) throw new Error('Artifact contains secret-bearing apiKey query material.')
  const key = apiKey()
  if (key && rendered.includes(key)) throw new Error('Artifact contains the raw provider key.')
}

function md(result) {
  const rows = result.sports.map((sport) => `| ${sport.label} | ${sport.httpStatus} | ${sport.eventsReturned} | ${sport.completedRows} | ${sport.inserted} | ${sport.updated} | ${sport.reused} | ${sport.message} |`).join('\n')
  return `# The Odds API Scores Results V1

Generated: ${result.generatedAt}

Commit: \`${git(['rev-parse', 'HEAD'])}\`

Status: ${result.status}

## Credit Safety

- Provider calls made: ${result.providerCallsMade}
- Requests remaining before: ${result.requestsRemainingBefore ?? 'unavailable'}
- Requests remaining after: ${result.requestsRemainingAfter ?? 'unavailable'}
- Requests used observed: ${result.requestsUsedObserved ?? 'unavailable'}
- Required reserve: ${result.creditReserve}

## Result Coverage

| Sport | HTTP | Events returned | Completed rows | Inserted | Updated | Reused | Message |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows}

## Safety Notes

- MLB is excluded because MLB Stats remains the stronger canonical result source.
- The Odds API scores are stored only as exact completed score rows for non-MLB sports.
- No box scores, player stats, injuries, lineup data, prediction generation or settlement execution was inferred.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const checks = [
    ['reserve is 2000', CREDIT_RESERVE === 2000],
    ['MLB excluded from weaker provider writes', !SPORTS.some((sport) => sport.sportKey === 'baseball_mlb')],
    ['sports bounded', SPORTS.length <= 4],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  const result = { success: failed.length === 0, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failedChecks: failed, providerCallsMade: 0, productionMutationsMade: 0 }
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exit(1)
  process.exit(0)
}

if (process.env.ODDS_API_SCORES_RESULTS_CONFIRM !== CONFIRMATION) {
  throw new Error(`Set ODDS_API_SCORES_RESULTS_CONFIRM=${CONFIRMATION} for live execution.`)
}
if (!apiKey()) throw new Error('Missing ODDS_API_KEY')
const client = supabase()
const calls = []
const sportResults = []
let inserted = 0
let updated = 0
let reused = 0

for (const sport of SPORTS) {
  const { payload, call } = await providerFetch(sport)
  calls.push(call)
  if (call.requestsRemaining === null) throw new Error(`Credit headers unavailable for ${sport.sportKey}`)
  if (call.requestsRemaining <= CREDIT_RESERVE) throw new Error(`Credit reserve reached after ${sport.sportKey}`)
  const rows = (Array.isArray(payload) ? payload : []).map((event) => normalizeResult(sport, event)).filter(Boolean)
  const existing = await existingRows(client, rows)
  const inserts = rows.filter((row) => !existing.has(row.game_id))
  const updates = rows.filter((row) => existing.has(row.game_id) && !same(row, existing.get(row.game_id)))
  const sameRows = rows.filter((row) => existing.has(row.game_id) && same(row, existing.get(row.game_id)))
  if (inserts.length) {
    const { error } = await client.from('game_results').insert(inserts)
    if (error) throw new Error(`game_results insert failed for ${sport.sportKey}: ${error.message}`)
  }
  for (const row of updates) {
    const { error } = await client.from('game_results').update({
      home_team: row.home_team,
      away_team: row.away_team,
      home_score: row.home_score,
      away_score: row.away_score,
      winner: row.winner,
      commence_time: row.commence_time,
    }).eq('game_id', row.game_id)
    if (error) throw new Error(`game_results update failed for ${row.game_id}: ${error.message}`)
  }
  inserted += inserts.length
  updated += updates.length
  reused += sameRows.length
  sportResults.push({
    ...sport,
    httpStatus: call.httpStatus,
    eventsReturned: call.rows,
    completedRows: rows.length,
    inserted: inserts.length,
    updated: updates.length,
    reused: sameRows.length,
    message: rows.length ? 'completed score rows processed' : 'no completed score rows returned',
  })
}

const first = calls[0] || null
const last = calls.at(-1) || null
const requestsUsedObserved = first?.requestsUsed !== null && last?.requestsUsed !== null ? Math.max(0, last.requestsUsed - first.requestsUsed) : null
const metadata = {
  checkpoint: 'the_odds_api_scores_results_v1',
  providerCallsMade: calls.length,
  creditsBefore: first?.requestsRemaining ?? null,
  creditsAfter: last?.requestsRemaining ?? null,
  creditsConsumed: requestsUsedObserved,
  sports: sportResults,
}
const { error: jobError } = await client.from('sports_sync_jobs').insert({
  job_type: 'the_odds_api_scores_results_v1',
  sport_key: 'all',
  league_key: 'multi',
  provider: PROVIDER,
  season: '',
  status: 'completed',
  records_fetched: sportResults.reduce((sum, sport) => sum + sport.eventsReturned, 0),
  records_inserted: inserted,
  records_updated: updated,
  records_skipped: 0,
  error_count: 0,
  completed_at: new Date().toISOString(),
  metadata,
  updated_at: new Date().toISOString(),
})
if (jobError) throw new Error(`sports_sync_jobs scores insert failed: ${jobError.message}`)

const result = {
  success: true,
  status: 'LIVE_SCORES_RESULTS_SYNC_COMPLETE',
  generatedAt: new Date().toISOString(),
  provider: PROVIDER,
  providerCallsMade: calls.length,
  requestsRemainingBefore: first?.requestsRemaining ?? null,
  requestsRemainingAfter: last?.requestsRemaining ?? null,
  requestsUsedObserved,
  creditReserve: CREDIT_RESERVE,
  rowsInserted: inserted,
  rowsUpdated: updated,
  rowsReused: reused,
  productionMutationsMade: inserted + updated + 1,
  sports: sportResults,
  planObserved: calls,
  blockers: [],
}
assertNoSecret(result)
const artifact = { generatedAt: result.generatedAt, commit: git(['rev-parse', 'HEAD']), checkpoint: 'THE_ODDS_API_SCORES_RESULTS_V1', result }
writeFileSync('docs/the-odds-api-scores-results-v1.json', `${JSON.stringify(artifact, null, 2)}\n`)
writeFileSync('docs/THE_ODDS_API_SCORES_RESULTS_V1.md', md(result))
console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  providerCallsMade: result.providerCallsMade,
  requestsRemainingAfter: result.requestsRemainingAfter,
  requestsUsedObserved: result.requestsUsedObserved,
  rowsInserted: result.rowsInserted,
  rowsUpdated: result.rowsUpdated,
  rowsReused: result.rowsReused,
  productionMutationsMade: result.productionMutationsMade,
}, null, 2))
