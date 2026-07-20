import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenter } from '@/services/ai-performance-center.service'

export async function GET(_request: NextRequest, context: { params: Promise<{ sport: string }> }) {
  try {
    const { sport } = await context.params
    const data = await getAiPerformanceCenter({ sportKey: sport, dryRun: true })
    return NextResponse.json({
      success: true,
      apiStatus: data.apiStatus,
      mode: 'performance_sport_api_v1',
      generatedAt: data.generatedAt,
      sport,
      aiBrain: data.aiBrain.selected,
      trust: data.trustScore,
      reportCard: data.reportCards.selected,
      goals: data.goals,
      maturityPipeline: data.maturityPipeline,
      predictionHistory: data.predictionHistory,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    })
  } catch (error) {
    return NextResponse.json({ success: false, apiStatus: 'ERROR', error: error instanceof Error ? error.message : 'Unknown sport performance error' }, { status: 500 })
  }
}
