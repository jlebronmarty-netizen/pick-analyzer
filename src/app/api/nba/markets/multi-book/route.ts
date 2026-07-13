import { NextResponse } from 'next/server'
import { getNbaMultiBookComparison } from '@/services/nba-multi-book-comparison.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') ?? 25)
    const staleMinutes = Number(searchParams.get('staleMinutes') ?? 120)
    const market = searchParams.get('market')

    const result = await getNbaMultiBookComparison({
      limit,
      staleMinutes,
      market,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('NBA multi-book comparison error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown NBA multi-book comparison error',
      },
      { status: 500 }
    )
  }
}
