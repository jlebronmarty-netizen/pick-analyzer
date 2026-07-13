import { NextRequest, NextResponse } from 'next/server'
import { generateNbaPredictions } from '@/services/nba-prediction-engine.service'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  const authHeader = request.headers.get('authorization')
  const { searchParams } = new URL(request.url)
  return authHeader === `Bearer ${cronSecret}` || searchParams.get('secret') === cronSecret
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20)
    const result = await generateNbaPredictions({
      persist: true,
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
            : 'NBA prediction generation failed',
      },
      { status: 500 }
    )
  }
}
