import { NextRequest, NextResponse } from 'next/server'
import { loadDashboardService, loadDashboardTodayService } from '@/lib/server-lazy-diagnostics'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const generatedAt = new Date().toISOString()
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode')
  try {
    if (mode === 'today') {
      const { getDashboardToday, validateDashboardTodayFixtures } = await loadDashboardTodayService()
      const today = await getDashboardToday()
      return NextResponse.json({
        ...today,
        validation: searchParams.get('includeValidation') === 'true' ? validateDashboardTodayFixtures() : undefined,
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
    }

    const bankroll = Number(searchParams.get('bankroll') ?? 1000)
    const { getDashboard } = await loadDashboardService()

    const dashboard = await getDashboard(
      Number.isFinite(bankroll) ? bankroll : 1000
    )

    return NextResponse.json(dashboard, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown dashboard error'
    if (mode !== 'today') {
      return NextResponse.json(
        {
          success: false,
          error: message,
          generatedAt,
        },
        { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }
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
        lifecycleCounts: {
          totalScheduledToday: 0,
          upcoming: 0,
          live: 0,
          final: 0,
          postponed: 0,
          canceled: 0,
          suspended: 0,
          statusUnconfirmed: 0,
          bettingEligible: 0,
          bettingLocked: 0,
          missingMarket: 0,
        },
        gamesWaitingForOdds: 0,
        gamesReadyForAnalysis: 0,
        predictionCandidates: 0,
        officialPicks: 0,
        marketIntelligence: { official: 0, aiLeans: 0, watchlist: 0, avoid: 0 },
        freshness: 'empty',
        nextAction: 'No action required',
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
        sections: {
          core: { status: 'UNAVAILABLE', data: null, reason: 'Today core data is temporarily unavailable.', updatedAt: null },
        },
        warnings: ['Today dashboard returned a degraded fallback response.'],
        errors: [{ dependency: 'dashboard_today', message, critical: true }],
        timing: {
          totalMs: 0,
          dependencies: {},
          slowDependencies: [],
          coldOrWarm: 'runtime_observed',
          targetWarmMs: 2000,
          targetColdMs: 5000,
        },
        providerCallsMade: 0,
        remoteMutationsMade: 0,
        diagnostics: {
          initialPrimaryEndpoint: '/api/dashboard/today',
          initialAdvancedCallsWhenDeveloperModeClosed: 0,
          dailyReportDeferred: true,
          canonicalSources: ['sport_events operating-date range'],
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
      { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}
