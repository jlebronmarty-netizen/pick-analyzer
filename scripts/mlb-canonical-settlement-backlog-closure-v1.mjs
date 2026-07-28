import fs from 'node:fs'

function loadLocalEnv() {
  const path = '.env.local'
  if (!fs.existsSync(path)) return
  const text = fs.readFileSync(path, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const raw = trimmed.slice(index + 1).trim()
    const value = raw.replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()

const { executeOperatingDay, settleOperatingDay } = await import('@/services/operating-day.service')
const { getAiLearningLifecycle } = await import('@/services/ai-learning-lifecycle.service')
const { supabaseAdmin } = await import('@/lib/supabase-admin')

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = 'America/Puerto_Rico'
const MAX_BATCHES = Number(process.env.MLB_CANONICAL_SETTLEMENT_MAX_BATCHES ?? 6)
const EXECUTE = process.env.MLB_CANONICAL_SETTLEMENT_EXECUTE === 'true'
const RUN_ID = `mlb-canonical-settlement-backlog-closure-v1-${new Date().toISOString()}`

function localDate(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function lower(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isSettled(row) {
  return ['win', 'loss', 'push'].includes(lower(row.status)) || ['win', 'loss', 'push'].includes(lower(row.result))
}

function hasFeatureEvidence(row) {
  const snapshot = row.feature_snapshot && typeof row.feature_snapshot === 'object' ? row.feature_snapshot : {}
  return Boolean(row.feature_snapshot_id || row.feature_snapshot_key || Object.keys(snapshot).length)
}

function labelReason(row) {
  const market = lower(row.market)
  if (['moneyline', 'h2h', 'money_line', 'ml'].includes(market)) return 'MONEYLINE_SETTLEMENT_RESULT'
  if (['spread', 'spreads', 'runline', 'run_line'].includes(market)) return 'RUNLINE_SETTLEMENT_RESULT'
  if (['total', 'totals', 'over_under'].includes(market)) return 'TOTAL_SETTLEMENT_RESULT'
  return 'UNSUPPORTED_MARKET_FOR_LEARNING_LABEL'
}

function profitFor(odds, stake, result) {
  if (result === 'loss') return -stake
  if (result === 'push') return 0
  return Number(odds) < 0 ? stake * (100 / Math.abs(Number(odds))) : stake * (Number(odds) / 100)
}

async function countRows(table, build) {
  let query = supabaseAdmin.from(table).select('id', { count: 'exact', head: true })
  if (build) query = build(query)
  const { count, error } = await query
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function readPredictionRows(build) {
  let query = supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, generated_at, cutoff_at, market, selection, team, line, odds, status, result, stake, profit, result_id, settlement_source, settlement_version, settlement_details, settled_at, feature_snapshot_id, feature_snapshot_key, feature_snapshot, production_eligible, recommended_pick, trial, scrambled, model_version')
    .eq('sport_key', SPORT_KEY)
  if (build) query = build(query)
  const { data, error } = await query
  if (error) throw new Error(`prediction_history read failed: ${error.message}`)
  return data ?? []
}

async function readGameResults(gameIds) {
  if (!gameIds.length) return []
  const rows = []
  for (let index = 0; index < gameIds.length; index += 100) {
    const { data, error } = await supabaseAdmin
      .from('game_results')
      .select('id, game_id, sport_key, home_team, away_team, home_score, away_score, winner, commence_time')
      .eq('sport_key', SPORT_KEY)
      .in('game_id', gameIds.slice(index, index + 100))
    if (error) throw new Error(`game_results read failed: ${error.message}`)
    rows.push(...(data ?? []))
  }
  return rows
}

async function operatingDayForDate(date) {
  const { data, error } = await supabaseAdmin
    .from('operating_days')
    .select('id, local_date, status, settlement_completed_at')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('local_date', date)
    .maybeSingle()
  if (error) throw new Error(`operating_days read failed: ${error.message}`)
  return data
}

async function adaptiveDryRun() {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://127.0.0.1:3000'
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(`${base}/api/operations/adaptive-refresh?dryRun=true`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) return { ok: false, status: response.status, selectedAction: null }
    const body = await response.json()
    return {
      ok: true,
      status: response.status,
      selectedAction: body.selectedAction ?? body.action ?? body.executionPlan?.selectedAction ?? null,
      providerCallsMade: Number(body.providerCallsMade ?? 0),
      remoteMutationsMade: Number(body.remoteMutationsMade ?? 0),
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function inventory() {
  const pending = await readPredictionRows((query) => query.eq('status', 'pending').order('commence_time', { ascending: true }).limit(10000))
  const results = await readGameResults(Array.from(new Set(pending.map((row) => row.game_id).filter(Boolean))))
  const resultByGame = new Map()
  const duplicateResults = new Map()
  for (const result of results) {
    const key = String(result.game_id)
    duplicateResults.set(key, (duplicateResults.get(key) ?? 0) + 1)
    if (!resultByGame.has(key)) resultByGame.set(key, result)
  }
  const ready = []
  const awaiting = []
  const failed = []
  for (const row of pending) {
    const result = resultByGame.get(row.game_id)
    const date = localDate(row.commence_time)
    const generatedAt = row.generated_at ? Date.parse(row.generated_at) : NaN
    const cutoffAt = row.cutoff_at ? Date.parse(row.cutoff_at) : row.commence_time ? Date.parse(row.commence_time) : NaN
    const supportedMarket = ['moneyline', 'spread', 'total'].includes(lower(row.market))
    const completeResult = result && result.home_score !== null && result.away_score !== null
    const duplicateResult = (duplicateResults.get(String(row.game_id)) ?? 0) > 1
    const cutoffSafe = Number.isFinite(generatedAt) && Number.isFinite(cutoffAt) && generatedAt <= cutoffAt
    const duplicateLogicalKey = `${row.game_id}|${lower(row.market)}|${lower(row.team ?? row.selection)}|${row.line ?? ''}`
    const base = { ...row, operatingDate: date, resultEvidence: result ?? null, duplicateLogicalKey }
    if (completeResult && supportedMarket && cutoffSafe && !duplicateResult && !isSettled(row)) {
      ready.push(base)
    } else if (!completeResult) {
      awaiting.push(base)
    } else {
      failed.push({
        ...base,
        failedEligibility: {
          supportedMarket,
          cutoffSafe,
          duplicateResult,
          alreadySettled: isSettled(row),
          completeResult: Boolean(completeResult),
        },
      })
    }
  }
  const logicalCounts = new Map()
  for (const row of ready) logicalCounts.set(row.duplicateLogicalKey, (logicalCounts.get(row.duplicateLogicalKey) ?? 0) + 1)
  const duplicateLogicalRows = ready.filter((row) => (logicalCounts.get(row.duplicateLogicalKey) ?? 0) > 1)
  return { pending, ready, awaiting, failed, duplicateLogicalRows, results, duplicateResults }
}

async function summaryCounts() {
  const [settled, pending, canonicalResults, performanceSample, nflPreview, nflFeatures, nhlPreview, nhlFeatures, weights] = await Promise.all([
    countRows('prediction_history', (query) => query.eq('sport_key', SPORT_KEY).in('result', ['win', 'loss', 'push'])),
    countRows('prediction_history', (query) => query.eq('sport_key', SPORT_KEY).eq('status', 'pending')),
    countRows('game_results', (query) => query.eq('sport_key', SPORT_KEY)),
    countRows('prediction_history', (query) => query.eq('sport_key', SPORT_KEY).in('result', ['win', 'loss', 'push'])),
    countRows('prediction_history', (query) => query.eq('sport_key', 'americanfootball_nfl').eq('status', 'Preview')),
    countRows('historical_feature_snapshots', (query) => query.eq('sport_key', 'americanfootball_nfl')),
    countRows('prediction_history', (query) => query.eq('sport_key', 'icehockey_nhl').eq('status', 'Preview')),
    countRows('historical_feature_snapshots', (query) => query.eq('sport_key', 'icehockey_nhl')),
    countRows('model_weight_history'),
  ])
  return { settled, pending, canonicalResults, performanceSample, nflPreview, nflFeatures, nhlPreview, nhlFeatures, modelWeightHistory: weights }
}

async function accountRows(ids) {
  if (!ids.length) return { rows: [], invalid: [] }
  const rows = []
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    const { data, error } = await supabaseAdmin
      .from('prediction_history')
      .select('id, game_id, market, team, selection, line, odds, status, result, stake, profit, result_id, settlement_source, settlement_version, settlement_details, settled_at')
      .in('id', chunk)
    if (error) throw new Error(`settled row audit failed: ${error.message}`)
    rows.push(...(data ?? []))
  }
  const invalid = rows.filter((row) => {
    const status = lower(row.status)
    const stake = Number(row.stake)
    const expected = Number(profitFor(Number(row.odds), stake, status).toFixed(2))
    return !['win', 'loss', 'push'].includes(status) ||
      !row.result_id ||
      !row.settlement_source ||
      !row.settled_at ||
      !Number.isFinite(stake) ||
      Math.abs(Number(row.profit) - expected) > 0.01
  })
  return { rows, invalid }
}

async function broaderAccountingAudit() {
  const rows = await readPredictionRows((query) => query.in('status', ['win', 'loss', 'push']).limit(10000))
  const stakeNull = rows.filter((row) => row.stake === null).length
  const stakeZero = rows.filter((row) => Number(row.stake) === 0).length
  const mismatches = rows.filter((row) => {
    const stake = Number(row.stake)
    if (!Number.isFinite(stake) || stake <= 0) return true
    const expected = Number(profitFor(Number(row.odds), stake, lower(row.status)).toFixed(2))
    return Math.abs(Number(row.profit) - expected) > 0.01
  })
  return { audited: rows.length, stakeNull, stakeZero, mismatches: mismatches.length, sampleMismatchIds: mismatches.slice(0, 10).map((row) => row.id) }
}

function learningEvidence(rows) {
  const eligibleSettled = rows.filter((row) => isSettled(row) && !row.trial && !row.scrambled)
  const accepted = eligibleSettled.filter((row) => hasFeatureEvidence(row) && labelReason(row) !== 'UNSUPPORTED_MARKET_FOR_LEARNING_LABEL')
  const rejected = eligibleSettled.filter((row) => !hasFeatureEvidence(row) || labelReason(row) === 'UNSUPPORTED_MARKET_FOR_LEARNING_LABEL')
  const deterministicKeys = accepted.map((row) => `${row.id}:${row.result_id ?? 'no_result'}:${lower(row.status)}:${row.feature_snapshot_id ?? row.feature_snapshot_key ?? 'embedded'}`)
  return {
    representation: 'prediction_history_settlement_derived_read_only_queue_v1',
    eligibleSettled: eligibleSettled.length,
    accepted: accepted.length,
    rejected: rejected.length,
    duplicateDeterministicKeys: deterministicKeys.length - new Set(deterministicKeys).size,
  }
}

async function main() {
  const beforeCounts = await summaryCounts()
  const beforeInventory = await inventory()
  const beforeLifecycle = await getAiLearningLifecycle()
  const scheduler = await adaptiveDryRun()
  const readyByDate = Object.entries(beforeInventory.ready.reduce((acc, row) => {
    acc[row.operatingDate] = (acc[row.operatingDate] ?? 0) + 1
    return acc
  }, {})).sort(([a], [b]) => a.localeCompare(b))

  const batches = []
  const settledIds = []
  if (beforeInventory.duplicateLogicalRows.length || beforeInventory.failed.length) {
    throw new Error(`Eligibility blockers found: failed=${beforeInventory.failed.length}, duplicateLogicalRows=${beforeInventory.duplicateLogicalRows.length}`)
  }

  if (EXECUTE) {
    for (const [date] of readyByDate.slice(0, MAX_BATCHES)) {
      const day = await operatingDayForDate(date)
      if (!day?.id) throw new Error(`No operating_day found for ${date}`)
      const dryRun = await settleOperatingDay({ operatingDayId: day.id, sportKey: SPORT_KEY, selectedDate: date, dryRun: true, prospectiveOnly: true })
      if (Number(dryRun.skipped ?? 0) > 0) throw new Error(`Dry-run skipped-row blocker for ${date}: ${JSON.stringify(dryRun)}`)
      if (Number(dryRun.eligible ?? 0) === 0) {
        batches.push({ date, operatingDayId: day.id, dryRun, execution: null, idempotency: dryRun, accounting: { rows: 0, invalid: 0 } })
        continue
      }
      const readyIdsForDate = beforeInventory.ready.filter((row) => row.operatingDate === date).map((row) => row.id)
      const beforeRows = await readPredictionRows((query) => query.in('id', readyIdsForDate).limit(1000))
      const execution = await executeOperatingDay({
        action: 'settle',
        sportKey: SPORT_KEY,
        leagueKey: LEAGUE_KEY,
        selectedDate: date,
        confirmed: true,
        dryRun: false,
        requestId: `${RUN_ID}-${date}`,
      })
      if (execution.action !== 'settle') throw new Error(`Action drift for ${date}: ${execution.action}`)
      if (Number(execution.providerCallsMade ?? 0) !== 0) throw new Error(`Unexpected provider calls for ${date}`)
      const afterRows = await readPredictionRows((query) => query.in('id', beforeRows.map((row) => row.id)).limit(1000))
      const newlySettled = afterRows.filter((row) => isSettled(row) && beforeRows.some((before) => before.id === row.id && !isSettled(before)))
      settledIds.push(...newlySettled.map((row) => row.id))
      const accounting = await accountRows(newlySettled.map((row) => row.id))
      if (accounting.invalid.length) throw new Error(`Settlement accounting mismatch for ${date}: ${accounting.invalid.map((row) => row.id).join(', ')}`)
      const idempotency = await settleOperatingDay({ operatingDayId: day.id, sportKey: SPORT_KEY, selectedDate: date, dryRun: true, prospectiveOnly: true })
      if (Number(idempotency.eligible ?? 0) !== 0 || Number(idempotency.settled ?? 0) !== 0) throw new Error(`Idempotency failure for ${date}: ${JSON.stringify(idempotency)}`)
      batches.push({ date, operatingDayId: day.id, dryRun, execution, idempotency, accounting: { rows: accounting.rows.length, invalid: accounting.invalid.length } })
    }
  }

  const afterCounts = await summaryCounts()
  const afterInventory = await inventory()
  const afterLifecycle = await getAiLearningLifecycle()
  const settledRows = settledIds.length ? await readPredictionRows((query) => query.in('id', settledIds).limit(1000)) : []
  const labels = learningEvidence(settledRows)
  const allSettledRows = await readPredictionRows((query) => query.in('status', ['win', 'loss', 'push']).limit(10000))
  const allLabels = learningEvidence(allSettledRows)
  const accountingAudit = await broaderAccountingAudit()

  console.log(JSON.stringify({
    mode: 'mlb_canonical_settlement_backlog_closure_v1',
    execute: EXECUTE,
    runId: RUN_ID,
    scheduler,
    before: {
      counts: beforeCounts,
      ready: beforeInventory.ready.length,
      awaiting: beforeInventory.awaiting.length,
      failed: beforeInventory.failed.length,
      duplicateLogicalRows: beforeInventory.duplicateLogicalRows.length,
      readyByDate,
      learningQueue: beforeLifecycle.learningQueue,
    },
    batches,
    after: {
      counts: afterCounts,
      ready: afterInventory.ready.length,
      awaiting: afterInventory.awaiting.length,
      failed: afterInventory.failed.length,
      duplicateLogicalRows: afterInventory.duplicateLogicalRows.length,
      learningQueue: afterLifecycle.learningQueue,
    },
    settlementAccounting: {
      newlySettledRows: settledRows.length,
      invalidNewlySettledRows: 0,
      broaderAudit: accountingAudit,
    },
    learningEvidence: {
      newlySettledScope: labels,
      allSettledScope: allLabels,
      inserted: 0,
      updated: 0,
      rejected: labels.rejected,
      idempotencyDuplicateKeys: labels.duplicateDeterministicKeys,
      modelWeightMutation: afterCounts.modelWeightHistory - beforeCounts.modelWeightHistory,
      architectureFinding: 'Canonical learning labels are derived from immutable prediction_history settlement/result/feature evidence; no standalone learning_labels table is claimed by the product data inventory.',
    },
    nonRegression: {
      nflPreview: afterCounts.nflPreview,
      nflFeatures: afterCounts.nflFeatures,
      nhlPreview: afterCounts.nhlPreview,
      nhlFeatures: afterCounts.nhlFeatures,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exit(1)
})
