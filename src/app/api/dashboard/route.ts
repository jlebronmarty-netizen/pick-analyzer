import { NextRequest, NextResponse } from 'next/server'
import { getDashboard } from '@/services/dashboard.service'
import { getDashboardToday, validateDashboardTodayFixtures } from '@/services/dashboard-today.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')
    if (mode === 'today') {
      const today = await getDashboardToday()
      return NextResponse.json({
        ...today,
        validation: searchParams.get('includeValidation') === 'true' ? validateDashboardTodayFixtures() : undefined,
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
    }

    const bankroll = Number(searchParams.get('bankroll') ?? 1000)

    const dashboard = await getDashboard(
      Number.isFinite(bankroll) ? bankroll : 1000
    )

    return NextResponse.json(dashboard, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
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
