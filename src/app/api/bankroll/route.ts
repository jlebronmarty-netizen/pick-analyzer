import { NextResponse } from 'next/server'
import { normalizeBankroll } from '@/services/bankroll.service'
import { buildPortfolios } from '@/services/portfolio-builder.service'
import { getPlayOfTheDay } from '@/services/play-of-the-day.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const bankroll = normalizeBankroll(searchParams.get('amount'))

    const [portfolioResult, playResult] = await Promise.all([
      buildPortfolios(bankroll),
      getPlayOfTheDay(),
    ])

    return NextResponse.json({
      success: true,
      bankroll,
      generatedAt: new Date().toISOString(),
      playOfTheDay: playResult.play,
      portfolios: portfolioResult.portfolios,
    })
  } catch (error) {
    console.error('Bankroll manager error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown bankroll error',
      },
      { status: 500 }
    )
  }
}