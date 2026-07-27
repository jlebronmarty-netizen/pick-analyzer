export type ProbabilityMarketType = 'moneyline' | 'run_line' | 'total' | 'pitcher_outs'

export type ProbabilityPickRisk = 'LOW' | 'MEDIUM' | 'HIGH'

export type ProbabilityPickConfidence = 'LOW' | 'MEDIUM' | 'HIGH'

export type ProbabilityPickQuality = 'LOW' | 'MEDIUM' | 'HIGH'

export type ProbabilityParlayMode = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'

export type ProbabilityParlayScope = 'MULTI_SPORT' | 'MLB_ONLY'

export type ProbabilitySportEligibilityStatus =
  | 'CERTIFIED_ACTIVE'
  | 'CERTIFIED_LIMITED'
  | 'SHADOW_ONLY'
  | 'INSUFFICIENT_DATA'
  | 'ENGINE_NOT_CERTIFIED'
  | 'OUT_OF_SEASON'
  | 'STALE'
  | 'BLOCKED'

export type ProbabilityDataStatus =
  | 'LIVE_PROVIDER'
  | 'CURRENT_STORED'
  | 'STALE_STORED'
  | 'MODEL_GENERATED'
  | 'FALLBACK'
  | 'FIXTURE'
  | 'SHADOW'
  | 'PREVIEW'
  | 'EMPTY'
  | 'BLOCKED'
  | 'UNKNOWN'

export type ProbabilitySportEligibility = {
  status: ProbabilitySportEligibilityStatus
  eligibleForRanking: boolean
  reason: string
  engineCertification: string
}

export type ProbabilitySportEligibilitySummary = {
  eligibleSports: string[]
  excludedSports: string[]
  excludedRows: number
  details: Record<string, ProbabilitySportEligibility & {
    rowsSeen: number
    rowsRanked: number
    rowsExcluded: number
  }>
}

export type ProbabilityPick = {
  id: string
  sport: string
  eventId: string
  marketType: ProbabilityMarketType
  selection: string
  modelProbability: number
  confidence: number
  quality: number
  risk: ProbabilityPickRisk
  starterStatus: string
  generatedAt: string
  cutoffAt: string | null
  projectionVersion: string
  drivers: string[]
  risks: string[]
  correlationGroup: string
  recommendationType: 'PROBABILITY_ONLY'
  score: number
  freshness: number
  featureCompleteness: number
  source: 'prediction_history' | 'mlb_pitcher_projection_engine'
  sportEligibility: ProbabilitySportEligibility
  dataStatus: ProbabilityDataStatus
}

export type ProbabilityPickSection = {
  id: string
  label: string
  picks: ProbabilityPick[]
}

export type ProbabilityParlayLeg = Pick<
  ProbabilityPick,
  | 'id'
  | 'sport'
  | 'eventId'
  | 'marketType'
  | 'selection'
  | 'modelProbability'
  | 'confidence'
  | 'quality'
  | 'risk'
  | 'correlationGroup'
  | 'recommendationType'
>

export type ProbabilityParlay = {
  id: string
  mode: ProbabilityParlayMode
  scope: ProbabilityParlayScope
  legCount: number
  legs: ProbabilityParlayLeg[]
  combinedProbability: number
  confidence: number
  quality: number
  risk: ProbabilityPickRisk
  correlationPenalty: number
  correlationWarnings: string[]
  drivers: string[]
  risks: string[]
  recommendationType: 'PROBABILITY_ONLY'
  generatedAt: string
}

export type ProbabilityPicksResponse = {
  success: true
  mode: 'probability_picks_v1'
  generatedAt: string
  dryRun: true
  providerCallsMade: 0
  remoteMutationsMade: 0
  summary: {
    picksGenerated: number
    sectionsGenerated: number
    sports: string[]
    markets: ProbabilityMarketType[]
    projectionOnly: true
    sportEligibility: ProbabilitySportEligibilitySummary
  }
  filters: Record<string, string | number | null>
  sections: ProbabilityPickSection[]
  picks: ProbabilityPick[]
  warnings: string[]
}

export type ProbabilityParlaysResponse = {
  success: true
  mode: 'probability_parlays_v1'
  generatedAt: string
  dryRun: true
  providerCallsMade: 0
  remoteMutationsMade: 0
  summary: {
    parlaysGenerated: number
    legsMin: number
    legsMax: number
    mode: ProbabilityParlayMode
    scope: ProbabilityParlayScope
    projectionOnly: true
  }
  parlays: ProbabilityParlay[]
  warnings: string[]
}

export type ProbabilityValidationResponse = {
  success: boolean
  mode: 'probability_picks_validation_v1'
  checks: number
  passed: number
  failed: number
  failedChecks: string[]
  providerCallsMade: 0
  remoteMutationsMade: 0
}
