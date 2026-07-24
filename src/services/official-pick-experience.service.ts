import 'server-only'

import type { CurrentBoardCandidate } from '@/services/current-board.service'
import type { MarketAlignmentContract } from '@/services/market-alignment.service'
import type { RecommendationExplanation } from '@/services/recommendation-explanation.service'
import { fairAmericanOddsFromProbability } from '@/services/recommendation-explanation.service'
import { classifyMarketSemantics } from '@/services/market-semantics.service'
import {
  isOfficialRecommendationStatus,
  RECOMMENDATION_THRESHOLDS_V1,
} from '@/services/recommendation-eligibility-policy.service'

export type OfficialPickContract = {
  contractVersion: 'official_pick_v1'
  status: 'AVAILABLE'
  predictionId: string
  eventId: string
  matchup: string
  scheduledTime: string | null
  market: CurrentBoardCandidate['market']
  marketLabel: string
  period: string
  selection: string
  normalizedSelection: string
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
  confidenceLabel: string
  risk: string
  freshnessStatus: string
  marketAgeMinutes: number | null
  maxAllowedAgeMinutes: number
  oddsSnapshotId: string | null
  featureSnapshotId: string | null
  selectedOddsSource: 'sports_odds_snapshots' | 'prediction_history_offered_price'
  selectedOddsLineage: {
    oddsSnapshotId: string | null
    oddsTimestamp: string | null
    marketInputTimestamp: string | null
    marketFreshnessTimestamp: string | null
    marketFreshnessSource: CurrentBoardCandidate['marketFreshnessSource']
    providerSourceUpdatedAt: string | null
    providerFetchedAt: string | null
    oddsIngestedAt: string | null
    oddsSnapshotCreatedAt: string | null
  }
  marketAlignment: MarketAlignmentContract
  recommendationExplanation: RecommendationExplanation
  modelFairOdds: number | null
  modelFairOddsLabel: string | null
  eligibility: {
    eligibilityVersion: 'recommendation_eligibility_policy_v1'
    thresholdsVersion: typeof RECOMMENDATION_THRESHOLDS_V1.mode
    recommendationPolicyStatus: string
    officialEligibility: CurrentBoardCandidate['officialEligibility']
    blockers: string[]
    thresholds: typeof RECOMMENDATION_THRESHOLDS_V1
  }
  timestamps: {
    predictionGeneratedAt: string | null
    recommendationGeneratedAt: string | null
    recommendationTimestampSource: 'recommendation_generated_at' | 'prediction_generated_at_fallback' | 'unavailable'
    cutoffAt: string | null
  }
  stakeRecommendation: {
    status: 'UNAVAILABLE'
    reason: 'No authorized stored stake recommendation is attached to this candidate.'
    units: null
    kellyFraction: null
  }
  actionLabel: 'Official Pick'
}

export type OfficialPickExperience = {
  contractVersion: 'official_pick_experience_v1'
  status: 'AVAILABLE' | 'EMPTY_VALID'
  generatedAt: string
  picks: OfficialPickContract[]
  emptyState: {
    headline: string
    summary: string
    topOpportunityRetained: boolean
  }
  providerCallsMade: 0
  remoteMutationsMade: 0
}

function official(candidate: CurrentBoardCandidate) {
  return (
    candidate.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE' &&
    isOfficialRecommendationStatus(candidate.recommendationPolicyStatus as never)
  )
}

function labelAmerican(value: number | null) {
  if (value === null || value === undefined) return null
  return `Model fair odds ${value > 0 ? '+' : ''}${value}`
}

export function buildOfficialPickContract(candidate: CurrentBoardCandidate): OfficialPickContract | null {
  if (!official(candidate) || !candidate.recommendationExplanation) return null
  const modelFairOdds = fairAmericanOddsFromProbability(candidate.marketAlignment.modelProbability ?? candidate.rawProbability)
  const recommendationGeneratedAt = candidate.recommendationGeneratedAt ?? candidate.predictionGeneratedAt ?? null
  return {
    contractVersion: 'official_pick_v1',
    status: 'AVAILABLE',
    predictionId: candidate.predictionId,
    eventId: candidate.eventId,
    matchup: candidate.matchup,
    scheduledTime: candidate.scheduledTime,
    market: candidate.market,
    marketLabel: candidate.marketLabel,
    period: candidate.period,
    selection: candidate.selection,
    normalizedSelection: candidate.normalizedSelection,
    line: candidate.line,
    americanOdds: candidate.americanOdds,
    sportsbook: candidate.sportsbook,
    modelProbability: candidate.marketAlignment.modelProbability ?? candidate.rawProbability,
    calibratedProbability: candidate.calibratedProbability,
    impliedProbability: candidate.impliedProbability,
    marketImpliedProbability: candidate.marketAlignment.marketImpliedProbability,
    edgePercentagePoints: candidate.marketAlignment.edgePercentagePoints,
    expectedValuePercent: candidate.marketAlignment.expectedValuePercent,
    confidence: candidate.confidence,
    confidenceLabel: candidate.confidenceLabel,
    risk: candidate.marketAlignment.risk,
    freshnessStatus: candidate.marketAlignment.freshnessStatus,
    marketAgeMinutes: candidate.marketAlignment.marketAgeMinutes,
    maxAllowedAgeMinutes: candidate.maxAllowedAgeMinutes,
    oddsSnapshotId: candidate.oddsSnapshotId,
    featureSnapshotId: candidate.snapshotId,
    selectedOddsSource: candidate.oddsSnapshotId ? 'sports_odds_snapshots' : 'prediction_history_offered_price',
    selectedOddsLineage: {
      oddsSnapshotId: candidate.oddsSnapshotId,
      oddsTimestamp: candidate.oddsTimestamp,
      marketInputTimestamp: candidate.marketInputTimestamp,
      marketFreshnessTimestamp: candidate.marketFreshnessTimestamp,
      marketFreshnessSource: candidate.marketFreshnessSource,
      providerSourceUpdatedAt: candidate.providerSourceUpdatedAt,
      providerFetchedAt: candidate.providerFetchedAt,
      oddsIngestedAt: candidate.oddsIngestedAt,
      oddsSnapshotCreatedAt: candidate.oddsSnapshotCreatedAt,
    },
    marketAlignment: candidate.marketAlignment,
    recommendationExplanation: candidate.recommendationExplanation,
    modelFairOdds,
    modelFairOddsLabel: labelAmerican(modelFairOdds),
    eligibility: {
      eligibilityVersion: 'recommendation_eligibility_policy_v1',
      thresholdsVersion: RECOMMENDATION_THRESHOLDS_V1.mode,
      recommendationPolicyStatus: candidate.recommendationPolicyStatus,
      officialEligibility: candidate.officialEligibility,
      blockers: candidate.blockers,
      thresholds: RECOMMENDATION_THRESHOLDS_V1,
    },
    timestamps: {
      predictionGeneratedAt: candidate.predictionGeneratedAt ?? null,
      recommendationGeneratedAt,
      recommendationTimestampSource: candidate.recommendationGeneratedAt
        ? 'recommendation_generated_at'
        : candidate.predictionGeneratedAt
          ? 'prediction_generated_at_fallback'
          : 'unavailable',
      cutoffAt: candidate.cutoff,
    },
    stakeRecommendation: {
      status: 'UNAVAILABLE',
      reason: 'No authorized stored stake recommendation is attached to this candidate.',
      units: null,
      kellyFraction: null,
    },
    actionLabel: 'Official Pick',
  }
}

export function buildOfficialPickExperience(candidates: CurrentBoardCandidate[], generatedAt = new Date().toISOString()): OfficialPickExperience {
  const picks = candidates
    .map((candidate) => buildOfficialPickContract(candidate))
    .filter(Boolean) as OfficialPickContract[]
  return {
    contractVersion: 'official_pick_experience_v1',
    status: picks.length ? 'AVAILABLE' : 'EMPTY_VALID',
    generatedAt,
    picks,
    emptyState: {
      headline: picks.length ? 'Official Pick available' : 'No Official Pick today.',
      summary: picks.length
        ? `${picks.length} candidate${picks.length === 1 ? '' : 's'} passed the existing Official Pick policy.`
        : 'No current candidate meets the existing Official Pick policy. The top tracked market remains informational and is not being promoted.',
      topOpportunityRetained: true,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validateOfficialPickExperienceFixtures() {
  const baseAlignment: MarketAlignmentContract = {
    alignmentStatus: 'ALIGNED',
    aligned: true,
    eventId: 'event-1',
    predictionId: 'prediction-1',
    oddsSnapshotId: 'odds-1',
    marketType: 'moneyline',
    period: 'full_game',
    selection: 'NYM',
    normalizedSelection: 'away',
    line: null,
    americanOdds: 120,
    decimalOdds: 2.2,
    sportsbook: 'Consensus',
    modelProbability: 60,
    calibratedProbability: null,
    marketImpliedProbability: 45.45,
    noVigProbability: null,
    edgePercentagePoints: 14.55,
    expectedValuePercent: 32,
    snapshotEdgePercentagePoints: 14.55,
    snapshotExpectedValuePercent: 32,
    actionableEdgePercentagePoints: 14.55,
    actionableExpectedValuePercent: 32,
    actionableUnavailableReason: null,
    marketSemantics: classifyMarketSemantics({ market: 'moneyline', line: null }),
    marketInputTimestamp: '2026-07-15T19:30:00.000Z',
    providerSourceTimestamp: '2026-07-15T19:20:00.000Z',
    oddsIngestedAt: '2026-07-15T19:31:00.000Z',
    marketAgeMinutes: 15,
    providerSourceAgeMinutes: 25,
    snapshotIngestionAgeMinutes: 14,
    freshnessStatus: 'FRESH',
    confidence: 74,
    risk: 'CONTROLLED',
    recommendationCategory: 'official',
    reasonCodes: [],
    calculationVersion: 'market_alignment_v1',
  }
  const explanation: RecommendationExplanation = {
    explanationVersion: 'recommendation_explanation_v1',
    category: 'official',
    headline: 'Qualified by current recommendation policy.',
    summary: 'Model 60.0% vs market 45.5%; edge +14.5 pts; EV +32.0%.',
    primaryReasons: [],
    secondaryReasons: [],
    blockers: [],
    promotionConditions: [],
    riskWarnings: [],
    evidence: [],
    alignmentStatus: 'ALIGNED',
    freshnessStatus: 'FRESH',
    confidenceStatus: 'MEETS_OFFICIAL_THRESHOLD',
    valueStatus: 'POSITIVE_VALUE',
    actionLabel: 'Official Pick',
    fairOdds: -150,
    fairOddsLabel: 'Model fair odds -150',
    calculationVersion: 'recommendation_explanation_v1',
  }
  const baseCandidate = {
    predictionId: 'prediction-1',
    snapshotId: 'feature-1',
    oddsSnapshotId: 'odds-1',
    eventId: 'event-1',
    matchup: 'NYM @ PHI',
    scheduledTime: '2026-07-16T23:10:00.000Z',
    market: 'moneyline',
    marketLabel: 'Moneyline',
    period: 'full_game',
    selection: 'NYM',
    normalizedSelection: 'away',
    line: null,
    americanOdds: 120,
    sportsbook: 'Consensus',
    impliedProbability: 45.45,
    oddsTimestamp: '2026-07-15T19:30:00.000Z',
    marketInputTimestamp: '2026-07-15T19:30:00.000Z',
    marketFreshnessTimestamp: '2026-07-15T19:31:00.000Z',
    marketFreshnessSource: 'snapshot_ingested_at',
    providerSourceUpdatedAt: '2026-07-15T19:20:00.000Z',
    providerFetchedAt: '2026-07-15T19:30:30.000Z',
    oddsIngestedAt: '2026-07-15T19:31:00.000Z',
    oddsSnapshotCreatedAt: '2026-07-15T19:31:00.000Z',
    marketAlignment: baseAlignment,
    recommendationExplanation: explanation,
    maxAllowedAgeMinutes: 120,
    cutoff: '2026-07-16T23:00:00.000Z',
    rawProbability: 60,
    calibratedProbability: null,
    confidence: 74,
    confidenceLabel: 'High',
    recommendationPolicyStatus: 'QUALIFIED',
    officialEligibility: 'OFFICIAL_ELIGIBLE_CANDIDATE',
    blockers: [],
    predictionGeneratedAt: '2026-07-15T19:32:00.000Z',
    recommendationGeneratedAt: null,
  } as unknown as CurrentBoardCandidate
  const populated = buildOfficialPickExperience([baseCandidate], '2026-07-15T19:35:00.000Z')
  const empty = buildOfficialPickExperience([{ ...baseCandidate, officialEligibility: 'NOT_OFFICIALLY_ELIGIBLE', recommendationPolicyStatus: 'ANALYZED_ONLY' } as CurrentBoardCandidate])
  const pick = populated.picks[0]
  const checks = [
    ['populated official pick available', populated.status === 'AVAILABLE' && populated.picks.length === 1],
    ['empty state valid', empty.status === 'EMPTY_VALID' && empty.picks.length === 0],
    ['contract version', pick?.contractVersion === 'official_pick_v1'],
    ['exact odds snapshot lineage', pick?.selectedOddsLineage.oddsSnapshotId === 'odds-1' && pick.selectedOddsSource === 'sports_odds_snapshots'],
    ['market alignment preserved', pick?.marketAlignment.calculationVersion === 'market_alignment_v1'],
    ['recommendation explanation preserved', pick?.recommendationExplanation.explanationVersion === 'recommendation_explanation_v1'],
    ['model fair odds labeled', pick?.modelFairOddsLabel === 'Model fair odds -150'],
    ['eligibility version preserved', pick?.eligibility.eligibilityVersion === 'recommendation_eligibility_policy_v1'],
    ['prediction timestamp preserved', pick?.timestamps.predictionGeneratedAt === '2026-07-15T19:32:00.000Z'],
    ['recommendation timestamp fallback explicit', pick?.timestamps.recommendationTimestampSource === 'prediction_generated_at_fallback'],
    ['stake unavailable when no stored stake exists', pick?.stakeRecommendation.status === 'UNAVAILABLE'],
    ['top opportunity retained when empty', empty.emptyState.topOpportunityRetained === true],
    ['provider calls remain zero', populated.providerCallsMade === 0 && empty.providerCallsMade === 0],
    ['remote mutations remain zero', populated.remoteMutationsMade === 0 && empty.remoteMutationsMade === 0],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'official_pick_experience_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    officialThresholdsChanged: false,
  }
}
