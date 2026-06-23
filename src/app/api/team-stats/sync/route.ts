import { NextResponse } from 'next/server'
import { syncMlbTeamStats } from '@/services/mlb-team-stats-sync.service'

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

    const currentYear = new Date().getFullYear()
    const result = await syncMlbTeamStats(currentYear)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Team stats sync error:', error)

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