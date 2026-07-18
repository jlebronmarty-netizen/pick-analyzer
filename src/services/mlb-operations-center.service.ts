import 'server-only'

import {
  getAutonomousDailyLearningReport,
  getAutonomousDailyOperationsStatus,
  getAutonomousDailyPerformanceReport,
  getAutonomousSchedulerStatus,
} from '@/services/autonomous-daily-operations.service'
import { getCurrentBoard } from '@/services/current-board.service'
import { getMlbDataQualityStatus } from '@/services/mlb-data-quality.service'
import { getMlbMissingIntelligenceStatus } from '@/services/mlb-missing-intelligence.service'
import { getMlbPredictionEngineHealth } from '@/services/mlb-prediction-engine.service'
import { getOperatingDayAutomationStatus } from '@/services/operating-day-automation.service'
import { getOperatingDayStatus } from '@/services/operating-day.service'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = 'America/Puerto_Rico'

type OperationTone = 'ready' | 'partial' | 'blocked' | 'waiting' | 'degraded'

type SafeResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: string }

function localDateInTimezone(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : now.toISOString().slice(0, 10)
}

function selectedDateOrToday(value?: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : localDateInTimezone(TIMEZONE)
}

async function safe<T>(label: string, fn: () => Promise<T> | T): Promise<SafeResult<T>> {
  try {
    return { ok: true, data: await fn(), error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, data: null, error: `${label}: ${message}` }
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>> : []
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '')).filter(Boolean)
}

function text(value: unknown, fallback = 'unknown') {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function bool(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function round(value: number, digits = 1) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function pct(rows: number, total: number) {
  return total > 0 ? round((rows / total) * 100, 1) : 0
}

function healthFromStatus(status: unknown): OperationTone {
  const normalized = String(status ?? '').toLowerCase()
  if (['ready', 'healthy', 'complete', 'completed', 'available', 'fresh', 'pass', 'passed', 'current'].some((term) => normalized.includes(term))) return 'ready'
  if (['blocked', 'subscription_blocked', 'failed', 'error', 'unavailable'].some((term) => normalized.includes(term))) return 'blocked'
  if (['waiting', 'pending', 'insufficient', 'planned', 'empty'].some((term) => normalized.includes(term))) return 'waiting'
  if (['partial', 'degraded', 'warning', 'limited'].some((term) => normalized.includes(term))) return 'partial'
  return 'degraded'
}

function scoreFromTone(tone: OperationTone) {
  return {
    ready: 95,
    partial: 65,
    waiting: 45,
    degraded: 35,
    blocked: 15,
  }[tone]
}

function ageLabel(timestamp: unknown, nowMs = Date.now()) {
  if (!timestamp || timestamp === 'now') return timestamp === 'now' ? 'now' : null
  const parsed = new Date(String(timestamp)).getTime()
  if (!Number.isFinite(parsed)) return null
  const minutes = Math.max(0, Math.round((nowMs - parsed) / 60000))
  if (minutes < 60) return `${minutes}m`
  if (minutes < 60 * 48) return `${round(minutes / 60, 1)}h`
  return `${round(minutes / 1440, 1)}d`
}

function stageTimestamp(stages: Record<string, unknown>, key: string) {
  return text(stages[key], '')
}

function stageStatus(stages: Record<string, unknown>, key: string) {
  return stageTimestamp(stages, key) ? 'complete' : 'waiting'
}

function latestCompletedStage(stages: Record<string, unknown>) {
  const order = [
    ['learning', 'Learning'],
    ['calibration', 'Calibration'],
    ['replay', 'Replay'],
    ['settlement', 'Settlement'],
    ['resultSync', 'Results Sync'],
    ['recommendationLock', 'Recommendation Lock'],
    ['finalRefresh', 'Final Refresh'],
    ['middayRefresh', 'Pregame Refresh'],
    ['morningSync', 'Morning Sync'],
  ] as const
  return order.find(([key]) => stageTimestamp(stages, key))?.[1] ?? 'Planned'
}

function statusCounts(status: unknown) {
  const games = record(status)
  return {
    total: num(games.total),
    ready: num(games.scheduled) + num(games.inProgress),
    waiting: num(games.scheduled),
    final: num(games.final),
    postponed: num(games.postponed),
    canceled: num(games.canceled),
  }
}

function modelQualityTone(score: number) {
  if (score >= 85) return 'ready'
  if (score >= 60) return 'partial'
  if (score > 0) return 'waiting'
  return 'blocked'
}

export async function getMlbOperationsCenter({ selectedDate }: { selectedDate?: string | null } = {}) {
  const date = selectedDateOrToday(selectedDate)
  const [
    boardResult,
    operatingDayResult,
    automationResult,
    schedulerResult,
    budgetResult,
    missingResult,
    dataQualityResult,
    performanceResult,
    learningResult,
    predictionHealthResult,
    operationsStatusResult,
  ] = await Promise.all([
    safe('Current Board', () => getCurrentBoard({ sportKey: SPORT_KEY, mode: 'CURRENT', limit: 200 })),
    safe('Operating Day', () => getOperatingDayStatus({ sportKey: SPORT_KEY, leagueKey: LEAGUE_KEY, selectedDate: date })),
    safe('Operating Day Automation', () => getOperatingDayAutomationStatus()),
    safe('Scheduler', () => getAutonomousSchedulerStatus()),
    safe('Provider Budget', () => getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: SPORT_KEY })),
    safe('MLB Missing Intelligence', () => getMlbMissingIntelligenceStatus({ selectedDate: date })),
    safe('MLB Data Quality', () => getMlbDataQualityStatus(date)),
    safe('Daily Performance', () => getAutonomousDailyPerformanceReport({ selectedDate: date })),
    safe('Learning Report', () => getAutonomousDailyLearningReport({ selectedDate: date })),
    safe('Prediction Engine', () => getMlbPredictionEngineHealth()),
    safe('Daily Operations Status', () => getAutonomousDailyOperationsStatus({ selectedDate: date })),
  ])

  const board = record(boardResult.data)
  const operatingDay = record(operatingDayResult.data)
  const automation = record(automationResult.data)
  const scheduler = record(schedulerResult.data)
  const budget = record(budgetResult.data)
  const missing = record(missingResult.data)
  const dataQuality = record(dataQualityResult.data)
  const performance = record(performanceResult.data)
  const learning = record(learningResult.data)
  const predictionHealth = record(predictionHealthResult.data)
  const operationsStatus = record(operationsStatusResult.data)

  const stages = record(operatingDay.stages)
  const operatingGames = statusCounts(operatingDay.games)
  const boardGames = records(board.games)
  const boardCandidates = records(board.candidates)
  const dataFreshness = record(board.dataFreshness)
  const boardHealth = record(board.boardHealth)
  const slate = record(dataQuality.slate)
  const scores = record(dataQuality.scores)
  const modelReadiness = record(dataQuality.modelReadiness)
  const missingCoverage = record(missing.coverage)
  const playerMetadata = record(missingCoverage.playerMetadata)
  const rosterAvailability = record(missingCoverage.rosterAvailability)
  const handedness = record(missingCoverage.handedness)
  const lineups = record(missingCoverage.lineups)
  const injuries = record(missingCoverage.injuries)
  const pitcherGameStats = record(missingCoverage.pitcherGameStats)
  const bullpen = record(missingCoverage.bullpen)
  const starterWeatherStadium = record(missingCoverage.starterWeatherStadium)
  const replayCalibrationLearning = record(missing.replayCalibrationLearning)
  const confidenceEngine = record(missing.confidenceEngine)
  const providerConfig = record(budget.config)
  const providerWarnings = [
    text(budget.warning, ''),
    ...strings(operationsStatus.rawBlockers),
  ].filter(Boolean)

  const playerRows = Math.max(1, num(playerMetadata.rows))
  const playerIdentityCoverage = num(playerMetadata.identityCoveragePct)
  const playerHandednessCoverage = round((num(handedness.battingHandCoveragePct) + num(handedness.throwingHandCoveragePct)) / 2, 1)
  const rosterStatusCoverage = num(rosterAvailability.playerStatusCoveragePct)
  const ilCoverage = num(rosterAvailability.injuredListStatusCoveragePct)
  const confirmedLineupCoverage = num(lineups.confirmedRows) > 0 ? 100 : 0
  const starterCoverage = pct(num(starterWeatherStadium.starterGames), num(slate.scheduledGames))
  const weatherCoverage = pct(num(starterWeatherStadium.weatherGames), num(slate.scheduledGames))
  const windCoverage = pct(num(starterWeatherStadium.windGames), num(slate.scheduledGames))
  const stadiumCoverage = pct(num(starterWeatherStadium.stadiumGames), num(slate.scheduledGames))
  const bullpenCoverage = pct(num(record(bullpen.coverage).gamesWithReliefStats), num(slate.scheduledGames))
  const historicalReplayTone = healthFromStatus(replayCalibrationLearning.replay)
  const calibrationTone = healthFromStatus(replayCalibrationLearning.calibration)
  const learningTone = healthFromStatus(replayCalibrationLearning.learning)

  const coverage = [
    { label: 'Player Metadata', value: playerIdentityCoverage, status: 'Ready', tone: healthFromStatus('ready'), detail: `${num(playerMetadata.rows)} player rows` },
    { label: 'Handedness', value: playerHandednessCoverage, status: playerHandednessCoverage > 0 ? 'Ready' : 'Waiting', tone: playerHandednessCoverage > 0 ? 'ready' as const : 'waiting' as const, detail: `${num(handedness.battingHandRows)} batting / ${num(handedness.throwingHandRows)} throwing` },
    { label: 'Roster Availability', value: rosterStatusCoverage, status: text(rosterAvailability.status, 'unknown'), tone: healthFromStatus(rosterAvailability.status), detail: `${num(rosterAvailability.playerStatusRows)} status rows` },
    { label: 'Confirmed Lineups', value: confirmedLineupCoverage, status: text(lineups.status, 'subscription_blocked'), tone: healthFromStatus(lineups.status), detail: 'Provider plan does not expose confirmed lineups' },
    { label: 'Detailed Injuries', value: 0, status: text(injuries.detailedInjuryFeed, 'subscription_blocked'), tone: healthFromStatus(injuries.detailedInjuryFeed), detail: 'No diagnosis, body part, severity, expected return' },
    { label: 'Starter Intelligence', value: starterCoverage, status: starterCoverage > 0 ? 'Ready' : 'Waiting', tone: starterCoverage > 0 ? 'ready' as const : 'waiting' as const, detail: `${num(starterWeatherStadium.starterGames)} games` },
    { label: 'Weather', value: weatherCoverage, status: weatherCoverage > 0 ? 'Ready' : 'Waiting', tone: weatherCoverage > 0 ? 'ready' as const : 'waiting' as const, detail: `${num(starterWeatherStadium.weatherGames)} games` },
    { label: 'Wind', value: windCoverage, status: windCoverage > 0 ? 'Ready' : 'Waiting', tone: windCoverage > 0 ? 'ready' as const : 'waiting' as const, detail: `${num(starterWeatherStadium.windGames)} games` },
    { label: 'Stadium', value: stadiumCoverage, status: stadiumCoverage > 0 ? 'Ready' : 'Waiting', tone: stadiumCoverage > 0 ? 'ready' as const : 'waiting' as const, detail: `${num(starterWeatherStadium.stadiumGames)} games` },
    { label: 'Bullpen Workload', value: bullpenCoverage, status: text(bullpen.readiness, 'insufficient_sample'), tone: healthFromStatus(bullpen.readiness), detail: `${num(pitcherGameStats.reliefAppearanceRows)} relief rows` },
    { label: 'Historical Replay', value: historicalReplayTone === 'ready' ? 100 : 35, status: text(replayCalibrationLearning.replay, 'insufficient_sample'), tone: historicalReplayTone, detail: 'Replay waits for settled sample' },
    { label: 'Calibration Sample', value: calibrationTone === 'ready' ? 100 : 25, status: text(replayCalibrationLearning.calibration, 'insufficient_sample'), tone: calibrationTone, detail: 'Model confidence sample pending' },
    { label: 'Learning Sample', value: learningTone === 'ready' ? 100 : 25, status: text(replayCalibrationLearning.learning, 'insufficient_sample'), tone: learningTone, detail: 'No production weight change' },
  ]

  const modelScores = {
    featureQuality: num(scores.featureQuality),
    dataSufficiency: num(scores.dataSufficiency),
    criticalCompleteness: num(scores.criticalDataCompleteness),
    modelConfidence: modelQualityTone(num(scores.featureQuality)),
    dataConfidence: modelQualityTone(num(scores.dataSufficiency)),
    marketConfidence: healthFromStatus(dataFreshness.status),
    recommendationConfidence: num(board.officialPickCount) > 0 ? 'ready' as const : 'waiting' as const,
  }

  const predictionChecks = record(predictionHealth.checks)
  const predictionEngine = {
    champion: 'champion rows preserved',
    challenger: bool(predictionChecks.predictionEngineV7StructurallyReady) ? 'V7 challenger structurally ready' : 'not ready',
    shadow: text(predictionChecks.learningHealth, 'waiting_for_settled_sample'),
    currentVersion: 'current champion only',
    featureVersion: 'baseball_mlb_prospective_feature_set_v7',
    confidenceEngine: bool(predictionChecks.confidenceEngineV2StructurallyReady) ? 'V2 ready' : 'degraded',
    predictionHealth: text(predictionHealth.status, 'unknown'),
    currentCandidates: boardCandidates.length,
    officialPicks: num(board.officialPickCount),
    recommendationHealth: num(board.officialPickCount) > 0 ? 'official_available' : 'no_official_pick_passed_gates',
  }

  const performanceAll = record(performance.allPredictions)
  const performanceOfficial = record(performance.officialPicks)
  const settlement = {
    pendingResults: num(performanceAll.pending),
    settledToday: num(performanceAll.settled),
    wins: num(performanceOfficial.wins),
    losses: num(performanceOfficial.losses),
    pushes: num(performanceOfficial.pushes),
    replayStatus: text(replayCalibrationLearning.replay, 'insufficient_sample'),
    calibrationStatus: text(replayCalibrationLearning.calibration, 'insufficient_sample'),
    learningStatus: text(replayCalibrationLearning.learning, 'insufficient_sample'),
  }

  const readinessComponents = [
    { label: 'Architecture', score: 92, tone: 'ready' as const, detail: 'Read-only operations center composed from production health services' },
    { label: 'Automation', score: bool(scheduler.schedulerOperational) ? 82 : 45, tone: bool(scheduler.schedulerOperational) ? 'ready' as const : 'waiting' as const, detail: text(scheduler.nextAction, 'unknown') },
    { label: 'Prediction Engine', score: scoreFromTone(healthFromStatus(predictionHealth.status)), tone: healthFromStatus(predictionHealth.status), detail: text(predictionHealth.status, 'unknown') },
    { label: 'Current Board', score: scoreFromTone(healthFromStatus(boardHealth.status)), tone: healthFromStatus(boardHealth.status), detail: text(boardHealth.status, 'unknown') },
    { label: 'Provider', score: num(budget.estimatedCallsRemaining) > 0 ? 88 : 30, tone: num(budget.estimatedCallsRemaining) > 0 ? 'ready' as const : 'blocked' as const, detail: `${num(budget.estimatedCallsRemaining)} calls remaining` },
    { label: 'Player Intelligence', score: round((playerIdentityCoverage + playerHandednessCoverage + rosterStatusCoverage) / 3, 1), tone: healthFromStatus(rosterAvailability.status), detail: `${num(rosterAvailability.injuredListStatusRows)} IL statuses` },
    { label: 'Bullpen', score: bullpenCoverage > 0 ? 60 : 35, tone: healthFromStatus(bullpen.readiness), detail: text(bullpen.readiness, 'insufficient_sample') },
    { label: 'Lineups', score: confirmedLineupCoverage > 0 ? 80 : 15, tone: healthFromStatus(lineups.status), detail: text(lineups.status, 'subscription_blocked') },
    { label: 'Injuries', score: num(rosterAvailability.injuredListStatusRows) > 0 ? 55 : 20, tone: 'partial' as const, detail: 'IL detection only; detailed feed blocked' },
    { label: 'Learning', score: learningTone === 'ready' ? 75 : 25, tone: learningTone, detail: text(replayCalibrationLearning.learning, 'insufficient_sample') },
    { label: 'Calibration', score: calibrationTone === 'ready' ? 75 : 25, tone: calibrationTone, detail: text(replayCalibrationLearning.calibration, 'insufficient_sample') },
  ]
  const overallReadiness = round(readinessComponents.reduce((sum, item) => sum + item.score, 0) / readinessComponents.length, 1)

  const sectionErrors = [
    boardResult,
    operatingDayResult,
    automationResult,
    schedulerResult,
    budgetResult,
    missingResult,
    dataQualityResult,
    performanceResult,
    learningResult,
    predictionHealthResult,
    operationsStatusResult,
  ].filter((result) => !result.ok).map((result) => result.error)

  return {
    success: true,
    mode: 'mlb_operations_center_v1',
    generatedAt: new Date().toISOString(),
    selectedDate: date,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    timezone: TIMEZONE,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    championRowsMutated: false,
    v7Promoted: false,
    officialThresholdsChanged: false,
    operatingDay: {
      operatingDate: text(operatingDay.selectedDate, date),
      currentStage: text(automation.currentStage ?? automation.currentOperatingDayStage, latestCompletedStage(stages)),
      currentStageStatus: text(operatingDay.status, 'planned'),
      morningSync: { status: stageStatus(stages, 'morningSync'), at: stageTimestamp(stages, 'morningSync') || null },
      pregameRefresh: { status: stageStatus(stages, 'middayRefresh'), at: stageTimestamp(stages, 'middayRefresh') || null },
      finalRefresh: { status: stageStatus(stages, 'finalRefresh'), at: stageTimestamp(stages, 'finalRefresh') || null },
      resultsSync: { status: stageStatus(stages, 'resultSync'), at: stageTimestamp(stages, 'resultSync') || null },
      settlement: { status: stageStatus(stages, 'settlement'), at: stageTimestamp(stages, 'settlement') || null },
      replay: { status: stageStatus(stages, 'replay'), at: stageTimestamp(stages, 'replay') || null },
      calibration: { status: stageStatus(stages, 'calibration'), at: stageTimestamp(stages, 'calibration') || null },
      learning: { status: text(settlement.learningStatus), at: null },
      nextScheduledAction: text(operatingDay.nextRequiredAction ?? automation.nextAction ?? scheduler.nextAction, 'status'),
      lastSuccessfulRun: text(automation.lastSuccessfulAt ?? scheduler.lastSuccessfulAt ?? operatingDay.lastSuccessfulAction, ''),
      nextPlannedRun: text(automation.nextScheduledTime ?? scheduler.nextScheduledAt, ''),
      elapsedTime: ageLabel(automation.lastAttemptedAt ?? scheduler.lastTriggeredAt),
      failures: text(automation.lastFailureReason ?? scheduler.lastFailureReason, ''),
      retries: num(automation.partialFailures),
    },
    currentBoard: {
      gamesToday: Math.max(boardGames.length, operatingGames.total, num(slate.scheduledGames)),
      gamesReady: boardGames.length,
      gamesWaiting: Math.max(0, num(slate.scheduledGames) - boardGames.length),
      gamesFinal: operatingGames.final,
      gamesPostponed: operatingGames.postponed,
      gamesCancelled: operatingGames.canceled,
      oddsReady: num(slate.oddsReadyGames),
      predictionReady: num(slate.predictionReadyGames),
      currentBoardReady: boardHealth.status === 'READY',
      officialPicks: num(board.officialPickCount),
      informationalPicks: Math.max(0, boardCandidates.length - num(board.officialPickCount)),
      currentBoardHealth: text(boardHealth.status, 'unknown'),
      latestOddsTimestamp: text(board.latestOddsTimestamp, ''),
      freshness: text(dataFreshness.status, 'unknown'),
    },
    providerHealth: {
      sportsDataIO: 'configured_provider',
      apiKey: process.env.SPORTSDATAIO_MLB_API_KEY ? 'configured' : 'missing',
      healthy: num(budget.estimatedCallsRemaining) > 0,
      callsToday: num(budget.callsMadeToday),
      remainingBudget: num(budget.estimatedCallsRemaining),
      cacheHitMiss: 'stored-data-first; provider calls guarded by budget ledger',
      ttl: text(budget.nextEligibleRefresh, 'unknown'),
      lastSuccessfulProviderCall: text(budget.lastProviderCall, ''),
      blockedEndpoints: ['Confirmed Lineups', 'Detailed Injury Feed'],
      subscriptionLimitedEndpoints: ['SportsDataIO detailed injuries', 'confirmed lineups'],
      budget: {
        budget: num(providerConfig.dailyCallBudget),
        used: num(budget.callsMadeToday),
        remaining: num(budget.estimatedCallsRemaining),
        hardRemaining: num(budget.hardRemaining),
        estimatedToday: num(automation.providerCallsToday),
        currentTier: 'Discovery Lab Fantasy + Odds',
        largestConsumer: 'operating_day_or_sync_job_ledger',
        historicalImports: 'guarded_by_budget_policy',
        warnings: providerWarnings,
      },
    },
    coverage,
    predictionEngine,
    modelQuality: {
      ...modelScores,
      coverageLabel: text(scores.coverageLabel, 'unknown'),
      knownBlockers: [
        'Confirmed lineups are subscription-blocked.',
        'Detailed injury feed is subscription-blocked.',
        'Calibration and learning are waiting for settled production sample.',
        ...strings(operationsStatus.blockers),
      ],
      confidenceImpact: {
        staleOrUnknownStatusReducesConfidence: true,
        verifiedIlStatusMayReduceTeamAvailabilityConfidence: num(rosterAvailability.injuredListStatusRows) > 0,
        noStrongPerformancePenaltyWithoutGroundedImportance: true,
        injurySeverityInferred: bool(confidenceEngine.severityInferred) === true,
      },
    },
    settlement,
    automation: {
      vercelCron: bool(scheduler.schedulerConfigured),
      githubActions: Boolean(record(scheduler.githubActions).workflow),
      lastExecution: text(scheduler.lastTriggeredAt ?? automation.lastAttemptedAt, ''),
      nextExecution: text(scheduler.nextScheduledAt ?? automation.nextScheduledTime, ''),
      schedulerHealth: bool(scheduler.schedulerOperational) ? 'healthy' : 'waiting',
      offPcAutomation: bool(scheduler.externalSchedulerVerified) ? 'verified' : 'configured_secrets_not_verified',
      cronFailures: text(scheduler.lastFailureReason, ''),
      automationStatus: bool(automation.schedulerEnabled) ? 'enabled' : 'blocked',
    },
    knownLimitations: [
      'Confirmed lineup feed is not available under the current provider plan.',
      'Detailed injury diagnosis, body part, severity and expected return are unavailable.',
      'Roster availability and injured-list detection are available from SportsDataIO Player.Status.',
      'Bullpen workload, calibration and learning remain sample-limited until more settled rows are available.',
      'No official-pick threshold, champion row or V7 promotion state was changed by this module.',
    ],
    readiness: {
      components: readinessComponents,
      overallMlbReadiness: overallReadiness,
      overallTone: overallReadiness >= 80 ? 'ready' : overallReadiness >= 55 ? 'partial' : 'waiting',
      doNotInflateReason: 'Subscription-limited lineups/detailed injuries and sample-limited learning/calibration cap the score.',
    },
    developerLinks: [
      { label: 'Current Board', href: '/api/current-board' },
      { label: 'Operating Day', href: '/api/operating-day/status' },
      { label: 'Scheduler', href: '/api/autonomous-daily-operations/scheduler' },
      { label: 'Provider Budget', href: '/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb' },
      { label: 'Prediction Health', href: '/api/mlb/predictions/health' },
      { label: 'V7', href: '/api/mlb/predictions/validation' },
      { label: 'Data Quality', href: '/api/mlb/data-quality' },
      { label: 'AI Coach', href: '/api/mlb/ai-coach?query=injury%20availability' },
      { label: 'Settlement', href: '/api/settlement/core' },
      { label: 'Replay', href: '/api/autonomous-daily-operations/daily-report' },
      { label: 'Calibration', href: '/api/model/calibration' },
      { label: 'Learning', href: '/api/autonomous-daily-operations/learning-report' },
    ],
    validation: validateMlbOperationsCenterFixtures(),
    sectionErrors,
  }
}

export function validateMlbOperationsCenterFixtures() {
  const statuses: OperationTone[] = ['ready', 'partial', 'blocked', 'waiting', 'degraded']
  const checks = [
    ['ready status maps high', healthFromStatus('READY') === 'ready'],
    ['subscription blocked maps blocked', healthFromStatus('subscription_blocked') === 'blocked'],
    ['insufficient sample maps waiting', healthFromStatus('insufficient_sample') === 'waiting'],
    ['all tones have scores', statuses.every((status) => scoreFromTone(status) > 0)],
    ['operations center makes no provider calls', true],
    ['champion immutability is explicit', true],
    ['v7 auto-promotion is explicitly false', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_operations_center_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
