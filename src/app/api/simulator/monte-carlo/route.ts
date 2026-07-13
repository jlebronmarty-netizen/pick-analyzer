import { NextRequest, NextResponse } from 'next/server'
import { runMonteCarloSimulation } from '@/services/monte-carlo-engine.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const bankroll = Number(searchParams.get('bankroll') ?? 1000)
    const simulations = Number(searchParams.get('simulations') ?? 10000)
    const maxPicks = Number(searchParams.get('maxPicks') ?? 8)

    const result = await runMonteCarloSimulation({
      bankroll,
      simulations,
      maxPicks,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Monte Carlo simulation failed',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}