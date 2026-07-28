import {
  NextRequest,
  NextResponse,
} from 'next/server'
import { isSupportedSport } from '@/config/sports.config'
import {
  getClosingLineIntelligence,
  validateClosingLineFixtures,
} from '@/services/closing-line-intelligence.service'

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(
      request.url
    )

    const sportKey =
      searchParams.get('sport') ?? 'all'

    const validate =
      searchParams.get('validate') === 'true'

    const limit = Number(
      searchParams.get('limit') ?? 2500
    )

    if (validate) {
      const validation = validateClosingLineFixtures()
      return NextResponse.json({
        mode: 'closing_line_intelligence_v1_validation',
        ...validation,
      })
    }

    if (!isSupportedSport(sportKey)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported sport: ${sportKey}`,
        },
        { status: 400 }
      )
    }

    const result =
      await getClosingLineIntelligence({
        sportKey,
        market: searchParams.get('market'),
        sportsbook: searchParams.get('sportsbook'),
        limit,
      })

    return NextResponse.json(result)
  } catch (error) {
    console.error(
      'Closing Line Intelligence failed:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Closing Line Intelligence failed',
      },
      { status: 500 }
    )
  }
}
