import { NextResponse } from 'next/server'
import { recalculateTeamStatsFromResults } from '@/services/team-stats-calculator.service'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return true

  const authHeader = request.headers.get('authorization')
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  return authHeader === `Bearer ${cronSecret}` || secret === cronSecret
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
    const sport = searchParams.get('sport') ?? 'baseball_mlb'

    const result = await recalculateTeamStatsFromResults(sport)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Team stats recalculation error:', error)

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