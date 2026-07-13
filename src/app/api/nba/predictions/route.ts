import { NextRequest, NextResponse } from 'next/server'
import { generateNbaPredictions } from '@/services/nba-prediction-engine.service'

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20)
    const result = await generateNbaPredictions({
      persist: false,
      limit: Number.isFinite(limit) ? limit : 20,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA predictions failed',
      },
      { status: 500 }
    )
  }
}
