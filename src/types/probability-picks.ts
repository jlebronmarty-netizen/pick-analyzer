export type ProbabilityMarketType = 'moneyline' | 'run_line' | 'total' | 'pitcher_outs'

export type ProbabilityPickRisk = 'LOW' | 'MEDIUM' | 'HIGH'

export type ProbabilityPickConfidence = 'LOW' | 'MEDIUM' | 'HIGH'

export type ProbabilityPickQuality = 'LOW' | 'MEDIUM' | 'HIGH'

export type ProbabilityParlayMode = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'

export type ProbabilityParlayScope = 'MULTI_SPORT' | 'MLB_ONLY'

export type ProbabilitySportEligibilityStatus =
  | 'CERTIFIED_ACTIVE'
  | 'CERTIFIED_LIMITED'
  | 'PREVIEW'
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
  eligibleForParlays?: boolean
  reason: string
  engineCertification: string
  displayName?: string
  dataReadiness?: string
  freshness?: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN'
  nextRequirement?: string
}

export type ProbabilitySportEligibilitySummary = {
  eligibleSports: string[]
  excludedSports: string[]
  rankingEligibleSports?: string[]
  parlayEligibleSports?: string[]
  excludedRows: number
  details: Record<string, ProbabilitySportEligibility & {
    rowsSeen: number
    rowsRanked: number
    rowsExcluded: number
    qualifiedRows: number
    excludedRowCount: number
  }>
}

export type ProbabilityTopSignals = {
  highestProbability: ProbabilityPick | null
  highestConfidence: ProbabilityPick | null
  highestQuality: ProbabilityPick | null
  mostStable: ProbabilityPick | null
  bestDataQuality: ProbabilityPick | null
}

export type ProbabilityFreshnessSummary = {
  status: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN'
  latestGeneratedAt: string | null
  oldestGeneratedAt: string | null
  staleRows: number
  agingRows: number
  freshRows: number
}

export type ProbabilityFilterMetadata = {
  sports: Array<{ value: string; label: string; eligible: boolean; reason: string }>
  markets: Array<{ value: ProbabilityMarketType | 'all'; label: string }>
  risk: ProbabilityPickRisk[]
  freshness: ProbabilityFreshnessSummary['status'][]
  certificationLevels: ProbabilitySportEligibilityStatus[]
  defaults: Record<string, string | number>
}

export type ProbabilitySortMetadata = {
  defaultSort: 'score'
  availableSorts: Array<'score' | 'probability' | 'confidence' | 'quality' | 'stability' | 'freshness' | 'eventStart'>
  note: string
}

export type ProbabilityBriefingContext = {
  outlook: 'Review Manually' | 'Wait' | 'Skip Today'
  qualifiedCount: number
  certifiedSports: string[]
  freshness: ProbabilityFreshnessSummary['status']
  mainWarning: string | null
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
  eventStartTime?: string | null
  dataAsOf?: string | null
  providerUpdatedAt?: string | null
  projectionVersion: string
  drivers: string[]
  risks: string[]
  qualificationReasons?: string[]
  mainRisks?: string[]
  explanation?: {
    whyQualified: string[]
    mainRisks: string[]
    nextLinks: Array<{ label: string; href: string }>
  }
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
  version?: 'probability_picks_v2'
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
    rankingEligibleSports?: string[]
    parlayEligibleSports?: string[]
    excludedSports?: string[]
    excludedRowsByReason?: Record<string, number>
    qualifiedRowsBySport?: Record<string, number>
    freshnessSummary?: ProbabilityFreshnessSummary
    topSignals?: ProbabilityTopSignals
  }
  filters: Record<string, string | number | null>
  sportEligibility?: ProbabilitySportEligibilitySummary
  rankingEligibleSports?: string[]
  parlayEligibleSports?: string[]
  excludedSports?: string[]
  excludedRowsByReason?: Record<string, number>
  qualifiedRowsBySport?: Record<string, number>
  freshnessSummary?: ProbabilityFreshnessSummary
  topSignals?: ProbabilityTopSignals
  filterMetadata?: ProbabilityFilterMetadata
  sortMetadata?: ProbabilitySortMetadata
  briefingContext?: ProbabilityBriefingContext
  sections: ProbabilityPickSection[]
  picks: ProbabilityPick[]
  warnings: string[]
}

export type ProbabilityParlaysResponse = {
  success: true
  mode: 'probability_parlays_v1'
  version?: 'probability_parlays_v2'
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
    multiSportAvailable?: boolean
    qualificationReasons?: string[]
  }
  parlays: ProbabilityParlay[]
  warnings: string[]
  presentation?: {
    modes: ProbabilityParlayMode[]
    scopes: Array<{ value: ProbabilityParlayScope; label: string; available: boolean; reason: string }>
    emptyState: string
    aggregateBlockers: string[]
  }
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
