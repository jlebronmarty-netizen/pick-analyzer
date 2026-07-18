import { NextResponse } from 'next/server'
import {
  getBsnBasketballKnowledgeEngine,
  getBsnTeamIntelligenceReadiness,
} from '@/services/bsn-platform.service'

export async function GET() {
  try {
    const [teamIntelligence, knowledgeEngine] = await Promise.all([
      getBsnTeamIntelligenceReadiness(),
      Promise.resolve(getBsnBasketballKnowledgeEngine()),
    ])

    return NextResponse.json({
      success: true,
      mode: 'bsn_intelligence_bundle_v1',
      generatedAt: new Date().toISOString(),
      providerCallsMade: 0,
      teamIntelligence,
      knowledgeEngine,
    })
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
