import { NextResponse } from 'next/server'
import { getTopPicksBySport } from '@/services/sport-top-picks.service'

export async function GET() {
  try {
    const result = await getTopPicksBySport()

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