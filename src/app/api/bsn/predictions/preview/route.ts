import { NextResponse } from 'next/server'
import { getBsnPredictionPreview } from '@/services/bsn-shadow-prediction-engine.service'

export async function GET() {
  try {
    const data = await getBsnPredictionPreview()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN prediction preview error',
      },
      { status: 500 }
    )
  }
}
