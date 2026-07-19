import { NextResponse } from 'next/server'
import { validateBsnIntelligenceEngine } from '@/services/bsn-intelligence-engine.service'

export async function GET() {
  try {
    return NextResponse.json(await validateBsnIntelligenceEngine())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN intelligence validation error',
      },
      { status: 500 }
    )
  }
}