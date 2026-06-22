import { NextResponse } from 'next/server'
import { syncMlbTeamStats } from '@/services/mlb-team-stats-sync.service'

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')

    if (cronSecret) {
      const expectedHeader = `Bearer ${cronSecret}`

      if (authHeader !== expectedHeader) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
          },
          { status: 401 }
        )
      }
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
          error instanceof Error
            ? error.message
            : 'Unexpected server error',
      },
      { status: 500 }
    )
  }
}