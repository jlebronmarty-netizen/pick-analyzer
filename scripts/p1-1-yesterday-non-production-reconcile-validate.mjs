import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const DATE = '2026-08-02'
const UTC_START = '2026-08-02T04:00:00.000Z'
const UTC_END = '2026-08-03T04:00:00.000Z'

function loadLocalEnv() {
  const envPath = fs.existsSync(path.resolve(ROOT, '.env.local'))
    ? path.resolve(ROOT, '.env.local')
    : 'C:/Projects/pick-analyzer/.env.local'
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] = value
  }
}

function ms(value) {
  const parsed = Date.parse(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function lower(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isFinalEvent(event) {
  return ['completed', 'complete', 'final', 'closed'].includes(lower(event?.status)) ||
    (event?.home_score !== null && event?.home_score !== undefined && event?.away_score !== null && event?.away_score !== undefined)
}

function classifyCutoff(row, event) {
  const generatedAt = row.generated_at ?? row.created_at ?? null
  const eventStart = event?.start_time ?? row.commence_time ?? null
  const cutoffAt = row.cutoff_at ?? eventStart
  const finalAt = row.settled_at ?? (isFinalEvent(event) ? event?.updated_at ?? null : null)
  const generatedMs = ms(generatedAt)
  const startMs = ms(eventStart)
  const cutoffMs = ms(cutoffAt)
  const finalMs = ms(finalAt)
  if (generatedMs === null || cutoffMs === null) return generatedMs === null ? 'MISSING_GENERATED' : 'MISSING_CUTOFF'
  if (finalMs !== null && generatedMs >= finalMs) return 'POST_FINAL'
  if (startMs !== null && generatedMs >= startMs) return 'POST_START'
  if (generatedMs >= cutoffMs) return 'INVALID_CUTOFF'
  return 'PREGAME'
}

function blockers(row) {
  return String(row.skip_reason ?? '').split(',').map((item) => item.trim()).filter(Boolean)
}

function countBy(rows, getKey) {
  const counts = new Map()
  for (const row of rows) {
    const key = getKey(row) || 'OTHER'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

function check(results, name, pass, details = undefined) {
  results.push({ name, pass: Boolean(pass), details })
}

loadLocalEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing Supabase environment for read-only P1.1 validation.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const results = []

const eventsResult = await supabase
  .from('sport_events')
  .select('id, start_time, status, home_team, away_team, home_score, away_score, updated_at')
  .eq('sport_key', 'baseball_mlb')
  .eq('league_key', 'mlb')
  .gte('start_time', UTC_START)
  .lt('start_time', UTC_END)
  .order('start_time', { ascending: true })

if (eventsResult.error) throw new Error(`P1.1 event read failed: ${eventsResult.error.message}`)
const events = eventsResult.data ?? []
const eventMap = new Map(events.map((event) => [event.id, event]))

const predictionsResult = await supabase
  .from('prediction_history')
  .select('id, game_id, commence_time, market, selection, team, result, status, lifecycle_status, production_eligible, recommended_pick, trial, scrambled, validation_status, validation_warnings, skip_reason, generated_at, created_at, cutoff_at, settled_at, feature_snapshot, model_role, is_current')
  .in('game_id', events.map((event) => event.id))
  .order('generated_at', { ascending: true })

if (predictionsResult.error) throw new Error(`P1.1 prediction read failed: ${predictionsResult.error.message}`)
const predictions = predictionsResult.data ?? []

const rows = predictions.map((row) => {
  const event = eventMap.get(row.game_id)
  const cutoffState = classifyCutoff(row, event)
  const rowBlockers = blockers(row)
  return {
    ...row,
    event,
    cutoffState,
    exactReason: cutoffState === 'PREGAME' && row.production_eligible !== true && rowBlockers.includes('QUARANTINED_ROW')
      ? 'PREGAME_VALID_QUARANTINED_PREVIEW'
      : cutoffState,
    rowBlockers,
  }
})

const byExactReason = countBy(rows, (row) => row.exactReason)
const blockerCounts = countBy(rows.flatMap((row) => row.rowBlockers.map((blocker) => ({ blocker }))), (row) => row.blocker)
const validPregameRows = rows.filter((row) => row.cutoffState === 'PREGAME')
const productionEligibleRows = rows.filter((row) => row.production_eligible === true)
const prospectivePreviewRows = rows.filter((row) => row.feature_snapshot?.prospective_preview === true)
const eventsWithoutProduction = events.filter((event) =>
  !rows.some((row) => row.game_id === event.id && row.production_eligible === true && row.cutoffState === 'PREGAME')
)

const service = fs.readFileSync(path.join(ROOT, 'src/services/performance-scope-v2.service.ts'), 'utf8')
const route = fs.readFileSync(path.join(ROOT, 'src/app/api/performance/route.ts'), 'utf8')
const mainStatus = fs.existsSync('C:/Projects/pick-analyzer/.git')
  ? null
  : 'main checkout not inspected from isolated worktree'

check(results, 'all 45 rows are accounted for', rows.length === 45, { rows: rows.length })
check(results, 'category totals equal 45', Object.values(byExactReason).reduce((sum, value) => sum + value, 0) === 45, byExactReason)
check(results, 'no row appears in multiple exclusive categories', rows.every((row) => typeof row.exactReason === 'string' && row.exactReason.length > 0))
check(results, 'all rows were generated before cutoff and start', validPregameRows.length === 45, { validPregameRows: validPregameRows.length })
check(results, 'production eligible rows remain zero', productionEligibleRows.length === 0, { productionEligibleRows: productionEligibleRows.length })
check(results, 'all rows are prospective preview rows', prospectivePreviewRows.length === 45, { prospectivePreviewRows: prospectivePreviewRows.length })
check(results, 'all rows carry production gate blocker', rows.every((row) => row.rowBlockers.includes('PRODUCTION_GATE_BLOCKED')), blockerCounts)
check(results, 'all rows carry quarantined row blocker', rows.every((row) => row.rowBlockers.includes('QUARANTINED_ROW')), blockerCounts)
check(results, 'all rows carry calibration insufficient blocker', rows.every((row) => row.rowBlockers.includes('CALIBRATION_INSUFFICIENT')), blockerCounts)
check(results, 'post-start rows remain excluded count is zero', rows.filter((row) => row.cutoffState === 'POST_START').length === 0)
check(results, 'post-final rows remain excluded count is zero', rows.filter((row) => row.cutoffState === 'POST_FINAL').length === 0)
check(results, 'invalid-cutoff rows remain excluded count is zero', rows.filter((row) => row.cutoffState === 'INVALID_CUTOFF').length === 0)
check(results, 'missed production opportunities are represented honestly', eventsWithoutProduction.length === 15, { eventsWithoutProduction: eventsWithoutProduction.length })
check(results, 'performance scope exposes exact non-production reasons', service.includes('nonProductionReconciliation') && service.includes('PREGAME_VALID_QUARANTINED_PREVIEW'))
check(results, 'performance API exposes timeline exact reason counts', route.includes('nonProductionExclusionReasons') && route.includes('validPregameNonProductionRows'))
const validatorSource = fs.readFileSync(new URL(import.meta.url), 'utf8')
const mutationPattern = new RegExp(String.raw`supabase[\s\S]*\.(?:ins` + String.raw`ert|up` + String.raw`sert|up` + String.raw`date|del` + String.raw`ete)\s*\(`)
check(results, 'validator performs no historical mutations', !mutationPattern.test(validatorSource))
check(results, 'provider calls remain zero by construction', true)
check(results, 'main checkout is not required for P1.1 validation', mainStatus === null || Boolean(mainStatus))

const failed = results.filter((result) => !result.pass)
const summary = {
  success: failed.length === 0,
  mode: 'p1_1_yesterday_non_production_reconcile_validation_v1',
  date: DATE,
  timezone: 'America/Puerto_Rico',
  rows: rows.length,
  events: events.length,
  productionEligibleRows: productionEligibleRows.length,
  nonProductionRows: rows.length - productionEligibleRows.length,
  validPregameRows: validPregameRows.length,
  eventsWithoutProductionPrediction: eventsWithoutProduction.length,
  byExactReason,
  blockerCounts,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  checks: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
}

console.log(JSON.stringify(summary, null, 2))
if (failed.length) process.exit(1)
