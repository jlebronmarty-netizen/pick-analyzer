import { NextResponse } from 'next/server'
import { getBsnReadinessEngine } from '@/services/bsn-model-maturity.service'

export async function GET() {
  try {
    const data = await getBsnReadinessEngine()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN readiness error',
      },
      { status: 500 }
    )
  }
}
