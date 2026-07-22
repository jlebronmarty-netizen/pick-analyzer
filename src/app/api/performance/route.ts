import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenter } from '@/services/ai-performance-center.service'
import { getPerformanceScopeV2 } from '@/services/performance-scope-v2.service'

export async function GET(request: NextRequest) {
  try {
    const sportKey = request.nextUrl.searchParams.get('sportKey')
    const [data, performanceScopeV2] = await Promise.all([
      getAiPerformanceCenter({ sportKey, dryRun: true }),
      getPerformanceScopeV2({ sportKey }),
    ])
    return NextResponse.json({
      success: true,
      apiStatus: data.apiStatus,
      mode: 'performance_api_v1',
      generatedAt: data.generatedAt,
      performanceScopeV2,
      publicView: data.aiBrain.publicView,
      internalView: data.aiBrain.internalView,
      aiBrain: data.aiBrain,
      sports: data.sports,
      reportCards: data.reportCards,
      trendAnalysis: data.trendAnalysis,
      evolutionSnapshots: data.evolutionSnapshots,
      performanceTimeline: data.performanceTimeline,
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
