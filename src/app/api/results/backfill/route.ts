import { NextResponse } from 'next/server'
import {
  clampScoresDaysFrom,
  getEnabledSports,
  getSupportedSport,
} from '@/config/sports.config'
import { syncRecentResults } from '@/services/results-sync.service'
import { recalculateTeamStatsFromResults } from '@/services/team-stats-calculator.service'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return true

  const authHeader = request.headers.get('authorization')
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  return authHeader === `Bearer ${cronSecret}` || secret === cronSecret
}

async function runBackfillForSport(sportKey: string, daysFrom: number) {
  const safeDaysFrom = clampScoresDaysFrom(daysFrom)

  const syncResult = await syncRecentResults(sportKey, safeDaysFrom)
  const statsResult = await recalculateTeamStatsFromResults(sportKey)

  return {
    sportKey,
    requestedDaysFrom: daysFrom,
    usedDaysFrom: safeDaysFrom,
    sync: syncResult,
    stats: statsResult,
  }
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)

    const sport = searchParams.get('sport')
    const daysFromParam = searchParams.get('daysFrom')
    const requestedDaysFrom = daysFromParam ? Number(daysFromParam) : 3

    if (sport) {
      const sportConfig = getSupportedSport(sport)

      if (!sportConfig) {
        return NextResponse.json(
          {
            success: false,
            error: `Unsupported sport: ${sport}`,
          },
          { status: 400 }
        )
      }

      const result = await runBackfillForSport(
        sportConfig.key,
        requestedDaysFrom
      )

      return NextResponse.json({
        success: true,
        mode: 'single-sport',
        note:
          'Odds API Scores only supports a limited recent window. Requested days are clamped automatically.',
        result,
      })
    }

    const sports = getEnabledSports()
    const results = []

    for (const sportConfig of sports) {
      try {
        const result = await runBackfillForSport(
          sportConfig.key,
          requestedDaysFrom
        )

        results.push({
          success: true,
          ...result,
        })
      } catch (error) {
        results.push({
          success: false,
          sportKey: sportConfig.key,
          error:
            error instanceof Error
              ? error.message
              : 'Unexpected sport backfill error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'multi-sport',
      note:
        'Odds API Scores only supports a limited recent window. Run this endpoint daily to build historical data incrementally.',
      count: results.length,
      results,
    })
  } catch (error) {
    console.error('Results backfill error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unexpected server error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return POST(request)
}