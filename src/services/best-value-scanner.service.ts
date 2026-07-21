import 'server-only'

import { getCurrentBoardCached, type CurrentBoardCandidate } from '@/services/current-board.service'
import { classifyMarketIntelligence } from '@/services/market-intelligence-category.service'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'

export type BestValueMode = 'current' | 'upcoming' | 'historical_explorer' | 'all_stored_advanced'

function score(candidate: CurrentBoardCandidate) {
  return (
    Number(candidate.expectedValue > 0) * 10000 +
    Number(candidate.edge > 0) * 5000 +
    candidate.expectedValue * 100 +
    candidate.edge * 60 +
    candidate.confidence * 20 +
    candidate.reliabilityScore * 12 +
    (candidate.featureQuality ?? 0) * 8 +
    (candidate.dataSufficiency ?? 0) * 8 -
    candidate.oddsAgeMinutes * 0.05
  )
}

function isAlignedFreshPositiveValue(candidate: CurrentBoardCandidate) {
  return (
    candidate.marketAlignment?.alignmentStatus === 'ALIGNED' &&
    candidate.marketAlignment.freshnessStatus !== 'STALE' &&
    Number.isFinite(candidate.marketAlignment.expectedValuePercent) &&
    Number.isFinite(candidate.marketAlignment.edgePercentagePoints) &&
    Number(candidate.marketAlignment.expectedValuePercent) > 0 &&
    Number(candidate.marketAlignment.edgePercentagePoints) > 0
  )
}

function category(candidate: CurrentBoardCandidate) {
  if (candidate.modeledValueStatus !== 'MODELED_VALUE') return 'No Modeled Value'
  if (candidate.expectedValue >= 8 && candidate.edge >= 5 && candidate.confidence >= 60) return 'Strong Modeled Value'
  if (candidate.expectedValue >= 5 && candidate.edge >= 3) return 'Developing Value'
  return 'Thin Value'
}

function mapMode(mode: BestValueMode) {
  if (mode === 'upcoming') return 'UPCOMING'
  if (mode === 'historical_explorer') return 'HISTORICAL_EXPLORER'
  if (mode === 'all_stored_advanced') return 'ALL_STORED_ADVANCED'
  return 'CURRENT'
}

function puertoRicoTodayStartMs() {
  const localDate = localDateInTimeZone(new Date().toISOString(), 'America/Puerto_Rico') ?? new Date().toISOString().slice(0, 10)
  return new Date(zonedUtcRange(localDate, 'America/Puerto_Rico').utcStart).getTime()
}

function currentOrFuture(candidates: CurrentBoardCandidate[]) {
  const todayStart = puertoRicoTodayStartMs()
  return candidates.filter((candidate) => {
    const startMs = candidate.scheduledTime ? new Date(candidate.scheduledTime).getTime() : Number.NaN
    return Number.isFinite(startMs) && startMs >= todayStart
  })
}

function reasonNotOfficial(candidate: CurrentBoardCandidate) {
  return classifyMarketIntelligence(candidate).reasonNotOfficial
}

function opportunityStatus(candidate: CurrentBoardCandidate) {
  return classifyMarketIntelligence(candidate).display
}

export async function getBestValueOpportunities({
  mode = 'current',
  includePasses = false,
  limit = 50,
}: {
  mode?: BestValueMode
  includePasses?: boolean
  limit?: number
} = {}) {
  try {
  let board = await getCurrentBoardCached('baseball_mlb', mapMode(mode), 200)
  let sourceCandidates = board.candidates
  let informationalFallbackUsed = false
  if (sourceCandidates.length === 0 && mode === 'current') {
    const fallbackBoard = await getCurrentBoardCached('baseball_mlb', 'ALL_STORED_ADVANCED', 200)
    const fallbackCandidates = currentOrFuture(fallbackBoard.candidates)
    if (fallbackCandidates.length) {
      board = fallbackBoard
      sourceCandidates = fallbackCandidates
      informationalFallbackUsed = true
    }
  }
  const positiveValue = sourceCandidates.filter(isAlignedFreshPositiveValue)
  const visiblePool = includePasses ? sourceCandidates : positiveValue
  const ranked = [...visiblePool]
    .sort((left, right) => score(right) - score(left))
    .slice(0, Math.max(1, Math.min(limit, 100)))

  const categories = {
    strongModeledValue: ranked.filter((candidate) => category(candidate) === 'Strong Modeled Value'),
    developingValue: ranked.filter((candidate) => category(candidate) === 'Developing Value'),
    thinValue: ranked.filter((candidate) => category(candidate) === 'Thin Value'),
    noModeledValue: ranked.filter((candidate) => category(candidate) === 'No Modeled Value'),
    notOfficiallyEligible: ranked.filter((candidate) => candidate.officialEligibility !== 'OFFICIAL_ELIGIBLE_CANDIDATE'),
  }

  return {
    success: true,
    mode: 'best_value_scanner_v1',
    generatedAt: new Date().toISOString(),
    boardMode: board.boardMode,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      candidatesScanned: sourceCandidates.length,
      candidatesReturned: ranked.length,
      positiveValueCandidates: sourceCandidates.filter(isAlignedFreshPositiveValue).length,
      noModeledValueCandidates: sourceCandidates.filter((candidate) => candidate.modeledValueStatus === 'NO_MODELED_VALUE').length,
      officialPickCount: board.officialPickCount,
      latestOddsCapture: board.latestOddsTimestamp,
      dataFreshness: board.dataFreshness,
      warning: positiveValue.length
        ? 'Positive value is aligned to fresh selected market data and remains informational until official gates qualify it.'
        : sourceCandidates.length
          ? 'No positive-value opportunities with aligned fresh market data.'
          : 'No opportunities available because no eligible games have grounded odds and probabilities.',
      scanCompleted: true,
      dataAvailable: true,
      errorCode: null,
      errorMessageSafe: null,
      positiveValueCount: positiveValue.length,
      informationalFallbackUsed,
      displayMode: informationalFallbackUsed ? 'informational_rankings_after_current_board_empty' : 'current_board_value_rankings',
    },
    rankingContract: ['aligned prediction and selected odds snapshot', 'positive expected value', 'positive edge', 'fresh market input', 'confidence', 'reliability', 'market stability', 'feature quality', 'data sufficiency'],
    categories,
    opportunities: ranked.map((candidate) => {
      const classification = classifyMarketIntelligence(candidate)
      return {
        ...candidate,
        valueCategory: category(candidate),
        valueScore: Number(score(candidate).toFixed(2)),
        officialDisplay:
          candidate.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE'
            ? 'Official'
            : `${classification.label} - not a recommendation`,
        valueDisplay:
          isAlignedFreshPositiveValue(candidate)
            ? 'POSITIVE VALUE'
            : classification.category === 'avoid'
              ? 'AVOID - NO POSITIVE VALUE'
              : candidate.marketAlignment?.alignmentStatus !== 'ALIGNED'
                ? `NOT VALUE RANKED - ${candidate.marketAlignment?.alignmentStatus ?? 'UNALIGNED'}`
                : candidate.marketAlignment?.freshnessStatus === 'STALE'
                  ? 'NOT VALUE RANKED - STALE MARKET INPUT'
                  : 'BELOW OFFICIAL VALUE THRESHOLD',
        marketIntelligenceCategory: classification.category,
        canonicalMarketState: classification.canonicalState,
        marketValueQuality: classification.valueQuality,
        marketFreshnessState: classification.freshnessState,
        primaryBlocker: classification.primaryBlocker,
        improvementPath: classification.improvementPath,
        opportunityCategory: classification.label,
        statusLabel: opportunityStatus(candidate),
        informationalWarning:
          candidate.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE'
            ? null
            : classification.warning,
        reasonNotOfficial: reasonNotOfficial(candidate),
        strengths: classification.strengths,
        weaknesses: classification.weaknesses,
        missingData: classification.missingData,
      }
    }),
  }
  } catch {
    return {
      success: true,
      mode: 'best_value_scanner_v1',
      generatedAt: new Date().toISOString(),
      boardMode: mapMode(mode),
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      summary: {
        candidatesScanned: 0,
        candidatesReturned: 0,
        positiveValueCandidates: 0,
        noModeledValueCandidates: 0,
        officialPickCount: 0,
        latestOddsCapture: null,
        dataFreshness: null,
        warning: 'DATA TEMPORARILY UNAVAILABLE',
        scanCompleted: false,
        dataAvailable: false,
        errorCode: 'CURRENT_BOARD_UNAVAILABLE',
        errorMessageSafe: 'DATA TEMPORARILY UNAVAILABLE',
        positiveValueCount: 0,
      },
      rankingContract: ['aligned prediction and selected odds snapshot', 'positive expected value', 'positive edge', 'fresh market input', 'confidence', 'reliability', 'market stability', 'feature quality', 'data sufficiency'],
      categories: {
        strongModeledValue: [],
        developingValue: [],
        thinValue: [],
        noModeledValue: [],
        notOfficiallyEligible: [],
      },
      opportunities: [],
    }
  }
}
