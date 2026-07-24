import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenterLazy } from '@/lib/server-lazy-diagnostics'
import { getPerformanceProductContract } from '@/services/performance-product-contract.service'

function timelineRows(timeline: Record<string, any>) {
  return Object.entries(timeline).map(([key, item]) => ({
    label: item.label ?? key,
    generated: item.generated,
    productionSettled: item.settled,
    wins: item.wins,
    losses: item.losses,
    pushes: item.pushes,
    record: `${item.wins ?? 0}-${item.losses ?? 0}-${item.pushes ?? 0}`,
    accuracy: item.accuracy,
    displayAccuracy: item.accuracy === null ? 'N/A' : `${item.accuracy}%`,
    predictions: item.generated,
    zeroSampleMessage: item.accuracy === null ? 'No settled production predictions in this scope.' : null,
  }))
}

function reportDimensions(reportCard: any) {
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

export async function GET(request: NextRequest) {
  try {
    const sportKey = request.nextUrl.searchParams.get('sportKey')
    const [data, product] = await Promise.all([
      getAiPerformanceCenterLazy({ sportKey, dryRun: true }),
      getPerformanceProductContract({ sportKey }),
    ])
    const selectedReport = product.reportCards.selected
    const selectedMetrics = selectedReport.metrics
    const selectedTrust = product.trustScore
    const productTimeline = timelineRows(product.performanceScopeV2.timeline)
    const aiBrain = {
      ...data.aiBrain,
      selected: {
        ...data.aiBrain.selected,
        overallHealth: selectedTrust.trustStatus,
        sampleSize: selectedMetrics.settled,
        calibrationStatus: selectedReport.calibration.calibrationError === null ? 'INSUFFICIENT_DATA' : 'AVAILABLE',
        blockers: selectedTrust.blockers,
        readiness: {
          score: selectedTrust.trustScore,
          status: selectedTrust.trustStatus,
        },
        trustScore: selectedTrust,
      },
      dailyReportCard: {
        ...data.aiBrain.dailyReportCard,
        overallGrade: selectedReport.overallGrade,
        dimensions: reportDimensions(selectedReport),
      },
      trustChange: product.trustChange,
      evolution: product.evolution,
      internalView: {
        ...data.aiBrain.internalView,
        brierScore: selectedMetrics.brier,
        calibrationError: selectedReport.calibration.calibrationError,
        calibrationBias: selectedReport.calibration.calibrationBias,
        confidenceReliability: selectedReport.calibration.confidenceReliability,
        trustComponents: selectedTrust.components,
        blockers: selectedTrust.blockers,
        rawDiagnostics: {
          ...data.aiBrain.internalView.rawDiagnostics,
          productScope: product.scopePolicy,
        },
      },
    }
    return NextResponse.json({
      success: true,
      apiStatus: product.apiStatus,
      mode: 'performance_api_v1',
      generatedAt: product.generatedAt,
      performanceScopeV2: product.performanceScopeV2,
      publicView: {
        ...data.aiBrain.publicView,
        overallAiGrade: selectedReport.overallGrade,
        trustLabel: selectedTrust.trustLabel,
        settledSample: selectedMetrics.settled,
        accuracy: selectedMetrics.accuracy,
        recentTrend: selectedTrust.trustStatus,
        lastUpdate: product.generatedAt,
      },
      internalView: aiBrain.internalView,
      aiBrain,
      sports: product.sports,
      reportCards: product.reportCards,
      trendAnalysis: data.trendAnalysis,
      evolutionSnapshots: {
        ...data.evolutionSnapshots,
        historyTimeline: productTimeline,
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
