import { explainPick } from '@/services/analysis-explainer.service'
import { getClvAnalytics } from '@/services/clv-analytics.service'
import { getModelCalibration } from '@/services/model-calibration.service'
import { getModelWeights } from '@/services/model-learning.service'
import { getTopPicks } from '@/services/top-picks.service'
import { PRODUCTION_DATA_GATE_V1_POLICY } from '@/services/production-data-gate.service'
import { getCurrentBoard } from '@/services/current-board.service'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Pick = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string
  team: string
  opponent: string
  sportsbook: string
  odds: number
  implied_probability: number
  model_probability: number
  edge: number
  ev: number
  confidence: number
  recommended_pick: boolean | null
  risk_grade?: string
  risk_label?: string
  risk_stars?: number
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
}

async function safeSection<T>(
  name: string,
  fallback: T,
  loader: () => Promise<T>
): Promise<T> {
  try {
    return await loader()
  } catch (error) {
    console.error(`Fast daily report ${name} failed:`, error)
    return fallback
  }
}

function sortBySmartScore(a: Pick, b: Pick) {
  return (
    (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
    b.confidence - a.confidence ||
    b.ev - a.ev ||
    b.edge - a.edge
  )
}

function dedupePicks(picks: Pick[]) {
  const map = new Map<string, Pick>()

  for (const pick of picks) {
    const key = `${pick.sport_key}:${pick.team}:${pick.opponent}`
    const existing = map.get(key)

    if (!existing || (pick.smart_score ?? 0) > (existing.smart_score ?? 0)) {
      map.set(key, pick)
    }
  }

  return [...map.values()]
}

function mapPick(pick: Pick | null) {
  if (!pick) return null

  return {
    ...pick,
    explanation: explainPick(pick),
  }
}

function calculateBankrollPlan(picks: Pick[], bankroll: number) {
  const maxDailyExposurePercent = 6
  const maxDailyExposure = bankroll * (maxDailyExposurePercent / 100)

  let remaining = maxDailyExposure

  const selected = picks
    .filter(
      (pick) =>
        pick.ev >= 5 &&
        pick.edge >= 5 &&
        pick.confidence >= 65 &&
        pick.recommended_pick === true
    )
    .sort(sortBySmartScore)
    .slice(0, 5)
    .map((pick) => {
      const desiredStake = Math.min(
        Number(pick.recommended_stake ?? 0),
        bankroll * 0.05
      )

      const stake = Number(Math.max(0, Math.min(desiredStake, remaining)).toFixed(2))

      remaining = Number((remaining - stake).toFixed(2))

      return {
        ...pick,
        recommendedStake: stake,
        stakePercent: bankroll ? Number(((stake / bankroll) * 100).toFixed(2)) : 0,
      }
    })

  const totalStake = Number(
    selected.reduce((sum, pick) => sum + pick.recommendedStake, 0).toFixed(2)
  )

  const expectedProfit = Number(
    selected
      .reduce((sum, pick) => sum + pick.recommendedStake * (pick.ev / 100), 0)
      .toFixed(2)
  )

  const exposurePercent = bankroll
    ? Number(((totalStake / bankroll) * 100).toFixed(2))
    : 0

  return {
    maxDailyExposurePercent,
    maxDailyExposure: Number(maxDailyExposure.toFixed(2)),
    totalStake,
    exposurePercent,
    exposureLevel:
      exposurePercent <= 3
        ? 'LOW'
        : exposurePercent <= 6
          ? 'MODERATE'
          : exposurePercent <= 10
            ? 'HIGH'
            : 'EXTREME',
    expectedProfit,
    expectedRoi: totalStake
      ? Number(((expectedProfit / totalStake) * 100).toFixed(2))
      : 0,
    remainingExposure: Number(Math.max(0, remaining).toFixed(2)),
    overExposure: exposurePercent > maxDailyExposurePercent,
    recommendedAction:
      exposurePercent >= maxDailyExposurePercent
        ? 'Playable, but close to daily exposure limit. Avoid adding extra picks.'
        : selected.length
          ? 'Stake plan is within disciplined bankroll limits.'
          : 'No qualified bankroll picks available right now.',
    bestStake: selected[0] ?? null,
    picks: selected,
  }
}

function getExecutiveSummary({
  totalPicks,
  bestBets,
  calibrationScore,
}: {
  totalPicks: number
  bestBets: number
  calibrationScore: number
}) {
  if (!totalPicks) {
    return 'No strong betting board detected today. Preserve bankroll and wait for better spots.'
  }

  if (bestBets >= 3) {
    return `Strong board today: ${bestBets} best bets found from saved model history.`
  }

  if (calibrationScore < 50) {
    return 'Proceed carefully. The board has opportunities, but model calibration needs more settled data.'
  }

  return 'Moderate betting board. Focus on highest-confidence singles and keep exposure controlled.'
}

async function countRows(table: string, filters: (query: any) => any) {
  const query = filters(
    supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
  )
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

async function getMlbOperationalSummary({
  officialPickCount,
}: {
  officialPickCount: number
}) {
  const board = await getCurrentBoard({ sportKey: 'baseball_mlb', mode: 'CURRENT', limit: 100 })

  const [
    latestSync,
  ] = await Promise.all([
    supabaseAdmin
      .from('sports_sync_jobs')
      .select('job_type, completed_at, status')
      .eq('sport_key', 'baseball_mlb')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    mode: 'mlb_daily_operational_summary_v1',
    selectedSport: 'baseball_mlb',
    providerStatus: 'ready_disabled_no_live_capture',
    gamesToday: board.games.length,
    slateGames: board.games.length,
    futureGames: board.games.length,
    gamesWithOdds: board.games.filter((game) => Boolean(game.latestOddsTimestamp)).length,
    analyzedCandidates: board.candidates.length,
    modeledValueCandidates: board.modeledValueCount,
    watchCandidates: board.watchCount,
    qualifiedPreviews: board.qualifiedPreviewCount,
    lastSuccessfulSync: latestSync.data?.completed_at ?? null,
    lastSuccessfulSyncType: latestSync.data?.job_type ?? null,
    latestOddsCapture: board.latestOddsTimestamp,
    dataFreshness: board.dataFreshness,
    boardHealth: board.boardHealth,
    nextRequiredAction:
      board.games.length > 0
        ? board.dataFreshness.nextRecommendedRefreshTime
          ? `Refresh stored odds by ${board.dataFreshness.nextRecommendedRefreshTime} if the game has not started.`
          : 'Monitor the current board and wait for postgame result/stat refresh.'
        : 'Import broader 2025/2026 foundations or wait for the next scheduled MLB slate.',
    previewCandidateCount: board.previewCount,
    officialPickCount,
    officialPicksEnabled: false,
    providerCallsMadeByThisReport: 0,
  }
}

export async function getDailyReportFast(bankroll = 1000) {
  const topPicks = await safeSection(
    'top picks',
    {
      success: false,
      sportKey: 'baseball_mlb',
      adaptiveWeightsAvailable: false,
      summary: {
        productionGateMode: PRODUCTION_DATA_GATE_V1_POLICY.mode,
        recommendationPolicyMode: 'recommendation_eligibility_policy_v1',
        automaticProductionApproval: false,
        calibrationStatus: 'probationary',
        pendingPicks: 0,
        safePendingPicks: 0,
        recommendedPicks: 0,
        officialQualifiedPicks: 0,
        watchCandidates: 0,
        topEvCount: 0,
        topConfidenceCount: 0,
        bestBetsCount: 0,
        sportsAvailable: [] as string[],
      },
      topEv: [],
      topConfidence: [],
      bestBets: [],
    },
    () => getTopPicks()
  )

  const calibration = await safeSection(
    'calibration',
    {
      success: false,
      overall: {
        calibrationScore: 0,
        modelStatus: 'INSUFFICIENT_DATA',
      },
    } as any,
    () => getModelCalibration()
  )

  const clv = await safeSection(
    'clv analytics',
    {
      success: false,
      summary: {
        averageClv: 0,
      },
    } as any,
    () => getClvAnalytics()
  )

  const learnedWeights = await safeSection(
    'model weights',
    {
      homeAwayAdvantage: 1.05,
      headToHeadAdvantage: 1.15,
      pitcherAdvantage: 1.45,
      injuryImpact: 1.3,
      weatherImpact: 0.75,
    },
    () => getModelWeights('baseball_mlb')
  )

  const picks = dedupePicks([
    ...(topPicks.bestBets as Pick[]),
    ...(topPicks.topConfidence as Pick[]),
    ...(topPicks.topEv as Pick[]),
  ]).sort(sortBySmartScore)

  const playOfTheDay = picks[0] ?? null
  const bestUnderdog = [...picks]
    .filter((pick) => pick.odds > 0)
    .sort(sortBySmartScore)[0] ?? null

  const bestFavorite = [...picks]
    .filter((pick) => pick.odds < 0)
    .sort(sortBySmartScore)[0] ?? null

  const highestEv = [...picks].sort((a, b) => b.ev - a.ev)[0] ?? null

  const highestConfidence =
    [...picks].sort((a, b) => b.confidence - a.confidence)[0] ?? null

  const bankrollPlan = calculateBankrollPlan(picks, bankroll)
  const officialPickCount = Number(topPicks.summary.recommendedPicks ?? 0)
  const previewCandidateCount = Number(
    (topPicks.summary.watchCandidates ?? 0) + (topPicks.summary.officialQualifiedPicks ?? 0)
  )

  const mlbOperationalSummary = await safeSection(
    'mlb operational summary',
    {
      mode: 'mlb_daily_operational_summary_v1',
      selectedSport: 'baseball_mlb',
      providerStatus: 'summary_unavailable',
      gamesToday: 0,
      slateGames: 0,
      futureGames: 0,
      gamesWithOdds: 0,
      analyzedCandidates: 0,
      modeledValueCandidates: 0,
      watchCandidates: 0,
      qualifiedPreviews: 0,
      lastSuccessfulSync: null,
      lastSuccessfulSyncType: null,
      latestOddsCapture: null,
      dataFreshness: {
        status: 'empty',
        latestOddsTimestamp: null,
        latestOddsAgeMinutes: null,
        maxAllowedAgeMinutes: 1440,
        nextRecommendedRefreshTime: null,
        timestampSemantics: 'selected_visible_market_snapshot',
        latestSourceTimestamp: null,
        latestVisibleMarketSnapshotTimestamp: null,
        oldestVisibleMarketSnapshotTimestamp: null,
        visibleMarketCount: 0,
        freshVisibleMarketCount: 0,
        staleVisibleMarketCount: 0,
        freshnessTimestampSource: null,
      },
      boardHealth: {
        status: 'EMPTY',
        warnings: ['Current board summary unavailable.'],
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      nextRequiredAction: 'Retry the read-only MLB operational summary.',
      previewCandidateCount,
      officialPickCount,
      officialPicksEnabled: false,
      providerCallsMadeByThisReport: 0,
    },
    () => getMlbOperationalSummary({ officialPickCount })
  )

  const riskAlerts: string[] = []

  if (calibration.overall?.modelStatus === 'NEEDS_RECALIBRATION') {
    riskAlerts.push('Model calibration needs more data before increasing stake sizes.')
  }

  if (bankrollPlan.exposurePercent >= 6) {
    riskAlerts.push('Bankroll exposure is at the daily limit.')
  }

  return {
    success: true,
    fast: true,
    bankroll,
    generatedAt: new Date().toISOString(),
    executiveSummary: getExecutiveSummary({
      totalPicks: picks.length,
      bestBets: topPicks.summary.bestBetsCount,
      calibrationScore: calibration.overall?.calibrationScore ?? 0,
    }),
    summary: {
      totalQualifiedPicks: picks.length,
      recommendedPicks: officialPickCount,
      bestBets: topPicks.summary.bestBetsCount,
      betNow: 0,
      sharpSignals: 0,
      bestSingles: picks.length,
      avoidList: 0,
      averageLineValue: 0,
      averageSharpConfidence: 0,
      bankrollExposurePercent: bankrollPlan.exposurePercent,
      bankrollExposureLevel: bankrollPlan.exposureLevel,
      clvAverage: clv.summary?.averageClv ?? 0,
      calibrationScore: calibration.overall?.calibrationScore ?? 0,
      modelStatus: calibration.overall?.modelStatus ?? 'INSUFFICIENT_DATA',
    },
    todayCard: {
      playOfTheDay: mapPick(playOfTheDay),
      bestUnderdog: mapPick(bestUnderdog),
      bestFavorite: mapPick(bestFavorite),
      highestEv: mapPick(highestEv),
      highestConfidence: mapPick(highestConfidence),
      bestSharp: null,
      bestClv: null,
    },
    bankrollPlan,
    bestPortfolio: null,
    portfolios: {},
    topSingles: picks.slice(0, 10),
    sharpMoneyPlays: [],
    bestClvPlays: [],
    avoidList: [],
    modelHealth: {
      calibration: calibration.overall,
      learnedWeights,
      clv: clv.summary,
    },
    mlbOperationalSummary,
    riskAlerts,
    notes: [
      'Fast report uses saved predictions only.',
      'Run the full Daily Report when you want live odds, sharp money and sportsbook intelligence.',
    ],
  }
}
