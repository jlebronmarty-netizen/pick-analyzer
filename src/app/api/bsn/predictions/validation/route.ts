import { NextResponse } from 'next/server'
import { validateBsnShadowPredictionEngine } from '@/services/bsn-shadow-prediction-engine.service'

export async function GET() {
  try {
    const data = await validateBsnShadowPredictionEngine()
    return NextResponse.json(data, { status: data.success ? 200 : 500 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN prediction validation error',
      },
      { status: 500 }
    )
  }
}
