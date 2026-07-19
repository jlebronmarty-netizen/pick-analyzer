import { NextResponse } from 'next/server'
import { getBsnExplanationEngine } from '@/services/bsn-model-maturity.service'

export async function GET() {
  try {
    const data = await getBsnExplanationEngine()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN explanation engine error',
      },
      { status: 500 }
    )
  }
}
