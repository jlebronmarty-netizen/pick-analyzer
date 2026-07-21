import 'server-only'

import type { CurrentBoardCandidate } from '@/services/current-board.service'
import type { OfficialPickContract } from '@/services/official-pick-experience.service'

export type MlbAiPicksFeedItemType =
  | 'OFFICIAL_PICK'
  | 'BEST_BET_TODAY'
  | 'BEST_VALUE'
  | 'MOST_LIKELY'
  | 'WATCH_CLOSELY'
  | 'HIDDEN_VALUE'
  | 'AVOID'
  | 'DATA_RISK'
  | 'MARKET_UPDATE'

export type MlbAiPicksFeedStatus = 'AVAILABLE' | 'EMPTY_VALID'

export type MlbAiPicksFeedItem = {
  id: string
  contractVersion: 'mlb_ai_picks_feed_item_v1'
  itemType: MlbAiPicksFeedItemType
  priority: number
  actionLabel: string
  predictionId: string
  eventId: string
  matchup: string
  scheduledTime: string | null
  market: CurrentBoardCandidate['market']
  marketLabel: string
  selection: string
  line: number | null
  americanOdds: number | null
  sportsbook: string
  modelProbability: number
  calibratedProbability: number | null
  impliedProbability: number
  marketImpliedProbability: number | null
  edgePercentagePoints: number | null
  expectedValuePercent: number | null
  confidence: number
  risk: string
  freshnessStatus: string
  marketAgeMinutes: number | null
  oddsSnapshotId: string | null
  featureSnapshotId: string | null
  predictionGeneratedAt: string | null
  recommendationGeneratedAt: string | null
  marketInputTimestamp: string | null
  marketFreshnessTimestamp: string | null
  marketFreshnessSource: CurrentBoardCandidate['marketFreshnessSource']
  marketAlignment: CurrentBoardCandidate['marketAlignment']
  recommendationExplanation: NonNullable<CurrentBoardCandidate['recommendationExplanation']>
  officialPick: OfficialPickContract | null
  evidence: string[]
  warnings: string[]
  blocker: string | null
  promotionCondition: string | null
}

export type MlbAiPicksFeed = {
  contractVersion: 'mlb_ai_picks_feed_v1'
  status: MlbAiPicksFeedStatus
  generatedAt: string
  sportKey: 'baseball_mlb'
  itemCount: number
  items: MlbAiPicksFeedItem[]
  emptyState: {
    headline: string
    summary: string
    topOpportunityRetained: boolean
  } | null
  summary: {
    candidatesScanned: number
    officialPickItems: number
    bestValueItems: number
    mostLikelyItems: number
    watchCloselyItems: number
    avoidItems: number
    dataRiskItems: number
    marketUpdateItems: number
  }
  guardrails: {
    providerCallsMade: 0
    remoteMutationsMade: 0
    officialPolicyChanged: false
    recommendationThresholdsChanged: false
    categoryAssignmentsChanged: false
    rankingsChanged: false
    fabricatedMarketMovement: false
  }
}

function round(value: number | null | undefined, digits = 2) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Number(parsed.toFixed(digits)) : null
}

function itemRisk(candidate: CurrentBoardCandidate) {
  if (candidate.stale || candidate.marketAlignment.freshnessStatus === 'STALE') return 'Elevated'
  if (candidate.anomalous || candidate.blockers.length || candidate.missingInformation.length >= 3) return 'Moderate'
  return 'Controlled'
}

function firstText(items: Array<{ label?: string; text?: string; value?: unknown } | undefined>) {
  for (const item of items) {
    if (!item) continue
    const label = String(item.label ?? item.text ?? '').trim()
    if (!label) continue
    const value = item.value === null || item.value === undefined || item.value === '' ? '' : `: ${item.value}`
    return `${label}${value}`
  }
  return null
}

function baseItem(
  candidate: CurrentBoardCandidate,
  itemType: MlbAiPicksFeedItemType,
  priority: number,
  actionLabel: string
): MlbAiPicksFeedItem | null {
  const explanation = candidate.recommendationExplanation
  if (!explanation) return null
  const alignment = candidate.marketAlignment
  const evidence = [
    explanation.headline,
    explanation.summary,
    firstText(explanation.primaryReasons ?? []),
    firstText(explanation.secondaryReasons ?? []),
  ].filter((value): value is string => Boolean(value))
  const warnings = [
    firstText(explanation.riskWarnings ?? []),
    candidate.stale ? 'Market input is stale.' : null,
    candidate.anomalous ? 'Market price or line requires anomaly review.' : null,
    ...candidate.missingInformation.slice(0, 3),
  ].filter((value): value is string => Boolean(value))
  return {
    id: `${itemType.toLowerCase()}-${candidate.predictionId}`,
    contractVersion: 'mlb_ai_picks_feed_item_v1',
    itemType,
    priority,
    actionLabel,
    predictionId: candidate.predictionId,
    eventId: candidate.eventId,
    matchup: candidate.matchup,
    scheduledTime: candidate.scheduledTime,
    market: candidate.market,
    marketLabel: candidate.marketLabel,
    selection: candidate.selection,
    line: candidate.line,
    americanOdds: candidate.americanOdds,
    sportsbook: candidate.sportsbook,
    modelProbability: candidate.rawProbability,
    calibratedProbability: candidate.calibratedProbability,
    impliedProbability: candidate.impliedProbability,
    marketImpliedProbability: round(alignment.marketImpliedProbability),
    edgePercentagePoints: round(alignment.edgePercentagePoints),
    expectedValuePercent: round(alignment.expectedValuePercent),
    confidence: candidate.confidence,
    risk: alignment.risk ?? itemRisk(candidate),
    freshnessStatus: alignment.freshnessStatus ?? 'UNKNOWN',
    marketAgeMinutes: round(alignment.marketAgeMinutes ?? candidate.marketInputAgeMinutes, 1),
    oddsSnapshotId: candidate.oddsSnapshotId,
    featureSnapshotId: candidate.snapshotId,
    predictionGeneratedAt: candidate.predictionGeneratedAt ?? null,
    recommendationGeneratedAt: candidate.recommendationGeneratedAt ?? null,
    marketInputTimestamp: candidate.marketInputTimestamp,
    marketFreshnessTimestamp: candidate.marketFreshnessTimestamp,
    marketFreshnessSource: candidate.marketFreshnessSource,
    marketAlignment: alignment,
    recommendationExplanation: explanation,
    officialPick: candidate.officialPick ?? null,
    evidence: evidence.slice(0, 5),
    warnings: warnings.slice(0, 5),
    blocker: firstText(explanation.blockers ?? []) ?? candidate.blockers[0] ?? null,
    promotionCondition: explanation.promotionConditions?.[0] ?? null,
  }
}

function probabilityRank(candidates: CurrentBoardCandidate[]) {
  return [...candidates].sort((left, right) =>
    right.rawProbability - left.rawProbability ||
    right.confidence - left.confidence ||
    right.reliabilityScore - left.reliabilityScore ||
    left.marketInputAgeMinutes - right.marketInputAgeMinutes
  )
}

function valueRank(candidates: CurrentBoardCandidate[]) {
  return [...candidates].sort((left, right) =>
    Number(right.expectedValue > 0 && right.edge > 0) - Number(left.expectedValue > 0 && left.edge > 0) ||
    right.expectedValue - left.expectedValue ||
    right.edge - left.edge ||
    right.confidence - left.confidence
  )
}

function isPositiveFreshAligned(candidate: CurrentBoardCandidate) {
  return (
    candidate.marketAlignment.alignmentStatus === 'ALIGNED' &&
    candidate.marketAlignment.freshnessStatus !== 'STALE' &&
    Number(candidate.marketAlignment.edgePercentagePoints ?? candidate.edge) > 0 &&
    Number(candidate.marketAlignment.expectedValuePercent ?? candidate.expectedValue) > 0
  )
}

function addUnique(items: MlbAiPicksFeedItem[], item: MlbAiPicksFeedItem | null) {
  if (!item) return
  if (items.some((existing) => existing.id === item.id)) return
  items.push(item)
}

export function buildMlbAiPicksFeed(candidates: CurrentBoardCandidate[], generatedAt = new Date().toISOString()): MlbAiPicksFeed {
  const eligible = candidates.filter((candidate) => (
    !['fallback', 'unavailable'].includes(candidate.probabilityOrigin) &&
    candidate.recommendationExplanation
  ))
  const items: MlbAiPicksFeedItem[] = []
  const official = eligible.filter((candidate) => candidate.officialPick)
  official.slice(0, 5).forEach((candidate, index) => {
    addUnique(items, baseItem(candidate, 'OFFICIAL_PICK', 10 + index, 'Official Pick'))
    addUnique(items, baseItem(candidate, 'BEST_BET_TODAY', 20 + index, 'Best Bet Today'))
  })

  valueRank(eligible.filter(isPositiveFreshAligned)).slice(0, 5).forEach((candidate, index) => {
    addUnique(items, baseItem(candidate, 'BEST_VALUE', 100 + index, 'Best Value'))
  })

  probabilityRank(eligible).slice(0, 5).forEach((candidate, index) => {
    addUnique(items, baseItem(candidate, 'MOST_LIKELY', 200 + index, 'Most Likely'))
  })

  valueRank(eligible.filter((candidate) => (
    isPositiveFreshAligned(candidate) &&
    !candidate.officialPick &&
    candidate.recommendationExplanation?.category !== 'avoid'
  ))).slice(0, 4).forEach((candidate, index) => {
    addUnique(items, baseItem(candidate, 'HIDDEN_VALUE', 300 + index, 'Hidden Value'))
  })

  eligible.filter((candidate) => candidate.recommendationExplanation?.category === 'watchlist').slice(0, 5).forEach((candidate, index) => {
    addUnique(items, baseItem(candidate, 'WATCH_CLOSELY', 400 + index, 'Watch Closely'))
  })

  eligible.filter((candidate) => candidate.recommendationExplanation?.category === 'avoid').slice(0, 5).forEach((candidate, index) => {
    addUnique(items, baseItem(candidate, 'AVOID', 500 + index, 'Avoid'))
  })

  eligible.filter((candidate) => (
    candidate.stale ||
    candidate.anomalous ||
    candidate.marketAlignment.freshnessStatus === 'STALE' ||
    candidate.marketAlignment.alignmentStatus !== 'ALIGNED'
  )).slice(0, 5).forEach((candidate, index) => {
    addUnique(items, baseItem(candidate, 'DATA_RISK', 600 + index, 'Data Risk'))
  })

  eligible.filter((candidate) => candidate.marketFreshnessTimestamp).slice(0, 3).forEach((candidate, index) => {
    addUnique(items, baseItem(candidate, 'MARKET_UPDATE', 700 + index, 'Market Update'))
  })

  items.sort((left, right) => left.priority - right.priority)
  const counts = (type: MlbAiPicksFeedItemType) => items.filter((item) => item.itemType === type).length
  return {
    contractVersion: 'mlb_ai_picks_feed_v1',
    status: items.length ? 'AVAILABLE' : 'EMPTY_VALID',
    generatedAt,
    sportKey: 'baseball_mlb',
    itemCount: items.length,
    items,
    emptyState: items.length
      ? null
      : {
          headline: 'No AI picks feed items are actionable right now.',
          summary: 'Stored Current Board candidates did not produce official, positive-value or risk-tracking feed items. No pick is promoted from an empty feed.',
          topOpportunityRetained: true,
        },
    summary: {
      candidatesScanned: eligible.length,
      officialPickItems: counts('OFFICIAL_PICK') + counts('BEST_BET_TODAY'),
      bestValueItems: counts('BEST_VALUE'),
      mostLikelyItems: counts('MOST_LIKELY'),
      watchCloselyItems: counts('WATCH_CLOSELY'),
      avoidItems: counts('AVOID'),
      dataRiskItems: counts('DATA_RISK'),
      marketUpdateItems: counts('MARKET_UPDATE'),
    },
    guardrails: {
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      officialPolicyChanged: false,
      recommendationThresholdsChanged: false,
      categoryAssignmentsChanged: false,
      rankingsChanged: false,
      fabricatedMarketMovement: false,
    },
  }
}

export function validateMlbAiPicksFeedFixtures() {
  const evidence = (
    code: string,
    label: string,
    value: string | number | null,
    severity: 'positive' | 'neutral' | 'warning' | 'negative',
    sourceField: string,
    text: string
  ) => ({ code, label, value, severity, sourceField, text })
  const explanation = {
    explanationVersion: 'recommendation_explanation_v1',
    category: 'watchlist' as const,
    headline: 'Price is worth monitoring.',
    summary: 'The model sees value, but official gates are not satisfied.',
    primaryReasons: [evidence('positive_ev', 'Positive expected value', '+4.1%', 'positive', 'marketAlignment.expectedValuePercent', 'Expected value is positive.')],
    secondaryReasons: [evidence('not_official', 'Not official', 'policy gate', 'warning', 'officialEligibility', 'Official policy did not qualify this candidate.')],
    blockers: [evidence('official_gate', 'Official gate', 'not qualified', 'warning', 'recommendationPolicyStatus', 'Official gate is not qualified.')],
    promotionConditions: ['Could improve if official policy gates are met with fresh aligned odds.'],
    riskWarnings: [],
    evidence: [],
    alignmentStatus: 'ALIGNED',
    freshnessStatus: 'FRESH',
    confidenceStatus: 'BELOW_OFFICIAL_THRESHOLD',
    valueStatus: 'POSITIVE_VALUE',
    actionLabel: 'Watchlist',
    fairOdds: -120,
    fairOddsLabel: 'Model fair odds -120',
    calculationVersion: 'recommendation_explanation_v1',
  }
  const candidate = {
    predictionId: 'prediction-1',
    snapshotId: 'feature-1',
    oddsSnapshotId: 'odds-1',
    eventId: 'event-1',
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    matchup: 'AWY @ HOM',
    scheduledTime: '2026-07-20T23:00:00.000Z',
    eventStatus: 'scheduled',
    market: 'moneyline',
    marketLabel: 'Moneyline',
    period: 'full_game',
    selection: 'HOM',
    normalizedSelection: 'home',
    line: null,
    sportsbook: 'Consensus',
    americanOdds: -110,
    impliedProbability: 52.38,
    oddsTimestamp: '2026-07-20T18:00:00.000Z',
    oddsAgeMinutes: 12,
    marketInputTimestamp: '2026-07-20T18:00:00.000Z',
    marketInputAgeMinutes: 12,
    marketFreshnessTimestamp: '2026-07-20T18:00:00.000Z',
    marketFreshnessSource: 'snapshot_ingested_at',
    marketSourceTimestamp: '2026-07-20T17:50:00.000Z',
    marketSourceAgeMinutes: 22,
    providerSourceUpdatedAt: '2026-07-20T17:50:00.000Z',
    providerFetchedAt: '2026-07-20T18:00:00.000Z',
    oddsIngestedAt: '2026-07-20T18:00:00.000Z',
    oddsSnapshotCreatedAt: '2026-07-20T18:00:01.000Z',
    marketAlignment: {
      alignmentStatus: 'ALIGNED',
      aligned: true,
      freshnessStatus: 'FRESH',
      eventId: 'event-1',
      predictionId: 'prediction-1',
      oddsSnapshotId: 'odds-1',
      marketType: 'moneyline',
      period: 'full_game',
      selection: 'HOM',
      normalizedSelection: 'home',
      line: null,
      oddsLine: null,
      sportsbook: 'Consensus',
      americanOdds: -110,
      decimalOdds: 1.91,
      modelProbability: 58,
      calibratedProbability: null,
      probabilityUsed: 58,
      marketImpliedProbability: 52.38,
      noVigProbability: null,
      edgePercentagePoints: 5.62,
      expectedValuePercent: 10.73,
      snapshotEdgePercentagePoints: 5.62,
      snapshotExpectedValuePercent: 10.73,
      actionableEdgePercentagePoints: 5.62,
      actionableExpectedValuePercent: 10.73,
      actionableUnavailableReason: null,
      marketInputTimestamp: '2026-07-20T18:00:00.000Z',
      providerSourceTimestamp: '2026-07-20T17:50:00.000Z',
      oddsIngestedAt: '2026-07-20T18:00:00.000Z',
      marketAgeMinutes: 12,
      providerSourceAgeMinutes: 22,
      snapshotIngestionAgeMinutes: 12,
      maxAllowedAgeMinutes: 30,
      confidence: 62,
      risk: 'CONTROLLED',
      recommendationCategory: 'ANALYZED_ONLY',
      calculationVersion: 'market_alignment_v1',
      reasonCodes: [],
    },
    recommendationExplanation: explanation,
    officialPick: null,
    maxAllowedAgeMinutes: 1440,
    cutoff: '2026-07-20T22:55:00.000Z',
    predictionGeneratedAt: '2026-07-20T18:01:00.000Z',
    recommendationGeneratedAt: '2026-07-20T18:01:00.000Z',
    pregameSafe: true,
    stale: false,
    anomalous: false,
    anomalyReasons: [],
    currentLatest: true,
    rawProbability: 58,
    calibratedProbability: null,
    confidence: 62,
    confidenceLabel: 'Medium',
    reliability: 'Good',
    reliabilityScore: 70,
    featureQuality: 78,
    dataSufficiency: 74,
    criticalDataCompleteness: 80,
    dataCompletenessLabel: 'STRONG',
    aiRating: 70,
    aiGrade: 'B',
    rankingScore: 190,
    modelVersion: 'fixture',
    featureSetVersion: 'fixture',
    calibrationStatus: 'probationary',
    edge: 5.62,
    expectedValue: 10.73,
    modeledValueStatus: 'MODELED_VALUE',
    semanticLabel: 'MODELED VALUE',
    probabilityOrigin: 'calculated',
    recommendationPolicyStatus: 'ANALYZED_ONLY',
    officialEligibility: 'NOT_OFFICIALLY_ELIGIBLE',
    blockers: ['official_policy_gate'],
    quarantined: true,
    trial: false,
    scrambled: false,
    productionEligible: false,
    leakageStatus: 'passed',
    boardLabel: 'CURRENT',
    positiveFactors: ['Positive expected value.'],
    negativeFactors: [],
    missingInformation: [],
    starterContext: null,
    pitcherContext: null,
    weatherContext: null,
    parkContext: null,
    summary: 'Fixture candidate.',
    logicalKey: 'baseball_mlb|event-1|moneyline|full_game|home',
  } as CurrentBoardCandidate
  const feed = buildMlbAiPicksFeed([candidate], '2026-07-20T18:02:00.000Z')
  const empty = buildMlbAiPicksFeed([], '2026-07-20T18:02:00.000Z')
  const checks = [
    ['feed contract version present', feed.contractVersion === 'mlb_ai_picks_feed_v1'],
    ['items are generated from current-board candidates', feed.summary.candidatesScanned === 1],
    ['positive aligned candidate creates best value item', feed.items.some((item) => item.itemType === 'BEST_VALUE')],
    ['positive aligned non-official candidate can be hidden value', feed.items.some((item) => item.itemType === 'HIDDEN_VALUE')],
    ['watchlist explanation creates watch closely item', feed.items.some((item) => item.itemType === 'WATCH_CLOSELY')],
    ['market update does not claim line movement', feed.items.some((item) => item.itemType === 'MARKET_UPDATE' && !item.evidence.join(' ').toLowerCase().includes('moved'))],
    ['official labels are absent without official contract', !feed.items.some((item) => item.itemType === 'OFFICIAL_PICK' || item.itemType === 'BEST_BET_TODAY')],
    ['market alignment is preserved', feed.items.every((item) => item.marketAlignment.calculationVersion === 'market_alignment_v1')],
    ['explanation is preserved', feed.items.every((item) => item.recommendationExplanation.explanationVersion === 'recommendation_explanation_v1')],
    ['odds lineage is attached', feed.items.every((item) => item.oddsSnapshotId === 'odds-1' && item.marketInputTimestamp === '2026-07-20T18:00:00.000Z')],
    ['provider calls remain zero', feed.guardrails.providerCallsMade === 0],
    ['remote mutations remain zero', feed.guardrails.remoteMutationsMade === 0],
    ['empty feed is valid', empty.status === 'EMPTY_VALID' && empty.emptyState !== null],
  ] as const
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failed.length === 0,
    mode: 'mlb_ai_picks_feed_validation_v1',
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
