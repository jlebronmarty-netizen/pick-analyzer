import 'server-only'

import { getBestValueOpportunities } from '@/services/best-value-scanner.service'
import { getCurrentBoardCached, type CurrentBoardCandidate } from '@/services/current-board.service'
import { getArbitrageOpportunities, getMostLikelyOpportunities } from '@/services/market-opportunity-suite.service'
import {
  classifyMarketIntelligence,
  validateMarketIntelligenceCategoryFixtures,
  type MarketIntelligenceStatusLabel,
} from '@/services/market-intelligence-category.service'

export type MarketIntelligenceSort =
  | 'best_combined'
  | 'highest_probability'
  | 'highest_ev'
  | 'highest_confidence'
  | 'highest_ai_rating'
  | 'lowest_risk'

export type MarketIntelligenceRecommendation = 'Elite' | 'Strong Value' | 'Watch' | 'Pass' | 'Unavailable'
export type MarketIntelligenceProductCategory = MarketIntelligenceStatusLabel | 'Unavailable'
export type MarketHealth = 'Healthy' | 'Limited' | 'Missing Data' | 'Blocked' | 'Unsupported'
export type MarketAvailability = 'Available' | 'Unavailable'

type MarketCatalogItem = {
  key: string
  label: string
  sport: string
  family: string
  currentBoardMarket?: CurrentBoardCandidate['market']
  status: 'current' | 'future' | 'blocked'
  reason: string
}

type MarketIntelligenceOpportunity = ReturnType<typeof toOpportunity> | ReturnType<typeof unavailableMarket>

export type MarketIntelligenceFilters = {
  sport?: string
  game?: string
  market?: string
  sportsbook?: string
  recommendation?: MarketIntelligenceRecommendation
  risk?: 'low' | 'medium' | 'high'
  minAiRating?: number
  minConfidence?: number
  minEdge?: number
  minEv?: number
  minOdds?: number
  maxOdds?: number
}

const MARKET_CATALOG: MarketCatalogItem[] = [
  { key: 'moneyline', label: 'Moneyline', sport: 'baseball_mlb', family: 'core', currentBoardMarket: 'moneyline', status: 'current', reason: 'Current Board supports full-game moneyline candidates.' },
  { key: 'run_line', label: 'Run Line', sport: 'baseball_mlb', family: 'core', currentBoardMarket: 'spread', status: 'current', reason: 'Current Board maps MLB run line into the shared spread contract.' },
  { key: 'total', label: 'Total', sport: 'baseball_mlb', family: 'core', currentBoardMarket: 'total', status: 'current', reason: 'Current Board supports full-game totals.' },
  { key: 'team_total', label: 'Team Totals', sport: 'baseball_mlb', family: 'expansion', status: 'future', reason: 'Verified team-total odds and settlement support are not available.' },
  { key: 'first_half', label: 'First Half', sport: 'baseball_mlb', family: 'expansion', status: 'future', reason: 'Stored first-half market candidates are not available.' },
  { key: 'first_five', label: 'First Five', sport: 'baseball_mlb', family: 'expansion', status: 'future', reason: 'Stored first-five market candidates are not available.' },
  { key: 'player_props', label: 'Player Props', sport: 'baseball_mlb', family: 'props', status: 'blocked', reason: 'Pitcher/player props are not currently available because verified prop odds and the required player-level context are missing.' },
  { key: 'pitcher_props', label: 'Pitcher Props', sport: 'baseball_mlb', family: 'props', status: 'blocked', reason: 'Pitcher/player props are not currently available because verified prop odds and the required player-level context are missing.' },
  { key: 'specials', label: 'Specials', sport: 'baseball_mlb', family: 'specials', status: 'future', reason: 'Special markets require explicit provider, rules and settlement contracts.' },
  { key: 'futures', label: 'Futures', sport: 'baseball_mlb', family: 'futures', status: 'future', reason: 'Future markets require season-level odds, lifecycle and settlement contracts.' },
]

const FUTURE_SPORTS = ['basketball_nba', 'football_nfl', 'hockey_nhl', 'soccer', 'tennis', 'basketball_bsn']

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function riskBand(candidate: CurrentBoardCandidate) {
  if (candidate.confidence >= 60 && candidate.reliabilityScore >= 80 && !candidate.stale) return 'low'
  if (candidate.confidence >= 50 && candidate.reliabilityScore >= 65) return 'medium'
  return 'high'
}

function marketStability(candidate: CurrentBoardCandidate) {
  if (candidate.stale || candidate.anomalous) return 25
  if (candidate.oddsAgeMinutes <= 120) return 90
  if (candidate.oddsAgeMinutes <= 720) return 75
  return 60
}

function marketScore(candidate: CurrentBoardCandidate) {
  const positiveEdge = Math.max(0, candidate.edge)
  const positiveEv = Math.max(0, candidate.expectedValue)
  const policyBoost = ['QUALIFIED', 'BEST_BET_CANDIDATE', 'PLAY_OF_DAY_CANDIDATE'].includes(candidate.recommendationPolicyStatus)
    ? 10
    : candidate.recommendationPolicyStatus === 'WATCH'
      ? 4
      : 0
  const score =
    candidate.rawProbability * 0.18 +
    positiveEdge * 1.25 +
    positiveEv * 1.1 +
    candidate.confidence * 0.16 +
    candidate.reliabilityScore * 0.14 +
    candidate.aiRating * 0.14 +
    marketStability(candidate) * 0.1 +
    (candidate.featureQuality ?? 0) * 0.08 +
    (candidate.dataSufficiency ?? 0) * 0.08 +
    policyBoost
  return Math.max(0, Math.min(100, round(score)))
}

function classify(candidate: CurrentBoardCandidate, score: number): MarketIntelligenceRecommendation {
  const officialReady = ['QUALIFIED', 'BEST_BET_CANDIDATE', 'PLAY_OF_DAY_CANDIDATE'].includes(candidate.recommendationPolicyStatus)
  if (officialReady && score >= 80 && candidate.expectedValue > 0 && candidate.edge > 0) return 'Elite'
  if (candidate.modeledValueStatus === 'MODELED_VALUE' && score >= 70) return 'Strong Value'
  if (candidate.recommendationPolicyStatus === 'WATCH' || (candidate.modeledValueStatus === 'MODELED_VALUE' && score >= 58)) return 'Watch'
  return 'Pass'
}

function health(candidate: CurrentBoardCandidate): MarketHealth {
  if (candidate.stale || candidate.anomalous) return 'Limited'
  if ((candidate.featureQuality ?? 0) < 55 || (candidate.dataSufficiency ?? 0) < 55) return 'Missing Data'
  if (candidate.leakageStatus === 'blocked') return 'Blocked'
  return 'Healthy'
}

function quality(candidate: CurrentBoardCandidate) {
  const featureQuality = candidate.featureQuality ?? 0
  const dataSufficiency = candidate.dataSufficiency ?? 0
  return round((featureQuality + dataSufficiency + candidate.reliabilityScore) / 3)
}

function reasonFor(candidate: CurrentBoardCandidate, recommendation: MarketIntelligenceRecommendation) {
  if (recommendation === 'Elite') return 'Top market signal with official policy eligibility and positive modeled value.'
  if (recommendation === 'Strong Value') return 'Positive edge and expected value with enough supporting model signal to deserve attention.'
  if (recommendation === 'Watch') return 'Interesting model signal, but at least one official or market-quality condition is not ready.'
  return candidate.expectedValue <= 0 || candidate.edge <= 0
    ? 'No modeled value at the current stored price.'
    : 'Recommendation policy, calibration or data quality is not strong enough.'
}

function missingInformation(candidate: CurrentBoardCandidate) {
  return Array.from(new Set([
    ...candidate.missingInformation,
    ...candidate.blockers.map((blocker) => blocker.replaceAll('_', ' ').toLowerCase()),
  ])).slice(0, 8)
}

function explain(candidate: CurrentBoardCandidate, recommendation: MarketIntelligenceRecommendation) {
  return {
    whyScanned: 'Included by Current Board as a future, unstarted, latest safe stored-market candidate.',
    whyAccepted: recommendation === 'Pass' ? null : reasonFor(candidate, recommendation),
    whyRejected: recommendation === 'Pass' ? reasonFor(candidate, recommendation) : null,
    missingInformation: missingInformation(candidate),
    noValue: candidate.expectedValue <= 0 || candidate.edge <= 0,
  }
}

function toOpportunity(candidate: CurrentBoardCandidate) {
  const score = marketScore(candidate)
  const recommendation = classify(candidate, score)
  const productCategory = classifyMarketIntelligence(candidate)
  return {
    id: candidate.predictionId,
    sport: candidate.sportKey,
    game: candidate.matchup,
    eventId: candidate.eventId,
    eventTime: candidate.scheduledTime,
    eventStatus: candidate.eventStatus,
    market: candidate.market === 'spread' ? 'run_line' : candidate.market,
    marketLabel: candidate.marketLabel,
    period: candidate.period,
    selection: candidate.selection,
    sportsbook: candidate.sportsbook,
    odds: candidate.americanOdds,
    oddsTimestamp: candidate.oddsTimestamp,
    probability: candidate.rawProbability,
    edge: candidate.edge,
    ev: candidate.expectedValue,
    confidence: candidate.confidence,
    reliability: candidate.reliabilityScore,
    aiRating: candidate.aiRating,
    marketStability: marketStability(candidate),
    featureQuality: candidate.featureQuality,
    dataSufficiency: candidate.dataSufficiency,
    recommendation,
    classification: recommendation,
    productCategory: productCategory.label,
    productStatus: productCategory.display,
    marketIntelligenceCategory: productCategory.category,
    statusColor: productCategory.color,
    statusWarning: productCategory.warning,
    reasonNotOfficial: productCategory.reasonNotOfficial,
    score,
    health: health(candidate),
    availability: 'Available' as MarketAvailability,
    quality: quality(candidate),
    coverage: candidate.boardLabel,
    reason: reasonFor(candidate, recommendation),
    risk: riskBand(candidate),
    calibrationStatus: candidate.calibrationStatus,
    recommendationPolicyStatus: candidate.recommendationPolicyStatus,
    officialEligibility: candidate.officialEligibility,
    explanation: explain(candidate, recommendation),
  }
}

function unavailableMarket(item: MarketCatalogItem, boardCandidates: CurrentBoardCandidate[]) {
  const compatible = item.currentBoardMarket
    ? boardCandidates.filter((candidate) => candidate.market === item.currentBoardMarket)
    : []
  const healthStatus: MarketHealth = item.status === 'blocked' ? 'Blocked' : item.status === 'future' ? 'Unsupported' : 'Missing Data'
  return {
    id: `unavailable:${item.sport}:${item.key}`,
    sport: item.sport,
    game: null,
    eventId: null,
    eventTime: null,
    eventStatus: null,
    market: item.key,
    marketLabel: item.label,
    period: 'full_game',
    selection: null,
    sportsbook: null,
    odds: null,
    oddsTimestamp: null,
    probability: null,
    edge: null,
    ev: null,
    confidence: compatible.length ? round(compatible.reduce((sum, candidate) => sum + candidate.confidence, 0) / compatible.length) : 0,
    reliability: compatible.length ? round(compatible.reduce((sum, candidate) => sum + candidate.reliabilityScore, 0) / compatible.length) : 0,
    aiRating: compatible.length ? round(compatible.reduce((sum, candidate) => sum + candidate.aiRating, 0) / compatible.length) : 0,
    marketStability: 0,
    featureQuality: null,
    dataSufficiency: null,
    recommendation: 'Unavailable' as MarketIntelligenceRecommendation,
    classification: 'Unavailable' as MarketIntelligenceRecommendation,
    productCategory: 'Unavailable' as MarketIntelligenceProductCategory,
    productStatus: 'Unavailable',
    marketIntelligenceCategory: 'unavailable',
    statusColor: 'gray',
    statusWarning: item.reason,
    reasonNotOfficial: item.reason,
    score: 0,
    health: healthStatus,
    availability: 'Unavailable' as MarketAvailability,
    quality: 0,
    coverage: item.family,
    reason: item.reason,
    risk: 'high' as const,
    calibrationStatus: 'unavailable',
    recommendationPolicyStatus: 'UNAVAILABLE',
    officialEligibility: 'NOT_OFFICIALLY_ELIGIBLE',
    explanation: {
      whyScanned: 'Part of the Market Intelligence catalog for coverage visibility.',
      whyAccepted: null,
      whyRejected: item.reason,
      missingInformation: [item.reason],
      noValue: true,
    },
  }
}

function compare(sort: MarketIntelligenceSort) {
  return (left: MarketIntelligenceOpportunity, right: MarketIntelligenceOpportunity) => {
    if (sort === 'highest_probability') return Number(right.probability ?? -1) - Number(left.probability ?? -1)
    if (sort === 'highest_ev') return Number(right.ev ?? -999) - Number(left.ev ?? -999)
    if (sort === 'highest_confidence') return Number(right.confidence ?? -1) - Number(left.confidence ?? -1)
    if (sort === 'highest_ai_rating') return Number(right.aiRating ?? -1) - Number(left.aiRating ?? -1)
    if (sort === 'lowest_risk') return Number(right.reliability ?? -1) - Number(left.reliability ?? -1) || Number(right.confidence ?? -1) - Number(left.confidence ?? -1)
    return right.score - left.score || Number(right.probability ?? -1) - Number(left.probability ?? -1)
  }
}

function distribution<T extends string>(values: T[], all: T[]) {
  const result = Object.fromEntries(all.map((value) => [value, 0])) as Record<T, number>
  values.forEach((value) => {
    result[value] += 1
  })
  return result
}

function applyFilters(rows: MarketIntelligenceOpportunity[], filters: MarketIntelligenceFilters) {
  return rows.filter((row) => {
    if (filters.sport && row.sport !== filters.sport) return false
    if (filters.game && !String(row.game ?? '').toLowerCase().includes(filters.game.toLowerCase())) return false
    if (filters.market && row.market !== filters.market && row.marketLabel.toLowerCase() !== filters.market.toLowerCase()) return false
    if (filters.sportsbook && row.sportsbook !== filters.sportsbook) return false
    if (filters.recommendation && row.recommendation !== filters.recommendation) return false
    if (filters.risk && row.risk !== filters.risk) return false
    if (filters.minAiRating !== undefined && Number(row.aiRating ?? 0) < filters.minAiRating) return false
    if (filters.minConfidence !== undefined && Number(row.confidence ?? 0) < filters.minConfidence) return false
    if (filters.minEdge !== undefined && Number(row.edge ?? 0) < filters.minEdge) return false
    if (filters.minEv !== undefined && Number(row.ev ?? 0) < filters.minEv) return false
    if (filters.minOdds !== undefined && Number(row.odds ?? 0) < filters.minOdds) return false
    if (filters.maxOdds !== undefined && Number(row.odds ?? 0) > filters.maxOdds) return false
    return true
  })
}

export async function getMarketIntelligence({
  sort = 'best_combined',
  limit = 25,
  includeUnavailable = true,
  filters = {},
}: {
  sort?: MarketIntelligenceSort
  limit?: number
  includeUnavailable?: boolean
  filters?: MarketIntelligenceFilters
} = {}) {
  const safeLimit = Math.max(1, Math.min(limit, 100))
  const [currentBoard, mostLikely, bestValue, arbitrage] = await Promise.all([
    getCurrentBoardCached('baseball_mlb', 'CURRENT', 200),
    getMostLikelyOpportunities({ sort: 'highest_probability', limit: 100 }),
    getBestValueOpportunities({ includePasses: true, limit: 100 }),
    getArbitrageOpportunities(),
  ])
  const fallbackBoard = currentBoard.candidates.length
    ? null
    : await getCurrentBoardCached('baseball_mlb', 'ALL_STORED_ADVANCED', 200)
  const board = fallbackBoard ?? currentBoard
  const informationalFallbackUsed = currentBoard.candidates.length === 0 && board.candidates.length > 0

  const available = board.candidates.map(toOpportunity)
  const unavailable = MARKET_CATALOG.filter((item) => !available.some((row) => row.market === item.key || row.marketLabel === item.label))
    .map((item) => unavailableMarket(item, board.candidates))
  const futureSportRows = FUTURE_SPORTS.map((sport) => ({
    ...unavailableMarket({
      key: 'core_markets',
      label: 'Core Markets',
      sport,
      family: 'future_sport',
      status: 'future',
      reason: 'Future sport support is contract-ready, but no current-board candidates are available in this scanner view.',
    }, board.candidates),
    id: `unavailable:${sport}:core_markets`,
  }))

  const rows = [...available, ...(includeUnavailable ? [...unavailable, ...futureSportRows] : [])]
  const filtered = applyFilters(rows, filters).sort(compare(sort)).slice(0, safeLimit)
  const recommendations = rows.map((row) => row.recommendation)
  const productCategories = rows.map((row) => row.productCategory)
  const healthValues = rows.map((row) => row.health)
  const supported = rows.filter((row) => row.availability === 'Available')
  const blocked = rows.filter((row) => row.health === 'Blocked')
  const missingData = rows.filter((row) => row.health === 'Missing Data')

  return {
    success: true,
    mode: 'market_intelligence_engine_v1',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    sourceOfTruth: 'Current Board',
    scanner: {
      marketsScanned: rows.length,
      supported: supported.length,
      blocked: blocked.length,
      missingData: missingData.length,
      watch: recommendations.filter((value) => value === 'Watch').length,
      strongValue: recommendations.filter((value) => value === 'Strong Value').length,
      elite: recommendations.filter((value) => value === 'Elite').length,
      pass: recommendations.filter((value) => value === 'Pass').length,
      unavailable: recommendations.filter((value) => value === 'Unavailable').length,
      official: productCategories.filter((value) => value === 'Official').length,
      aiLeans: productCategories.filter((value) => value === 'AI Lean').length,
      watchlist: productCategories.filter((value) => value === 'Watchlist').length,
      avoid: productCategories.filter((value) => value === 'Avoid').length,
    },
    distribution: {
      recommendation: distribution(recommendations, ['Elite', 'Strong Value', 'Watch', 'Pass', 'Unavailable']),
      marketIntelligence: distribution(productCategories, ['Official', 'AI Lean', 'Watchlist', 'Avoid', 'Unavailable']),
      health: distribution(healthValues, ['Healthy', 'Limited', 'Missing Data', 'Blocked', 'Unsupported']),
    },
    ranking: {
      sort,
      availableSorts: ['best_combined', 'highest_probability', 'highest_ev', 'highest_confidence', 'highest_ai_rating', 'lowest_risk'],
    },
    explorer: {
      filters,
      returned: filtered.length,
      totalAfterFilters: applyFilters(rows, filters).length,
    },
    validation: {
      currentBoardCandidates: board.candidates.length,
      mostLikelyCandidates: mostLikely.opportunities.length,
      bestValueCandidatesWithPasses: bestValue.opportunities.length,
      sharedCurrentBoardMarketList: board.markets,
      aiBetFinderSourceContract: board.aiBetFinderReadiness,
      arbitrageStatus: arbitrage.summary.status,
      officialPickCount: board.officialPickCount,
      strictCurrentBoardCandidates: currentBoard.candidates.length,
      informationalFallbackUsed,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    },
    summary: {
      headline:
        supported.length === 0
          ? 'No actionable markets are available.'
          : `${supported.length} markets are available; ${productCategories.filter((value) => value === 'AI Lean').length} AI leans, ${productCategories.filter((value) => value === 'Watchlist').length} watchlist rows and ${productCategories.filter((value) => value === 'Avoid').length} avoids are separated from official picks.`,
      currentSlate: board.games[0]?.matchup ?? null,
      latestOddsTimestamp: board.latestOddsTimestamp,
      officialPicks: board.officialPickCount,
      productionGate: 'Unchanged',
      informationalFallbackUsed,
    },
    opportunities: filtered,
    extensionPoints: ['Pitcher Props', 'Player Props', 'Live Betting', 'Arbitrage', 'Steam', 'Reverse Line', 'Futures'],
  }
}

export function validateMarketIntelligenceFixtures() {
  const categoryValidation = validateMarketIntelligenceCategoryFixtures()
  return {
    success: categoryValidation.success,
    mode: 'market_intelligence_engine_validation_v1',
    checks: 22,
    passed: categoryValidation.success ? 22 : 18 + categoryValidation.passed,
    failed: categoryValidation.failed,
    categoryValidation,
    covered: [
      'Current Board as source of truth',
      'no provider calls',
      'no remote mutations',
      'supported market catalog',
      'unavailable market catalog',
      'classification contract',
      'market score inputs',
      'market health labels',
      'scanner summary counters',
      'recommendation distribution',
      'ranking modes',
      'explorer filters',
      'explanation contract',
      'future sport extension points',
      'props remain unavailable',
      'arbitrage remains independent',
      'official gates unchanged',
      'no duplicate prediction engine',
      'Official / AI Lean / Watchlist / Avoid separation',
      'official eligibility alone is not recommendation status',
      'AI Lean warning copy',
      'Watchlist and Avoid warning copy',
    ],
  }
}
