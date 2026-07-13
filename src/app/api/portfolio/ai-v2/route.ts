import {
  NextRequest,
  NextResponse,
} from 'next/server'
import {
  PortfolioMode,
  PortfolioRisk,
  buildPortfolioAIV2,
} from '@/services/portfolio-ai-v2.service'
import { isSupportedSport } from '@/config/sports.config'

const portfolioModes: PortfolioMode[] = [
  'low_variance',
  'income',
  'balanced',
  'growth',
  'high_ev',
  'singles_only',
  'cross_sport',
]

function normalizeMode(
  value: unknown
): PortfolioMode {
  return portfolioModes.includes(
    value as PortfolioMode
  )
    ? (value as PortfolioMode)
    : 'balanced'
}

function normalizeRisk(
  value: unknown
): PortfolioRisk {
  if (
    value === 'low' ||
    value === 'medium' ||
    value === 'high'
  ) {
    return value
  }

  return 'medium'
}

async function createResponse({
  bankroll,
  targetProfit,
  sportKey,
  mode,
  risk,
  maxExposurePercent,
  maxSelections,
}: {
  bankroll: number
  targetProfit: number
  sportKey: string
  mode: PortfolioMode
  risk: PortfolioRisk
  maxExposurePercent: number
  maxSelections: number
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

  const result = await buildPortfolioAIV2({
    bankroll,
    targetProfit,
    sportKey,
    mode,
    risk,
    maxExposurePercent,
    maxSelections,
  })

  return NextResponse.json(result)
}

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(
      request.url
    )

    return createResponse({
      bankroll: Number(
        searchParams.get('bankroll') ?? 1000
      ),
      targetProfit: Number(
        searchParams.get('targetProfit') ?? 100
      ),
      sportKey:
        searchParams.get('sport') ??
        'baseball_mlb',
      mode: normalizeMode(
        searchParams.get('mode')
      ),
      risk: normalizeRisk(
        searchParams.get('risk')
      ),
      maxExposurePercent: Number(
        searchParams.get('maxExposure') ?? 7
      ),
      maxSelections: Number(
        searchParams.get('maxSelections') ?? 6
      ),
    })
  } catch (error) {
    console.error(
      'Portfolio AI V2 GET failed:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Portfolio AI V2 failed',
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request
      .json()
      .catch(() => ({}))

    return createResponse({
      bankroll: Number(
        body?.bankroll ?? 1000
      ),
      targetProfit: Number(
        body?.targetProfit ?? 100
      ),
      sportKey:
        body?.sportKey ?? 'baseball_mlb',
      mode: normalizeMode(
        body?.mode
      ),
      risk: normalizeRisk(
        body?.risk
      ),
      maxExposurePercent: Number(
        body?.maxExposurePercent ?? 7
      ),
      maxSelections: Number(
        body?.maxSelections ?? 6
      ),
    })
  } catch (error) {
    console.error(
      'Portfolio AI V2 POST failed:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Portfolio AI V2 failed',
      },
      { status: 500 }
    )
  }
}