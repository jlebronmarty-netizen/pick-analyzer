import { NextRequest, NextResponse } from 'next/server'
import { getBsnIntelligenceEngine, validateBsnIntelligenceEngine } from '@/services/bsn-intelligence-engine.service'

export async function GET(request: NextRequest) {
  try {
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const data = await getBsnIntelligenceEngine()
    if (!includeValidation) return NextResponse.json(data)
    const fixtureValidation = await validateBsnIntelligenceEngine()
    return NextResponse.json({ ...data, fixtureValidation })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN intelligence error',
      },
      { status: 500 }
    )
  }
}