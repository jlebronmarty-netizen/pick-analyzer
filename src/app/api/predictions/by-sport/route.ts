import { NextRequest, NextResponse } from 'next/server'
import { isSupportedSport } from '@/config/sports.config'
import { getTopPicks } from '@/services/top-picks.service'
import {
  getHistoricalValidationReplay,
  getMlbProspectivePreview,
} from '@/services/prediction-history.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedSport = searchParams.get('sport') ?? 'all'
    const historicalValidation = searchParams.get('historicalValidation') === 'true'
    const validationMode = searchParams.get('validationMode')
    const prospectivePreview = searchParams.get('prospectivePreview') === 'true'
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

    if (
      prospectivePreview ||
      validationMode === 'prospective_preview' ||
      validationMode === 'prospective'
    ) {
      if (requestedSport !== 'baseball_mlb') {
        return NextResponse.json(
          {
            success: false,
            error: 'Prospective preview is currently supported only for baseball_mlb.',
          },
          { status: 400 }
        )
      }

      const result = await getMlbProspectivePreview()
      return NextResponse.json(result)
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
