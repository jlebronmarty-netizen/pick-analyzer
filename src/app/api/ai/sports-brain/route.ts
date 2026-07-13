import { NextRequest, NextResponse } from 'next/server'
import { isSupportedSport } from '@/config/sports.config'
import { getAISportsBrainStrategy } from '@/services/ai-sports-brain.service'

type RiskPreference = 'low' | 'medium' | 'high'

function normalizeRisk(value: unknown): RiskPreference {
  if (
    value === 'low' ||
    value === 'medium' ||
    value === 'high'
  ) {
    return value
  }

  return 'medium'
}

async function buildResponse({
  bankroll,
  targetProfit,
  riskPreference,
  maxParlayLegs,
  sportKey,
}: {
  bankroll: number
  targetProfit: number
  riskPreference: RiskPreference
  maxParlayLegs: number
  sportKey: string
}) {
  if (!isSupportedSport(sportKey)) {
    return NextResponse.json(
      {
        success: false,
        error: `Unsupported sport: ${sportKey}`,
      },
      { status: 400 }
    )
  }

  const result = await getAISportsBrainStrategy({
    bankroll,
    targetProfit,
    riskPreference,
    maxParlayLegs,
    sportKey,
  })

  return NextResponse.json(result)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    return buildResponse({
      bankroll: Number(
        searchParams.get('bankroll') ?? 1000
      ),
      targetProfit: Number(
        searchParams.get('targetProfit') ?? 100
      ),
      riskPreference: normalizeRisk(
        searchParams.get('risk')
      ),
      maxParlayLegs: Number(
        searchParams.get('maxLegs') ?? 3
      ),
      sportKey:
        searchParams.get('sport') ??
        'baseball_mlb',
    })
  } catch (error) {
    console.error('AI Sports Brain GET failed:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'AI Sports Brain failed',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request
      .json()
      .catch(() => ({}))

    return buildResponse({
      bankroll: Number(body?.bankroll ?? 1000),
      targetProfit: Number(
        body?.targetProfit ?? 100
      ),
      riskPreference: normalizeRisk(
        body?.riskPreference
      ),
      maxParlayLegs: Number(
        body?.maxParlayLegs ?? 3
      ),
      sportKey:
        body?.sportKey ?? 'baseball_mlb',
    })
  } catch (error) {
    console.error('AI Sports Brain POST failed:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'AI Sports Brain failed',
      },
      { status: 500 }
    )
  }
}