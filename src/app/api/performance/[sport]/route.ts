import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenterLazy } from '@/lib/server-lazy-diagnostics'
import { getPerformanceProductContract } from '@/services/performance-product-contract.service'

export async function GET(_request: NextRequest, context: { params: Promise<{ sport: string }> }) {
  try {
    const { sport } = await context.params
    const [data, product] = await Promise.all([
      getAiPerformanceCenterLazy({ sportKey: sport, dryRun: true }),
      getPerformanceProductContract({ sportKey: sport }),
    ])
    return NextResponse.json({
      success: true,
      apiStatus: product.apiStatus,
      mode: 'performance_sport_api_v1',
      generatedAt: product.generatedAt,
      sport,
      aiBrain: {
        ...data.aiBrain.selected,
        trustScore: product.trustScore,
        sampleSize: product.reportCards.selected.metrics.settled,
      },
      trust: product.trustScore,
      reportCard: product.reportCards.selected,
      goals: data.goals,
      maturityPipeline: data.maturityPipeline,
      predictionHistory: product.performanceScopeV2.historyPreview,
      scopePolicy: product.scopePolicy,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    })
  } catch (error) {
    return NextResponse.json({ success: false, apiStatus: 'ERROR', error: error instanceof Error ? error.message : 'Unknown sport performance error' }, { status: 500 })
  }
}
