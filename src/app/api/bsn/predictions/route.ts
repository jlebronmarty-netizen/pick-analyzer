import { NextRequest, NextResponse } from 'next/server'
import { getBsnShadowPredictionEngine } from '@/services/bsn-shadow-prediction-engine.service'

export async function GET(request: NextRequest) {
  try {
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const data = await getBsnShadowPredictionEngine({ includeValidation })

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
    const data = await getBsnShadowPredictionEngine({ includeValidation: body?.includeValidation === true })

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
