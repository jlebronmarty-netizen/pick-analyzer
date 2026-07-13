import { NextRequest, NextResponse } from 'next/server'
import { getDashboard } from '@/services/dashboard.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bankroll = Number(searchParams.get('bankroll') ?? 1000)

    const dashboard = await getDashboard(
      Number.isFinite(bankroll) ? bankroll : 1000
    )

    return NextResponse.json(dashboard)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown dashboard error',
      },
      { status: 500 }
    )
  }
}