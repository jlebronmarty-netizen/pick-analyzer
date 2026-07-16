import 'server-only'

import { getCurrentBoard, type CurrentBoardCandidate } from '@/services/current-board.service'

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

export async function getBestValueOpportunities({
  mode = 'current',
  includePasses = false,
  limit = 50,
}: {
  mode?: BestValueMode
  includePasses?: boolean
  limit?: number
} = {}) {
  const board = await getCurrentBoard({ mode: mapMode(mode), limit: 200 })
  const ranked = [...board.candidates]
    .filter((candidate) => includePasses || candidate.expectedValue > 0 || candidate.edge > 0)
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
      candidatesScanned: board.candidates.length,
      candidatesReturned: ranked.length,
      positiveValueCandidates: board.candidates.filter((candidate) => candidate.expectedValue > 0 && candidate.edge > 0).length,
      noModeledValueCandidates: board.candidates.filter((candidate) => candidate.modeledValueStatus === 'NO_MODELED_VALUE').length,
      officialPickCount: board.officialPickCount,
      latestOddsCapture: board.latestOddsTimestamp,
      dataFreshness: board.dataFreshness,
      warning: 'MODELED VALUE is not an official pick. Official picks still require production gate and recommendation policy approval.',
    },
    rankingContract: ['positive expected value', 'positive edge', 'confidence', 'reliability', 'market stability', 'feature quality', 'data sufficiency', 'odds freshness'],
    categories,
    opportunities: ranked.map((candidate) => ({
      ...candidate,
      valueCategory: category(candidate),
      valueScore: Number(score(candidate).toFixed(2)),
      officialDisplay:
        candidate.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE'
          ? 'OFFICIAL ELIGIBILITY REVIEW'
          : 'NOT OFFICIALLY ELIGIBLE',
      valueDisplay:
        candidate.modeledValueStatus === 'MODELED_VALUE'
          ? 'MODELED VALUE DETECTED'
          : 'NO MODELED VALUE',
    })),
  }
}
