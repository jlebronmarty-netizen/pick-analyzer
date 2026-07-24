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
  const components = [
    { key: 'sample_size', label: 'Production Sample Size', value: scored, normalizedScore: scored ? sampleScore : null, weight: 0.35, contribution: scored ? round(sampleScore * 0.35) : 0, availability: scored ? 'AVAILABLE' : 'UNAVAILABLE', explanation: 'Cutoff-safe production Win/Loss sample.' },
    { key: 'accuracy', label: 'Accuracy', value: metrics.accuracy, normalizedScore: metrics.accuracy, weight: 0.25, contribution: metrics.accuracy === null ? 0 : round(metrics.accuracy * 0.25), availability: metrics.accuracy === null ? 'UNAVAILABLE' : 'AVAILABLE', explanation: 'Win rate over the same production scope.' },
    { key: 'brier_score', label: 'Brier Score', value: metrics.brier, normalizedScore: brierScore, weight: 0.2, contribution: brierScore === null ? 0 : round(brierScore * 0.2), availability: brierScore === null ? 'UNAVAILABLE' : 'AVAILABLE', explanation: 'Probability accuracy over scored outcomes.' },
    { key: 'calibration_error', label: 'Calibration Error', value: calibration.calibrationError, normalizedScore: calibration.confidenceReliability, weight: 0.2, contribution: calibration.confidenceReliability === null ? 0 : round(calibration.confidenceReliability * 0.2), availability: calibration.confidenceReliability === null ? 'UNAVAILABLE' : 'AVAILABLE', explanation: calibration.explanation },
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
    blockers: scored === 0 ? ['NO_SETTLED_PRODUCTION_PREDICTIONS'] : scored < 30 ? ['LOW_SETTLED_SAMPLE'] : [],
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
    eligible: 0,
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
  }
}

export async function getPerformanceProductContract({ sportKey }: { sportKey?: string | null } = {}) {
  const scope = await getPerformanceScopeV2({ sportKey })
  const season = scope.timeline.season
  const today = scope.timeline.today
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
        predictions: metrics.generated,
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
      readiness: { readinessScore: sport.key === 'baseball_mlb' ? 100 : 0, providerReady: sport.key === 'baseball_mlb', officialReady: metrics.wins + metrics.losses > 0, predictionReady: metrics.generated > 0, calibrationReady: calibrationFrom(metrics).calibrationError !== null },
    }
  })

  return {
    success: true,
    apiStatus: season.settled ? 'SUCCESS' : 'INSUFFICIENT_DATA',
    mode: 'performance_product_contract_v1',
    generatedAt: scope.generatedAt,
    scopePolicy: scope.scopePolicy,
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
    sports,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
