import { NextRequest, NextResponse } from 'next/server'
import { runBsnPredictionEngineV7 } from '@/services/bsn-platform.service'

export async function GET() {
  try {
    const data = await runBsnPredictionEngineV7({ dryRun: true, confirmed: false })

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN prediction error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const data = await runBsnPredictionEngineV7({
      dryRun: body?.dryRun ?? true,
      confirmed: body?.confirmed === true,
      idempotencyKey: body?.idempotencyKey ?? null,
    })

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN prediction error',
      },
      { status: 500 }
    )
  }
}
