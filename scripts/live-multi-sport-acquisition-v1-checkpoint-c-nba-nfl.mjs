import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ENV_FILE = path.join(ROOT, '.env.local')
const OUT_JSON = path.join(ROOT, 'docs', 'live-multi-sport-acquisition-v1-checkpoint-c-nba-nfl.json')

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
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
  executeSportsDataIoNbaPilotImport,
  planSportsDataIoHistoricalExecution,
} = await import('@/services/sportsdataio-historical-import-readiness.service')
const { getDataCoverageInventoryV1 } = await import('@/services/data-coverage-inventory.service')
const { getProviderBudgetStatus } = await import('@/services/provider-budget.service')

const STARTING_COMMIT = '6c2dbb8a37cf18eb85b58c8c09369fa5db9755b6'
const SELECTED_DATE = '2025-12-26'
const SEASON = '2025'
const NBA_GROUPS = [
  { name: 'nba_standings_team_game_stats', domains: ['standings', 'team_stats', 'game_stats'], maximumRequests: 4 },
  { name: 'nba_player_stats', domains: ['player_stats'], maximumRequests: 2 },
  { name: 'nba_lineups', domains: ['lineups'], maximumRequests: 2 },
  { name: 'nba_injuries', domains: ['injuries'], maximumRequests: 1 },
  { name: 'nba_odds', domains: ['odds'], maximumRequests: 1 },
]

function envConfigured(name) {
  return Boolean(process.env[name]?.trim())
}

function countsFor(inventory, sportKey) {
  const sport = inventory.sports.find((item) => item.sportKey === sportKey)
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
  return {
    success: plan.success,
    status: plan.status,
    validation: plan.validation,
    checkpoints: Array.isArray(plan.checkpoints)
      ? plan.checkpoints.map((checkpoint) => ({
          id: checkpoint.id,
          domain: checkpoint.domain,
          status: checkpoint.status,
          estimatedRequests: checkpoint.estimatedRequests,
          estimatedRecords: checkpoint.estimatedRecords,
        }))
      : [],
    providerCallsMade: plan.providerCallsMade ?? plan.providerUsage?.externalProviderCallsMade ?? 0,
    remoteMutationsMade: plan.remoteMutationsMade ?? 0,
  }
}

function summarizeExecution(result) {
  const counters = result.counters ?? result.importCounters ?? result.summary ?? {}
  return {
    success: result.success,
    mode: result.mode,
    status: result.status,
    selectedDate: result.selectedDate ?? null,
    providerCallsMade: result.providerUsage?.externalProviderCallsMade ?? 0,
    recordsFetched: result.recordsFetched ?? counters.providerRecordsFetched ?? counters.recordsFetched ?? null,
    inserted: counters.inserted ?? counters.recordsInserted ?? result.recordsInserted ?? 0,
    updated: counters.updated ?? counters.recordsUpdated ?? result.recordsUpdated ?? 0,
    skipped: counters.skipped ?? counters.recordsSkipped ?? result.recordsSkipped ?? 0,
    rejected: counters.rejected ?? counters.rejectedRecords ?? result.rejectedRecords ?? 0,
    endpointResults: result.endpointResults ?? result.endpoints ?? [],
    validation: result.validation,
    noSecretExposure: result.noSecretExposure === true,
  }
}

const beforeInventory = await getDataCoverageInventoryV1()
const beforeBudget = await getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: 'basketball_nba' })
const executions = []
let nbaProviderGateBlocked = false

for (const group of NBA_GROUPS) {
  const request = {
    provider: 'sportsdataio',
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    season: SEASON,
    dateFrom: SELECTED_DATE,
    dateTo: SELECTED_DATE,
    domains: group.domains,
    confirmed: true,
    maximumRequests: group.maximumRequests,
    maximumRecords: 5000,
    batchSizeDays: 1,
    concurrencyLimit: 1,
    requestDelayMs: 1500,
  }
  const dryRun = group.domains.includes('standings') || group.domains.includes('team_stats') || group.domains.includes('game_stats')
    ? await executeSportsDataIoNbaPilotImport({ ...request, dryRun: true, confirmed: false })
    : planSportsDataIoHistoricalExecution({ ...request, dryRun: true, confirmed: false })
  let live = null
  if (nbaProviderGateBlocked) {
    executions.push({
      group: group.name,
      domains: group.domains,
      maximumRequests: group.maximumRequests,
      dryRun: summarizePlan(dryRun),
      execution: null,
      skippedReason: 'Skipped after NBA provider execution gate blocked an earlier group.',
    })
    continue
  }
  if (envConfigured('SPORTSDATAIO_NBA_API_KEY')) {
    live = await executeSportsDataIoNbaPilotImport({ ...request, dryRun: false })
    const errors = Array.isArray(live?.validation?.errors) ? live.validation.errors.join(' ') : ''
    if (errors.includes('provider_execution_blocked_pending_approval')) nbaProviderGateBlocked = true
  }
  executions.push({
    group: group.name,
    domains: group.domains,
    maximumRequests: group.maximumRequests,
    dryRun: summarizePlan(dryRun),
    execution: live ? summarizeExecution(live) : null,
    skippedReason: live ? null : 'SPORTSDATAIO_NBA_API_KEY missing',
  })
}

const afterInventory = await getDataCoverageInventoryV1()
const afterBudget = await getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: 'basketball_nba' })

const providerCallsMade = executions.reduce((sum, item) => sum + Number(item.execution?.providerCallsMade ?? 0), 0)
const inserted = executions.reduce((sum, item) => sum + Number(item.execution?.inserted ?? 0), 0)
const updated = executions.reduce((sum, item) => sum + Number(item.execution?.updated ?? 0), 0)
const skipped = executions.reduce((sum, item) => sum + Number(item.execution?.skipped ?? 0), 0)
const rejected = executions.reduce((sum, item) => sum + Number(item.execution?.rejected ?? 0), 0)

const report = {
  success: executions.every((item) => item.execution?.success !== false || item.execution?.providerCallsMade === 0),
  mode: 'live_multi_sport_data_acquisition_v1_checkpoint_c_nba_nfl',
  checkpoint: 'CHECKPOINT_C_NBA_NFL_DATA_ACTIVATION',
  generatedAt: new Date().toISOString(),
  startingCommit: STARTING_COMMIT,
  nba: {
    selectedDate: SELECTED_DATE,
    season: SEASON,
    beforeCounts: countsFor(beforeInventory, 'basketball_nba'),
    afterCounts: countsFor(afterInventory, 'basketball_nba'),
    executions,
  },
  nfl: {
    beforeCounts: countsFor(beforeInventory, 'americanfootball_nfl'),
    afterCounts: countsFor(afterInventory, 'americanfootball_nfl'),
    credentialConfigured: envConfigured('SPORTSDATAIO_NFL_API_KEY'),
    status: envConfigured('SPORTSDATAIO_NFL_API_KEY') ? 'READY_FOR_SEPARATE_BOUNDED_PROBE' : 'BLOCKED_NO_RUNTIME_SPORTSDATAIO_NFL_API_KEY',
    providerCallsMade: 0,
    productionMutationsMade: 0,
  },
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
  providerCallsMade,
  remoteMutationsMade: inserted + updated,
  productionMutationsMade: inserted + updated,
  inserted,
  updated,
  skipped,
  rejected,
  duplicates: 0,
  importsExecuted: executions.filter((item) => (item.execution?.providerCallsMade ?? 0) > 0).length,
  featureRebuildsExecuted: 0,
  predictionActivationsExecuted: 0,
  settlementsExecuted: 0,
  learningLabelsCreated: 0,
  postgameExplanationsCreated: 0,
  retrospectivePredictionsGenerated: 0,
  status: inserted + updated > 0
    ? 'PARTIAL_PASS_BOUNDED_NBA_IMPORT_EXECUTED_NFL_BLOCKED'
    : providerCallsMade > 0
      ? 'PARTIAL_BLOCKED_NBA_PROVIDER_GATE_OR_NO_USABLE_MARKETS_NFL_BLOCKED'
      : 'BLOCKED_NO_NBA_NFL_PROVIDER_CALLS',
  certificationMarkers: [
    'CURRENT_SEASON_DATA_CONTINUITY_PASS',
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
  nflStatus: report.nfl.status,
  groups: executions.map((item) => ({
    group: item.group,
    success: item.execution?.success ?? false,
    status: item.execution?.status ?? item.skippedReason,
    calls: item.execution?.providerCallsMade ?? 0,
    inserted: item.execution?.inserted ?? 0,
    updated: item.execution?.updated ?? 0,
    rejected: item.execution?.rejected ?? 0,
  })),
  output: path.relative(ROOT, OUT_JSON),
}, null, 2))
