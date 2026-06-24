import { NextResponse } from 'next/server'
import { getPlayOfTheDay } from '@/services/play-of-the-day.service'

export async function GET() {
  try {
    const result = await getPlayOfTheDay()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Play of the day error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown play of the day error',
      },
      { status: 500 }
    )
  }
}