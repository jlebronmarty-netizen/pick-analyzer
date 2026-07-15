import { NextRequest, NextResponse } from 'next/server'
import { isSupportedSport } from '@/config/sports.config'
import { getTopPicks } from '@/services/top-picks.service'
import { getHistoricalValidationReplay } from '@/services/prediction-history.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedSport = searchParams.get('sport') ?? 'all'
    const historicalValidation = searchParams.get('historicalValidation') === 'true'
    const validationMode = searchParams.get('validationMode')
    const date = searchParams.get('date') ?? ''

    if (!isSupportedSport(requestedSport)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported sport: ${requestedSport}`,
        },
        { status: 400 }
      )
    }

    if (historicalValidation || validationMode === 'quarantined') {
      const result = await getHistoricalValidationReplay({
        sportKey: requestedSport,
        date,
        validationMode,
        historicalValidation,
      })

      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    const result = await getTopPicks(requestedSport)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Top picks by sport error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown top picks by sport error',
      },
      { status: 500 }
    )
  }
}
