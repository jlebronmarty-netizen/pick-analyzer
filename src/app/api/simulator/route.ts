import { NextResponse } from 'next/server'
import { runPortfolioSimulator } from '@/services/portfolio-simulator.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const result = await runPortfolioSimulator({
      bankroll: searchParams.get('bankroll'),
      simulations: searchParams.get('simulations'),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Portfolio simulator error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown simulator error',
      },
      { status: 500 }
    )
  }
}