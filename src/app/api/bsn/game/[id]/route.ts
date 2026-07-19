import { NextRequest, NextResponse } from 'next/server'
import { getBsnGamePrediction } from '@/services/bsn-shadow-prediction-engine.service'

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const data = await getBsnGamePrediction(id)
    return NextResponse.json(data, { status: data.success ? 200 : 404 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN game prediction error',
      },
      { status: 500 }
    )
  }
}
