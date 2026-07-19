import 'server-only'

import {
  getCurrentBoard,
  type CurrentBoardCandidate,
  type CurrentBoardResponse,
} from '@/services/current-board.service'
import {
  classifyMarketIntelligence,
  type MarketIntelligenceCategory,
  type MarketIntelligenceStatusLabel,
} from '@/services/market-intelligence-category.service'

type BestBetsLabel = 'BEST BETS TODAY' | 'BEST BETS TODAY - NOT RECOMMENDED'
type BestBetsMode = 'official_recommendations' | 'informational_not_recommended'

export type BestBetsTodayCandidate = {
  rank: number
  predictionId: string
  eventId: string
  matchup: string
  scheduledTime: string | null
  market: string
  marketLabel: string
  selection: string
  line: number | null
  sportsbook: string
  americanOdds: number | null
  modelProbability: number
  calibratedProbability: number | null
  probabilityUsed: number
  impliedProbability: number
  fairOdds: number | null
  edge: number
  expectedValue: number
  confidence: number
  reliabilityScore: number
  featureQuality: number | null
  dataSufficiency: number | null
  criticalDataCompleteness: number
  starterConfidence: number | null
  pitcherMismatch: number | null
  weatherRunEnvironment: string | null
  windSpeed: number | null
  stadiumId: string | null
  score: number
  scoreComponents: {
    probability: number
    value: number
    confidence: number
    dataQuality: number
    starterPitching: number
    marketFreshness: number
    reliability: number
    penalty: number
  }
  official: boolean
  marketIntelligenceCategory: MarketIntelligenceCategory
  productCategory: MarketIntelligenceStatusLabel
  productStatus: string
  statusColor: string
  statusWarning: string | null
  reasonNotOfficial: string | null
  officialEligibility: CurrentBoardCandidate['officialEligibility']
  recommendationPolicyStatus: string
  mode: BestBetsMode
  displayLabel: BestBetsLabel
  drivers: string[]
  riskFactors: string[]
  missingInformation: string[]
  blockers: string[]
  modelVersion: string
  featureSetVersion: string
  oddsTimestamp: string | null
}

export type BestBetsTodayResponse = {
  success: true
  mode: 'best_bets_today_engine_v1'
  generatedAt: string
  sportKey: string
  slateDate: string | null
  displayLabel: BestBetsLabel
  recommendationMode: BestBetsMode
  providerCallsMade: 0
  remoteMutationsMade: 0
  officialHistoryChanged: false
  predictionsRegenerated: false
  predictionRegenerationNote: string
  modelVersion: string
  featureSetVersion: string
  summary: {
    candidatesScanned: number
    currentBoardCandidates: number
    officialCandidateCount: number
    informationalCandidateCount: number
    returnedCount: number
    positiveValueCount: number
    latestOddsTimestamp: string | null
    dataFreshnessStatus: CurrentBoardResponse['dataFreshness']['status']
    officialPicksRemain: number
    scoringContract: string[]
  }
  topPick: BestBetsTodayCandidate | null
  officialBestBets: BestBetsTodayCandidate[]
  informationalBestBets: BestBetsTodayCandidate[]
  bestBets: BestBetsTodayCandidate[]
  bestValue: BestBetsTodayCandidate | null
  validationNotes: string[]
  guardrails: {
    llmUsed: false
    providerCallsMade: 0
    remoteMutationsMade: 0
    officialPolicyChanged: false
    recommendationThresholdsChanged: false
    settlementRun: false
    fabricatedData: false
  }
}

const OFFICIAL_STATUSES = new Set(['QUALIFIED', 'BEST_BET_CANDIDATE', 'PLAY_OF_DAY_CANDIDATE'])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function decimalToAmerican(decimal: number) {
  if (!Number.isFinite(decimal) || decimal <= 1) return null
  return Math.round(decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1))
}

function fairAmericanFromProbability(probabilityPercent: number) {
  const probability = probabilityPercent / 100
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return null
  return decimalToAmerican(1 / probability)
}

function starterConfidence(candidate: CurrentBoardCandidate) {
  return numberValue(asRecord(candidate.starterContext).starterConfidence)
}

function pitcherMismatch(candidate: CurrentBoardCandidate) {
  const context = asRecord(candidate.pitcherContext)
  const away = numberValue(asRecord(context.away).pitcherQuality)
  const home = numberValue(asRecord(context.home).pitcherQuality)
  if (away === null || home === null) return null
  const selection = candidate.selection.toLowerCase()
  const matchup = candidate.matchup.toLowerCase()
  const [awayName = '', homeName = ''] = matchup.split(' @ ')
  if (selection.includes(awayName)) return round(away - home)
  if (selection.includes(homeName)) return round(home - away)
  return round(Math.abs(away - home))
}

function dataScore(candidate: CurrentBoardCandidate) {
  const quality = candidate.featureQuality ?? 0
  const sufficiency = candidate.dataSufficiency ?? 0
  const critical = candidate.criticalDataCompleteness ?? 0
  return clamp(quality * 0.34 + sufficiency * 0.33 + critical * 0.33)
}

function valueScore(candidate: CurrentBoardCandidate) {
  const ev = clamp((candidate.expectedValue + 20) * 2.2)
  const edge = clamp((candidate.edge + 15) * 2.4)
  const positiveBonus = candidate.expectedValue > 0 && candidate.edge > 0 ? 15 : 0
  return clamp(ev * 0.45 + edge * 0.4 + positiveBonus)
}

function marketFreshnessScore(candidate: CurrentBoardCandidate) {
  if (!Number.isFinite(candidate.oddsAgeMinutes)) return 35
  const ageRatio = candidate.maxAllowedAgeMinutes > 0
    ? candidate.oddsAgeMinutes / candidate.maxAllowedAgeMinutes
    : 1
  return clamp(100 - ageRatio * 55)
}

function penaltyScore(candidate: CurrentBoardCandidate) {
  let penalty = 0
  if (candidate.expectedValue <= 0) penalty += 14
  if (candidate.edge <= 0) penalty += 12
  if (candidate.stale) penalty += 18
  if (candidate.anomalous) penalty += 20
  if (candidate.calibrationStatus.toLowerCase().includes('probation')) penalty += 10
  if (candidate.calibrationStatus.toLowerCase().includes('uncalibrated')) penalty += 18
  if (candidate.criticalDataCompleteness !== undefined && candidate.criticalDataCompleteness < 70) penalty += 12
  penalty += Math.min(20, candidate.blockers.length * 3)
  penalty += Math.min(14, candidate.missingInformation.length * 2)
  return clamp(penalty)
}

function drivers(candidate: CurrentBoardCandidate, score: BestBetsTodayCandidate['scoreComponents']) {
  const items: string[] = []
  if (candidate.expectedValue > 0 && candidate.edge > 0) items.push('Positive modeled edge and EV.')
  if (candidate.rawProbability >= 50) items.push('Above coin-flip model probability.')
  if ((candidate.calibratedProbability ?? 0) > 0) items.push('Calibrated probability is available.')
  if ((candidate.featureQuality ?? 0) >= 70) items.push('Feature quality is usable.')
  if ((candidate.dataSufficiency ?? 0) >= 70) items.push('Data sufficiency is usable.')
  if (starterConfidence(candidate) !== null) items.push('Verified starter context is attached.')
  if (asRecord(candidate.weatherContext).windSpeed !== undefined) items.push('Weather and wind context are attached.')
  if (asRecord(candidate.parkContext).stadiumId !== undefined) items.push('StadiumID context is attached.')
  if (score.marketFreshness >= 70) items.push('Selected odds are fresh enough for review.')
  return items.length ? items.slice(0, 7) : ['Ranked from stored Current Board model output.']
}

function risks(candidate: CurrentBoardCandidate) {
  const items = new Set<string>()
  if (candidate.expectedValue <= 0) items.add('Negative or zero expected value.')
  if (candidate.edge <= 0) items.add('Market price is not better than model probability.')
  if (candidate.officialEligibility !== 'OFFICIAL_ELIGIBLE_CANDIDATE') items.add('Not officially eligible.')
  if (!OFFICIAL_STATUSES.has(candidate.recommendationPolicyStatus)) items.add('Recommendation policy did not approve official status.')
  if (candidate.calibrationStatus.toLowerCase().includes('probation')) items.add('Calibration is still probationary.')
  if ((candidate.criticalDataCompleteness ?? 0) < 70) items.add('Critical input completeness is limited.')
  if (candidate.stale) items.add('Odds freshness is stale.')
  if (candidate.anomalous) items.add('Price or line needs anomaly review.')
  candidate.negativeFactors.slice(0, 4).forEach((item) => items.add(item))
  return Array.from(items).slice(0, 8)
}

function isOfficialBestBet(candidate: CurrentBoardCandidate) {
  return (
    !['fallback', 'unavailable'].includes(candidate.probabilityOrigin) &&
    candidate.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE' &&
    OFFICIAL_STATUSES.has(candidate.recommendationPolicyStatus) &&
    candidate.expectedValue > 0 &&
    candidate.edge > 0 &&
    !candidate.stale &&
    !candidate.anomalous
  )
}

function scoreCandidate(candidate: CurrentBoardCandidate) {
  const probabilityUsed = candidate.calibratedProbability ?? candidate.rawProbability
  const starter = starterConfidence(candidate)
  const components = {
    probability: clamp(probabilityUsed),
    value: valueScore(candidate),
    confidence: clamp(candidate.confidence),
    dataQuality: dataScore(candidate),
    starterPitching: starter === null ? 50 : clamp(starter),
    marketFreshness: marketFreshnessScore(candidate),
    reliability: clamp(candidate.reliabilityScore),
    penalty: penaltyScore(candidate),
  }
  const score = clamp(
    components.probability * 0.18 +
      components.value * 0.2 +
      components.confidence * 0.14 +
      components.dataQuality * 0.15 +
      components.starterPitching * 0.09 +
      components.marketFreshness * 0.09 +
      components.reliability * 0.15 -
      components.penalty * 0.42
  )
  return { score: round(score), components }
}

function toBestBetCandidate(
  candidate: CurrentBoardCandidate,
  rank: number,
  displayLabel: BestBetsLabel,
  mode: BestBetsMode
): BestBetsTodayCandidate {
  const scored = scoreCandidate(candidate)
  const weather = asRecord(candidate.weatherContext)
  const park = asRecord(candidate.parkContext)
  const pitcher = pitcherMismatch(candidate)
  const classification = classifyMarketIntelligence(candidate)
  const official = mode === 'official_recommendations'
  return {
    rank,
    predictionId: candidate.predictionId,
    eventId: candidate.eventId,
    matchup: candidate.matchup,
    scheduledTime: candidate.scheduledTime,
    market: candidate.market,
    marketLabel: candidate.marketLabel,
    selection: candidate.selection,
    line: candidate.line,
    sportsbook: candidate.sportsbook,
    americanOdds: candidate.americanOdds,
    modelProbability: candidate.rawProbability,
    calibratedProbability: candidate.calibratedProbability,
    probabilityUsed: candidate.calibratedProbability ?? candidate.rawProbability,
    impliedProbability: candidate.impliedProbability,
    fairOdds: fairAmericanFromProbability(candidate.calibratedProbability ?? candidate.rawProbability),
    edge: candidate.edge,
    expectedValue: candidate.expectedValue,
    confidence: candidate.confidence,
    reliabilityScore: candidate.reliabilityScore,
    featureQuality: candidate.featureQuality,
    dataSufficiency: candidate.dataSufficiency,
    criticalDataCompleteness: candidate.criticalDataCompleteness ?? 0,
    starterConfidence: starterConfidence(candidate),
    pitcherMismatch: pitcher,
    weatherRunEnvironment: typeof weather.runEnvironment === 'string' ? weather.runEnvironment : null,
    windSpeed: numberValue(weather.windSpeed),
    stadiumId: park.stadiumId === undefined || park.stadiumId === null ? null : String(park.stadiumId),
    score: scored.score,
    scoreComponents: scored.components,
    official,
    marketIntelligenceCategory: classification.category,
    productCategory: classification.label,
    productStatus: classification.display,
    statusColor: classification.color,
    statusWarning: official ? null : classification.warning,
    reasonNotOfficial: official ? null : classification.reasonNotOfficial,
    officialEligibility: candidate.officialEligibility,
    recommendationPolicyStatus: candidate.recommendationPolicyStatus,
    mode,
    displayLabel,
    drivers: drivers(candidate, scored.components),
    riskFactors: risks(candidate),
    missingInformation: candidate.missingInformation,
    blockers: candidate.blockers,
    modelVersion: candidate.modelVersion,
    featureSetVersion: candidate.featureSetVersion,
    oddsTimestamp: candidate.oddsTimestamp,
  }
}

function diversify(candidates: CurrentBoardCandidate[], limit: number) {
  const selected: CurrentBoardCandidate[] = []
  const seenEvents = new Set<string>()
  for (const candidate of candidates) {
    if (!seenEvents.has(candidate.eventId) || selected.length < 2) {
      selected.push(candidate)
      seenEvents.add(candidate.eventId)
    }
    if (selected.length >= limit) break
  }
  if (selected.length < limit) {
    for (const candidate of candidates) {
      if (!selected.some((item) => item.predictionId === candidate.predictionId)) selected.push(candidate)
      if (selected.length >= limit) break
    }
  }
  return selected
}

export function buildBestBetsTodayFromBoard(board: CurrentBoardResponse): BestBetsTodayResponse {
  const validCandidates = board.candidates.filter((candidate) => !['fallback', 'unavailable'].includes(candidate.probabilityOrigin))
  const ranked = [...validCandidates].sort((left, right) => {
    const leftScore = scoreCandidate(left).score
    const rightScore = scoreCandidate(right).score
    return (
      rightScore - leftScore ||
      right.expectedValue - left.expectedValue ||
      right.edge - left.edge ||
      right.rawProbability - left.rawProbability ||
      right.confidence - left.confidence
    )
  })
  const officialRanked = ranked.filter(isOfficialBestBet)
  const recommendationMode: BestBetsMode = officialRanked.length
    ? 'official_recommendations'
    : 'informational_not_recommended'
  const displayLabel: BestBetsLabel = officialRanked.length
    ? 'BEST BETS TODAY'
    : 'BEST BETS TODAY - NOT RECOMMENDED'
  const selectedSource = officialRanked.length ? officialRanked : ranked
  const bestBets = diversify(selectedSource, 5).map((candidate, index) =>
    toBestBetCandidate(candidate, index + 1, displayLabel, recommendationMode)
  )
  const officialBestBets = officialRanked.slice(0, 5).map((candidate, index) =>
    toBestBetCandidate(candidate, index + 1, 'BEST BETS TODAY', 'official_recommendations')
  )
  const informationalBestBets = ranked.slice(0, 5).map((candidate, index) =>
    toBestBetCandidate(candidate, index + 1, 'BEST BETS TODAY - NOT RECOMMENDED', 'informational_not_recommended')
  )
  const bestValueSource = [...ranked].filter((candidate) => candidate.expectedValue > 0 && candidate.edge > 0).sort((left, right) =>
    Number(right.expectedValue > 0 && right.edge > 0) - Number(left.expectedValue > 0 && left.edge > 0) ||
    right.expectedValue - left.expectedValue ||
    right.edge - left.edge
  )[0]

  return {
    success: true,
    mode: 'best_bets_today_engine_v1',
    generatedAt: new Date().toISOString(),
    sportKey: board.sportKey,
    slateDate: board.slateDate,
    displayLabel,
    recommendationMode,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    officialHistoryChanged: false,
    predictionsRegenerated: false,
    predictionRegenerationNote:
      'No safe current-slate regeneration path was invoked; rankings use the enriched Current Board V5 starter/weather/stadium context and preserve prediction history.',
    modelVersion: bestBets[0]?.modelVersion ?? ranked[0]?.modelVersion ?? 'unknown',
    featureSetVersion: bestBets[0]?.featureSetVersion ?? ranked[0]?.featureSetVersion ?? 'unknown',
    summary: {
      candidatesScanned: ranked.length,
      currentBoardCandidates: board.candidates.length,
      officialCandidateCount: officialBestBets.length,
      informationalCandidateCount: informationalBestBets.length,
      returnedCount: bestBets.length,
      positiveValueCount: validCandidates.filter((candidate) => candidate.expectedValue > 0 && candidate.edge > 0).length,
      latestOddsTimestamp: board.latestOddsTimestamp,
      dataFreshnessStatus: board.dataFreshness.status,
      officialPicksRemain: board.officialPickCount,
      scoringContract: [
        'probability is balanced with value, confidence and reliability',
        'positive edge and EV help but never override official gates',
        'starter, pitching, weather, wind and StadiumID context are consumed when attached',
        'odds freshness, data completeness, calibration and blockers reduce rank',
        'informational fallbacks are never labeled official',
      ],
    },
    topPick: bestBets[0] ?? null,
    officialBestBets,
    informationalBestBets,
    bestBets,
    bestValue: bestValueSource ? toBestBetCandidate(bestValueSource, 1, displayLabel, recommendationMode) : null,
    validationNotes: [
      'Read-only Current Board consumer.',
      'No provider endpoint is called.',
      'No settlement, policy, threshold or official-history mutation is performed.',
    ],
    guardrails: {
      llmUsed: false,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      officialPolicyChanged: false,
      recommendationThresholdsChanged: false,
      settlementRun: false,
      fabricatedData: false,
    },
  }
}

export async function getBestBetsToday({
  sportKey = 'baseball_mlb',
  limit = 200,
}: {
  sportKey?: string
  limit?: number
} = {}) {
  const board = await getCurrentBoard({ sportKey, mode: 'CURRENT', limit })
  return buildBestBetsTodayFromBoard(board)
}

export function validateBestBetsTodayFixtures() {
  const base = {
    predictionId: 'fixture-1',
    snapshotId: 'snapshot-1',
    oddsSnapshotId: 'odds-1',
    eventId: 'event-1',
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    matchup: 'AWY @ HOM',
    scheduledTime: '2026-07-17T23:00:00.000Z',
    eventStatus: 'scheduled',
    market: 'moneyline' as const,
    marketLabel: 'Moneyline',
    period: 'full_game',
    selection: 'HOM',
    normalizedSelection: 'home',
    line: null,
    sportsbook: 'Consensus',
    americanOdds: -120,
    impliedProbability: 54.55,
    oddsTimestamp: '2026-07-17T18:00:00.000Z',
    oddsAgeMinutes: 20,
    maxAllowedAgeMinutes: 1440,
    cutoff: null,
    pregameSafe: true,
    stale: false,
    anomalous: false,
    anomalyReasons: [],
    currentLatest: true,
    rawProbability: 58,
    calibratedProbability: 57,
    confidence: 63,
    confidenceLabel: 'Medium',
    reliability: 'Solid',
    reliabilityScore: 72,
    featureQuality: 74,
    dataSufficiency: 76,
    criticalDataCompleteness: 70,
    dataCompletenessLabel: 'MODERATE',
    aiRating: 68,
    aiGrade: 'C',
    rankingScore: 71,
    modelVersion: 'fixture_model_v5',
    featureSetVersion: 'fixture_features_v5',
    calibrationStatus: 'validated',
    edge: 2.45,
    expectedValue: 4.1,
    modeledValueStatus: 'MODELED_VALUE' as const,
    semanticLabel: 'MODELED VALUE' as const,
    probabilityOrigin: 'calculated' as const,
    recommendationPolicyStatus: 'ANALYZED_ONLY',
    officialEligibility: 'NOT_OFFICIALLY_ELIGIBLE' as const,
    blockers: ['fixture blocker'],
    quarantined: true,
    trial: false,
    scrambled: false,
    productionEligible: false,
    leakageStatus: 'passed' as const,
    boardLabel: 'CURRENT' as const,
    positiveFactors: ['Fixture positive value.'],
    negativeFactors: [],
    missingInformation: [],
    starterContext: { starterConfidence: 80 },
    pitcherContext: { away: { pitcherQuality: 55 }, home: { pitcherQuality: 64 } },
    weatherContext: { windSpeed: 8, runEnvironment: 'neutral' },
    parkContext: { stadiumId: '10' },
    summary: 'fixture',
    logicalKey: 'fixture',
  } satisfies CurrentBoardCandidate
  const board = {
    success: true,
    mode: 'current_board_intelligence_engine_v1',
    boardMode: 'CURRENT',
    generatedAt: '2026-07-17T18:30:00.000Z',
    sportKey: 'baseball_mlb',
    slateDate: '2026-07-17',
    operatingDate: '2026-07-17',
    timezone: 'America/Puerto_Rico',
    games: [],
    markets: ['Moneyline'],
    candidates: [base],
    latestOddsTimestamp: base.oddsTimestamp,
    dataFreshness: {
      status: 'fresh',
      latestOddsTimestamp: base.oddsTimestamp,
      latestOddsAgeMinutes: 20,
      maxAllowedAgeMinutes: 1440,
      nextRecommendedRefreshTime: null,
    },
    officialPickCount: 0,
    previewCount: 1,
    modeledValueCount: 1,
    watchCount: 0,
    qualifiedPreviewCount: 0,
    excludedRowSummary: {
      rowsBeforeFiltering: 1,
      rowsAfterFiltering: 1,
      uniqueRowsExcluded: 0,
      exclusionReasonCounts: {
        HISTORICAL: 0,
        SETTLED: 0,
        EVENT_STARTED: 0,
        EVENT_COMPLETED: 0,
        LEGACY_UNLINKED: 0,
        FIXTURE: 0,
        SUPERSEDED: 0,
        STALE_ODDS: 0,
        POST_CUTOFF_ODDS: 0,
        LIVE_ODDS: 0,
        ALTERNATE_MARKET: 0,
        UNSUPPORTED_MARKET: 0,
        INVALID_PRICE: 0,
        INVALID_LINE: 0,
        DUPLICATE: 0,
        MISSING_EVENT: 0,
        MISSING_SNAPSHOT: 0,
        LEAKAGE_RISK: 0,
      },
      duplicateRowsRemoved: 0,
      supersededRowsExcluded: 0,
    },
    boardHealth: { status: 'READY', warnings: [], providerCallsMade: 0, remoteMutationsMade: 0 },
    bestValueReadiness: { rankingContract: [], candidates: [] },
    aiBetFinderReadiness: {
      contract: 'ai_bet_finder_readiness_v1',
      sources: [],
      llmUsed: false,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    },
  } satisfies CurrentBoardResponse
  const response = buildBestBetsTodayFromBoard(board)
  const checks = [
    ['informational fallback is not official', response.recommendationMode === 'informational_not_recommended' && response.topPick?.official === false],
    ['provider calls remain zero', response.providerCallsMade === 0 && response.guardrails.providerCallsMade === 0],
    ['value and probability both contribute', (response.topPick?.scoreComponents.value ?? 0) > 0 && (response.topPick?.scoreComponents.probability ?? 0) > 0],
    ['starter weather stadium context is surfaced', response.topPick?.starterConfidence === 80 && response.topPick?.windSpeed === 8 && response.topPick?.stadiumId === '10'],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'best_bets_today_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}
