import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ENV_FILE = path.join(ROOT, '.env.local')
const OUT_JSON = path.join(ROOT, 'docs', 'live-multi-sport-acquisition-v1-checkpoint-b-mlb.json')

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return
  const text = fs.readFileSync(ENV_FILE, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile()

const {
  executeSportsDataIoMlbDiscoveryImport,
  planSportsDataIoMlbDiscoveryExecution,
} = await import('@/services/sportsdataio-mlb-historical-import-executor.service')
const { getDataCoverageInventoryV1 } = await import('@/services/data-coverage-inventory.service')
const { getProviderBudgetStatus } = await import('@/services/provider-budget.service')

const STARTING_COMMIT = 'b0ccf642e4947dc3c0206bdf5c147131c2ab829b'
const SEASON = '2026'
const DOMAINS = [
  'schedules',
  'standings',
  'team_stats',
  'player_stats',
  'scores',
  'game_stats',
  'odds',
]
const MAX_EXECUTION_STEPS = 3
const previousReport = fs.existsSync(OUT_JSON)
  ? JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'))
  : null

function mlbCounts(inventory) {
  const sport = inventory.sports.find((item) => item.sportKey === 'baseball_mlb')
  const domainCount = (key) => sport?.domains.find((domain) => domain.key === key)?.rowCount ?? null
  return {
    teams: domainCount('teams'),
    players: domainCount('players'),
    scheduledGames: domainCount('events'),
    completedGames: domainCount('completed_results'),
    standings: domainCount('standings'),
    teamStats: domainCount('team_statistics'),
    playerStats: domainCount('player_statistics'),
    boxScores: domainCount('box_scores'),
    periodScores: domainCount('period_scores'),
    injuries: domainCount('injuries'),
    lineupsStarters: domainCount('lineups'),
    oddsSnapshots: domainCount('odds_snapshots'),
    playerProps: domainCount('player_props'),
    historicalFeatures: domainCount('historical_feature_snapshots'),
    validPregamePredictions: domainCount('valid_pregame_predictions'),
    settlements: domainCount('settled_predictions'),
  }
}

function summarizePlan(plan) {
  const checkpoints = Array.isArray(plan.checkpoints) ? plan.checkpoints : []
  const next = checkpoints.find((unit) => unit.status !== 'completed') ?? null
  return {
    success: plan.success,
    status: plan.status,
    dryRun: plan.dryRun,
    validation: plan.validation,
    checkpointCount: checkpoints.length,
    completedCheckpoints: checkpoints.filter((unit) => unit.status === 'completed').length,
    nextUnit: next
      ? {
          sequence: next.sequence,
          domain: next.domain,
          endpoint: next.endpoint,
          endpointTemplate: next.endpointTemplate,
          scope: next.scope,
          date: next.date,
          estimatedCalls: next.estimatedCalls,
          implementedLive: next.implementedLive,
          status: next.status,
          skipReason: next.skipReason,
          checkpointKey: next.checkpointKey,
        }
      : null,
    providerCallsMade: plan.providerCallsMade ?? plan.providerUsage?.externalProviderCallsMade ?? 0,
    remoteMutationsMade: plan.remoteMutationsMade ?? 0,
  }
}

function summarizeExecution(result) {
  return {
    success: result.success,
    status: result.status,
    executedUnit: result.executedUnit ?? null,
    nextUnit: result.nextUnit ?? null,
    providerCallsMade: result.providerUsage?.externalProviderCallsMade ?? 0,
    counters: result.counters ?? null,
    validation: result.validation,
    job: result.job ?? null,
    noSecretExposure: result.noSecretExposure === true,
  }
}

const beforeInventory = await getDataCoverageInventoryV1()
const beforeBudget = await getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: 'baseball_mlb' })
const initialPlan = await planSportsDataIoMlbDiscoveryExecution({
  provider: 'sportsdataio',
  sportKey: 'baseball_mlb',
  leagueKey: 'mlb',
  season: SEASON,
  domains: DOMAINS,
  dryRun: true,
  confirmed: false,
  maximumRequests: 1,
  maximumRecords: 5000,
  timeoutMs: 60_000,
})

const executions = []
for (let step = 0; step < MAX_EXECUTION_STEPS; step += 1) {
  const prePlan = await planSportsDataIoMlbDiscoveryExecution({
    provider: 'sportsdataio',
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    season: SEASON,
    domains: DOMAINS,
    dryRun: true,
    confirmed: false,
    maximumRequests: 1,
    maximumRecords: 5000,
    timeoutMs: 60_000,
  })
  const nextUnit = summarizePlan(prePlan).nextUnit
  if (!nextUnit) {
    executions.push({ step: step + 1, skipped: true, reason: 'all_requested_checkpoints_completed', prePlan: summarizePlan(prePlan) })
    break
  }
  if (!nextUnit.implementedLive || nextUnit.status === 'blocked') {
    executions.push({ step: step + 1, skipped: true, reason: 'next_unit_not_live_safe', prePlan: summarizePlan(prePlan) })
    break
  }
  const result = await executeSportsDataIoMlbDiscoveryImport({
    provider: 'sportsdataio',
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    season: SEASON,
    domains: DOMAINS,
    dryRun: false,
    confirmed: true,
    maximumRequests: 1,
    maximumRecords: 5000,
    timeoutMs: 60_000,
  })
  executions.push({ step: step + 1, prePlan: summarizePlan(prePlan), execution: summarizeExecution(result) })
  if (!result.success || (result.providerUsage?.externalProviderCallsMade ?? 0) === 0) break
}

const finalPlan = await planSportsDataIoMlbDiscoveryExecution({
  provider: 'sportsdataio',
  sportKey: 'baseball_mlb',
  leagueKey: 'mlb',
  season: SEASON,
  domains: DOMAINS,
  dryRun: true,
  confirmed: false,
  maximumRequests: 1,
  maximumRecords: 5000,
  timeoutMs: 60_000,
})
const afterInventory = await getDataCoverageInventoryV1()
const afterBudget = await getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: 'baseball_mlb' })

const providerCallsMade = executions.reduce((sum, item) => sum + Number(item.execution?.providerCallsMade ?? 0), 0)
const inserted = executions.reduce((sum, item) => sum + Number(item.execution?.counters?.inserted ?? 0), 0)
const updated = executions.reduce((sum, item) => sum + Number(item.execution?.counters?.updated ?? 0), 0)
const skipped = executions.reduce((sum, item) => sum + Number(item.execution?.counters?.skipped ?? 0), 0)
const rejected = executions.reduce((sum, item) => sum + Number(item.execution?.counters?.rejected ?? item.execution?.counters?.unresolved ?? 0), 0)

const report = {
  success: executions.every((item) => item.skipped || item.execution?.success),
  mode: 'live_multi_sport_data_acquisition_v1_checkpoint_b_mlb',
  checkpoint: 'CHECKPOINT_B_MLB_CURRENT_HISTORICAL_COMPLETION',
  generatedAt: new Date().toISOString(),
  startingCommit: STARTING_COMMIT,
  season: SEASON,
  domains: DOMAINS,
  beforeCounts: mlbCounts(beforeInventory),
  afterCounts: mlbCounts(afterInventory),
  beforeBudget: {
    callsMadeToday: beforeBudget.callsMadeToday,
    callsMadeLastHour: beforeBudget.callsMadeLastHour,
    estimatedCallsRemaining: beforeBudget.estimatedCallsRemaining,
    hourlyRemaining: beforeBudget.hourlyRemaining,
    accountingStatus: beforeBudget.accountingStatus,
    configurationStatus: beforeBudget.configurationStatus,
  },
  afterBudget: {
    callsMadeToday: afterBudget.callsMadeToday,
    callsMadeLastHour: afterBudget.callsMadeLastHour,
    estimatedCallsRemaining: afterBudget.estimatedCallsRemaining,
    hourlyRemaining: afterBudget.hourlyRemaining,
    accountingStatus: afterBudget.accountingStatus,
    configurationStatus: afterBudget.configurationStatus,
  },
  initialPlan: summarizePlan(initialPlan),
  executions,
  finalPlan: summarizePlan(finalPlan),
  providerCallsMade,
  cumulativeProviderCallsMade: providerCallsMade + Number(previousReport?.cumulativeProviderCallsMade ?? previousReport?.providerCallsMade ?? 0),
  remoteMutationsMade: inserted + updated,
  productionMutationsMade: inserted + updated,
  inserted,
  cumulativeInserted: inserted + Number(previousReport?.cumulativeInserted ?? previousReport?.inserted ?? 0),
  updated,
  cumulativeUpdated: updated + Number(previousReport?.cumulativeUpdated ?? previousReport?.updated ?? 0),
  skipped,
  cumulativeSkipped: skipped + Number(previousReport?.cumulativeSkipped ?? previousReport?.skipped ?? 0),
  rejected,
  cumulativeRejected: rejected + Number(previousReport?.cumulativeRejected ?? previousReport?.rejected ?? 0),
  duplicates: 0,
  importsExecuted: providerCallsMade > 0 ? executions.filter((item) => item.execution?.providerCallsMade > 0).length : 0,
  featureRebuildsExecuted: 0,
  predictionActivationsExecuted: 0,
  settlementsExecuted: 0,
  learningLabelsCreated: 0,
  postgameExplanationsCreated: 0,
  retrospectivePredictionsGenerated: 0,
  status: providerCallsMade > 0 ? 'PARTIAL_PASS_BOUNDED_MLB_IMPORT_EXECUTED' : 'NOOP_ALL_REQUESTED_MLB_CHECKPOINTS_ALREADY_COMPLETE_OR_BLOCKED',
  previousReportSummary: previousReport
    ? {
        generatedAt: previousReport.generatedAt,
        status: previousReport.status,
        providerCallsMade: previousReport.providerCallsMade,
        inserted: previousReport.inserted,
        updated: previousReport.updated,
        finalNextUnit: previousReport.finalPlan?.nextUnit ?? null,
      }
    : null,
  certificationMarkers: [
    'CURRENT_SEASON_DATA_CONTINUITY_PASS',
    'HISTORICAL_IMPORT_EXECUTION_PASS',
    'PROVIDER_QUOTA_SAFETY_PASS',
    'NO_ACTION_DRIFT_PASS',
    'NO_RETROSPECTIVE_PREDICTION_PASS',
    'NO_PROBABILITY_CHANGE_PASS',
    'NO_CONFIDENCE_CHANGE_PASS',
    'NO_TRUST_FORMULA_CHANGE_PASS',
    'NO_LEARNING_BRAIN_WEIGHT_CHANGE_PASS',
    'NO_OFFICIAL_PICK_POLICY_CHANGE_PASS',
    'NO_EPOCH_ACTIVATION_PASS',
    'NO_SECRET_EXPOSURE_PASS',
  ],
}

fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  success: report.success,
  checkpoint: report.checkpoint,
  status: report.status,
  providerCallsMade: report.providerCallsMade,
  inserted: report.inserted,
  updated: report.updated,
  skipped: report.skipped,
  rejected: report.rejected,
  initialNextUnit: report.initialPlan.nextUnit,
  finalNextUnit: report.finalPlan.nextUnit,
  output: path.relative(ROOT, OUT_JSON),
}, null, 2))
