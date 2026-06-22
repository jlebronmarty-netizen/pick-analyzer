import { NextResponse } from 'next/server'
import {
  capturePredictionsForAllSports,
  capturePredictionsForSport,
} from '@/services/prediction-capture.service'

export async function GET(request: Request) {
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
    const sport = searchParams.get('sport')

    const result = sport
      ? await capturePredictionsForSport(sport)
      : await capturePredictionsForAllSports()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Capture predictions cron error:', error)

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