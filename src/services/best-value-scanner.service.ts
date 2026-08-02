import 'server-only'

import { getCurrentBoardCached, type CurrentBoardCandidate } from '@/services/current-board.service'
import { classifyMarketIntelligence } from '@/services/market-intelligence-category.service'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'
import { buildExplainableIntelligence } from '@/services/explainable-intelligence.service'

export type BestValueMode = 'current' | 'upcoming' | 'historical_explorer' | 'all_stored_advanced'

function score(candidate: CurrentBoardCandidate) {
  const actionableEv = candidate.canonicalEv?.actionableExpectedValue ?? null
  const actionableEdge = candidate.canonicalEv?.actionableEdge ?? null
  const ev = Number.isFinite(actionableEv) ? Number(actionableEv) : candidate.canonicalEv?.expectedValue ?? Number.NEGATIVE_INFINITY
  const edge = Number.isFinite(actionableEdge) ? Number(actionableEdge) : candidate.canonicalEv?.edge ?? Number.NEGATIVE_INFINITY
  return (
    Number(ev > 0) * 10000 +
    Number(edge > 0) * 5000 +
    ev * 100 +
    edge * 60 +
    candidate.confidence * 20 +
    candidate.reliabilityScore * 12 +
    (candidate.featureQuality ?? 0) * 8 +
    (candidate.dataSufficiency ?? 0) * 8 -
    candidate.oddsAgeMinutes * 0.05
  )
}

function isAlignedFreshPositiveValue(candidate: CurrentBoardCandidate) {
  return (
    candidate.canonicalPrice?.status === 'AVAILABLE' &&
    Number.isFinite(candidate.canonicalEv?.actionableExpectedValue) &&
    Number.isFinite(candidate.canonicalEv?.actionableEdge) &&
    Number(candidate.canonicalEv?.actionableExpectedValue) > 0 &&
    Number(candidate.canonicalEv?.actionableEdge) > 0
  )
}

function category(candidate: CurrentBoardCandidate) {
  const ev = candidate.canonicalEv?.actionableExpectedValue
  const edge = candidate.canonicalEv?.actionableEdge
  if (!Number.isFinite(ev) || !Number.isFinite(edge) || Number(ev) <= 0 || Number(edge) <= 0) return 'No Modeled Value'
  if (Number(ev) >= 8 && Number(edge) >= 5 && candidate.confidence >= 60) return 'Strong Modeled Value'
  if (Number(ev) >= 5 && Number(edge) >= 3) return 'Developing Value'
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

function noPositiveValueWarning(sourceCandidates: CurrentBoardCandidate[]) {
  if (!sourceCandidates.length) return 'No opportunities available because no eligible games have grounded odds and probabilities.'
  const aligned = sourceCandidates.filter((candidate) => candidate.canonicalPrice?.status === 'AVAILABLE' || candidate.marketAlignment?.alignmentStatus === 'ALIGNED')
  if (!aligned.length) {
    return 'Odds or probabilities exist, but no candidate has an exact aligned event, market, selection, line, sportsbook and snapshot for EV ranking.'
  }
  const stale = aligned.filter((candidate) => candidate.canonicalReason === 'STALE_MARKET' || ['STALE', 'EXPIRED', 'UNKNOWN'].includes(candidate.marketAlignment.freshnessStatus))
  if (stale.length === aligned.length) {
    return 'Aligned odds exist, but EV is not actionable because market freshness is stale, expired or timestamp-unknown.'
  }
  const unknownPush = aligned.filter((candidate) => candidate.canonicalReason === 'UNKNOWN_PUSH' || candidate.marketAlignment.actionableUnavailableReason === 'UNKNOWN_PUSH_PROBABILITY')
  if (unknownPush.length) {
    return 'Aligned odds exist, but push-capable markets cannot be value-ranked until Win/Push/Loss probability is known.'
  }
  const priced = aligned.filter((candidate) =>
    Number.isFinite(candidate.canonicalEv?.actionableExpectedValue) &&
    Number.isFinite(candidate.canonicalEv?.actionableEdge)
  )
  if (priced.length) {
    return 'Aligned fresh odds exist, but model probability does not clear both positive EV and positive edge at the current price.'
  }
  return 'Model probability and current odds exist, but EV could not be computed for the aligned market.'
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
      productFreshnessSla: {
        bestValue: board.productFreshnessSla.surfaces.bestValue,
        currentBoard: board.productFreshnessSla.surfaces.currentBoard,
        proof: board.productFreshnessSla.canonicalTimestampProof,
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      warning: positiveValue.length
        ? 'Positive value is aligned to fresh selected market data and remains informational until official gates qualify it.'
        : noPositiveValueWarning(sourceCandidates),
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
      const canonicalOutcome = candidate.canonicalOutcome ?? {
        selection: candidate.selection,
        line: candidate.line,
        probability: candidate.rawProbability,
      }
      const canonicalPrice = candidate.canonicalPrice ?? {
        americanOdds: candidate.americanOdds,
        impliedProbability: candidate.impliedProbability,
      }
      const canonicalEv = candidate.canonicalEv ?? {
        edge: candidate.edge,
        expectedValue: candidate.expectedValue,
        actionableEdge: candidate.marketAlignment?.actionableEdgePercentagePoints ?? null,
        actionableExpectedValue: candidate.marketAlignment?.actionableExpectedValuePercent ?? null,
      }
      const canonicalReason = candidate.canonicalReason ?? candidate.marketAlignment?.actionableUnavailableReason ?? 'ALIGNED'
      const explanationContract = buildExplainableIntelligence({
        subject: `${canonicalOutcome.selection} ${candidate.marketLabel}`,
        positive: classification.strengths,
        negative: classification.weaknesses,
        neutral: [
          isAlignedFreshPositiveValue(candidate)
            ? 'Current price, model probability and implied probability produce positive modeled EV.'
            : 'Best Value requires aligned fresh odds, positive EV and positive edge.',
        ],
        unavailable: classification.missingData,
        missingData: classification.missingData,
        blockers: candidate.blockers,
        confidence: candidate.confidence,
        featureQuality: candidate.featureQuality,
        dataSufficiency: candidate.dataSufficiency,
        marketFreshness: candidate.marketAlignment.freshnessStatus,
        calibrationStatus: candidate.calibrationStatus,
        officialEligible: candidate.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE',
      })
      return {
        ...candidate,
        canonicalDisplaySelection: canonicalOutcome.selection,
        canonicalDisplayLine: canonicalOutcome.line,
        canonicalDisplayOdds: canonicalPrice.americanOdds,
        canonicalDisplayImpliedProbability: canonicalPrice.impliedProbability,
        canonicalDisplayEdge: canonicalEv.edge,
        canonicalDisplayExpectedValue: canonicalEv.expectedValue,
        canonicalDisplayProbability: canonicalOutcome.probability,
        canonicalDisplayReason: canonicalReason,
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
              : canonicalReason === 'NO_OPPOSITE_PRICE'
                ? 'NOT VALUE RANKED - NO OPPOSITE PRICE'
              : canonicalReason === 'NO_STORED_ODDS'
                ? 'NOT VALUE RANKED - NO STORED ODDS'
              : candidate.marketAlignment?.alignmentStatus !== 'ALIGNED'
                ? `NOT VALUE RANKED - ${candidate.marketAlignment?.alignmentStatus ?? 'UNALIGNED'}`
                : canonicalReason === 'UNKNOWN_PUSH' || candidate.marketAlignment?.actionableUnavailableReason === 'UNKNOWN_PUSH_PROBABILITY'
                  ? 'NOT VALUE RANKED - UNKNOWN PUSH PROBABILITY'
                : canonicalReason === 'STALE_MARKET' || ['STALE', 'EXPIRED', 'UNKNOWN'].includes(candidate.marketAlignment?.freshnessStatus ?? 'UNKNOWN')
                  ? `NOT VALUE RANKED - ${candidate.marketAlignment?.freshnessStatus ?? 'UNKNOWN'} MARKET INPUT`
                : Number(canonicalEv.actionableExpectedValue ?? Number.NaN) <= 0
                    ? 'NOT VALUE RANKED - NEGATIVE EV AT CURRENT ODDS'
                    : Number(canonicalEv.actionableEdge ?? Number.NaN) <= 0
                      ? 'NOT VALUE RANKED - MODEL PROBABILITY BELOW SPORTSBOOK IMPLIED PROBABILITY'
                      : 'NOT VALUE RANKED - EV UNAVAILABLE',
        marketIntelligenceCategory: classification.category,
        canonicalMarketState: classification.canonicalState,
        marketValueQuality: classification.valueQuality,
        marketFreshnessState: classification.freshnessState,
        productFreshness: candidate.surfaceFreshness.bestValue,
        surfaceFreshness: candidate.surfaceFreshness,
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
        explainableIntelligence: explanationContract,
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
