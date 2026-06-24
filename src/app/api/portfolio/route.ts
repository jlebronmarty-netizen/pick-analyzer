import { NextResponse } from 'next/server'
import { normalizeBankroll } from '@/services/bankroll.service'
import { buildPortfolios } from '@/services/portfolio-builder.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const bankroll = normalizeBankroll(searchParams.get('bankroll'))

    const result = await buildPortfolios(bankroll)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Portfolio builder error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown portfolio error',
      },
      { status: 500 }
    )
  }
}