import { NextResponse } from 'next/server'
import { getBsnShadowMarketIntelligence } from '@/services/bsn-model-maturity.service'

export async function GET() {
  try {
    const data = await getBsnShadowMarketIntelligence()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN shadow market intelligence error',
      },
      { status: 500 }
    )
  }
}
