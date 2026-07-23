import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentBoardCached, mapLegacyBoardMode, type CurrentBoardCandidate } from '@/services/current-board.service'
import { classifyMarketIntelligence } from '@/services/market-intelligence-category.service'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'
import { getModelOnlyIntelligence } from '@/services/model-only-intelligence.service'

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  team: string | null
  opponent: string | null
  market: string | null
  sportsbook: string | null
  odds: number | null
  implied_probability: number | null
  model_probability: number | null
  edge: number | null
  ev: number | null
  confidence: number | null
  line: number | null
  odds_timestamp: string | null
  generated_at: string | null
  cutoff_at: string | null
  model_version: string | null
  feature_snapshot_id: string | null
  feature_set_version: string | null
  validation_status: string | null
  lifecycle_status: string | null
  status: string | null
  result: string | null
  production_eligible: boolean | null
  recommended_pick: boolean | null
  feature_snapshot: Record<string, unknown> | null
  validation_warnings: unknown
  skip_reason: string | null
}

type OddsRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  event_id: string
  provider: string | null
  sportsbook: string | null
  market: string | null
  outcome: string | null
  price: number | null
  line: number | null
  snapshot_time: string | null
  metadata: Record<string, unknown> | null
}

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
}

type SortMode =
  | 'highest_probability'
  | 'best_value'
  | 'best_combined'
  | 'lowest_risk'
  | 'highest_confidence'
  | 'newest_odds'

type BoardMode =
  | 'current_board'
  | 'upcoming'
  | 'historical_explorer'
  | 'all_stored_data'

type MostLikelyCard = ReturnType<typeof toMostLikelyCard>

type SelectionAudit = {
  rowsBeforeFiltering: number
  rowsAfterMarketFilter: number
  rowsAfterModeFilter: number
  historicalExcluded: number
  settledExcluded: number
  fixtureExcluded: number
  legacyUnlinkedExcluded: number
  staleExcluded: number
  supersededExcluded: number
  liveAlternateExcluded: number
  afterStartExcluded: number
  invalidOddsExcluded: number
  extremeOddsFlagged: number
  duplicatesRemoved: number
  staleOrHistoricalRowsExcluded: number
  anomalousOddsExcluded: number
}

const SUPPORTED_MOST_LIKELY_MARKETS = ['moneyline', 'spread', 'total'] as const
const CURRENT_ODDS_STALE_MINUTES = 24 * 60
const HISTORICAL_ODDS_STALE_MINUTES = 45 * 24 * 60
const EXTREME_AMERICAN_ODDS = 1000
const MAX_VALID_AMERICAN_ODDS = 5000

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function chunks<T>(values: T[], size = 100) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function americanToDecimal(odds: number) {
  if (!Number.isFinite(odds) || odds === 0) return 1
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
}

function decimalToAmerican(decimal: number) {
  if (!Number.isFinite(decimal) || decimal <= 1) return null
  return Math.round(decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1))
}

function impliedFromAmerican(odds: number) {
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
}

function fairAmericanFromProbability(probabilityPercent: number) {
  const probability = probabilityPercent / 100
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return null
  const decimal = 1 / probability
  return decimalToAmerican(decimal)
}

function ageMinutes(value: string | null | undefined, now = Date.now()) {
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.round((now - parsed) / 60000))
}

function qualityLabel(value: number | null) {
  if (value === null) return 'Unknown'
  if (value >= 80) return 'Excellent'
  if (value >= 70) return 'Good'
  if (value >= 55) return 'Limited'
  return 'Weak'
}

function marketLabel(value: string | null) {
  if (value === 'moneyline') return 'Moneyline'
  if (value === 'spread' || value === 'run_line') return 'Run Line'
  if (value === 'total') return 'Total'
  return value ?? 'Market'
}

function canonicalPredictionMarket(value: string | null) {
  if (value === 'run_line') return 'spread'
  return String(value ?? 'unknown')
}

function canonicalOddsMarket(value: string | null) {
  if (value === 'spread') return 'run_line'
  return String(value ?? 'unknown')
}

function marketPeriod(row: PredictionRow | OddsRow) {
  const metadata = 'metadata' in row ? asRecord(row.metadata) : asRecord(row.feature_snapshot)
  return String(metadata.marketPeriod ?? metadata.period ?? 'full_game')
}

function selectionLabel(row: PredictionRow) {
  return row.team ?? row.opponent ?? 'Selection'
}

function normalizedSelection(row: PredictionRow) {
  const selection = selectionLabel(row).toLowerCase()
  if (String(row.market) === 'total') {
    if (selection.includes('under')) return 'under'
    if (selection.includes('over')) return 'over'
  }
  if (row.home_team && selection === row.home_team.toLowerCase()) return 'home'
  if (row.away_team && selection === row.away_team.toLowerCase()) return 'away'
  if (selection === 'home' || selection === 'away' || selection === 'over' || selection === 'under') return selection
  return selection
}

function isFutureUnstarted(row: PredictionRow, event: EventRow | undefined, nowMs: number) {
  const startTime = event?.start_time ?? row.commence_time
  const startMs = startTime ? new Date(startTime).getTime() : Number.NaN
  const eventStatus = String(event?.status ?? row.status ?? '').toLowerCase()
  const rowResult = String(row.result ?? '').toLowerCase()
  const lifecycle = String(row.lifecycle_status ?? '').toLowerCase()
  if (!Number.isFinite(startMs) || startMs <= nowMs) return false
  if (['live', 'in_progress', 'completed', 'final', 'closed', 'cancelled', 'postponed'].includes(eventStatus)) return false
  if (['win', 'loss', 'push', 'void'].includes(rowResult)) return false
  if (['settled', 'void', 'closed'].includes(lifecycle)) return false
  return true
}

function isHistoricalRow(row: PredictionRow, event: EventRow | undefined, nowMs: number) {
  return !isFutureUnstarted(row, event, nowMs)
}

function calibrationStatus(row: PredictionRow, snapshot: Record<string, unknown>) {
  return String(snapshot.calibrationStatus ?? snapshot.calibration_status ?? row.validation_status ?? 'probationary')
}

function boardLabel(row: PredictionRow, event: EventRow | undefined, nowMs: number) {
  const snapshot = asRecord(row.feature_snapshot)
  if (isHistoricalRow(row, event, nowMs)) return 'HISTORICAL'
  if (snapshot.prospective_preview === true) return 'PREVIEW'
  return 'CURRENT'
}

function safeOddsIssues(row: OddsRow, startTime: string | null | undefined, cutoffAt: string | null | undefined, nowMs: number) {
  const metadata = asRecord(row.metadata)
  const issues: string[] = []
  const price = Number(row.price)
  const snapshotMs = row.snapshot_time ? new Date(row.snapshot_time).getTime() : Number.NaN
  const startMs = startTime ? new Date(startTime).getTime() : Number.NaN
  const cutoffMs = cutoffAt ? new Date(cutoffAt).getTime() : Number.POSITIVE_INFINITY
  if (!Number.isFinite(price) || price === 0 || Math.abs(price) > MAX_VALID_AMERICAN_ODDS) issues.push('invalid_american_odds')
  if (Number.isFinite(price) && Math.abs(price) > EXTREME_AMERICAN_ODDS) issues.push('extreme_price_review')
  if (!row.snapshot_time || !Number.isFinite(snapshotMs)) issues.push('missing_odds_timestamp')
  if (Number.isFinite(startMs) && Number.isFinite(snapshotMs) && snapshotMs >= startMs) issues.push('at_or_after_start_odds')
  if (Number.isFinite(cutoffMs) && Number.isFinite(snapshotMs) && snapshotMs > cutoffMs) issues.push('after_prediction_cutoff_odds')
  if (metadata.isLive === true || metadata.live === true || metadata.marketType === 'live') issues.push('live_contamination')
  if (metadata.isAlternate === true || metadata.alternate === true || String(metadata.marketType ?? '').toLowerCase().includes('alternate')) {
    issues.push('alternate_contamination')
  }
  if (ageMinutes(row.snapshot_time, nowMs) > CURRENT_ODDS_STALE_MINUTES) issues.push('stale_odds')
  return issues
}

function safePredictionOddsIssues(
  row: PredictionRow,
  event: EventRow | undefined,
  nowMs: number,
  mode: BoardMode
) {
  const issues: string[] = []
  const price = Number(row.odds)
  const snapshotMs = row.odds_timestamp ? new Date(row.odds_timestamp).getTime() : Number.NaN
  const startTime = event?.start_time ?? row.commence_time
  const startMs = startTime ? new Date(startTime).getTime() : Number.NaN
  const cutoffMs = row.cutoff_at ? new Date(row.cutoff_at).getTime() : Number.POSITIVE_INFINITY
  const freshnessLimit = mode === 'historical_explorer' || mode === 'all_stored_data'
    ? HISTORICAL_ODDS_STALE_MINUTES
    : CURRENT_ODDS_STALE_MINUTES
  if (!Number.isFinite(price) || price === 0 || Math.abs(price) > MAX_VALID_AMERICAN_ODDS) issues.push('invalid_american_odds')
  if (Number.isFinite(price) && Math.abs(price) > EXTREME_AMERICAN_ODDS) issues.push('extreme_price_review')
  if (!row.odds_timestamp || !Number.isFinite(snapshotMs)) issues.push('missing_odds_timestamp')
  if (Number.isFinite(startMs) && Number.isFinite(snapshotMs) && snapshotMs >= startMs) issues.push('at_or_after_start_odds')
  if (Number.isFinite(cutoffMs) && Number.isFinite(snapshotMs) && snapshotMs > cutoffMs) issues.push('after_prediction_cutoff_odds')
  if (ageMinutes(row.odds_timestamp, nowMs) > freshnessLimit) issues.push('stale_odds')
  return issues
}

function oddsMatchesPrediction(odds: OddsRow, row: PredictionRow) {
  if (canonicalOddsMarket(row.market) !== canonicalOddsMarket(odds.market)) return false
  const oddsOutcome = String(odds.outcome ?? '').toLowerCase()
  const normalized = normalizedSelection(row)
  const selection = selectionLabel(row).toLowerCase()
  if (oddsOutcome !== normalized && oddsOutcome !== selection) return false
  const predictionLine = numberValue(row.line)
  const oddsLine = numberValue(odds.line)
  if (canonicalPredictionMarket(row.market) === 'moneyline') return oddsLine === null
  if (predictionLine === null || oddsLine === null) return false
  return Math.abs(predictionLine - oddsLine) < 0.001
}

function latestSafeOddsForPrediction(
  row: PredictionRow,
  oddsRows: OddsRow[],
  event: EventRow | undefined,
  nowMs: number,
  mode: BoardMode
) {
  const startTime = event?.start_time ?? row.commence_time
  const freshnessLimit = mode === 'historical_explorer' || mode === 'all_stored_data'
    ? HISTORICAL_ODDS_STALE_MINUTES
    : CURRENT_ODDS_STALE_MINUTES
  const candidates = oddsRows
    .filter((odds) => odds.event_id === row.game_id)
    .filter((odds) => oddsMatchesPrediction(odds, row))
    .map((odds) => ({
      odds,
      issues: safeOddsIssues(odds, startTime, row.cutoff_at, nowMs),
    }))
    .filter(({ issues }) => !issues.some((issue) => issue !== 'extreme_price_review' && issue !== 'stale_odds'))
    .filter(({ odds }) => ageMinutes(odds.snapshot_time, nowMs) <= freshnessLimit)
    .sort((left, right) => new Date(String(right.odds.snapshot_time)).getTime() - new Date(String(left.odds.snapshot_time)).getTime())

  return candidates[0] ?? null
}

function displayEv(modelProbability: number, americanOdds: number) {
  const probability = modelProbability / 100
  const decimal = americanToDecimal(americanOdds)
  return round((probability * (decimal - 1) - (1 - probability)) * 100)
}

function semanticSummary({
  edge,
  ev,
  productionEligible,
  calibration,
  stale,
  quarantined,
}: {
  edge: number
  ev: number
  productionEligible: boolean
  calibration: string
  stale: boolean
  quarantined: boolean
}) {
  if (stale) return 'STALE'
  if (calibration.toLowerCase().includes('uncalibrated')) return 'UNCALIBRATED'
  if (edge > 0 && ev > 0) return 'MODELED VALUE'
  if (edge <= 0 || ev <= 0) return 'NO MODELED VALUE'
  if (!productionEligible) return quarantined ? 'QUARANTINED' : 'NOT OFFICIALLY ELIGIBLE'
  return 'NO MODELED VALUE'
}

function combinedScore(row: PredictionRow, snapshot: Record<string, unknown>) {
  const probability = numberValue(row.model_probability) ?? 0
  const confidence = numberValue(row.confidence) ?? 0
  const reliability = numberValue(snapshot.reliabilityScore) ?? 45
  const ai = numberValue(snapshot.aiRating) ?? 45
  const edge = Math.max(0, numberValue(row.edge) ?? 0)
  return round(probability * 0.34 + confidence * 0.22 + reliability * 0.18 + ai * 0.16 + edge * 1.2)
}

function compareOpportunity(sort: SortMode) {
  return (left: MostLikelyCard, right: MostLikelyCard) => {
    if (sort === 'best_value') return right.edge - left.edge || right.expectedValue - left.expectedValue
    if (sort === 'best_combined') return right.combinedScore - left.combinedScore
    if (sort === 'lowest_risk') return right.reliabilityScore - left.reliabilityScore || right.confidence - left.confidence
    if (sort === 'highest_confidence') return right.confidence - left.confidence
    if (sort === 'newest_odds') {
      return new Date(right.oddsTimestamp ?? 0).getTime() - new Date(left.oddsTimestamp ?? 0).getTime()
    }
    return right.probability - left.probability
  }
}

function compareCurrentBoardOpportunity(sort: SortMode) {
  return (left: ReturnType<typeof currentBoardCandidateToMostLikelyCard>, right: ReturnType<typeof currentBoardCandidateToMostLikelyCard>) => {
    if (sort === 'best_value') return right.edge - left.edge || right.expectedValue - left.expectedValue
    if (sort === 'best_combined') return right.combinedScore - left.combinedScore
    if (sort === 'lowest_risk') return right.reliabilityScore - left.reliabilityScore || right.confidence - left.confidence
    if (sort === 'highest_confidence') return right.confidence - left.confidence
    if (sort === 'newest_odds') return new Date(right.oddsTimestamp ?? 0).getTime() - new Date(left.oddsTimestamp ?? 0).getTime()
    return right.probability - left.probability || right.confidence - left.confidence || right.reliabilityScore - left.reliabilityScore || right.aiRating - left.aiRating
  }
}

function complementSelection(candidate: CurrentBoardCandidate) {
  if (candidate.market === 'total') {
    return candidate.selection.toLowerCase().includes('under') ? 'Over' : 'Under'
  }
  const [away = 'Away', home = 'Home'] = candidate.matchup.split(' @ ')
  const selection = candidate.selection.toLowerCase()
  if (selection === away.toLowerCase() || selection === 'away') return home
  if (selection === home.toLowerCase() || selection === 'home') return away
  return `Not ${candidate.selection}`
}

function mostLikelyOutcome(candidate: CurrentBoardCandidate) {
  const selectedProbability = Math.max(0, Math.min(100, Number(candidate.rawProbability ?? 0)))
  const complementProbability = Math.max(0, Math.min(100, 100 - selectedProbability))
  const complementIsMoreLikely = complementProbability > selectedProbability
  return {
    selectedProbability: round(selectedProbability),
    complementProbability: round(complementProbability),
    displayedProbability: round(Math.max(selectedProbability, complementProbability)),
    displayedSelection: complementIsMoreLikely ? complementSelection(candidate) : candidate.selection,
    displayedLine: complementIsMoreLikely && candidate.line !== null ? -candidate.line : candidate.line,
    complementDerived: complementIsMoreLikely,
    probabilitySemantic: complementIsMoreLikely
      ? 'Derived complement probability from the stored binary selected-side probability.'
      : 'Stored selected-side probability.',
  }
}

function currentBoardCandidateToMostLikelyCard(candidate: CurrentBoardCandidate) {
  const official = candidate.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE'
  const classification = classifyMarketIntelligence(candidate)
  const reasonNotOfficial = official
    ? null
    : classification.reasonNotOfficial
  const likely = mostLikelyOutcome(candidate)
  return {
    id: candidate.predictionId,
    sportKey: candidate.sportKey,
    matchup: candidate.matchup,
    eventId: candidate.eventId,
    startTime: candidate.scheduledTime,
    eventStatus: candidate.eventStatus,
    market: candidate.market,
    marketLabel: candidate.marketLabel,
    period: candidate.period,
    selection: likely.displayedSelection,
    sourceSelection: candidate.selection,
    line: likely.displayedLine,
    sourceLine: candidate.line,
    odds: likely.complementDerived ? null : candidate.americanOdds,
    sourceOdds: candidate.americanOdds,
    sportsbook: candidate.sportsbook,
    probability: likely.displayedProbability,
    selectedSideProbability: likely.selectedProbability,
    complementProbability: likely.complementProbability,
    complementDerived: likely.complementDerived,
    probabilitySemantic: likely.probabilitySemantic,
    sportsbookProbability: candidate.impliedProbability,
    edge: candidate.edge,
    expectedValue: candidate.expectedValue,
    snapshotEdge: candidate.marketAlignment.snapshotEdgePercentagePoints,
    snapshotExpectedValue: candidate.marketAlignment.snapshotExpectedValuePercent,
    actionableEdge: candidate.marketAlignment.actionableEdgePercentagePoints,
    actionableExpectedValue: candidate.marketAlignment.actionableExpectedValuePercent,
    actionableUnavailableReason: candidate.marketAlignment.actionableUnavailableReason,
    confidence: candidate.confidence,
    confidenceLabel: candidate.confidenceLabel,
    reliability: candidate.reliability,
    reliabilityScore: candidate.reliabilityScore,
    aiRating: candidate.aiRating,
    aiGrade: candidate.aiGrade,
    combinedScore: round(
      likely.displayedProbability * 0.34 +
        candidate.confidence * 0.22 +
        candidate.reliabilityScore * 0.18 +
        candidate.aiRating * 0.16 +
        Math.max(0, candidate.edge) * 1.2
    ),
    recommendation: candidate.semanticLabel,
    recommendationStatus: candidate.recommendationPolicyStatus,
    semanticLabel: candidate.semanticLabel,
    probabilityOrigin: candidate.probabilityOrigin,
    officialEligibility:
      official
        ? 'ELIGIBLE_FOR_OFFICIAL_REVIEW'
        : 'NOT OFFICIALLY ELIGIBLE',
    marketIntelligenceCategory: classification.category,
    canonicalMarketState: classification.canonicalState,
    marketValueQuality: classification.valueQuality,
    marketFreshnessState: classification.freshnessState,
    primaryBlocker: classification.primaryBlocker,
    improvementPath: classification.improvementPath,
    opportunityCategory: classification.label,
    statusLabel: classification.display,
    informationalWarning: official
      ? null
      : classification.warning,
    reasonNotOfficial,
    strengths: classification.strengths,
    weaknesses: classification.weaknesses,
    calibrationStatus: candidate.calibrationStatus,
    modelVersion: candidate.modelVersion,
    featureSetVersion: candidate.featureSetVersion,
    boardLabel: candidate.boardLabel,
    currentHistoricalPreviewLabel: candidate.boardLabel,
    why: candidate.summary,
    warnings: [
      ...candidate.negativeFactors.slice(0, 2),
      ...(candidate.blockers.includes('NON_POSITIVE_EDGE') || candidate.blockers.includes('LOW_EV')
        ? ['High probability does not always mean good betting value.']
        : []),
    ],
    blockers: candidate.blockers,
    missingData: candidate.missingInformation,
    featureQuality: candidate.featureQuality,
    dataSufficiency: candidate.dataSufficiency,
    criticalDataCompleteness: candidate.criticalDataCompleteness ?? null,
    fairOdds: fairAmericanFromProbability(likely.displayedProbability),
    actionability:
      official
        ? 'official_review_candidate'
        : candidate.expectedValue > 0
          ? 'preview_value_only_not_official'
          : 'informational_probability_only',
    explanation: {
      primaryDrivers: candidate.positiveFactors.slice(0, 3),
      secondaryContext: candidate.summary ? [candidate.summary] : [],
      missingData: candidate.missingInformation,
      recommendationBlockers: candidate.blockers,
      probabilityVsValue:
        'Most Likely ranks binary outcome probability. Betting value still requires aligned odds, positive edge and positive EV.',
    },
    oddsTimestamp: candidate.oddsTimestamp,
    oddsAgeMinutes: candidate.oddsAgeMinutes,
    storedOddsTimestamp: candidate.oddsTimestamp,
    marketInputTimestamp: candidate.marketInputTimestamp,
    marketInputAgeMinutes: candidate.marketInputAgeMinutes,
    marketFreshnessTimestamp: candidate.marketFreshnessTimestamp,
    marketFreshnessSource: candidate.marketFreshnessSource,
    marketSourceTimestamp: candidate.marketSourceTimestamp,
    marketSourceAgeMinutes: candidate.marketSourceAgeMinutes,
    providerSourceUpdatedAt: candidate.providerSourceUpdatedAt,
    providerFetchedAt: candidate.providerFetchedAt,
    oddsIngestedAt: candidate.oddsIngestedAt,
    oddsSnapshotCreatedAt: candidate.oddsSnapshotCreatedAt,
    marketAlignment: candidate.marketAlignment,
    recommendationExplanation: candidate.recommendationExplanation,
    selectedOddsSnapshotId: candidate.oddsSnapshotId,
    selectedOddsSource: candidate.oddsSnapshotId ? 'sports_odds_snapshots' : 'prediction_history_offered_price',
    anomalies: candidate.anomalyReasons,
    productionEligible: candidate.productionEligible,
    independentTool: true,
  }
}

type CanonicalProbabilityCard = ReturnType<typeof currentBoardCandidateToMostLikelyCard>

function modelOnlyOutcomeToMostLikelyCard(outcome: any): CanonicalProbabilityCard {
  const probability = round(Number(outcome.modelProbability ?? outcome.probability ?? 0))
  const confidence = round(Number(outcome.confidence ?? 0))
  const market = String(outcome.market ?? 'unknown')
  const marketLabelValue = String(outcome.marketLabel ?? marketLabel(market))
  return ({
    id: String(outcome.id ?? `${outcome.eventId ?? 'model'}:${market}:${outcome.selection ?? 'selection'}`),
    sportKey: String(outcome.sportKey ?? 'baseball_mlb'),
    matchup: String(outcome.matchup ?? 'Matchup pending'),
    eventId: String(outcome.eventId ?? ''),
    startTime: outcome.startTime ?? null,
    eventStatus: String(outcome.eventStatus ?? 'scheduled'),
    market,
    marketLabel: marketLabelValue,
    period: 'full_game',
    selection: String(outcome.selection ?? 'Selection pending'),
    sourceSelection: String(outcome.selection ?? 'Selection pending'),
    line: outcome.line ?? null,
    sourceLine: outcome.line ?? null,
    odds: outcome.sportsbookOdds ?? outcome.odds ?? null,
    sourceOdds: outcome.sportsbookOdds ?? outcome.odds ?? null,
    sportsbook: String(outcome.sportsbook ?? 'Stored model output'),
    probability,
    selectedSideProbability: probability,
    complementProbability: round(100 - probability),
    complementDerived: false,
    probabilitySemantic: 'Stored model-only pregame probability. Betting value still requires current market odds.',
    sportsbookProbability: Number(outcome.impliedProbability ?? outcome.sportsbookProbability ?? 0) || 0,
    edge: 0,
    expectedValue: 0,
    snapshotEdge: null,
    snapshotExpectedValue: null,
    actionableEdge: null,
    actionableExpectedValue: null,
    actionableUnavailableReason: 'Current market odds are required before EV can be treated as actionable.',
    confidence,
    confidenceLabel: confidence >= 70 ? 'High' : confidence >= 50 ? 'Moderate' : 'Limited',
    reliability: 'Informational',
    reliabilityScore: Math.max(0, Math.min(100, confidence)),
    aiRating: Math.max(0, Math.min(100, round((probability * 0.65) + (confidence * 0.35)))),
    aiGrade: 'INFO',
    combinedScore: round((probability * 0.7) + (confidence * 0.3)),
    recommendation: 'NO MODELED VALUE',
    recommendationStatus: 'MODEL_ONLY',
    semanticLabel: 'Model Only',
    probabilityOrigin: 'model_only',
    officialEligibility: 'NOT OFFICIALLY ELIGIBLE',
    marketIntelligenceCategory: 'model_only',
    canonicalMarketState: 'model_only',
    marketValueQuality: 'EV unavailable',
    marketFreshnessState: outcome.marketAvailable ? 'stored odds attached' : 'waiting for sportsbook odds',
    primaryBlocker: outcome.marketAvailable ? 'No Official Pick from this informational surface.' : 'Waiting for sportsbook odds.',
    improvementPath: 'Refresh market odds, then re-run Current Board value gates.',
    opportunityCategory: 'Model Only',
    statusLabel: outcome.marketAvailable ? 'Model Probability' : 'Waiting for Sportsbook Odds',
    informationalWarning: 'Informational probability only. This is not an Official Pick and has no stake.',
    reasonNotOfficial: 'Model-only rows do not pass through the Official Pick value and market freshness gates.',
    strengths: ['Stored model probability is available.'],
    weaknesses: outcome.marketAvailable ? ['EV is not computed on the model-only surface.'] : ['Current sportsbook odds are not attached yet.'],
    calibrationStatus: 'model_only',
    modelVersion: String(outcome.modelVersion ?? 'unknown'),
    featureSetVersion: 'model_only',
    boardLabel: 'MODEL ONLY',
    currentHistoricalPreviewLabel: 'Model Only',
    why: 'Stored model probability is available while Current Board waits for safe current market data.',
    warnings: ['Model-only probability is not a betting recommendation.'],
    blockers: outcome.blockers ?? ['NO_OFFICIAL_PICK', 'CURRENT_MARKET_REQUIRED_FOR_EV'],
    missingData: outcome.marketAvailable ? [] : ['Current sportsbook odds'],
    featureQuality: outcome.featureQuality ?? null,
    dataSufficiency: outcome.dataSufficiency ?? null,
    criticalDataCompleteness: null,
    fairOdds: fairAmericanFromProbability(probability),
    actionability: 'informational_probability_only',
    explanation: {
      primaryDrivers: ['Stored model probability'],
      secondaryContext: ['Current Board value gates remain unchanged.'],
      missingData: outcome.marketAvailable ? [] : ['Current sportsbook odds'],
      recommendationBlockers: outcome.blockers ?? ['NO_OFFICIAL_PICK'],
      probabilityVsValue: 'Most Likely can show probability before value is actionable.',
    },
    oddsTimestamp: null,
    oddsAgeMinutes: Number.POSITIVE_INFINITY,
    storedOddsTimestamp: null,
    marketInputTimestamp: null,
    marketInputAgeMinutes: null,
    marketFreshnessTimestamp: null,
    marketFreshnessSource: 'model_only',
    marketSourceTimestamp: null,
    marketSourceAgeMinutes: null,
    providerSourceUpdatedAt: null,
    providerFetchedAt: null,
    oddsIngestedAt: null,
    oddsSnapshotCreatedAt: null,
    marketAlignment: {
      alignmentStatus: 'MODEL_ONLY',
      freshnessStatus: outcome.marketAvailable ? 'AVAILABLE' : 'NO_MARKET',
      marketAgeMinutes: null,
      edgePercentagePoints: null,
      expectedValuePercent: null,
      snapshotEdgePercentagePoints: null,
      snapshotExpectedValuePercent: null,
      actionableEdgePercentagePoints: null,
      actionableExpectedValuePercent: null,
      actionableUnavailableReason: 'Current market odds are required before EV can be treated as actionable.',
      marketImpliedProbability: null,
    },
    recommendationExplanation: null,
    selectedOddsSnapshotId: null,
    selectedOddsSource: 'model_only',
    anomalies: [],
    productionEligible: false,
    independentTool: true,
  } as unknown) as CanonicalProbabilityCard
}

function puertoRicoTodayStartMs() {
  const localDate = localDateInTimeZone(new Date().toISOString(), 'America/Puerto_Rico') ?? new Date().toISOString().slice(0, 10)
  return new Date(zonedUtcRange(localDate, 'America/Puerto_Rico').utcStart).getTime()
}

function currentOrFutureInformational(cards: CanonicalProbabilityCard[]) {
  const todayStart = puertoRicoTodayStartMs()
  return cards.filter((card) => {
    const startMs = card.startTime ? new Date(card.startTime).getTime() : Number.NaN
    return Number.isFinite(startMs) && startMs >= todayStart
  })
}

function topPickFrom(rows: CanonicalProbabilityCard[]) {
  const official = rows.find((row) => row.officialEligibility === 'ELIGIBLE_FOR_OFFICIAL_REVIEW')
  const candidate = official ?? rows[0] ?? null
  return {
    type: official ? 'official_pick' : candidate ? 'most_likely_outcome' : 'none',
    candidate,
    disclaimer: official
      ? 'Official recommendation status is controlled by recommendation policy.'
      : candidate
        ? 'No official pick is being forced. This is informational and probability-focused.'
        : 'No valid current supported outcome is available.',
  }
}

function moneylineRank(rows: CanonicalProbabilityCard[]) {
  return rows
    .filter((row) => row.market === 'moneyline')
    .sort(
      (left, right) =>
        right.probability - left.probability ||
        right.confidence - left.confidence ||
        Number(right.dataSufficiency ?? 0) - Number(left.dataSufficiency ?? 0) ||
        Number(right.featureQuality ?? 0) - Number(left.featureQuality ?? 0) ||
        right.reliabilityScore - left.reliabilityScore
    )
}

function mostLikelyMoneylineFrom(rows: CanonicalProbabilityCard[]) {
  const candidate = moneylineRank(rows)[0] ?? null
  if (!candidate) {
    return {
      candidate: null,
      probability: null,
      fairOdds: null,
      marketOdds: null,
      ev: null,
      confidence: null,
      officialStatus: 'unavailable',
      blockers: ['NO_VALID_CURRENT_MONEYLINE'],
      explanation: 'No valid current moneyline candidate is available.',
    }
  }
  return {
    candidate,
    probability: candidate.probability,
    fairOdds: candidate.fairOdds,
    marketOdds: candidate.odds,
    ev: candidate.expectedValue,
    confidence: candidate.confidence,
    officialStatus: candidate.officialEligibility,
    blockers: candidate.blockers,
    explanation: {
      primaryDrivers: candidate.explanation.primaryDrivers,
      secondaryContext: candidate.explanation.secondaryContext,
      missingData: candidate.missingData,
      recommendationBlockers: candidate.blockers,
      probabilityVsValue:
        'This is the highest modeled moneyline probability, not automatically the best bet.',
    },
  }
}

function parlayFrom(rows: CanonicalProbabilityCard[]) {
  const legs = moneylineRank(rows)
    .filter((row, index, all) => all.findIndex((candidate) => candidate.eventId === row.eventId) === index)
    .slice(0, 2)
  if (legs.length < 2) {
    return {
      legs: [],
      rawJointProbability: null,
      adjustedJointProbability: null,
      impliedProbability: null,
      combinedOdds: null,
      ev: null,
      confidence: null,
      independenceAssumed: true,
      correlationAdjustment: 'not_enough_eligible_legs',
      officialStatus: 'informational_only',
      blockers: ['NEEDS_TWO_DISTINCT_VALID_MONEYLINES'],
      disclaimer: 'No informational two-leg moneyline parlay is available.',
    }
  }
  const rawJoint = round((legs[0].probability / 100) * (legs[1].probability / 100) * 100, 2)
  const adjustedJoint = round(rawJoint * 0.92, 2)
  const decimalOdds = legs.reduce((product, leg) => product * americanToDecimal(Number(leg.odds ?? 0)), 1)
  const combinedAmerican = decimalToAmerican(decimalOdds)
  const implied = combinedAmerican === null ? null : round(impliedFromAmerican(combinedAmerican) * 100, 2)
  const ev = combinedAmerican === null ? null : displayEv(adjustedJoint, combinedAmerican)
  const confidence = round(legs.reduce((sum, leg) => sum + leg.confidence, 0) / legs.length)
  return {
    legs,
    rawJointProbability: rawJoint,
    adjustedJointProbability: adjustedJoint,
    impliedProbability: implied,
    combinedOdds: {
      decimal: round(decimalOdds, 3),
      american: combinedAmerican,
    },
    ev,
    confidence,
    independenceAssumed: true,
    correlationAdjustment: '8_percent_conservative_haircut_no_correlation_model',
    officialStatus: 'informational_only',
    blockers: [
      'PARLAY_NOT_OFFICIAL_RECOMMENDATION',
      ...Array.from(new Set(legs.flatMap((leg) => leg.blockers))),
    ],
    disclaimer:
      'Estimated joint probability assumes independence, then applies a conservative haircut. This is informational only and may still be negative EV.',
  }
}

function toMostLikelyCard(row: PredictionRow, oddsRow: OddsRow | null, event: EventRow | undefined, nowMs: number, mode: BoardMode) {
  const snapshot = asRecord(row.feature_snapshot)
  const blockers = String(row.skip_reason ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const probability = numberValue(row.model_probability) ?? 0
  const selectedOdds = numberValue(oddsRow?.price) ?? numberValue(row.odds) ?? 0
  const implied = selectedOdds ? round(impliedFromAmerican(selectedOdds) * 100) : (numberValue(row.implied_probability) ?? 0)
  const edge = round(probability - implied)
  const expectedValue = selectedOdds ? displayEv(probability, selectedOdds) : (numberValue(row.ev) ?? 0)
  const confidence = numberValue(row.confidence) ?? 0
  const reliabilityScore = numberValue(snapshot.reliabilityScore) ?? Math.min(100, Math.max(0, confidence))
  const aiRating = numberValue(snapshot.aiRating) ?? combinedScore(row, snapshot)
  const missingData = Array.isArray(snapshot.missingData) ? snapshot.missingData.map(String) : []
  const positiveFactors = Array.isArray(snapshot.positiveFactors) ? snapshot.positiveFactors.map(String) : []
  const negativeFactors = Array.isArray(snapshot.negativeFactors) ? snapshot.negativeFactors.map(String) : []
  const startTime = event?.start_time ?? row.commence_time
  const eventStatus = event?.status ?? row.status ?? 'unknown'
  const selectedOddsTimestamp = oddsRow?.snapshot_time ?? row.odds_timestamp
  const selectedOddsAge = ageMinutes(selectedOddsTimestamp, nowMs)
  const calibration = calibrationStatus(row, snapshot)
  const label = boardLabel(row, event, nowMs)
  const anomalies = oddsRow ? safeOddsIssues(oddsRow, startTime, row.cutoff_at, nowMs) : safePredictionOddsIssues(row, event, nowMs, mode)
  const quarantined = row.production_eligible !== true || snapshot.prospective_preview === true
  const semantic = semanticSummary({
    edge,
    ev: expectedValue,
    productionEligible: row.production_eligible === true,
    calibration,
    stale: anomalies.includes('stale_odds'),
    quarantined,
  })
  return {
    id: row.id,
    sportKey: row.sport_key,
    matchup: `${event?.away_team ?? row.away_team ?? 'Away'} @ ${event?.home_team ?? row.home_team ?? 'Home'}`,
    eventId: row.game_id,
    startTime,
    eventStatus,
    market: row.market ?? 'unknown',
    marketLabel: marketLabel(row.market),
    period: marketPeriod(row),
    selection: selectionLabel(row),
    line: row.line,
    odds: selectedOdds || null,
    sportsbook: oddsRow?.sportsbook ?? row.sportsbook ?? 'Unknown',
    probability,
    sportsbookProbability: implied,
    edge,
    expectedValue,
    confidence,
    confidenceLabel: String(snapshot.confidenceLabel ?? (confidence >= 70 ? 'High' : confidence >= 60 ? 'Medium' : 'Low')),
    reliability: String(snapshot.reliabilityLabel ?? qualityLabel(reliabilityScore)),
    reliabilityScore,
    aiRating: round(aiRating),
    aiGrade: String(snapshot.aiGrade ?? ''),
    combinedScore: combinedScore(row, snapshot),
    recommendation: semantic,
    recommendationStatus: String(snapshot.recommendationStatus ?? 'ANALYZED_ONLY'),
    semanticLabel: semantic,
    officialEligibility: row.production_eligible === true ? 'ELIGIBLE_FOR_OFFICIAL_REVIEW' : 'NOT OFFICIALLY ELIGIBLE',
    calibrationStatus: calibration,
    modelVersion: row.model_version ?? String(snapshot.modelVersion ?? 'unknown'),
    featureSetVersion: row.feature_set_version ?? String(snapshot.featureSetVersion ?? 'unknown'),
    boardLabel: label,
    currentHistoricalPreviewLabel: label,
    why:
      positiveFactors[0] ??
      (probability >= 70
        ? 'This outcome is more likely than the rest of the board, but price still matters.'
        : 'This is ranked by probability from stored model output.'),
    warnings: [
      ...(negativeFactors.slice(0, 2)),
      ...(blockers.includes('NON_POSITIVE_EDGE') || blockers.includes('LOW_EV')
        ? ['High probability does not always mean good betting value.']
        : []),
    ],
    missingData,
    oddsTimestamp: selectedOddsTimestamp,
    oddsAgeMinutes: selectedOddsAge,
    storedOddsTimestamp: row.odds_timestamp,
    selectedOddsSnapshotId: oddsRow?.id ?? null,
    selectedOddsSource: oddsRow ? 'sports_odds_snapshots' : 'prediction_history_offered_price',
    anomalies,
    productionEligible: row.production_eligible === true,
    independentTool: true,
  }
}

export async function getMostLikelyOpportunities({
  sort = 'highest_probability',
  limit = 50,
  mode = 'current_board',
}: {
  sort?: SortMode
  limit?: number
  mode?: BoardMode
} = {}) {
  const safeLimit = Math.max(1, Math.min(limit, 100))
  let board = await getCurrentBoardCached(
    'baseball_mlb',
    mapLegacyBoardMode(mode),
    200
  )
  let fallbackUsed = false
  let rows = board.candidates
    .filter((candidate) => !['fallback', 'unavailable'].includes(candidate.probabilityOrigin))
    .map(currentBoardCandidateToMostLikelyCard)
    .sort(compareCurrentBoardOpportunity(sort))
    .slice(0, safeLimit)

  if (rows.length === 0 && mode === 'current_board') {
    const fallbackBoard = await getCurrentBoardCached('baseball_mlb', 'ALL_STORED_ADVANCED', 200)
    const fallbackRows = currentOrFutureInformational(
      fallbackBoard.candidates
        .filter((candidate) => !['fallback', 'unavailable'].includes(candidate.probabilityOrigin))
        .map(currentBoardCandidateToMostLikelyCard)
    )
      .sort(compareCurrentBoardOpportunity(sort))
      .slice(0, safeLimit)
    if (fallbackRows.length) {
      board = fallbackBoard
      rows = fallbackRows
      fallbackUsed = true
    }
  }

  const modelOnly = rows.length === 0 ? await getModelOnlyIntelligence() : null
  const modelOnlyRows = rows.length
    ? []
    : (modelOnly?.categories.allModelOutcomes ?? [])
        .map(modelOnlyOutcomeToMostLikelyCard)
        .sort(compareCurrentBoardOpportunity(sort))
        .slice(0, safeLimit)
  const displayRows = rows.length ? rows : modelOnlyRows
  const probabilityRankedRows = [...displayRows].sort(compareCurrentBoardOpportunity('highest_probability'))
  const topPick = topPickFrom(probabilityRankedRows)
  const mostLikelyMoneyline = mostLikelyMoneylineFrom(probabilityRankedRows)
  const mostLikelyMoneylineParlay = parlayFrom(probabilityRankedRows)

  const shownMarkets = new Set(displayRows.map((row) => row.marketLabel))
  const unavailableMarkets = [
    ...SUPPORTED_MOST_LIKELY_MARKETS
      .map((market) => marketLabel(market))
      .filter((label) => !shownMarkets.has(label))
      .map((label) => `${label}: no valid current safe odds row in selected scope`),
    'Team Totals: provider/store has no supported current full-game team-total candidates',
    'First Half: provider/store has no supported current first-half candidates',
    'Player Props: props are not enabled for this suite',
    'Pitcher Props: props are not enabled for this suite',
  ]

  return {
    success: true,
    mode: 'market_opportunity_most_likely_v1',
    boardMode: mode,
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_prediction_history',
    },
    isolation: {
      feedsTopPicks: false,
      feedsBetSlip: false,
      feedsOfficialPicks: false,
      feedsPlayOfDay: false,
      mutatesRemoteState: false,
    },
    summary: {
      opportunities: displayRows.length,
      supportedMarkets: Array.from(new Set(displayRows.map((row) => row.marketLabel))).sort(),
      unavailableMarkets,
      sort,
      currentSlateStart: board.games[0]?.scheduledTime ?? null,
      rowsBeforeFiltering: board.excludedRowSummary.rowsBeforeFiltering,
      rowsAfterFiltering: displayRows.length,
      staleHistoricalLegacyExcluded:
        board.excludedRowSummary.exclusionReasonCounts.STALE_ODDS +
        board.excludedRowSummary.exclusionReasonCounts.HISTORICAL +
        board.excludedRowSummary.exclusionReasonCounts.SETTLED +
        board.excludedRowSummary.exclusionReasonCounts.LEGACY_UNLINKED,
      duplicatesRemoved: board.excludedRowSummary.duplicateRowsRemoved,
      anomalousOddsExcluded:
        board.excludedRowSummary.exclusionReasonCounts.INVALID_PRICE +
        board.excludedRowSummary.exclusionReasonCounts.INVALID_LINE +
        board.excludedRowSummary.exclusionReasonCounts.LIVE_ODDS +
        board.excludedRowSummary.exclusionReasonCounts.ALTERNATE_MARKET,
      anomalousOddsFlagged: rows.filter((row) => row.anomalies.length > 0).length,
      currentBoard: {
        slateDate: board.slateDate,
        latestOddsTimestamp: board.latestOddsTimestamp,
        dataFreshness: board.dataFreshness,
        uniqueRowsExcluded: board.excludedRowSummary.uniqueRowsExcluded,
        exclusionReasonCounts: board.excludedRowSummary.exclusionReasonCounts,
        boardHealth: board.boardHealth,
      },
      audit: {
        rowsBeforeFiltering: board.excludedRowSummary.rowsBeforeFiltering,
        rowsAfterMarketFilter: board.excludedRowSummary.rowsBeforeFiltering - board.excludedRowSummary.exclusionReasonCounts.UNSUPPORTED_MARKET,
        rowsAfterModeFilter: board.excludedRowSummary.rowsAfterFiltering,
        historicalExcluded: board.excludedRowSummary.exclusionReasonCounts.HISTORICAL,
        settledExcluded: board.excludedRowSummary.exclusionReasonCounts.SETTLED,
        fixtureExcluded: board.excludedRowSummary.exclusionReasonCounts.FIXTURE,
        legacyUnlinkedExcluded: board.excludedRowSummary.exclusionReasonCounts.LEGACY_UNLINKED,
        staleExcluded: board.excludedRowSummary.exclusionReasonCounts.STALE_ODDS,
        supersededExcluded: board.excludedRowSummary.exclusionReasonCounts.SUPERSEDED,
        liveAlternateExcluded:
          board.excludedRowSummary.exclusionReasonCounts.LIVE_ODDS +
          board.excludedRowSummary.exclusionReasonCounts.ALTERNATE_MARKET,
        afterStartExcluded:
          board.excludedRowSummary.exclusionReasonCounts.EVENT_STARTED +
          board.excludedRowSummary.exclusionReasonCounts.POST_CUTOFF_ODDS,
        invalidOddsExcluded:
          board.excludedRowSummary.exclusionReasonCounts.INVALID_PRICE +
          board.excludedRowSummary.exclusionReasonCounts.INVALID_LINE,
        extremeOddsFlagged: rows.filter((row) => row.anomalies.length > 0).length,
        duplicatesRemoved: board.excludedRowSummary.duplicateRowsRemoved,
        staleOrHistoricalRowsExcluded:
          board.excludedRowSummary.exclusionReasonCounts.STALE_ODDS +
          board.excludedRowSummary.exclusionReasonCounts.HISTORICAL +
          board.excludedRowSummary.exclusionReasonCounts.SETTLED,
        anomalousOddsExcluded:
          board.excludedRowSummary.exclusionReasonCounts.INVALID_PRICE +
          board.excludedRowSummary.exclusionReasonCounts.INVALID_LINE +
          board.excludedRowSummary.exclusionReasonCounts.LIVE_ODDS +
          board.excludedRowSummary.exclusionReasonCounts.ALTERNATE_MARKET,
      },
      warning: 'High probability does not always mean good betting value.',
      informationalFallbackUsed: fallbackUsed,
      displayMode: fallbackUsed ? 'informational_rankings_after_current_board_empty' : 'current_board_rankings',
      modelOnlyFallbackUsed: rows.length === 0 && modelOnlyRows.length > 0,
    },
    topPick: displayRows.length ? topPick : {
      type: modelOnly?.categories.allModelOutcomes[0] ? 'model_only_outcome' : modelOnly?.categories.allPitcherShadows[0] ? 'pitcher_outs_shadow' : 'none',
      candidate: modelOnly?.categories.allModelOutcomes[0] ?? modelOnly?.categories.allPitcherShadows[0] ?? null,
      disclaimer: modelOnly?.categories.allModelOutcomes[0] || modelOnly?.categories.allPitcherShadows[0]
        ? 'This is model-only or shadow intelligence. It is not an Official Pick and has no EV, Kelly or stake.'
        : 'No valid current supported model-only outcome is available.',
    },
    highestProbabilitySupportedOutcome: displayRows.length ? topPick.candidate : modelOnly?.categories.allModelOutcomes[0] ?? null,
    mostLikelyMoneyline: displayRows.length ? mostLikelyMoneyline : {
      candidate: modelOnly?.categories.highestMoneylineProbability[0] ?? null,
      probability: modelOnly?.categories.highestMoneylineProbability[0]?.modelProbability ?? null,
      fairOdds: null,
      marketOdds: modelOnly?.categories.highestMoneylineProbability[0]?.sportsbookOdds ?? null,
      ev: null,
      confidence: modelOnly?.categories.highestMoneylineProbability[0]?.confidence ?? null,
      officialStatus: 'model_only_not_official',
      blockers: modelOnly?.categories.highestMoneylineProbability[0] ? ['NO_OFFICIAL_PICK', 'EV_NOT_AVAILABLE_ON_MODEL_ONLY_SURFACE'] : ['NO_VALID_CURRENT_MONEYLINE'],
      explanation: modelOnly?.categories.highestMoneylineProbability[0]
        ? 'Highest current pregame model moneyline probability from stored prediction history. Odds are not required for this informational surface.'
        : 'No valid current moneyline candidate is available.',
    },
    mostLikelyMoneylineParlay: displayRows.length ? mostLikelyMoneylineParlay : modelOnly?.informationalParlays.twoLegHighestProbability ?? {
      legs: [],
      rawJointProbability: null,
      adjustedJointProbability: null,
      impliedProbability: null,
      combinedOdds: null,
      ev: null,
      confidence: null,
      independenceAssumed: true,
      correlationAdjustment: 'not_enough_eligible_legs',
      officialStatus: 'informational_only',
      blockers: ['NEEDS_TWO_DISTINCT_VALID_MONEYLINES'],
      disclaimer: 'No informational two-leg moneyline parlay is available.',
    },
    modelOnlyIntelligence: modelOnly,
    probabilityEducation: {
      headline: 'Higher probability does not necessarily mean a bet is profitable at the available price.',
      labels: [
        'Highest Modeled Probability',
        'Informational Only',
        'Preview - Not Officially Recommended',
      ],
      officialSeparation:
        'Official picks remain controlled by recommendation policy. This scanner never promotes an informational candidate.',
    },
    opportunities: displayRows,
  }
}

function normalizedLine(row: OddsRow) {
  const market = String(row.market ?? '')
  const line = numberValue(row.line)
  if (line === null) return 'none'
  if (market === 'spread' || market === 'run_line') return Math.abs(line).toFixed(2)
  return line.toFixed(2)
}

function periodKey(row: OddsRow) {
  const metadata = asRecord(row.metadata)
  return String(metadata.marketPeriod ?? metadata.period ?? 'full_game')
}

function rulesKey(row: OddsRow) {
  const metadata = asRecord(row.metadata)
  return String(metadata.marketType ?? metadata.sourceType ?? 'pregame')
}

function arbitrageGroupKey(row: OddsRow) {
  return [row.sport_key, row.event_id, row.market, normalizedLine(row), periodKey(row), rulesKey(row)].join('|')
}

function isValidOddsRow(row: OddsRow) {
  const metadata = asRecord(row.metadata)
  if (metadata.isLive === true || metadata.isAlternate === true) return false
  if (!row.sportsbook || row.sportsbook.toLowerCase() === 'consensus') return false
  if (!row.market || !row.outcome || !row.snapshot_time) return false
  return Number.isFinite(Number(row.price)) && Number(row.price) !== 0
}

function requiredOutcomes(rows: OddsRow[]) {
  const market = String(rows[0]?.market ?? '')
  const outcomes = new Set(rows.map((row) => String(row.outcome).toLowerCase()))
  if (market === 'moneyline') {
    return outcomes.has('home') && outcomes.has('away')
      ? ['home', 'away']
      : outcomes.size === 2
        ? Array.from(outcomes)
        : []
  }
  if (market === 'total') return outcomes.has('over') && outcomes.has('under') ? ['over', 'under'] : []
  if (market === 'spread' || market === 'run_line') {
    return outcomes.has('home') && outcomes.has('away')
      ? ['home', 'away']
      : outcomes.size === 2
        ? Array.from(outcomes)
        : []
  }
  return []
}

function bestByOutcome(rows: OddsRow[], outcomes: string[]) {
  return outcomes
    .map((outcome) => {
      const candidates = rows
        .filter((row) => String(row.outcome).toLowerCase() === outcome)
        .sort((left, right) => americanToDecimal(Number(right.price)) - americanToDecimal(Number(left.price)))
      return candidates[0] ?? null
    })
    .filter((row): row is OddsRow => Boolean(row))
}

function stakePlan(rows: OddsRow[], investment: number) {
  const inverseSum = rows.reduce((sum, row) => sum + 1 / americanToDecimal(Number(row.price)), 0)
  const payout = investment / inverseSum
  return rows.map((row) => {
    const decimal = americanToDecimal(Number(row.price))
    const stake = payout / decimal
    return {
      outcome: row.outcome,
      sportsbook: row.sportsbook,
      odds: row.price,
      line: row.line,
      stake: round(stake),
      payout: round(stake * decimal),
      snapshotTime: row.snapshot_time,
      oddsAgeMinutes: ageMinutes(row.snapshot_time),
    }
  })
}

export async function getArbitrageOpportunities({
  staleMinutes = 120,
  investment = 1000,
}: {
  staleMinutes?: number
  investment?: number
} = {}) {
  try {
  const safeStale = Math.max(5, Math.min(staleMinutes, 1440))
  const safeInvestment = Math.max(10, Math.min(investment, 100000))
  const now = new Date()
  const windowStart = new Date(now.getTime() - safeStale * 60000).toISOString()
  const eventsResult = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team, away_team, start_time, status')
    .eq('sport_key', 'baseball_mlb')
    .gt('start_time', now.toISOString())
    .order('start_time', { ascending: true })
    .limit(100)

  if (eventsResult.error) throw new Error(`arbitrage event read failed: ${eventsResult.error.message}`)

  const futureEvents = ((eventsResult.data ?? []) as EventRow[]).filter((event) => {
    const status = String(event.status ?? '').toLowerCase()
    return !['live', 'in_progress', 'completed', 'final', 'closed', 'cancelled', 'postponed'].includes(status)
  })
  const eventIds = futureEvents.map((event) => event.id)
  const oddsRows: OddsRow[] = []
  for (const chunk of chunks(eventIds, 50)) {
    if (!chunk.length) continue
    const oddsResult = await supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id, sport_key, league_key, season, event_id, provider, sportsbook, market, outcome, price, line, snapshot_time, metadata')
      .eq('sport_key', 'baseball_mlb')
      .in('event_id', chunk)
      .in('market', ['moneyline', 'run_line', 'total'])
      .gte('snapshot_time', windowStart)
      .order('snapshot_time', { ascending: false })
      .limit(1000)
    if (oddsResult.error) throw new Error(`arbitrage odds read failed: ${oddsResult.error.message}`)
    oddsRows.push(...((oddsResult.data ?? []) as OddsRow[]))
  }

  const eventsById = new Map(futureEvents.map((event) => [event.id, event]))
  const latestByBookOutcome = new Map<string, OddsRow>()
  for (const row of oddsRows) {
    if (!isValidOddsRow(row)) continue
    const age = ageMinutes(row.snapshot_time)
    if (age > safeStale) continue
    const key = `${arbitrageGroupKey(row)}|${row.sportsbook}|${row.outcome}`
    const current = latestByBookOutcome.get(key)
    if (!current || String(row.snapshot_time) > String(current.snapshot_time)) {
      latestByBookOutcome.set(key, row)
    }
  }

  const grouped = new Map<string, OddsRow[]>()
  for (const row of latestByBookOutcome.values()) {
    const key = arbitrageGroupKey(row)
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }

  const opportunities = []
  let potentialCount = 0
  for (const [key, rows] of grouped) {
    const sportsbookCount = new Set(rows.map((row) => row.sportsbook)).size
    const outcomes = requiredOutcomes(rows)
    if (sportsbookCount < 2 || outcomes.length < 2) continue
    const bestRows = bestByOutcome(rows, outcomes)
    if (bestRows.length !== outcomes.length) continue
    const impliedSum = bestRows.reduce((sum, row) => sum + impliedFromAmerican(Number(row.price)), 0)
    const margin = round((1 - impliedSum) * 100)
    const event = eventsById.get(rows[0].event_id)
    if (margin <= 0) {
      if (margin > -2) potentialCount += 1
      continue
    }
    const stakes = stakePlan(bestRows, safeInvestment)
    const guaranteedReturn = Math.min(...stakes.map((stake) => stake.payout))
    const expectedProfit = round(guaranteedReturn - safeInvestment)
    opportunities.push({
      id: key,
      status: 'GUARANTEED_ARBITRAGE',
      eventId: rows[0].event_id,
      matchup: `${event?.away_team ?? 'Away'} @ ${event?.home_team ?? 'Home'}`,
      sportKey: rows[0].sport_key,
      market: rows[0].market,
      line: rows[0].line,
      period: periodKey(rows[0]),
      guaranteedReturn: round(guaranteedReturn),
      investment: safeInvestment,
      expectedProfit,
      margin,
      oddsAgeMinutes: Math.max(...stakes.map((stake) => stake.oddsAgeMinutes)),
      executionRisk:
        Math.max(...stakes.map((stake) => stake.oddsAgeMinutes)) > 30
          ? 'Medium: odds are aging.'
          : 'Low: stored prices are fresh, but execution still depends on live sportsbook availability.',
      stakes,
    })
  }

  opportunities.sort((left, right) => right.margin - left.margin || right.expectedProfit - left.expectedProfit)

  const verifiedSportsbooks = new Set(
    oddsRows
      .map((row) => row.sportsbook)
      .filter((book): book is string => Boolean(book && book.toLowerCase() !== 'consensus'))
  )

  return {
    success: true,
    mode: 'market_opportunity_arbitrage_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_sports_odds_snapshots',
    },
    isolation: {
      feedsRecommendationEngine: false,
      feedsKelly: false,
      feedsPortfolio: false,
      feedsOfficialPicks: false,
      mutatesRemoteState: false,
    },
    summary: {
      status:
        verifiedSportsbooks.size < 2
          ? 'MULTIBOOK_DATA_UNAVAILABLE'
          : opportunities.length > 0
            ? 'ARBITRAGE_FOUND'
            : potentialCount > 0
              ? 'NO_ARBITRAGE_FOUND'
              : 'NO_ARBITRAGE_FOUND',
      guaranteedCount: opportunities.length,
      potentialCount,
      verifiedSportsbooks: Array.from(verifiedSportsbooks).sort(),
      checkedGroups: grouped.size,
      warning:
        verifiedSportsbooks.size < 2
          ? 'Current stored provider data does not expose verified multi-book pricing. Arbitrage is unavailable.'
          : 'Potential arbitrage may disappear before wagers are placed.',
    },
    opportunities,
    notificationSettings: {
      architectureOnly: true,
      backendServiceEnabled: false,
      guaranteedArbitrage: true,
      minimumMarginPercent: 1,
      minimumProfit: 25,
      maximumStake: safeInvestment,
      preferredSportsbooks: Array.from(verifiedSportsbooks).sort(),
      maximumOddsAgeMinutes: safeStale,
      browserNotificationEnabled: false,
      emailPlaceholder: '',
      futureMobilePlaceholder: '',
    },
  }
  } catch {
    return {
      success: true,
      mode: 'market_opportunity_arbitrage_v1',
      generatedAt: new Date().toISOString(),
      providerUsage: {
        externalProviderCallsMade: 0,
        source: 'stored_sports_odds_snapshots',
      },
      isolation: {
        feedsRecommendationEngine: false,
        feedsKelly: false,
        feedsPortfolio: false,
        feedsOfficialPicks: false,
        mutatesRemoteState: false,
      },
      summary: {
        status: 'SCANNER_DATA_ERROR',
        guaranteedCount: 0,
        potentialCount: 0,
        verifiedSportsbooks: [],
        checkedGroups: 0,
        warning: 'Data temporarily unavailable. Arbitrage scan did not complete.',
      },
      opportunities: [],
      notificationSettings: {
        architectureOnly: true,
        backendServiceEnabled: false,
        guaranteedArbitrage: true,
        minimumMarginPercent: 1,
        minimumProfit: 25,
        maximumStake: Math.max(10, Math.min(investment, 100000)),
        preferredSportsbooks: [],
        maximumOddsAgeMinutes: Math.max(5, Math.min(staleMinutes, 1440)),
        browserNotificationEnabled: false,
        emailPlaceholder: '',
        futureMobilePlaceholder: '',
      },
    }
  }
}
