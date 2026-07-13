import {
  NextRequest,
  NextResponse,
} from 'next/server'
import { isSupportedSport } from '@/config/sports.config'
import { getClosingLineIntelligence } from '@/services/closing-line-intelligence.service'

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(
      request.url
    )

    const sportKey =
      searchParams.get('sport') ?? 'all'

    const limit = Number(
      searchParams.get('limit') ?? 2500
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

    const result =
      await getClosingLineIntelligence({
        sportKey,
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