import { NextResponse } from 'next/server'
import { recalculateHeadToHead } from '@/services/team-matchups-calculator.service'

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

    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport') ?? 'baseball_mlb'

    const result = await recalculateHeadToHead(sport)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Head-to-head recalculation error:', error)

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