import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenterLazy } from '@/lib/server-lazy-diagnostics'
import { getPerformanceProductContract } from '@/services/performance-product-contract.service'

type TimelineSource = Record<string, {
  label?: string
  generated?: number
  eligible?: number
  settled?: number
  pending?: number
  wins?: number
  losses?: number
  pushes?: number
  accuracy?: number | null
  nonProductionExclusionReasons?: Record<string, number>
  nonProductionBlockers?: Record<string, number>
  validPregameNonProductionRows?: number
}>

type ReportCardSource = {
  metrics: {
    accuracy: number | null
    wins: number
    losses: number
    brier: number | null
  }
  calibration: {
    calibrationError: number | null
    calibrationBias: number | null
    confidenceReliability: number | null
    sample: number
  }
}

function timelineRows(timeline: TimelineSource) {
  return Object.entries(timeline).map(([key, item]) => ({
    label: item.label ?? key,
    generated: item.generated,
    productionEligible: item.eligible,
    productionSettled: item.settled,
    productionPending: item.pending,
    nonProductionRows: Math.max(0, Number(item.generated ?? 0) - Number(item.eligible ?? 0)),
    nonProductionExclusionReasons: item.nonProductionExclusionReasons ?? {},
    nonProductionBlockers: item.nonProductionBlockers ?? {},
    validPregameNonProductionRows: item.validPregameNonProductionRows ?? 0,
    wins: item.wins,
    losses: item.losses,
    pushes: item.pushes,
    record: `${item.wins ?? 0}-${item.losses ?? 0}-${item.pushes ?? 0}`,
    accuracy: item.accuracy,
    displayAccuracy: item.accuracy === null ? 'N/A' : `${item.accuracy}%`,
    predictions: item.generated,
    zeroSampleMessage: item.accuracy === null
      ? Number(item.generated ?? 0) > 0 && Number(item.eligible ?? 0) === 0
        ? `${item.generated} generated rows in this bucket are not production-evaluable, so Production Settled remains 0 without fabricating settlements.`
        : 'No settled production predictions in this scope.'
      : null,
  }))
}

function reportDimensions(reportCard: ReportCardSource) {
  const metrics = reportCard.metrics
  return {
    accuracy: {
      score: metrics.accuracy,
      label: metrics.accuracy === null ? 'INSUFFICIENT DATA' : metrics.accuracy >= 55 ? 'GOOD' : 'WATCH',
      explanation: 'Accuracy uses the cutoff-safe production Win/Loss sample.',
      sampleSize: metrics.wins + metrics.losses,
      provisional: metrics.wins + metrics.losses < 30,
    },
    brierScore: {
      score: metrics.brier === null ? null : Math.max(0, Number((100 - (metrics.brier / 0.35) * 100).toFixed(2))),
      label: metrics.brier === null ? 'INSUFFICIENT DATA' : 'AVAILABLE',
      explanation: 'Brier Score is mean squared probability error over scored outcomes.',
      sampleSize: metrics.wins + metrics.losses,
      provisional: metrics.wins + metrics.losses < 30,
    },
    calibrationError: {
      score: reportCard.calibration.calibrationError,
      label: reportCard.calibration.calibrationError === null ? 'INSUFFICIENT DATA' : 'ABSOLUTE ERROR',
      explanation: 'Calibration Error is absolute confidence-vs-accuracy gap, not signed bias.',
      sampleSize: reportCard.calibration.sample,
      provisional: reportCard.calibration.sample < 30,
    },
    calibrationBias: {
      score: reportCard.calibration.calibrationBias,
      label: reportCard.calibration.calibrationBias === null ? 'INSUFFICIENT DATA' : 'SIGNED BIAS',
      explanation: 'Calibration Bias is signed: positive means overconfident, negative means underconfident.',
      sampleSize: reportCard.calibration.sample,
      provisional: reportCard.calibration.sample < 30,
    },
  }
}

function userStatus(value: unknown) {
  const normalized = String(value ?? '').replaceAll('_', ' ').trim().toLowerCase()
  const labels: Record<string, string> = {
    available: 'Available',
    unavailable: 'Unavailable',
    active: 'Active',
    complete: 'Complete',
    limited: 'Limited',
    blocked: 'Blocked',
    ready: 'Ready',
    'production scope': 'Production-scope sample',
    'limited sample': 'Limited sample',
    'no settled sample': 'No settled sample',
    'no settled production predictions': 'No settled production predictions',
    'low settled sample': 'Low settled sample',
    'low settled production sample': 'Low settled production sample',
    'insufficient data': 'Insufficient data',
    'insufficient sample': 'Insufficient sample',
    'brier score above target': 'Brier score is above target',
    'calibration error above target': 'Calibration error is above target',
    'settlement coverage below target': 'Settlement coverage is below target',
    'value above target': 'Value is above target',
    'below target': 'Below target',
    'qualified sample': 'Qualified sample',
    'small sample': 'Small sample',
    'higher is better': 'Higher is better',
    'lower is better': 'Lower is better',
    'range target': 'Range target',
    'not started': 'Not started',
    'separate scope': 'Separate scope',
    improving: 'Improving',
    declining: 'Declining',
  }
  return labels[normalized] ?? String(value ?? '').replaceAll('_', ' ')
}

const RAW_USER_MODE_CODES = new Set([
  'AVAILABLE',
  'UNAVAILABLE',
  'ACTIVE',
  'COMPLETE',
  'LIMITED',
  'BLOCKED',
  'READY',
  'PRODUCTION_SCOPE',
  'LIMITED_SAMPLE',
  'NO_SETTLED_SAMPLE',
  'NO_SETTLED_PRODUCTION_PREDICTIONS',
  'LOW_SETTLED_SAMPLE',
  'LOW_SETTLED_PRODUCTION_SAMPLE',
  'INSUFFICIENT_DATA',
  'INSUFFICIENT_SAMPLE',
  'BRIER_SCORE_ABOVE_TARGET',
  'CALIBRATION_ERROR_ABOVE_TARGET',
  'SETTLEMENT_COVERAGE_BELOW_TARGET',
  'VALUE_ABOVE_TARGET',
  'BELOW_TARGET',
  'QUALIFIED_SAMPLE',
  'SMALL_SAMPLE',
  'HIGHER_IS_BETTER',
  'LOWER_IS_BETTER',
  'RANGE_TARGET',
  'NOT STARTED',
  'SEPARATE_SCOPE',
  'IMPROVING',
  'DECLINING',
])

function userModeValue(value: unknown): unknown {
  if (typeof value === 'string' && RAW_USER_MODE_CODES.has(value)) return userStatus(value)
  if (Array.isArray(value)) return value.map(userModeValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, userModeValue(item)]))
  }
  return value
}

export async function GET(request: NextRequest) {
  try {
    const sportKey = request.nextUrl.searchParams.get('sportKey')
    const includeFullDiagnostics = request.nextUrl.searchParams.get('diagnostics') === 'full' || request.nextUrl.searchParams.get('includeDiagnostics') === 'full'
    const [data, product] = await Promise.all([
      includeFullDiagnostics ? getAiPerformanceCenterLazy({ sportKey, dryRun: true }) : Promise.resolve(null),
      getPerformanceProductContract({
        sportKey,
        includeHistoryRows: includeFullDiagnostics,
        maxPredictionRows: includeFullDiagnostics ? 5000 : 2000,
      }),
    ])
    const selectedReport = product.reportCards.selected
    const selectedMetrics = selectedReport.metrics
    const selectedTrust = product.trustScore
    const productTimeline = timelineRows(product.performanceScopeV2.timeline)
    const publicTrustScore = userModeValue(selectedTrust)
    const publicGoals = userModeValue(product.goals)
    const publicMaturityPipeline = userModeValue(product.maturityPipeline)
    const publicEngineeringAdvisor = userModeValue(product.engineeringAdvisor)
    const publicTrustChange = userModeValue(product.trustChange)
    const publicEvolution = userModeValue(product.evolution)
    const publicSports = userModeValue(product.sports)
    const publicReportCards = userModeValue(product.reportCards)
    const aiBrain = {
      ...(data?.aiBrain ?? {}),
      selected: {
        ...(data?.aiBrain?.selected ?? {}),
        overallHealth: userStatus(selectedTrust.trustStatus),
        sampleSize: selectedMetrics.settled,
        calibrationStatus: selectedReport.calibration.calibrationError === null ? 'Insufficient data' : 'Available',
        blockers: selectedTrust.blockers.map(userStatus),
        readiness: {
          score: selectedTrust.trustScore,
          status: userStatus(selectedTrust.trustStatus),
        },
        trustScore: publicTrustScore,
      },
      dailyReportCard: {
        ...(data?.aiBrain?.dailyReportCard ?? {}),
        overallGrade: selectedReport.overallGrade,
        dimensions: reportDimensions(selectedReport),
      },
      goals: publicGoals,
      maturityPipeline: publicMaturityPipeline,
      engineeringAdvisor: publicEngineeringAdvisor,
      trustChange: publicTrustChange,
      evolution: publicEvolution,
      internalView: {
        ...(data?.aiBrain?.internalView ?? {}),
        brierScore: selectedMetrics.brier,
        logLoss: data?.aiBrain?.internalView?.logLoss ?? null,
        calibrationError: selectedReport.calibration.calibrationError,
        calibrationBias: selectedReport.calibration.calibrationBias,
        confidenceReliability: selectedReport.calibration.confidenceReliability,
        featureDrift: data?.aiBrain?.internalView?.featureDrift ?? 0,
        confidenceDrift: data?.aiBrain?.internalView?.confidenceDrift ?? 0,
        modelDrift: data?.aiBrain?.internalView?.modelDrift ?? 0,
        dataQuality: data?.aiBrain?.internalView?.dataQuality ?? (selectedMetrics.generated ? 100 : 0),
        providerHealth: data?.aiBrain?.internalView?.providerHealth ?? 'stored-data-only',
        reliabilityBuckets: data?.aiBrain?.internalView?.reliabilityBuckets ?? [],
        trustComponents: selectedTrust.components,
        blockers: selectedTrust.blockers,
        rawDiagnostics: {
          ...(data?.aiBrain?.internalView?.rawDiagnostics ?? {}),
          responseMode: includeFullDiagnostics ? 'full_diagnostics' : 'product_summary',
          historyPagination: data?.aiBrain?.internalView?.rawDiagnostics?.historyPagination ??
            product.performanceScopeV2.queryDiagnostics?.predictionHistory ?? {
              rowsRead: product.performanceScopeV2.totals.generated,
              pagesRead: Math.ceil(product.performanceScopeV2.totals.generated / 1000),
              capApplied: false,
            },
          productScope: product.scopePolicy,
          userModeRawCodes: {
            selectedTrustStatus: selectedTrust.trustStatus,
            selectedSampleQualification: selectedTrust.sampleQualification,
            selectedBlockers: selectedTrust.blockers,
            selectedCalibrationStatus: selectedReport.calibration.calibrationError === null ? 'INSUFFICIENT_DATA' : 'AVAILABLE',
            goals: product.goals,
            maturityPipeline: product.maturityPipeline,
            engineeringAdvisor: product.engineeringAdvisor,
            trustChange: product.trustChange,
            evolution: product.evolution,
            reportCards: product.reportCards,
          },
        },
      },
    }
    return NextResponse.json({
      success: true,
      apiStatus: product.apiStatus,
      mode: 'performance_api_v1',
      responseMode: includeFullDiagnostics ? 'full_diagnostics' : 'product_summary',
      generatedAt: product.generatedAt,
      performanceScopeV2: product.performanceScopeV2,
      performanceScopeReconciliation: product.scopeReconciliation,
      publicView: {
        ...(data?.aiBrain?.publicView ?? {}),
        overallAiGrade: selectedReport.overallGrade,
        trustLabel: selectedTrust.trustLabel,
        settledSample: selectedMetrics.settled,
        accuracy: selectedMetrics.accuracy,
        recentTrend: userStatus(selectedTrust.trustStatus),
        modelStatus: userStatus(selectedTrust.trustStatus),
        lastUpdate: product.generatedAt,
        disclaimer: 'Performance is calculated from cutoff-safe production scope evidence only.',
      },
      internalView: aiBrain.internalView,
      aiBrain,
      sports: publicSports,
      reportCards: publicReportCards,
      goals: publicGoals,
      maturityPipeline: publicMaturityPipeline,
      engineeringAdvisor: publicEngineeringAdvisor,
      trendAnalysis: data?.trendAnalysis ?? {
        source: 'performance_scope_v2',
        storedSnapshotCount: 0,
        daily: productTimeline.map((item) => ({
          period: item.label,
          accuracyTrend: item.accuracy ?? 0,
          predictions: item.predictions,
          settled: item.productionSettled ?? 0,
        })),
      },
      evolutionSnapshots: {
        ...(data?.evolutionSnapshots ?? {}),
        existingSnapshots: data?.evolutionSnapshots?.existingSnapshots ?? 0,
        historyTimeline: productTimeline,
        trendCalculationsUseStoredSnapshots: data?.evolutionSnapshots?.trendCalculationsUseStoredSnapshots ?? false,
      },
      performanceTimeline: productTimeline,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        apiStatus: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown performance API error',
      },
      { status: 500 }
    )
  }
}
