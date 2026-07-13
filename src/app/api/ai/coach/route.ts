import {
  NextRequest,
  NextResponse,
} from 'next/server'
import { isSupportedSport } from '@/config/sports.config'
import { getAICoachAnalysis } from '@/services/ai-coach.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(
      request.url
    )

    const sportKey =
      searchParams.get('sport') ?? 'all'

    const recommendedOnly =
      searchParams.get('recommendedOnly') ===
      'true'

    const minimumSample = Number(
      searchParams.get('minimumSample') ?? 10
    )

    if (!isSupportedSport(sportKey)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported sport: ${sportKey}`,
        },
        { status: 400 }
      )
    }

    const result = await getAICoachAnalysis({
      sportKey,
      recommendedOnly,
      minimumSample,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI Coach failed:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'AI Coach failed',
      },
      { status: 500 }
    )
  }
}