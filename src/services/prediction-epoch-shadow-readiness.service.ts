import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getPredictionEpochMigrationState } from '@/services/prediction-epoch-migration-state.service'

export type PredictionOriginV1 = 'LIVE_PREGAME' | 'HISTORICAL_WALK_FORWARD_REPLAY' | 'LEGACY_PRE_CERTIFICATION'
export type CertificationStatusV1 = 'SHADOW_PENDING' | 'CERTIFIED' | 'QUARANTINED' | 'INVALID' | 'REJECTED'
export type ReadinessLevelV1 = 'READY' | 'SHADOW_READY' | 'BLOCKED' | 'UNKNOWN'

type PredictionRow = {
  id: string
  sport_key: string | null
  game_id: string | null
  commence_time: string | null
  market: string | null
  selection: string | null
  team: string | null
  line: number | null
  odds: number | null
  sportsbook: string | null
  odds_timestamp: string | null
  generated_at: string | null
  cutoff_at: string | null
  feature_snapshot_id: string | null
  feature_snapshot_key: string | null
  feature_set_version: string | null
  feature_snapshot_generated_at: string | null
  feature_snapshot: Record<string, unknown> | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  model_version: string | null
  model_role?: string | null
  prediction_epoch_key?: string | null
  prediction_epoch_id?: string | null
  validation_warnings?: string[] | null
}

type EventRow = {
  id: string
  sport_key: string | null
  start_time: string | null
  status: string | null
}

const SPORT = 'baseball_mlb'
const SUPPORTED_MARKETS = new Set(['moneyline', 'spread', 'run_line', 'total'])
const NORMAL_WINDOW_MINUTES = 12
const FINAL_90_WINDOW_MINUTES = 7
const REFRESH_CUTOFF_MINUTES = 10
const DEFAULT_MAX_PROVIDER_CALLS_PER_DAY = 900

function nowIso() {
  return new Date().toISOString()
}

function toDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function minutesBetween(left: Date | null, right: Date | null) {
  if (!left || !right) return null
  return Math.round(((left.getTime() - right.getTime()) / 60000) * 100) / 100
}

function dateOnly(value: string | null | undefined) {
  const parsed = toDate(value)
  return parsed ? parsed.toISOString().slice(0, 10) : null
}

function marketKey(value: string | null | undefined) {
  const raw = String(value ?? '').toLowerCase()
  if (raw === 'spread') return 'run_line'
  return raw
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function gate(name: string, passed: boolean, actual: unknown, required: unknown) {
  return { name, passed, actual, required }
}

function inferOrigin(row: PredictionRow): PredictionOriginV1 {
  const snapshot = asRecord(row.feature_snapshot)
  const origin = String(snapshot.prediction_origin ?? snapshot.predictionOrigin ?? '').toUpperCase()
  if (origin === 'HISTORICAL_WALK_FORWARD_REPLAY') return 'HISTORICAL_WALK_FORWARD_REPLAY'
  if (origin === 'LIVE_PREGAME') return 'LIVE_PREGAME'
  if (row.prediction_epoch_key && row.model_role !== 'shadow') return 'LIVE_PREGAME'
  return 'LEGACY_PRE_CERTIFICATION'
}

function hasCompleteFeatureLineage(row: PredictionRow) {
  const snapshot = asRecord(row.feature_snapshot)
  return Boolean(
    (row.feature_snapshot_id || row.feature_snapshot_key) &&
      row.feature_set_version &&
      (snapshot.quality !== undefined || snapshot.featureQuality !== undefined || snapshot.featureQualityScore !== undefined) &&
      (snapshot.sufficiency !== undefined || snapshot.dataSufficiency !== undefined || snapshot.dataSufficiencyScore !== undefined)
  )
}

function classifyPrediction(row: PredictionRow, now = new Date()) {
  const generatedAt = toDate(row.generated_at)
  const cutoffAt = toDate(row.cutoff_at)
  const commenceAt = toDate(row.commence_time)
  const oddsAt = toDate(row.odds_timestamp)
  const featureAt = toDate(row.feature_snapshot_generated_at) ?? generatedAt
  const market = marketKey(row.market)
  const oddsAgeAtGenerationMinutes = minutesBetween(generatedAt, oddsAt)
  const minutesToStart = minutesBetween(commenceAt, now)
  const finalWindow = minutesToStart !== null && minutesToStart <= 90
  const freshnessTarget = finalWindow ? FINAL_90_WINDOW_MINUTES : NORMAL_WINDOW_MINUTES
  const warnings = Array.isArray(row.validation_warnings) ? row.validation_warnings : []
  const origin = inferOrigin(row)

  const gates = [
    gate('event_identity_verified', Boolean(row.game_id), row.game_id, 'non-empty event id'),
    gate('market_mapping_verified', SUPPORTED_MARKETS.has(market) && Boolean(row.selection ?? row.team), `${market}:${row.selection ?? row.team ?? ''}`, 'supported market and selection'),
    gate('cutoff_verified', Boolean(generatedAt && cutoffAt && commenceAt && generatedAt <= cutoffAt && generatedAt < commenceAt), row.generated_at, 'generated_at <= cutoff_at and < commence_time'),
    gate('odds_lineage_verified', Boolean(oddsAt && cutoffAt && oddsAt <= cutoffAt && row.sportsbook && num(row.odds) !== null), { oddsTimestamp: row.odds_timestamp, sportsbook: row.sportsbook, odds: row.odds }, 'timestamped pre-cutoff sportsbook odds'),
    gate('odds_freshness_sla_met', oddsAgeAtGenerationMinutes !== null && oddsAgeAtGenerationMinutes >= 0 && oddsAgeAtGenerationMinutes <= freshnessTarget, oddsAgeAtGenerationMinutes, `<= ${freshnessTarget} minutes`),
    gate('feature_lineage_verified', hasCompleteFeatureLineage(row), { featureSnapshotId: row.feature_snapshot_id, featureSnapshotKey: row.feature_snapshot_key, featureSetVersion: row.feature_set_version }, 'snapshot id/key, feature version, quality and sufficiency'),
    gate('settlement_compatible', Boolean(row.game_id && row.market && (row.selection ?? row.team)), `${row.game_id}:${row.market}:${row.selection ?? row.team ?? ''}`, 'event/market/selection settlement key'),
    gate('learning_label_compatible', Boolean(row.feature_snapshot_id && row.model_version && row.feature_set_version), { featureSnapshotId: row.feature_snapshot_id, modelVersion: row.model_version, featureSetVersion: row.feature_set_version }, 'feature snapshot and model version link'),
    gate('no_retrospective_prediction', Boolean(generatedAt && commenceAt && generatedAt < commenceAt), row.generated_at, 'generated before event start'),
    gate('shadow_isolation_preserved', row.production_eligible !== true && row.trial !== true && row.scrambled !== true, { productionEligible: row.production_eligible, trial: row.trial, scrambled: row.scrambled }, 'not production eligible and not trial/scrambled'),
    gate('critical_warnings_absent', !warnings.some((warning) => /leak|postgame|critical/i.test(String(warning))), warnings, 'no leakage/postgame/critical warnings'),
  ]
  const failedGates = gates.filter((item) => !item.passed).map((item) => item.name)
  const status: CertificationStatusV1 = failedGates.includes('cutoff_verified') || failedGates.includes('no_retrospective_prediction')
    ? 'INVALID'
    : failedGates.length > 0
      ? 'QUARANTINED'
      : 'SHADOW_PENDING'

  return {
    predictionId: row.id,
    eventId: row.game_id,
    operatingDate: dateOnly(row.commence_time),
    market,
    selection: row.selection ?? row.team,
    line: row.line,
    generatedAt: row.generated_at,
    cutoffAt: row.cutoff_at,
    oddsTimestamp: row.odds_timestamp,
    oddsAgeAtGenerationMinutes,
    freshnessTargetMinutes: freshnessTarget,
    featureSnapshotTimestamp: featureAt?.toISOString() ?? null,
    predictionOrigin: origin,
    gates,
    shadowCertificationResult: status,
    failedGates,
    productionEligibleCurrentValue: row.production_eligible === true,
    readinessDimensions: {
      rowLevelReadiness: status === 'SHADOW_PENDING' ? 'SHADOW_READY' as ReadinessLevelV1 : 'BLOCKED' as ReadinessLevelV1,
      marketLevelReadiness: SUPPORTED_MARKETS.has(market) ? 'SHADOW_READY' as ReadinessLevelV1 : 'BLOCKED' as ReadinessLevelV1,
      modelVersionReadiness: row.model_version ? 'SHADOW_READY' as ReadinessLevelV1 : 'BLOCKED' as ReadinessLevelV1,
      sportLevelReadiness: 'BLOCKED' as ReadinessLevelV1,
    },
  }
}

async function loadRecentMlbPredictions(limit: number, selectedDate?: string | null) {
  let query = supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, market, selection, team, line, odds, sportsbook, odds_timestamp, generated_at, cutoff_at, feature_snapshot_id, feature_snapshot_key, feature_set_version, feature_snapshot_generated_at, feature_snapshot, production_eligible, trial, scrambled, model_version, model_role, prediction_epoch_key, prediction_epoch_id, validation_warnings')
    .eq('sport_key', SPORT)
    .order('generated_at', { ascending: false })
    .limit(limit)
  if (selectedDate) {
    const start = `${selectedDate}T00:00:00.000Z`
    const end = `${selectedDate}T23:59:59.999Z`
    query = query.gte('commence_time', start).lte('commence_time', end)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as PredictionRow[]
}

async function loadActiveMlbEvents() {
  const now = new Date()
  const end = new Date(now.getTime() + 36 * 60 * 60 * 1000)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, start_time, status')
    .eq('sport_key', SPORT)
    .gte('start_time', now.toISOString())
    .lte('start_time', end.toISOString())
    .order('start_time', { ascending: true })
    .limit(40)
  if (error) return [] as EventRow[]
  return (data ?? []) as EventRow[]
}

function estimateRefreshesForEvent(event: EventRow, marketsPerEvent: number) {
  const start = toDate(event.start_time)
  if (!start) return { normalWindowRuns: 0, finalWindowRuns: 0, totalRefreshRuns: 0, calls: 0, writes: 0 }
  const captureEnd = new Date(start.getTime() - REFRESH_CUTOFF_MINUTES * 60 * 1000)
  const finalStart = new Date(start.getTime() - 90 * 60 * 1000)
  const now = new Date()
  const normalStart = now < finalStart ? now : finalStart
  const normalEnd = captureEnd < finalStart ? captureEnd : finalStart
  const normalMinutes = Math.max(0, (normalEnd.getTime() - normalStart.getTime()) / 60000)
  const finalMinutes = Math.max(0, (captureEnd.getTime() - (now > finalStart ? now : finalStart).getTime()) / 60000)
  const normalWindowRuns = Math.ceil(normalMinutes / 10)
  const finalWindowRuns = Math.ceil(finalMinutes / 5)
  const totalRefreshRuns = normalWindowRuns + finalWindowRuns
  return {
    normalWindowRuns,
    finalWindowRuns,
    totalRefreshRuns,
    calls: totalRefreshRuns,
    writes: totalRefreshRuns * marketsPerEvent * 2,
  }
}

export async function getPredictionEpochShadowReadiness(options: { limit?: number; selectedDate?: string | null } = {}) {
  const limit = Math.min(Math.max(Math.round(options.limit ?? 75), 1), 250)
  const rows = await loadRecentMlbPredictions(limit, options.selectedDate)
  const predictions = rows.map((row) => classifyPrediction(row))
  const gateCounts = new Map<string, { passed: number; failed: number }>()
  for (const prediction of predictions) {
    for (const item of prediction.gates) {
      const existing = gateCounts.get(item.name) ?? { passed: 0, failed: 0 }
      if (item.passed) existing.passed += 1
      else existing.failed += 1
      gateCounts.set(item.name, existing)
    }
  }
  const statusCounts = predictions.reduce<Record<string, number>>((acc, item) => {
    acc[item.shadowCertificationResult] = (acc[item.shadowCertificationResult] ?? 0) + 1
    return acc
  }, {})
  return {
    success: true,
    mode: 'prediction_epoch_shadow_readiness_v1',
    generatedAt: nowIso(),
    readOnly: true,
    shadowOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    productionEligibilityMutations: 0,
    officialPickPolicyChanged: false,
    sport: SPORT,
    selectedDate: options.selectedDate ?? null,
    rowsEvaluated: predictions.length,
    statusCounts,
    gateSummary: Object.fromEntries(gateCounts.entries()),
    predictions,
  }
}

export async function getPregameOddsRefreshCadenceSlaV1() {
  const events = await loadActiveMlbEvents()
  const activeEvents = events.filter((event) => !/final|complete|closed|postponed|cancel/i.test(String(event.status ?? '')))
  const marketsPerEvent = 3
  const estimates = activeEvents.map((event) => ({
    eventId: event.id,
    startTime: event.start_time,
    status: event.status,
    ...estimateRefreshesForEvent(event, marketsPerEvent),
  }))
  const totalCalls = estimates.reduce((sum, item) => sum + item.calls, 0)
  const totalWrites = estimates.reduce((sum, item) => sum + item.writes, 0)
  return {
    success: true,
    mode: 'pregame_odds_refresh_cadence_freshness_sla_v1',
    generatedAt: nowIso(),
    readOnly: true,
    shadowOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    cadence: {
      moreThan90MinutesBeforeStart: '10 minutes',
      final90MinutesBeforeStart: '5 minutes',
      stopCaptureAtCutoffMinutesBeforeStart: REFRESH_CUTOFF_MINUTES,
    },
    freshnessTargets: {
      normalActivePregameWindowMinutes: NORMAL_WINDOW_MINUTES,
      final90MinutesWindowMinutes: FINAL_90_WINDOW_MINUTES,
    },
    currentProviderRequestLimits: {
      configuredMaxCallsPerOperatingDay: Number(process.env.MLB_ODDS_MAX_CALLS_PER_DAY ?? DEFAULT_MAX_PROVIDER_CALLS_PER_DAY),
      source: process.env.MLB_ODDS_MAX_CALLS_PER_DAY ? 'MLB_ODDS_MAX_CALLS_PER_DAY' : 'default_shadow_budget',
      secretsExposed: false,
    },
    activeSlateEstimate: {
      events: activeEvents.length,
      marketsPerEvent,
      estimatedCallsRemainingToday: totalCalls,
      estimatedWritesRemainingToday: totalWrites,
      eventEstimates: estimates,
    },
    fullSlateEstimate: {
      assumedGames: 15,
      marketsPerEvent,
      tenMinuteCadenceCallsPerGame: 24,
      combinedCadenceCallsPerGame: 33,
      estimatedCallsPerDayAtTenMinuteCadence: 15 * 24,
      estimatedCallsPerDayAtCombinedCadence: 15 * 33,
      estimatedMarketRowsPerDayAtCombinedCadence: 15 * 33 * marketsPerEvent * 2,
    },
    protections: {
      perEventAndMarketIdempotency: 'deterministic odds snapshot key: provider:event:market:bookmaker:outcome:line:snapshot_time',
      executionLock: 'required before live scheduler; use existing job/checkpoint lock table or provider budget ledger',
      duplicateRunProtection: 'idempotency key per operating-day/window plus no-overlap lock',
      providerRateLimitHandling: 'budget precheck, retry-after respect, exponential backoff, fail-closed on uncertain accounting',
      maxCallsPerOperatingDay: Number(process.env.MLB_ODDS_MAX_CALLS_PER_DAY ?? DEFAULT_MAX_PROVIDER_CALLS_PER_DAY),
      staleOddsDetection: `normal <= ${NORMAL_WINDOW_MINUTES} minutes; final 90 <= ${FINAL_90_WINDOW_MINUTES} minutes`,
      missedRefreshRecording: 'required: append scheduler observation row/checkpoint with event, market, expectedAt, reason',
      processHardTimeout: 'required for live scheduler runner',
      noOverlappingExecutions: 'required distributed lock before provider call',
    },
    infrastructureRecommendation: {
      recommendedOwner: 'existing adaptive refresh scheduler with GitHub Actions orchestrating bounded route execution',
      vercelCron: 'not preferred for 5-minute cadence unless plan/runtime duration and overlap controls are proven',
      githubActions: 'usable for orchestration if concurrency group and timeout-minutes are configured',
      duplicateExecutionRisk: 'current scheduler ownership must be singular; do not run Vercel Cron and GitHub Actions for the same MLB odds window',
      liveActivationStatus: 'BLOCKED_SHADOW_ONLY',
    },
  }
}

export async function getOddsChangeTriggeredPredictionRefreshV1() {
  return {
    success: true,
    mode: 'odds_change_triggered_prediction_refresh_v1',
    generatedAt: nowIso(),
    readOnly: true,
    shadowOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    rule: 'consider regeneration only when the market snapshot materially changes or required pre-cutoff features change; never regenerate merely because the scheduler ran',
    triggers: {
      noValidPredictionForCurrentMarketSnapshot: true,
      existingPredictionOddsStale: true,
      requiredFeaturesChangedBeforeCutoff: true,
      priorGenerationFailed: true,
      materialOddsOrLineChanged: true,
    },
    materialChangeRules: {
      moneylinePrice: 'absolute American price change >= 10, or implied-probability change >= 1.0 percentage point',
      runLinePrice: 'absolute American price change >= 10',
      runLineHandicap: 'any handicap change, including +/-1.5 to alternate line',
      totalPrice: 'absolute American price change >= 10',
      totalPointsLine: 'points line change >= 0.5',
    },
    blockedActions: [
      'no automatic production regeneration',
      'no probability formula change',
      'no confidence or quality formula change',
      'no production_eligible mutation',
      'no Official Pick promotion',
    ],
  }
}

export async function getPredictionEpochActivationReadinessV1() {
  const [migrationState, shadow, sla, refresh] = await Promise.all([
    getPredictionEpochMigrationState(),
    getPredictionEpochShadowReadiness({ limit: 100 }),
    getPregameOddsRefreshCadenceSlaV1(),
    getOddsChangeTriggeredPredictionRefreshV1(),
  ])
  const blockers = [
    migrationState.migrationApplied ? null : 'PREDICTION_EPOCH_SCHEMA_NOT_APPLIED',
    migrationState.activeEpochCount === 0 ? 'NO_ACTIVE_OR_SHADOW_EPOCH_SEEDED' : null,
    shadow.rowsEvaluated === 0 ? 'NO_RECENT_MLB_PREDICTIONS_TO_CLASSIFY' : null,
    Object.values(shadow.statusCounts).length > 0 && (shadow.statusCounts.SHADOW_PENDING ?? 0) === shadow.rowsEvaluated ? null : 'RECENT_ROWS_NOT_ALL_SHADOW_CERTIFIABLE',
    sla.infrastructureRecommendation.liveActivationStatus === 'BLOCKED_SHADOW_ONLY' ? 'ODDS_REFRESH_SCHEDULER_SHADOW_ONLY' : null,
    'DEPLOYMENT_COMMIT_NOT_VERIFIED_IN_THIS_LOCAL_PHASE',
    'SETTLEMENT_COMPATIBILITY_NOT_CERTIFIED_FOR_NEW_EPOCH',
    'LEARNING_LABEL_COMPATIBILITY_NOT_CERTIFIED_FOR_NEW_EPOCH',
    'MISSED_OPPORTUNITY_RECORDING_NOT_PERSISTED',
    'SCHEDULER_LOCK_NOT_PROVEN_IN_PRODUCTION',
  ].filter(Boolean) as string[]
  return {
    success: true,
    mode: 'prediction_epoch_activation_readiness_v1',
    generatedAt: nowIso(),
    readOnly: true,
    shadowOnly: true,
    ready: blockers.length === 0,
    blockingGates: blockers,
    proposedEpochStartCondition: [
      'Apply additive governance schema after approval.',
      'Seed a SHADOW epoch only.',
      'Run at least one full live MLB operating day with LIVE_PREGAME shadow rows.',
      'Prove odds freshness SLA, cutoff, lineage, duplicate, settlement and learning-label gates.',
      'Manually approve activation after read-only certification.',
    ],
    proposedEpochStartTimestamp: null,
    migrationState: {
      migrationApplied: migrationState.migrationApplied,
      migrationState: migrationState.migrationState,
      activeEpochCount: migrationState.activeEpochCount,
      activeEpochKey: migrationState.activeEpochKey,
    },
    shadowSummary: {
      rowsEvaluated: shadow.rowsEvaluated,
      statusCounts: shadow.statusCounts,
    },
    oddsCadence: sla,
    oddsChangeTriggeredRefresh: refresh,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    sqlApplied: false,
    epochActivated: false,
    historicalReplayExecuted: false,
  }
}

export async function validatePredictionEpochShadowReadinessFixtures() {
  const sample: PredictionRow = {
    id: 'fixture',
    sport_key: SPORT,
    game_id: 'event-1',
    commence_time: '2026-07-28T23:00:00.000Z',
    market: 'moneyline',
    selection: 'Home Team',
    team: 'Home Team',
    line: null,
    odds: -110,
    sportsbook: 'FixtureBook',
    odds_timestamp: '2026-07-28T21:55:00.000Z',
    generated_at: '2026-07-28T22:00:00.000Z',
    cutoff_at: '2026-07-28T22:50:00.000Z',
    feature_snapshot_id: '00000000-0000-4000-8000-000000000001',
    feature_snapshot_key: 'fixture-key',
    feature_set_version: 'fixture-v1',
    feature_snapshot_generated_at: '2026-07-28T22:00:00.000Z',
    feature_snapshot: { quality: 72, sufficiency: 68 },
    production_eligible: false,
    trial: false,
    scrambled: false,
    model_version: 'fixture-model-v1',
    model_role: 'shadow',
    prediction_epoch_key: null,
    prediction_epoch_id: null,
    validation_warnings: [],
  }
  const good = classifyPrediction(sample, new Date('2026-07-28T21:30:00.000Z'))
  const stale = classifyPrediction({ ...sample, id: 'stale', odds_timestamp: '2026-07-28T21:30:00.000Z' }, new Date('2026-07-28T21:30:00.000Z'))
  const postStart = classifyPrediction({ ...sample, id: 'late', generated_at: '2026-07-28T23:01:00.000Z' }, new Date('2026-07-28T21:30:00.000Z'))
  const checks = [
    ['valid fixture is shadow pending', good.shadowCertificationResult === 'SHADOW_PENDING'],
    ['valid fixture does not promote production eligibility', good.productionEligibleCurrentValue === false],
    ['stale fixture is quarantined', stale.shadowCertificationResult === 'QUARANTINED' && stale.failedGates.includes('odds_freshness_sla_met')],
    ['post-start fixture is invalid', postStart.shadowCertificationResult === 'INVALID'],
    ['odds change rules are documented', (await getOddsChangeTriggeredPredictionRefreshV1()).materialChangeRules.totalPointsLine.includes('0.5')],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'prediction_epoch_shadow_readiness_v1_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
  }
}
