import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  PRODUCTION_DATA_GATE_V1_POLICY,
  isProductionEligibleRow,
} from '@/services/production-data-gate.service'

type SettledPredictionRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string
  team: string
  opponent: string
  market: string
  sportsbook: string
  odds: number
  model_probability: number
  confidence: number
  edge: number
  ev: number
  recommended_pick: boolean | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
  status: string | null
  result: string | null
  created_at?: string | null
}

type PerformanceAccumulator = {
  key: string
  label: string
  bets: number
  wins: number
  losses: number
  pushes: number
  totalStake: number
  profit: number
  totalOdds: number
  totalConfidence: number
  totalEv: number
  totalEdge: number
}

type CoachSeverity = 'positive' | 'warning' | 'critical' | 'info'

type CoachInsight = {
  id: string
  title: string
  message: string
  severity: CoachSeverity
  metric?: string
  sampleSize: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function decimalOdds(americanOdds: number) {
  if (americanOdds > 0) {
    return 1 + americanOdds / 100
  }

  if (americanOdds < 0) {
    return 1 + 100 / Math.abs(americanOdds)
  }

  return 1
}

function profitForResult({
  result,
  odds,
  stake = 1,
}: {
  result: string
  odds: number
  stake?: number
}) {
  const normalizedResult = normalize(result)

  if (normalizedResult === 'win') {
    return stake * (decimalOdds(odds) - 1)
  }

  if (normalizedResult === 'loss') {
    return -stake
  }

  return 0
}

function getResolvedResult(row: SettledPredictionRow) {
  const result = normalize(row.result)

  if (
    result === 'win' ||
    result === 'loss' ||
    result === 'push'
  ) {
    return result
  }

  return null
}

function getOddsRange(odds: number) {
  if (odds <= -200) return 'Heavy Favorite'
  if (odds <= -150) return 'Favorite -200 to -151'
  if (odds <= -110) return 'Favorite -150 to -110'
  if (odds < 100) return 'Near Even'
  if (odds <= 150) return 'Underdog +100 to +150'
  if (odds <= 250) return 'Underdog +151 to +250'
  return 'Longshot +251 or higher'
}

function getConfidenceRange(confidence: number) {
  if (confidence >= 80) return '80%+'
  if (confidence >= 70) return '70–79.99%'
  if (confidence >= 60) return '60–69.99%'
  if (confidence >= 50) return '50–59.99%'
  return 'Below 50%'
}

function getEvRange(ev: number) {
  if (ev >= 20) return '20%+'
  if (ev >= 10) return '10–19.99%'
  if (ev >= 5) return '5–9.99%'
  if (ev >= 0) return '0–4.99%'
  return 'Negative EV'
}

function getDayName(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(date)
}

function getHourRange(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  const hour = date.getUTCHours()

  if (hour < 6) return '12 AM–5:59 AM'
  if (hour < 12) return '6 AM–11:59 AM'
  if (hour < 18) return '12 PM–5:59 PM'
  return '6 PM–11:59 PM'
}

function createAccumulator(
  key: string,
  label: string
): PerformanceAccumulator {
  return {
    key,
    label,
    bets: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    totalStake: 0,
    profit: 0,
    totalOdds: 0,
    totalConfidence: 0,
    totalEv: 0,
    totalEdge: 0,
  }
}

function addToAccumulator(
  map: Map<string, PerformanceAccumulator>,
  key: string,
  label: string,
  row: SettledPredictionRow,
  result: string
) {
  const current =
    map.get(key) ?? createAccumulator(key, label)

  current.bets += 1
  current.totalStake += 1
  current.totalOdds += Number(row.odds ?? 0)
  current.totalConfidence += Number(row.confidence ?? 0)
  current.totalEv += Number(row.ev ?? 0)
  current.totalEdge += Number(row.edge ?? 0)
  current.profit += profitForResult({
    result,
    odds: Number(row.odds ?? 0),
  })

  if (result === 'win') current.wins += 1
  if (result === 'loss') current.losses += 1
  if (result === 'push') current.pushes += 1

  map.set(key, current)
}

function finalizeAccumulator(
  accumulator: PerformanceAccumulator
) {
  const decisions =
    accumulator.wins + accumulator.losses

  const winRate =
    decisions > 0
      ? (accumulator.wins / decisions) * 100
      : 0

  const roi =
    accumulator.totalStake > 0
      ? (accumulator.profit /
          accumulator.totalStake) *
        100
      : 0

  return {
    key: accumulator.key,
    label: accumulator.label,
    bets: accumulator.bets,
    wins: accumulator.wins,
    losses: accumulator.losses,
    pushes: accumulator.pushes,
    winRate: round(winRate),
    roi: round(roi),
    profit: round(accumulator.profit),
    averageOdds: round(
      accumulator.totalOdds /
        Math.max(accumulator.bets, 1)
    ),
    averageConfidence: round(
      accumulator.totalConfidence /
        Math.max(accumulator.bets, 1)
    ),
    averageEv: round(
      accumulator.totalEv /
        Math.max(accumulator.bets, 1)
    ),
    averageEdge: round(
      accumulator.totalEdge /
        Math.max(accumulator.bets, 1)
    ),
  }
}

function finalizeMap(
  map: Map<string, PerformanceAccumulator>
) {
  return [...map.values()]
    .map(finalizeAccumulator)
    .sort(
      (first, second) =>
        second.roi - first.roi ||
        second.bets - first.bets
    )
}

function confidenceCalibration(rows: SettledPredictionRow[]) {
  if (rows.length === 0) {
    return {
      score: 0,
      averageConfidence: 0,
      actualWinRate: 0,
      difference: 0,
      status: 'INSUFFICIENT_DATA',
    }
  }

  const averageConfidence =
    rows.reduce(
      (sum, row) =>
        sum + Number(row.confidence ?? 0),
      0
    ) / rows.length

  const wins = rows.filter(
    (row) => getResolvedResult(row) === 'win'
  ).length

  const losses = rows.filter(
    (row) => getResolvedResult(row) === 'loss'
  ).length

  const decisions = wins + losses

  const actualWinRate =
    decisions > 0 ? (wins / decisions) * 100 : 0

  const difference =
    averageConfidence - actualWinRate

  const score = round(
    clamp(100 - Math.abs(difference) * 4, 0, 100)
  )

  return {
    score,
    averageConfidence: round(averageConfidence),
    actualWinRate: round(actualWinRate),
    difference: round(difference),
    status:
      Math.abs(difference) <= 3
        ? 'WELL_CALIBRATED'
        : difference > 3
          ? 'OVERCONFIDENT'
          : 'UNDERCONFIDENT',
  }
}

function buildInsights({
  overall,
  bySport,
  byOddsRange,
  byMarket,
  byConfidence,
  calibration,
  minimumSample,
}: {
  overall: ReturnType<typeof finalizeAccumulator>
  bySport: ReturnType<typeof finalizeMap>
  byOddsRange: ReturnType<typeof finalizeMap>
  byMarket: ReturnType<typeof finalizeMap>
  byConfidence: ReturnType<typeof finalizeMap>
  calibration: ReturnType<typeof confidenceCalibration>
  minimumSample: number
}) {
  const insights: CoachInsight[] = []

  const reliableSports = bySport.filter(
    (item) => item.bets >= minimumSample
  )

  const reliableOdds = byOddsRange.filter(
    (item) => item.bets >= minimumSample
  )

  const reliableMarkets = byMarket.filter(
    (item) => item.bets >= minimumSample
  )

  const reliableConfidence = byConfidence.filter(
    (item) => item.bets >= minimumSample
  )

  const bestSport = reliableSports[0]
  const worstSport = [...reliableSports].sort(
    (first, second) =>
      first.roi - second.roi
  )[0]

  if (bestSport && bestSport.roi > 0) {
    insights.push({
      id: 'best-sport',
      title: 'Strongest sport',
      message: `${bestSport.label} has produced ${bestSport.roi}% ROI across ${bestSport.bets} settled predictions.`,
      severity: 'positive',
      metric: `${bestSport.roi}% ROI`,
      sampleSize: bestSport.bets,
    })
  }

  if (
    worstSport &&
    worstSport.roi < -5 &&
    worstSport.key !== bestSport?.key
  ) {
    insights.push({
      id: 'worst-sport',
      title: 'Sport requiring caution',
      message: `${worstSport.label} has returned ${worstSport.roi}% ROI. Reduce exposure until the model improves in this sport.`,
      severity: 'warning',
      metric: `${worstSport.roi}% ROI`,
      sampleSize: worstSport.bets,
    })
  }

  const bestOdds = reliableOdds[0]
  const worstOdds = [...reliableOdds].sort(
    (first, second) =>
      first.roi - second.roi
  )[0]

  if (bestOdds && bestOdds.roi > 0) {
    insights.push({
      id: 'best-odds-range',
      title: 'Best odds range',
      message: `${bestOdds.label} is currently the strongest price range, with ${bestOdds.roi}% ROI.`,
      severity: 'positive',
      metric: `${bestOdds.roi}% ROI`,
      sampleSize: bestOdds.bets,
    })
  }

  if (
    worstOdds &&
    worstOdds.roi < -5 &&
    worstOdds.key !== bestOdds?.key
  ) {
    insights.push({
      id: 'worst-odds-range',
      title: 'Avoid weak price range',
      message: `${worstOdds.label} has underperformed at ${worstOdds.roi}% ROI.`,
      severity: 'critical',
      metric: `${worstOdds.roi}% ROI`,
      sampleSize: worstOdds.bets,
    })
  }

  const bestMarket = reliableMarkets[0]

  if (bestMarket && bestMarket.roi > 0) {
    insights.push({
      id: 'best-market',
      title: 'Best market',
      message: `${bestMarket.label} has been the strongest tracked market, returning ${bestMarket.roi}% ROI.`,
      severity: 'positive',
      metric: `${bestMarket.roi}% ROI`,
      sampleSize: bestMarket.bets,
    })
  }

  const highestConfidence =
    reliableConfidence.find(
      (item) => item.key === '80%+'
    ) ??
    reliableConfidence.find(
      (item) => item.key === '70–79.99%'
    )

  if (
    highestConfidence &&
    highestConfidence.roi < 0
  ) {
    insights.push({
      id: 'high-confidence-warning',
      title: 'High confidence is not converting',
      message: `${highestConfidence.label} selections have ${highestConfidence.roi}% ROI despite high model confidence. Review calibration and stake sizing.`,
      severity: 'warning',
      metric: `${highestConfidence.winRate}% win rate`,
      sampleSize: highestConfidence.bets,
    })
  }

  if (calibration.status === 'OVERCONFIDENT') {
    insights.push({
      id: 'overconfident',
      title: 'Model is overconfident',
      message: `Average confidence exceeds actual win rate by ${calibration.difference} percentage points.`,
      severity: 'warning',
      metric: `${calibration.score}/100 calibration`,
      sampleSize: overall.bets,
    })
  }

  if (calibration.status === 'UNDERCONFIDENT') {
    insights.push({
      id: 'underconfident',
      title: 'Model may be too conservative',
      message: `Actual win rate exceeds average confidence by ${Math.abs(calibration.difference)} percentage points.`,
      severity: 'info',
      metric: `${calibration.score}/100 calibration`,
      sampleSize: overall.bets,
    })
  }

  if (overall.bets < minimumSample) {
    insights.push({
      id: 'small-sample',
      title: 'Small sample warning',
      message: `Only ${overall.bets} settled predictions are available. Treat all conclusions as preliminary.`,
      severity: 'info',
      metric: `${overall.bets} samples`,
      sampleSize: overall.bets,
    })
  }

  return insights
}

function buildRules({
  bySport,
  byOddsRange,
  byMarket,
  byConfidence,
  minimumSample,
}: {
  bySport: ReturnType<typeof finalizeMap>
  byOddsRange: ReturnType<typeof finalizeMap>
  byMarket: ReturnType<typeof finalizeMap>
  byConfidence: ReturnType<typeof finalizeMap>
  minimumSample: number
}) {
  const doRules: string[] = []
  const avoidRules: string[] = []

  const categories = [
    ...bySport.map((item) => ({
      ...item,
      category: 'sport',
    })),
    ...byOddsRange.map((item) => ({
      ...item,
      category: 'odds range',
    })),
    ...byMarket.map((item) => ({
      ...item,
      category: 'market',
    })),
    ...byConfidence.map((item) => ({
      ...item,
      category: 'confidence range',
    })),
  ].filter(
    (item) => item.bets >= minimumSample
  )

  for (const item of categories) {
    if (item.roi >= 8 && doRules.length < 5) {
      doRules.push(
        `Prioritize ${item.label} (${item.category}): ${item.roi}% ROI over ${item.bets} predictions.`
      )
    }

    if (
      item.roi <= -8 &&
      avoidRules.length < 5
    ) {
      avoidRules.push(
        `Reduce or avoid ${item.label} (${item.category}): ${item.roi}% ROI over ${item.bets} predictions.`
      )
    }
  }

  if (doRules.length === 0) {
    doRules.push(
      'Keep stake sizes conservative until a reliable positive pattern develops.'
    )
  }

  if (avoidRules.length === 0) {
    avoidRules.push(
      'Avoid increasing exposure based on small samples or one-day performance.'
    )
  }

  return {
    do: doRules,
    avoid: avoidRules,
  }
}

export async function getAICoachAnalysis({
  sportKey = 'all',
  limit = 5000,
  recommendedOnly = false,
  minimumSample = 10,
}: {
  sportKey?: string
  limit?: number
  recommendedOnly?: boolean
  minimumSample?: number
} = {}) {
  let query = supabaseAdmin
    .from('prediction_history')
    .select(
      'id, sport_key, game_id, commence_time, team, opponent, market, sportsbook, odds, model_probability, confidence, edge, ev, recommended_pick, production_eligible, trial, scrambled, status, result, created_at'
    )
    .eq('production_eligible', true)
    .order('commence_time', {
      ascending: false,
    })
    .limit(clamp(limit, 100, 10000))

  if (sportKey !== 'all') {
    query = query.eq('sport_key', sportKey)
  }

  if (recommendedOnly) {
    query = query.eq('recommended_pick', true)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const settledRows = (
    (data ?? []) as SettledPredictionRow[]
  ).filter((row) => isProductionEligibleRow(row) && Boolean(getResolvedResult(row)))

  const overallAccumulator = createAccumulator(
    'overall',
    'Overall'
  )

  const bySportMap = new Map<
    string,
    PerformanceAccumulator
  >()

  const byMarketMap = new Map<
    string,
    PerformanceAccumulator
  >()

  const byOddsRangeMap = new Map<
    string,
    PerformanceAccumulator
  >()

  const byConfidenceMap = new Map<
    string,
    PerformanceAccumulator
  >()

  const byEvRangeMap = new Map<
    string,
    PerformanceAccumulator
  >()

  const byDayMap = new Map<
    string,
    PerformanceAccumulator
  >()

  const byHourMap = new Map<
    string,
    PerformanceAccumulator
  >()

  const favoriteMap = new Map<
    string,
    PerformanceAccumulator
  >()

  for (const row of settledRows) {
    const result = getResolvedResult(row)

    if (!result) continue

    addToAccumulator(
      new Map([
        ['overall', overallAccumulator],
      ]),
      'overall',
      'Overall',
      row,
      result
    )

    const sport = row.sport_key || 'unknown'
    const market = row.market || 'unknown'
    const oddsRange = getOddsRange(row.odds)
    const confidenceRange =
      getConfidenceRange(row.confidence)
    const evRange = getEvRange(row.ev)
    const day = getDayName(row.commence_time)
    const hour = getHourRange(row.commence_time)
    const favoriteType =
      row.odds < 0 ? 'Favorites' : 'Underdogs'

    addToAccumulator(
      bySportMap,
      sport,
      sport,
      row,
      result
    )

    addToAccumulator(
      byMarketMap,
      market,
      market,
      row,
      result
    )

    addToAccumulator(
      byOddsRangeMap,
      oddsRange,
      oddsRange,
      row,
      result
    )

    addToAccumulator(
      byConfidenceMap,
      confidenceRange,
      confidenceRange,
      row,
      result
    )

    addToAccumulator(
      byEvRangeMap,
      evRange,
      evRange,
      row,
      result
    )

    addToAccumulator(
      byDayMap,
      day,
      day,
      row,
      result
    )

    addToAccumulator(
      byHourMap,
      hour,
      hour,
      row,
      result
    )

    addToAccumulator(
      favoriteMap,
      favoriteType,
      favoriteType,
      row,
      result
    )

    overallAccumulator.bets += 1
    overallAccumulator.totalStake += 1
    overallAccumulator.totalOdds += row.odds
    overallAccumulator.totalConfidence += row.confidence
    overallAccumulator.totalEv += row.ev
    overallAccumulator.totalEdge += row.edge
    overallAccumulator.profit +=
      profitForResult({
        result,
        odds: row.odds,
      })

    if (result === 'win') {
      overallAccumulator.wins += 1
    }

    if (result === 'loss') {
      overallAccumulator.losses += 1
    }

    if (result === 'push') {
      overallAccumulator.pushes += 1
    }
  }

  const overall = finalizeAccumulator(
    overallAccumulator
  )

  const bySport = finalizeMap(bySportMap)
  const byMarket = finalizeMap(byMarketMap)
  const byOddsRange = finalizeMap(
    byOddsRangeMap
  )
  const byConfidence = finalizeMap(
    byConfidenceMap
  )
  const byEvRange = finalizeMap(byEvRangeMap)
  const byDay = finalizeMap(byDayMap)
  const byHour = finalizeMap(byHourMap)
  const favoritesVsUnderdogs =
    finalizeMap(favoriteMap)

  const calibration =
    confidenceCalibration(settledRows)

  const insights = buildInsights({
    overall,
    bySport,
    byOddsRange,
    byMarket,
    byConfidence,
    calibration,
    minimumSample,
  })

  const rules = buildRules({
    bySport,
    byOddsRange,
    byMarket,
    byConfidence,
    minimumSample,
  })

  const dataQuality =
    overall.bets >= 250
      ? 'STRONG'
      : overall.bets >= 100
        ? 'MODERATE'
        : overall.bets >= minimumSample
          ? 'LIMITED'
          : 'INSUFFICIENT'

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    mode: 'ai_coach_v1',

    filters: {
      sportKey,
      recommendedOnly,
      minimumSample,
    },

    dataQuality: {
      productionGateMode: PRODUCTION_DATA_GATE_V1_POLICY.mode,
      level: dataQuality,
      settledPredictions: overall.bets,
      message:
        dataQuality === 'STRONG'
          ? 'Sample size is strong enough for meaningful pattern analysis.'
          : dataQuality === 'MODERATE'
            ? 'Patterns are useful, but should continue to be monitored.'
            : dataQuality === 'LIMITED'
              ? 'Patterns are preliminary because the sample is limited.'
              : 'There is not enough settled history for reliable conclusions.',
    },

    overall,
    calibration,

    best: {
      sport:
        bySport.find(
          (item) => item.bets >= minimumSample
        ) ?? null,
      market:
        byMarket.find(
          (item) => item.bets >= minimumSample
        ) ?? null,
      oddsRange:
        byOddsRange.find(
          (item) => item.bets >= minimumSample
        ) ?? null,
      confidenceRange:
        byConfidence.find(
          (item) => item.bets >= minimumSample
        ) ?? null,
      evRange:
        byEvRange.find(
          (item) => item.bets >= minimumSample
        ) ?? null,
      day:
        byDay.find(
          (item) => item.bets >= minimumSample
        ) ?? null,
      timeWindow:
        byHour.find(
          (item) => item.bets >= minimumSample
        ) ?? null,
    },

    breakdowns: {
      bySport,
      byMarket,
      byOddsRange,
      byConfidence,
      byEvRange,
      byDay,
      byHour,
      favoritesVsUnderdogs,
    },

    insights,
    rules,
  }
}
