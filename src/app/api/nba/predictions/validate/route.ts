import { NextRequest, NextResponse } from 'next/server'
import { loadNbaPredictionEngine } from '@/lib/server-lazy-diagnostics'

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
    const { generateNbaPredictions } = await loadNbaPredictionEngine()
    const result = await generateNbaPredictions({
      persist: false,
      limit: Number.isFinite(limit) ? limit : 20,
    })

    return NextResponse.json({
      success: true,
      mode: 'nba_prediction_validation_api_v1',
      generatedAt: result.generatedAt,
      validation: result.validation,
      predictionsChecked: result.predictions.length,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA prediction validation failed',
      },
      { status: 500 }
    )
  }
}
