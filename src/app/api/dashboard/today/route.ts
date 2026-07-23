import { NextRequest, NextResponse } from 'next/server'
import { loadDashboardTodayService } from '@/lib/server-lazy-diagnostics'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
}

export async function GET(request: NextRequest) {
  const generatedAt = new Date().toISOString()
  const { searchParams } = new URL(request.url)
  try {
    const { getDashboardToday, validateDashboardTodayFixtures } = await loadDashboardTodayService()
    const today = await getDashboardToday()
    return NextResponse.json({
      ...today,
      validation: searchParams.get('includeValidation') === 'true' ? validateDashboardTodayFixtures() : undefined,
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown dashboard error'
    return NextResponse.json(
      {
        success: true,
        status: 'UNAVAILABLE',
        mode: 'dashboard_today_contract_v1',
        generatedAt,
        operatingDate: generatedAt.slice(0, 10),
        nextSlateDate: null,
        currentGames: 0,
        upcomingGames: 0,
        finalGames: 0,
        summary: {
          recommendation: 'Today is temporarily unavailable.',
          aiBriefing: 'Today core data is temporarily unavailable.',
          currentOperatingDay: 'Operating-day data is temporarily unavailable.',
          nextSlate: 'Next slate data is temporarily unavailable.',
          marketPrices: 'Market price status is temporarily unavailable.',
        },
        currentGameCards: [],
        nextSlateGames: [],
        partial: true,
        warnings: ['Today dashboard returned a degraded fallback response.'],
        errors: [{ dependency: 'dashboard_today', message, critical: true }],
        providerCallsMade: 0,
        remoteMutationsMade: 0,
        diagnostics: {
          initialPrimaryEndpoint: '/api/dashboard/today',
          dashboardSlateSource: 'primary_current_events',
          dashboardFallbackUsed: false,
          dashboardQueryStatus: 'QUERY_FAILED',
          slate: {
            status: 'QUERY_FAILED',
            requestedOperatingDate: generatedAt.slice(0, 10),
            timezone: 'America/Puerto_Rico',
            rawRowsRead: 0,
            canonicalRowsRetained: 0,
            filteredOutByCanonicalDate: 0,
            queryWindowUtcStart: null,
            queryWindowUtcEndExclusive: null,
            reason: message,
          },
        },
        error: message,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    )
  }
}
