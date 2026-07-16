import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentBoard, mapLegacyBoardMode, type CurrentBoardCandidate } from '@/services/current-board.service'

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

function impliedFromAmerican(odds: number) {
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
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

function currentBoardCandidateToMostLikelyCard(candidate: CurrentBoardCandidate) {
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
    selection: candidate.selection,
    line: candidate.line,
    odds: candidate.americanOdds,
    sportsbook: candidate.sportsbook,
    probability: candidate.rawProbability,
    sportsbookProbability: candidate.impliedProbability,
    edge: candidate.edge,
    expectedValue: candidate.expectedValue,
    confidence: candidate.confidence,
    confidenceLabel: candidate.confidenceLabel,
    reliability: candidate.reliability,
    reliabilityScore: candidate.reliabilityScore,
    aiRating: candidate.aiRating,
    aiGrade: candidate.aiGrade,
    combinedScore: round(
      candidate.rawProbability * 0.34 +
        candidate.confidence * 0.22 +
        candidate.reliabilityScore * 0.18 +
        candidate.aiRating * 0.16 +
        Math.max(0, candidate.edge) * 1.2
    ),
    recommendation: candidate.semanticLabel,
    recommendationStatus: candidate.recommendationPolicyStatus,
    semanticLabel: candidate.semanticLabel,
    officialEligibility:
      candidate.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE'
        ? 'ELIGIBLE_FOR_OFFICIAL_REVIEW'
        : 'NOT OFFICIALLY ELIGIBLE',
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
    missingData: candidate.missingInformation,
    oddsTimestamp: candidate.oddsTimestamp,
    oddsAgeMinutes: candidate.oddsAgeMinutes,
    storedOddsTimestamp: candidate.oddsTimestamp,
    selectedOddsSnapshotId: candidate.oddsSnapshotId,
    selectedOddsSource: candidate.oddsSnapshotId ? 'sports_odds_snapshots' : 'prediction_history_offered_price',
    anomalies: candidate.anomalyReasons,
    productionEligible: candidate.productionEligible,
    independentTool: true,
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
  const board = await getCurrentBoard({
    sportKey: 'baseball_mlb',
    mode: mapLegacyBoardMode(mode),
    limit: 200,
  })
  const rows = board.candidates
    .map(currentBoardCandidateToMostLikelyCard)
    .sort(compareCurrentBoardOpportunity(sort))
    .slice(0, safeLimit)

  const shownMarkets = new Set(rows.map((row) => row.marketLabel))
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
      opportunities: rows.length,
      supportedMarkets: Array.from(new Set(rows.map((row) => row.marketLabel))).sort(),
      unavailableMarkets,
      sort,
      currentSlateStart: board.games[0]?.scheduledTime ?? null,
      rowsBeforeFiltering: board.excludedRowSummary.rowsBeforeFiltering,
      rowsAfterFiltering: rows.length,
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
    },
    opportunities: rows,
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
  const safeStale = Math.max(5, Math.min(staleMinutes, 1440))
  const safeInvestment = Math.max(10, Math.min(investment, 100000))
  const [oddsResult, eventsResult] = await Promise.all([
    supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id, sport_key, league_key, season, event_id, provider, sportsbook, market, outcome, price, line, snapshot_time, metadata')
      .order('snapshot_time', { ascending: false })
      .limit(3000),
    supabaseAdmin
      .from('sport_events')
      .select('id, sport_key, league_key, season, home_team, away_team, start_time, status')
      .limit(3000),
  ])

  if (oddsResult.error) throw new Error(`arbitrage odds read failed: ${oddsResult.error.message}`)
  if (eventsResult.error) throw new Error(`arbitrage event read failed: ${eventsResult.error.message}`)

  const eventsById = new Map(((eventsResult.data ?? []) as EventRow[]).map((event) => [event.id, event]))
  const latestByBookOutcome = new Map<string, OddsRow>()
  for (const row of (oddsResult.data ?? []) as OddsRow[]) {
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
    ((oddsResult.data ?? []) as OddsRow[])
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
          ? 'ARBITRAGE_UNAVAILABLE'
          : opportunities.length > 0
            ? 'GUARANTEED_ARBITRAGE_FOUND'
            : potentialCount > 0
              ? 'POTENTIAL_ARBITRAGE_ONLY'
              : 'NO_ARBITRAGE',
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
}
