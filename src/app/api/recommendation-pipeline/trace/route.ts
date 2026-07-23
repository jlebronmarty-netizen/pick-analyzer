import { NextResponse } from 'next/server'
import { getRecommendationPipelineTrace } from '@/services/recommendation-pipeline-trace.service'

export async function GET() {
  try {
    const trace = await getRecommendationPipelineTrace()
    return NextResponse.json(trace)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        apiStatus: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown recommendation pipeline trace error',
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      { status: 500 }
    )
  }
}
