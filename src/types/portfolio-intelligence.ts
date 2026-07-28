import type { ProbabilityFreshnessSummary, ProbabilityMarketType, ProbabilityPickRisk } from '@/types/probability-picks'

export type PortfolioRelationshipClass =
  | 'SAME_EVENT'
  | 'SAME_TEAM'
  | 'OPPOSING_SIDES'
  | 'MONEYLINE_RUNLINE_RELATIONSHIP'
  | 'SIDE_TOTAL_RELATIONSHIP'
  | 'PLAYER_TEAM_RELATIONSHIP'
  | 'CROSS_SPORT'
  | 'INDEPENDENCE_UNKNOWN'
  | 'INSUFFICIENT_EVIDENCE'

export type PortfolioDependencyTolerance = 'all' | 'lower_shared_exposure' | 'cross_sport_only'

export type PortfolioOpportunityStatus = 'ELIGIBLE' | 'BLOCKED'

export type PortfolioOpportunity = {
  id: string
  sport: string
  eventId: string
  market: ProbabilityMarketType
  selection: string
  modelProbability: number
  confidence: number
  quality: number
  currentPriceAvailable: boolean
  currentPrice: number | null
  freshness: ProbabilityFreshnessSummary['status']
  status: PortfolioOpportunityStatus
  dataSufficiency: number
  sharedEventExposureKey: string
  sharedTeamExposureKey: string | null
  sharedPlayerExposureKey: string | null
  evidenceSource: 'probability_picks' | 'probability_picks_current_board_overlay'
  blockers: string[]
  risk: ProbabilityPickRisk
}

export type PortfolioCombination = {
  id: string
  legCount: number
  legs: PortfolioOpportunity[]
  relationshipClasses: PortfolioRelationshipClass[]
  naiveJointProbability: number
  naiveJointProbabilityLabel: string
  combinedEvidenceQuality: number
  weakestLeg: PortfolioOpportunity
  concentrationScore: number
  diversification: 'Diversified by sport' | 'Lower shared exposure' | 'Concentrated' | 'Same-event dependent' | 'Insufficient evidence'
  dependencyWarnings: string[]
  uncertaintyFlags: string[]
  blocked: boolean
  blockers: string[]
}

export type PortfolioIntelligenceResponse = {
  success: true
  mode: 'portfolio_intelligence_v1'
  generatedAt: string
  dryRun: true
  providerCallsMade: 0
  remoteMutationsMade: 0
  sourceOpportunityCount: number
  eligibleOpportunityCount: number
  availableSports: string[]
  evidenceCoverage: {
    currentPriceAvailable: number
    currentPriceUnavailable: number
    staleInputs: number
    blockedOpportunities: number
  }
  freshness: ProbabilityFreshnessSummary
  calculationAssumptions: string[]
  filters: {
    sport: string | null
    market: string | null
    size: number
    limit: number
    dependency: PortfolioDependencyTolerance
    freshnessRequirement: ProbabilityFreshnessSummary['status'] | 'all'
  }
  combinations: PortfolioCombination[]
  blockedCombinations: PortfolioCombination[]
  strongestEvidenceCombination: PortfolioCombination | null
  highestNaiveJointProbability: PortfolioCombination | null
  lowestSharedExposure: PortfolioCombination | null
  exclusions: Array<{ id: string; reason: string }>
  warnings: string[]
}
