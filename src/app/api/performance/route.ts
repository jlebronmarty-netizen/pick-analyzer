import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenter } from '@/services/ai-performance-center.service'

export async function GET(request: NextRequest) {
  try {
    const sportKey = request.nextUrl.searchParams.get('sportKey')
    const data = await getAiPerformanceCenter({ sportKey, dryRun: true })
    return NextResponse.json({
      success: true,
      apiStatus: data.apiStatus,
      mode: 'performance_api_v1',
      generatedAt: data.generatedAt,
      publicView: data.aiBrain.publicView,
      internalView: data.aiBrain.internalView,
      aiBrain: data.aiBrain,
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
