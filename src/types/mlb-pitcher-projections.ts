export type PitcherStarterStatus = 'CONFIRMED' | 'PROBABLE' | 'EXPECTED' | 'UNVERIFIED'
export type PitcherFeatureAvailability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE'
export type PitcherDataSufficiency = 'FULL' | 'STANDARD' | 'LIMITED' | 'INSUFFICIENT'
export type PitcherConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT'
export type PitcherRecommendationStatus = 'MODEL_PROJECTION_ONLY'

export type PitcherFeatureValue = {
  value: number | string | boolean | null
  source: string
  sourceTimestamp: string | null
  availability: PitcherFeatureAvailability
  fallbackUsed: boolean
  reliability: number
  cutoffAt: string | null
}

export type PitcherIdentity = {
  pitcherId: string
  providerPitcherId: string | null
  mlbPlayerId: string | null
  pitcherName: string
  team: string | null
  handedness: string | null
  activeStatus: string | null
}

export type PitcherStarterAssignment = {
  eventId: string
  teamId: string | null
  opponentTeamId: string | null
  opponent: string | null
  homeAway: 'home' | 'away' | null
  starterStatus: PitcherStarterStatus
  starterSource: string
  starterConfirmedAt: string | null
  eventStartTime: string | null
  cutoffAt: string | null
}

export type PitcherGameLog = {
  gameId: string
  gameDate: string | null
  opponent: string | null
  homeAway: 'home' | 'away' | null
  started: boolean
  inningsPitched: number
  recordedOuts: number
  pitchesThrown: number | null
  battersFaced: number
  strikeouts: number
  walks: number
  hits: number
  earnedRuns: number
  homeRuns: number | null
  daysOfRest: number | null
  sourceTimestamp: string | null
}

export type PitcherSeasonProfile = {
  starts: number
  averageOuts: number | null
  medianOuts: number | null
  standardDeviationOuts: number | null
  averageInnings: number | null
  averagePitchCount: number | null
  medianPitchCount: number | null
  pitchesPerInning: number | null
  battersFacedPerInning: number | null
  strikeoutRate: number | null
  walkRate: number | null
  whip: number | null
  era: number | null
}

export type PitcherRecentForm = {
  last3Starts: number
  last5Starts: number
  last10Starts: number
  weightedRecentOuts: number | null
  weightedRecentPitchCount: number | null
  workloadTrend: number | null
  efficiencyTrend: number | null
  shortRestIndicator: boolean
}

export type PitcherOpponentContext = {
  opponentTeamId: string | null
  opponent: string | null
  strikeoutTendency: number | null
  walkTendency: number | null
  offensiveStrength: number | null
  handednessSplit: number | null
  lineupStrength: number | null
  availability: PitcherFeatureAvailability
}

export type PitcherWorkloadContext = {
  pctReach15: number | null
  pctReach16: number | null
  pctReach17: number | null
  pctReach18: number | null
  pctReach19: number | null
  earlyExitFrequency: number | null
  volatility: number | null
  workloadClassification: 'WORKHORSE' | 'STANDARD' | 'LIMITED' | 'VOLATILE' | 'INSUFFICIENT'
}

export type PitcherProjectionFeatures = {
  identity: PitcherIdentity
  starterAssignment: PitcherStarterAssignment
  gameLogs: PitcherGameLog[]
  seasonProfile: PitcherSeasonProfile
  recentForm: PitcherRecentForm
  opponentContext: PitcherOpponentContext
  workloadContext: PitcherWorkloadContext
  featureValues: Record<string, PitcherFeatureValue>
  dataSufficiency: PitcherDataSufficiency
  qualityScore: number
  blockers: string[]
  warnings: string[]
  leakageCounters: PitcherProjectionHealth['leakageCounters']
  rowsRead: number
}

export type PitcherOutsDistribution = {
  minOuts: number
  maxOuts: number
  meanOuts: number
  standardDeviation: number
  outcomes: Array<{ outs: number; probability: number }>
}

export type PitcherProjectionExplanation = {
  mainDrivers: string[]
  mainRisks: string[]
  warnings: string[]
  blockers: string[]
}

export type MlbPitcherProjection = {
  projectionId: string
  eventId: string
  pitcherId: string
  providerPitcherId: string | null
  pitcherName: string
  team: string | null
  opponent: string | null
  homeAway: 'home' | 'away' | null
  handedness: string | null
  starterStatus: PitcherStarterStatus
  starterSource: string
  starterConfirmedAt: string | null
  projectedOuts: number | null
  projectedInnings: number | null
  projectedPitchCount: number | null
  projectedStrikeouts: number | null
  projectedHitsAllowed: number | null
  projectedEarnedRuns: number | null
  secondaryAvailability: {
    pitchCount: PitcherFeatureAvailability
    innings: PitcherFeatureAvailability
    strikeouts: PitcherFeatureAvailability
    hitsAllowed: PitcherFeatureAvailability
    earnedRuns: PitcherFeatureAvailability
  }
  outsDistribution: PitcherOutsDistribution | null
  overProbabilities: Record<'14.5' | '15.5' | '16.5' | '17.5' | '18.5', number | null>
  underProbabilities: Record<'14.5' | '15.5' | '16.5' | '17.5' | '18.5', number | null>
  confidence: number
  confidenceLevel: PitcherConfidenceLevel
  qualityScore: number
  dataSufficiency: PitcherDataSufficiency
  recommendationStatus: PitcherRecommendationStatus
  featureSnapshot: PitcherProjectionFeatures
  mainDrivers: string[]
  mainRisks: string[]
  blockers: string[]
  warnings: string[]
  expectedWorkloadClassification: PitcherWorkloadContext['workloadClassification']
  modelVersion: string
  generatedAt: string
  eventStartTime: string | null
  cutoffAt: string | null
}

export type PitcherProjectionHealth = {
  success: boolean
  mode: string
  generatedAt: string
  providerCallsMade: number
  remoteMutationsMade: number
  rowsRead: number
  rowsGenerated: number
  rowsPersisted: number
  rowsSkipped: number
  warnings: string[]
  validation: {
    success: boolean
    failedChecks: string[]
  }
  leakageCounters: {
    postStartFeatures: number
    postFinalFeatures: number
    futureGameLogs: number
    futureLineups: number
    futureStarterUpdates: number
    invalidFeatureTimestamps: number
  }
}
