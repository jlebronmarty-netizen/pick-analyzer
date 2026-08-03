import 'server-only'

import { getEnabledSports } from '@/config/sports.config'
import { getPerformanceScopeV2 } from '@/services/performance-scope-v2.service'

type PerformanceScope = Awaited<ReturnType<typeof getPerformanceScopeV2>>
type TimelineMetrics = PerformanceScope['timeline'][string]

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function nullableNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scoreFromBrier(value: number | null) {
  return value === null ? null : Math.max(0, Math.min(100, round(100 - (value / 0.35) * 100)))
}

function calibrationFrom(metrics: TimelineMetrics) {
  const accuracy = nullableNumber(metrics.accuracy)
  const confidence = nullableNumber((metrics as Record<string, unknown>).averageConfidence)
  if (accuracy === null || confidence === null || metrics.wins + metrics.losses === 0) {
    return {
      calibrationError: null,
      calibrationBias: null,
      confidenceReliability: null,
      sample: metrics.wins + metrics.losses,
      explanation: 'No scored settled predictions in this scope.',
    }
  }
  const signedBias = round(confidence - accuracy)
  return {
    calibrationError: Math.abs(signedBias),
    calibrationBias: signedBias,
    confidenceReliability: Math.max(0, Math.min(100, round(100 - Math.abs(signedBias) * 4))),
    sample: metrics.wins + metrics.losses,
    explanation: 'Calibration error is absolute confidence-vs-accuracy gap; calibration bias keeps the signed direction.',
  }
}

function trustFrom(metrics: TimelineMetrics) {
  const scored = metrics.wins + metrics.losses
  const calibration = calibrationFrom(metrics)
  const brierScore = scoreFromBrier(metrics.brier)
  const accuracyScore = metrics.accuracy
  const sampleScore = Math.min(100, round((scored / 250) * 100))
  const blockers = [
    ...(scored === 0 ? ['NO_SETTLED_PRODUCTION_PREDICTIONS'] : scored < 30 ? ['LOW_SETTLED_SAMPLE'] : []),
    ...(metrics.brier !== null && metrics.brier > 0.22 ? ['BRIER_SCORE_ABOVE_TARGET'] : []),
  ]
  const components = [
    { key: 'sample_size', label: 'Production Sample Size', value: scored, normalizedScore: scored ? sampleScore : null, weight: 0.35, contribution: scored ? round(sampleScore * 0.35) : 0, availability: scored ? 'AVAILABLE' : 'UNAVAILABLE', explanation: 'Cutoff-safe production Win/Loss sample.' },
    { key: 'accuracy', label: 'Accuracy', value: metrics.accuracy, normalizedScore: metrics.accuracy, weight: 0.25, contribution: metrics.accuracy === null ? 0 : round(metrics.accuracy * 0.25), availability: metrics.accuracy === null ? 'UNAVAILABLE' : 'AVAILABLE', explanation: 'Win rate over the same production scope.' },
    { key: 'brier_score', label: 'Brier Score', value: metrics.brier, normalizedScore: brierScore, weight: 0.2, contribution: brierScore === null ? 0 : round(brierScore * 0.2), availability: brierScore === null ? 'UNAVAILABLE' : 'AVAILABLE', explanation: 'Probability accuracy over scored outcomes.' },
    { key: 'calibration_quality', label: 'Calibration Quality Score', value: calibration.calibrationError, normalizedScore: calibration.confidenceReliability, weight: 0.2, contribution: calibration.confidenceReliability === null ? 0 : round(calibration.confidenceReliability * 0.2), availability: calibration.confidenceReliability === null ? 'UNAVAILABLE' : 'AVAILABLE', explanation: `${calibration.explanation} The displayed trust component is a 0-100 quality score; the raw calibration error remains available as the component value.` },
  ]
  const available = components.filter((item) => item.availability === 'AVAILABLE')
  const weight = available.reduce((sum, item) => sum + item.weight, 0)
  const trustScore = scored === 0 || weight === 0
    ? null
    : round(available.reduce((sum, item) => sum + item.contribution, 0) / weight)
  return {
    trustScore,
    trustLabel: trustScore === null ? 'INSUFFICIENT DATA' : trustScore >= 80 ? 'STRONG' : trustScore >= 60 ? 'MODERATE' : 'LIMITED',
    trustStatus: scored === 0 ? 'NO_SETTLED_SAMPLE' : scored < 30 ? 'LIMITED_SAMPLE' : 'PRODUCTION_SCOPE',
    trustConfidence: scored,
    sampleQualification: scored === 0 ? 'NO_SETTLED_SAMPLE' : scored < 30 ? 'SMALL_SAMPLE' : 'QUALIFIED_SAMPLE',
    blockers,
    warnings: scored === 0 ? ['Trust is not available until production predictions settle.'] : [],
    components,
  }
}

function reportCardFrom(metrics: TimelineMetrics) {
  const trust = trustFrom(metrics)
  const score = trust.trustScore
  return {
    overallGrade: score === null ? 'N/A' : score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'F',
    sample: metrics.wins + metrics.losses,
    metrics,
    calibration: calibrationFrom(metrics),
    trustScore: trust,
  }
}

type GoalDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'RANGE_TARGET'

function evaluateGoal({
  currentValue,
  target,
  direction,
  sample,
}: {
  currentValue: number | null
  target: number
  direction: GoalDirection
  sample: number
}) {
  if (currentValue === null || sample === 0) {
    return { status: 'NOT ENOUGH DATA', progressPercentage: 0, blocker: 'INSUFFICIENT_SAMPLE' }
  }
  const achieved = direction === 'HIGHER_IS_BETTER'
    ? currentValue >= target
    : direction === 'LOWER_IS_BETTER'
      ? currentValue <= target
      : currentValue === target
  const progressPercentage = direction === 'HIGHER_IS_BETTER'
    ? Math.min(100, round((currentValue / target) * 100))
    : direction === 'LOWER_IS_BETTER'
      ? Math.min(100, round((target / Math.max(currentValue, 0.0001)) * 100))
      : achieved ? 100 : 0
  if (achieved) return { status: 'ACHIEVED', progressPercentage, blocker: null }
  if (direction === 'LOWER_IS_BETTER') return { status: 'NEEDS IMPROVEMENT', progressPercentage, blocker: 'VALUE_ABOVE_TARGET' }
  if (progressPercentage >= 75) return { status: 'APPROACHING TARGET', progressPercentage, blocker: 'BELOW_TARGET' }
  if (progressPercentage >= 45) return { status: 'WATCH', progressPercentage, blocker: 'BELOW_TARGET' }
  return { status: 'BLOCKED', progressPercentage, blocker: 'BELOW_TARGET' }
}

function goalsFrom(metrics: TimelineMetrics) {
  const scored = metrics.wins + metrics.losses
  const calibration = calibrationFrom(metrics)
  const definitions = [
    { key: 'minimum_settled_sample', label: 'Minimum settled sample', currentValue: scored, target: 100, direction: 'HIGHER_IS_BETTER' as const },
    { key: 'maximum_brier_score', label: 'Maximum Brier Score', currentValue: metrics.brier, target: 0.22, direction: 'LOWER_IS_BETTER' as const },
    { key: 'maximum_calibration_error', label: 'Maximum calibration error', currentValue: calibration.calibrationError, target: 8, direction: 'LOWER_IS_BETTER' as const },
    { key: 'minimum_settlement_coverage', label: 'Minimum settlement coverage', currentValue: metrics.settlementCoverage, target: 70, direction: 'HIGHER_IS_BETTER' as const },
  ]
  return {
    mode: 'performance_goals_scope_v2',
    scope: 'cutoff_safe_production_scope',
    goals: definitions.map((goal) => {
      const available = goal.currentValue !== null && Number.isFinite(Number(goal.currentValue))
      const evaluation = evaluateGoal({ currentValue: available ? Number(goal.currentValue) : null, target: goal.target, direction: goal.direction, sample: scored })
      return {
        ...goal,
        progressPercentage: evaluation.progressPercentage,
        status: evaluation.status,
        sampleQualification: scored === 0 ? 'NO_SETTLED_SAMPLE' : scored < 30 ? 'SMALL_SAMPLE' : 'QUALIFIED_SAMPLE',
        blocker: evaluation.status === 'ACHIEVED' ? null : goal.key,
      }
    }),
  }
}

export function validatePerformanceProductContractFixtures() {
  const metric = (brier: number): TimelineMetrics => ({
    label: 'fixture',
    generated: 3,
    totalAnalyzedRows: 3,
    eligible: 3,
    canonicalPredictionRows: 3,
    nonProductionAnalysisRows: 0,
    recommendationEligibleRows: 3,
    actionableRows: 3,
    officialPickEligibleRows: 3,
    settledCanonicalRows: 3,
    uniqueMarkets: 3,
    current: 0,
    superseded: 0,
    settled: 3,
    pending: 0,
    wins: 2,
    losses: 1,
    pushes: 0,
    voids: 0,
    accuracy: 66.67,
    brier,
    averageConfidence: 61,
    settlementCoverage: 100,
    nonProductionExclusionReasons: {},
    nonProductionBlockers: {},
    nonProductionBreakdown: {},
    validPregameNonProductionRows: 0,
  })
  const achieved = goalsFrom(metric(0.2)).goals.find((goal) => goal.key === 'maximum_brier_score')
  const exact = goalsFrom(metric(0.22)).goals.find((goal) => goal.key === 'maximum_brier_score')
  const above = goalsFrom(metric(0.2549)).goals.find((goal) => goal.key === 'maximum_brier_score')
  const evolution = evolutionEntry('season', metric(0.2549))
  const checks = [
    ['brier below target achieved', achieved?.status === 'ACHIEVED'],
    ['brier equal target achieved', exact?.status === 'ACHIEVED'],
    ['brier above target needs improvement', above?.status === 'NEEDS IMPROVEMENT' && above.blocker === 'maximum_brier_score'],
    ['qualified metrics do not use insufficient status', evolution.status === 'LIMITED_SAMPLE' || evolution.status === 'PRODUCTION_SCOPE'],
    ['trend scope explanation is explicit', typeof evolution.scopeExplanation === 'string' && evolution.scopeExplanation.includes('matching prior comparison cohort')],
    ['brier blocker emitted', trustFrom(metric(0.2549)).blockers.includes('BRIER_SCORE_ABOVE_TARGET')],
    ['calibration quality label is not calibration error', trustFrom(metric(0.2549)).components.some((item) => item.key === 'calibration_quality' && item.label === 'Calibration Quality Score' && item.value === 5.67 && item.normalizedScore === 77.32)],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'performance_product_contract_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

function maturityPipelineFrom(metrics: TimelineMetrics) {
  const scored = metrics.wins + metrics.losses
  const calibration = calibrationFrom(metrics)
  const totalAnalyzedRows = Number((metrics as Record<string, unknown>).totalAnalyzedRows ?? metrics.generated ?? 0)
  const canonicalPredictionRows = Number((metrics as Record<string, unknown>).canonicalPredictionRows ?? metrics.eligible ?? 0)
  const nonProductionAnalysisRows = Number((metrics as Record<string, unknown>).nonProductionAnalysisRows ?? Math.max(0, totalAnalyzedRows - canonicalPredictionRows))
  const stage = (status: string, score: number, evidence: string[], blockers: string[], nextAction: string, sampleScope: string) => ({
    status,
    score,
    evidence,
    blockers,
    nextAction,
    sampleScope,
  })
  return {
    DATA: stage(
      'ACTIVE',
      canonicalPredictionRows ? 80 : 0,
      [`${canonicalPredictionRows} canonical Current Era predictions; ${nonProductionAnalysisRows} non-production analysis rows; ${totalAnalyzedRows} total analyzed rows in scope.`],
      canonicalPredictionRows ? [] : ['NO_CANONICAL_PRODUCTION_PREDICTIONS'],
      'Maintain production data quality monitoring.',
      'Canonical Production Sample'
    ),
    BACKTESTING: stage(scored >= 100 ? 'COMPLETE' : scored > 0 ? 'ACTIVE' : 'NOT STARTED', Math.min(100, scored), [`${scored} scored Win/Loss outcomes.`], scored < 100 ? ['SETTLED_SAMPLE_BELOW_100'] : [], 'Accumulate settled production samples.', 'Production Sample'),
    CALIBRATION: stage(scored >= 30 && calibration.calibrationError !== null && calibration.calibrationError <= 8 ? 'COMPLETE' : scored ? 'LIMITED' : 'BLOCKED', calibration.confidenceReliability ?? 0, [`Calibration error ${calibration.calibrationError ?? 'N/A'} on ${calibration.sample} scored outcomes.`], scored < 30 ? ['CALIBRATION_SAMPLE_BELOW_30'] : [], 'Review reliability after more same-scope settlements.', 'Production Sample'),
    SHADOW_REPLAY: stage('SEPARATE_SCOPE', 0, ['Replay and shadow samples are intentionally excluded from production performance trust.'], [], 'Keep replay/shadow evidence labeled separately.', 'Replay/Shadow Sample'),
  }
}

function engineeringAdvisorFrom(metrics: TimelineMetrics) {
  const scored = metrics.wins + metrics.losses
  const calibration = calibrationFrom(metrics)
  const blockers = [
    ...(scored < 30 ? ['LOW_SETTLED_PRODUCTION_SAMPLE'] : []),
    ...(metrics.brier !== null && metrics.brier > 0.22 ? ['BRIER_SCORE_ABOVE_TARGET'] : []),
    ...(calibration.calibrationError !== null && calibration.calibrationError > 8 ? ['CALIBRATION_ERROR_ABOVE_TARGET'] : []),
    ...((metrics.settlementCoverage ?? 0) < 70 ? ['SETTLEMENT_COVERAGE_BELOW_TARGET'] : []),
  ]
  return {
    currentStrengths: [
      'Performance, trust, report card, goals, timeline and history use performance_scope_v2.',
      metrics.generated ? 'Cutoff-safe production prediction history is available.' : 'Scope contract is available.',
    ],
    currentWeaknesses: blockers.map((item) => item.replaceAll('_', ' ').toLowerCase()),
    currentBlockers: blockers,
    estimatedReadiness: scored === 0 ? 'INSUFFICIENT DATA' : scored < 30 ? 'LIMITED_SAMPLE' : 'PRODUCTION_SCOPE',
    nextRecommendedImprovements: blockers.length
      ? ['Accumulate same-scope settled production samples before making stronger trust or calibration claims.']
      : ['Continue monitoring market alignment, settlement coverage and calibration drift.'],
    highestImpactTasks: blockers.length
      ? blockers
      : ['Monitor current market alignment blockers: stale market, missing opposite price, unknown push probability.'],
  }
}

function change(current: number | null, previous: number | null) {
  return {
    currentValue: current,
    previousValue: previous,
    absoluteChange: current === null || previous === null ? null : round(current - previous),
  }
}

function evolutionEntry(period: string, current: TimelineMetrics, previous?: TimelineMetrics) {
  const currentTrust = trustFrom(current)
  const previousTrust = previous ? trustFrom(previous) : null
  const currentCalibration = calibrationFrom(current)
  const previousCalibration = previous ? calibrationFrom(previous) : null
  return {
    period,
    status: currentTrust.trustStatus,
    scopeExplanation: previousTrust?.trustScore === null || previousTrust === null
      ? 'Current metrics are available in the cutoff-safe production scope; trend direction is unavailable until a matching prior comparison cohort exists.'
      : 'Current and previous values use the same cutoff-safe production scope.',
    trendDirection: previousTrust?.trustScore === null || previousTrust === null || currentTrust.trustScore === null
      ? 'INSUFFICIENT_DATA'
      : currentTrust.trustScore >= previousTrust.trustScore
        ? 'IMPROVING'
        : 'DECLINING',
    sampleCounts: { current: current.wins + current.losses, previous: previous ? previous.wins + previous.losses : 0 },
    trustScore: change(currentTrust.trustScore, previousTrust?.trustScore ?? null),
    accuracy: change(current.accuracy, previous?.accuracy ?? null),
    brierScore: change(current.brier, previous?.brier ?? null),
    calibration: change(currentCalibration.calibrationError, previousCalibration?.calibrationError ?? null),
    calibrationBias: change(currentCalibration.calibrationBias, previousCalibration?.calibrationBias ?? null),
    readiness: change(currentTrust.trustScore, previousTrust?.trustScore ?? null),
    dataQuality: change(null, null),
    featureQuality: change(null, null),
    confidenceQuality: change(currentCalibration.confidenceReliability, previousCalibration?.confidenceReliability ?? null),
  }
}

function trustChangeEntry(label: string, trustScore: number | null) {
  return {
    previousScore: null,
    currentScore: trustScore,
    absoluteChange: null,
    direction: 'INSUFFICIENT_DATA',
    mainPositiveContributors: [],
    mainNegativeContributors: [],
    newBlockers: [],
    resolvedBlockers: [],
    explanation: `${label} comparison is unavailable until matching cutoff-safe production samples exist.`,
  }
}

function emptyMetrics(label = 'No settled production predictions'): TimelineMetrics {
  return {
    label,
    generated: 0,
    totalAnalyzedRows: 0,
    eligible: 0,
    canonicalPredictionRows: 0,
    nonProductionAnalysisRows: 0,
    recommendationEligibleRows: 0,
    actionableRows: 0,
    officialPickEligibleRows: 0,
    settledCanonicalRows: 0,
    uniqueMarkets: 0,
    current: 0,
    superseded: 0,
    settled: 0,
    pending: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    voids: 0,
    accuracy: null,
    brier: null,
    averageConfidence: null,
    settlementCoverage: null,
    nonProductionExclusionReasons: {},
    nonProductionBlockers: {},
    nonProductionBreakdown: {},
    validPregameNonProductionRows: 0,
  }
}

export async function getPerformanceProductContract({
  sportKey,
  includeHistoryRows = false,
  maxPredictionRows,
}: {
  sportKey?: string | null
  includeHistoryRows?: boolean
  maxPredictionRows?: number
} = {}) {
  const scope = await getPerformanceScopeV2({ sportKey, includeHistoryRows, maxPredictionRows })
  const season = scope.timeline.season
  const today = scope.timeline.today
  const totalAnalyzedRows = Number((season as Record<string, unknown>).totalAnalyzedRows ?? season.generated ?? 0)
  const canonicalPredictionRows = Number((season as Record<string, unknown>).canonicalPredictionRows ?? season.eligible ?? 0)
  const nonProductionAnalysisRows = Number((season as Record<string, unknown>).nonProductionAnalysisRows ?? Math.max(0, totalAnalyzedRows - canonicalPredictionRows))
  const recommendationEligibleRows = Number((season as Record<string, unknown>).recommendationEligibleRows ?? 0)
  const actionableRows = Number((season as Record<string, unknown>).actionableRows ?? 0)
  const officialPickEligibleRows = Number((season as Record<string, unknown>).officialPickEligibleRows ?? 0)
  const settledCanonicalRows = Number((season as Record<string, unknown>).settledCanonicalRows ?? season.settled ?? 0)
  const selectedTrust = trustFrom(season)
  const selectedCalibration = calibrationFrom(season)
  const enabledSports = getEnabledSports()
  const sports = enabledSports.map((sport) => {
    const sportScope = sport.key === (sportKey ?? null) || !sportKey ? scope : null
    const metrics = sportScope && (sport.key === 'baseball_mlb' || sport.key === sportKey) ? season : emptyMetrics()
    return {
      sportKey: sport.key,
      label: sport.label,
      shortLabel: sport.shortLabel,
      productionReady: sport.key === 'baseball_mlb' && metrics.wins + metrics.losses > 0,
      metrics: {
        predictions: Number((metrics as Record<string, unknown>).canonicalPredictionRows ?? metrics.eligible ?? 0),
        settled: metrics.settled,
        correct: metrics.wins,
        incorrect: metrics.losses,
        pushes: metrics.pushes,
        accuracy: metrics.accuracy,
        brierScore: metrics.brier,
        calibrationError: calibrationFrom(metrics).calibrationError,
        calibrationBias: calibrationFrom(metrics).calibrationBias,
        confidenceReliability: calibrationFrom(metrics).confidenceReliability,
        predictionConfidence: null,
        coverage: metrics.settlementCoverage ?? 0,
        shadowAccuracy: null,
        officialAccuracy: null,
        aiLeanAccuracy: null,
        watchlistAccuracy: null,
        avoidAccuracy: null,
      },
      trust: trustFrom(metrics),
      performanceTrust: trustFrom(metrics),
      dataReadiness: { readinessScore: sport.key === 'baseball_mlb' ? 100 : 0, status: sport.key === 'baseball_mlb' ? 'READY' : 'NO_SETTLED_SAMPLE' },
      dailyReportCard: reportCardFrom(metrics),
      readiness: { readinessScore: sport.key === 'baseball_mlb' ? 100 : 0, providerReady: sport.key === 'baseball_mlb', officialReady: metrics.wins + metrics.losses > 0, predictionReady: Number((metrics as Record<string, unknown>).canonicalPredictionRows ?? metrics.eligible ?? 0) > 0, calibrationReady: calibrationFrom(metrics).calibrationError !== null },
    }
  })

  return {
    success: true,
    apiStatus: season.settled ? 'SUCCESS' : 'INSUFFICIENT_DATA',
    mode: 'performance_product_contract_v1',
    generatedAt: scope.generatedAt,
    scopePolicy: scope.scopePolicy,
    scopeReconciliation: {
      contract: 'performance_scope_reconciliation_v1',
      canonicalScope: 'cutoff_safe_production_scope',
      trust: 'season timeline from performance_scope_v2',
      accuracy: 'same season timeline Win/Loss sample',
      calibration: 'same season timeline scored sample; error is absolute, bias is signed',
      predictionHistory: 'performance_scope_v2.historyRows',
      timeline: 'performance_scope_v2.timeline',
      dailyReportCard: 'same selected reportCardFrom(season) contract',
      goals: 'same selected goalsFrom(season) contract',
      modelMaturity: 'production sample with replay/shadow explicitly labeled separate',
    },
    performancePresentation: {
      contract: 'performance_presentation_metrics_v1',
      activeEpoch: scope.scopePolicy.activeEpoch?.epochKey ?? null,
      epochId: scope.scopePolicy.activeEpoch?.id ?? null,
      epochName: scope.scopePolicy.activeEpoch?.epochName ?? null,
      eraMode: scope.scopePolicy.eraMode,
      productionScopeVersion: scope.scopePolicy.productionScopeVersion,
      metricDefinitionsVersion: scope.scopePolicy.metricDefinitionsVersion,
      totalAnalyzedRows,
      canonicalPredictionRows,
      nonProductionAnalysisRows,
      recommendationEligibleRows,
      actionableRows,
      officialPickEligibleRows,
      settledCanonicalRows,
      trust: selectedTrust.trustScore,
      accuracy: season.accuracy,
      explanation: 'Pick Analyzer analyzed rows during Current Era processing. Canonical event-market predictions are used for settlement, learning and Performance; preserved preview or diagnostic evidence does not count as independent production predictions.',
    },
    performanceScopeV2: scope,
    trustScore: selectedTrust,
    trustChange: {
      source: 'performance_scope_v2',
      note: 'Trust change is derived from the same cutoff-safe production scope; unavailable periods remain null.',
      previousDay: trustChangeEntry('Previous day', selectedTrust.trustScore),
      previous7DayWindow: trustChangeEntry('Previous 7 days', selectedTrust.trustScore),
      previous30DayWindow: trustChangeEntry('Previous 30 days', selectedTrust.trustScore),
      previousModelVersion: trustChangeEntry('Previous model version', selectedTrust.trustScore),
    },
    evolution: {
      today: evolutionEntry('today', today, scope.timeline.yesterday),
      yesterday: evolutionEntry('yesterday', scope.timeline.yesterday),
      sevenDays: evolutionEntry('7_days', scope.timeline.last7Days),
      thirtyDays: evolutionEntry('30_days', scope.timeline.last30Days),
      season: evolutionEntry('season', season),
      lifetime: evolutionEntry('lifetime', scope.timeline.lifetime),
      metricDefinitions: {
        calibrationError: 'Absolute confidence-vs-accuracy gap; lower is better.',
        calibrationBias: 'Signed confidence-vs-accuracy gap; positive means overconfident, negative means underconfident.',
        brierScore: 'Mean squared probability error over scored Win/Loss outcomes.',
        confidenceReliability: 'Trust component derived from absolute calibration error.',
      },
    },
    reportCards: {
      selected: reportCardFrom(season),
      today: reportCardFrom(today),
      allSports: reportCardFrom(season),
    },
    goals: goalsFrom(season),
    maturityPipeline: maturityPipelineFrom(season),
    engineeringAdvisor: engineeringAdvisorFrom(season),
    sports,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
