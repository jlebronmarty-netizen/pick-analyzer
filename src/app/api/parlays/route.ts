import { NextResponse } from 'next/server'
import { generateSmartParlays } from '@/services/parlay-generator.service'
import { optimizeBetSlip } from '@/services/bet-slip-optimizer.service'
import { getModelOnlyIntelligence } from '@/services/model-only-intelligence.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const bankroll = Number(searchParams.get('bankroll') ?? 1000)
    const maxLegs = Number(searchParams.get('legs') ?? 4)

    const [parlays, optimizer, modelOnly] = await Promise.all([
      generateSmartParlays(),
      optimizeBetSlip({
        bankroll,
        maxLegs,
      }),
      getModelOnlyIntelligence(),
    ])

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),

      parlays,
      informationalModelOnlyParlays: modelOnly.informationalParlays,
      modelOnlyParlayPolicy: {
        status: modelOnly.informationalParlays.twoLegHighestProbability ? 'AVAILABLE' : 'EMPTY',
        labels: ['MODEL ONLY', 'INFORMATIONAL', 'NOT AN OFFICIAL PICK', 'NO STAKE'],
        blocker: modelOnly.informationalParlays.blocker,
      },

      optimizer,
    })
  } catch (error) {
    console.error('Parlay generator error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown parlay generator error',
      },
      {
        status: 500,
      }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
