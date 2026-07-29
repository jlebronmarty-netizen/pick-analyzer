import fs from 'node:fs'
import { writeFileSync } from 'node:fs'

const envPath = '.env.local'
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const { supabaseAdmin } = await import('../src/lib/supabase-admin.ts')
const {
  classifyCanonicalSettlementState,
  validateCanonicalSettlementStateFixtures,
} = await import('../src/services/canonical-settlement-state.service.ts')

const PREDICTION_COLUMNS = [
  'id',
  'sport_key',
  'game_id',
  'commence_time',
  'generated_at',
  'cutoff_at',
  'home_team',
  'away_team',
  'team',
  'opponent',
  'market',
  'line',
  'result',
  'status',
  'lifecycle_status',
  'settlement_details',
  'settled_at',
  'settlement_source',
  'settlement_market',
  'settlement_version',
  'result_id',
  'model_role',
  'model_version',
  'feature_snapshot_id',
  'feature_snapshot_key',
  'feature_snapshot',
  'odds_snapshot_id',
  'operating_day_id',
  'idempotency_key',
  'production_eligible',
  'recommended_pick',
  'trial',
  'scrambled',
  'validation_status',
  'validation_warnings',
  'is_current',
].join(', ')

function countBy(rows, getKey) {
  const counts = new Map()
  for (const row of rows) {
    const key = String(getKey(row) ?? 'unknown')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Object.fromEntries(Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)))
}

function seasonOf(row) {
  return String(row.commence_time ?? row.generated_at ?? 'unknown').slice(0, 4) || 'unknown'
}

async function paged(table, columns, build) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let query = supabaseAdmin.from(table).select(columns, { count: from === 0 ? 'exact' : undefined }).range(from, from + 999)
    if (build) query = build(query)
    const { data, error } = await query
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

const predictions = await paged('prediction_history', PREDICTION_COLUMNS, (query) => query.order('created_at', { ascending: false }))
const eventIds = Array.from(new Set(predictions.map((row) => row.game_id).filter(Boolean)))
const results = []
for (let index = 0; index < eventIds.length; index += 100) {
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('id, game_id, sport_key, home_team, away_team, home_score, away_score, created_at')
    .in('game_id', eventIds.slice(index, index + 100))
  if (error) throw new Error(`game_results read failed: ${error.message}`)
  results.push(...(data ?? []))
}

const resultByGame = new Map(results.map((row) => [row.game_id, row]))
const classified = predictions.map((row) => {
  const state = classifyCanonicalSettlementState(row, row.game_id ? resultByGame.get(row.game_id) : null)
  const logicalKey = [row.sport_key, row.game_id, row.market, row.team, row.line, row.model_version, row.generated_at].join('|')
  return { row, state, logicalKey }
})
const duplicateKeys = new Set(
  Array.from(classified.reduce((map, item) => map.set(item.logicalKey, (map.get(item.logicalKey) ?? 0) + 1), new Map()).entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
)
for (const item of classified) {
  if (duplicateKeys.has(item.logicalKey) && item.state.classification === 'OTHER_PROVEN_CAUSE') {
    item.state.classification = 'DUPLICATE_LOGICAL_PREDICTION'
  }
}

const byClassification = countBy(classified, (item) => item.state.classification)
const bySport = countBy(classified, (item) => item.row.sport_key)
const bySportClassification = {}
for (const [sport, rows] of Object.entries(Object.groupBy(classified, (item) => item.row.sport_key ?? 'unknown'))) {
  bySportClassification[sport] = countBy(rows, (item) => item.state.classification)
}

const storedTerminal = classified.filter((item) => item.state.storedTerminal)
const deterministicTerminal = classified.filter((item) => item.state.deterministicTerminal)
const performanceIncluded = classified.filter((item) => item.state.performanceIncluded)
const learningIncluded = classified.filter((item) => item.state.learningIncluded)
const schedulerSettled = classified.filter((item) => item.state.schedulerAlreadySettled)
const pending = classified.filter((item) => item.state.pending)
const awaiting = classified.filter((item) => item.state.awaitingResult)

const mlb = classified.filter((item) => item.row.sport_key === 'baseball_mlb')
const nflPreview = classified.filter((item) => item.row.sport_key === 'americanfootball_nfl' && String(item.row.model_version ?? '').toLowerCase().includes('preview'))
const nhlPreview = classified.filter((item) => item.row.sport_key === 'icehockey_nhl' && String(item.row.model_version ?? '').toLowerCase().includes('preview'))

const result = {
  success: true,
  mode: 'historical_settled_status_reconciliation_v1',
  generatedAt: new Date().toISOString(),
  source: 'read_only_supabase_service_role',
  fixtureValidation: validateCanonicalSettlementStateFixtures(),
  totals: {
    predictionRows: predictions.length,
    gameResultsRead: results.length,
    uniquePredictionGameIds: eventIds.length,
    duplicateLogicalRows: classified.filter((item) => duplicateKeys.has(item.logicalKey)).length,
    storedTerminal: storedTerminal.length,
    deterministicTerminal: deterministicTerminal.length,
    performanceIncluded: performanceIncluded.length,
    learningIncluded: learningIncluded.length,
    schedulerSettled: schedulerSettled.length,
    pending: pending.length,
    awaitingResult: awaiting.length,
  },
  mlb: {
    rows: mlb.length,
    storedTerminal: mlb.filter((item) => item.state.storedTerminal).length,
    deterministicTerminal: mlb.filter((item) => item.state.deterministicTerminal).length,
    performanceIncluded: mlb.filter((item) => item.state.performanceIncluded).length,
    learningIncluded: mlb.filter((item) => item.state.learningIncluded).length,
    pending: mlb.filter((item) => item.state.pending).length,
    awaitingResult: mlb.filter((item) => item.state.awaitingResult).length,
    byClassification: countBy(mlb, (item) => item.state.classification),
  },
  previewNonRegression: {
    nflPreviewRows: nflPreview.length,
    nhlPreviewRows: nhlPreview.length,
  },
  matrix: {
    byClassification,
    bySport,
    bySportClassification,
    bySeason: countBy(classified, (item) => seasonOf(item.row)),
    byMarket: countBy(classified, (item) => item.row.market),
    byStatus: countBy(classified, (item) => item.row.status),
    byModelVersion: countBy(classified, (item) => item.row.model_version),
    bySettlementSource: countBy(classified, (item) => item.row.settlement_source ?? item.row.settlement_details?.source ?? item.row.settlement_details?.settlement_reconciliation_v2?.source),
  },
  examples: Object.fromEntries(Object.entries(byClassification).map(([classification]) => [
    classification,
    classified
      .filter((item) => item.state.classification === classification)
      .slice(0, 10)
      .map((item) => ({
        id: item.row.id,
        sportKey: item.row.sport_key,
        gameId: item.row.game_id,
        market: item.row.market,
        status: item.row.status,
        result: item.row.result,
        storedOutcome: item.state.storedOutcome,
        deterministicOutcome: item.state.deterministicOutcome,
        deterministicReason: item.state.deterministicReason,
        modelVersion: item.row.model_version,
        settlementSource: item.row.settlement_source ?? null,
      })),
  ])),
  safety: {
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    settlementWrites: 0,
    learningWrites: 0,
    modelWeightMutations: 0,
  },
}

writeFileSync('docs/historical-settled-status-reconciliation-v1.json', `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify({
  success: result.success,
  totals: result.totals,
  mlb: result.mlb,
  previewNonRegression: result.previewNonRegression,
  fixtureValidation: result.fixtureValidation,
  safety: result.safety,
}, null, 2))
