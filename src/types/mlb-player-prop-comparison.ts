export type PitcherPropMarketKey = 'pitcher_outs_recorded'
export type PitcherPropOutcome = 'OVER' | 'UNDER'
export type PitcherPropComparisonStatus =
  | 'MODEL_FAVORS_OVER'
  | 'MODEL_FAVORS_UNDER'
  | 'MARKET_ALIGNED'
  | 'LOW_DATA'
  | 'LINE_MISMATCH'
  | 'NO_PROP_AVAILABLE'
  | 'NO_STARTER'
  | 'PROJECTION_ONLY'

export type PitcherPropMarket = {
  marketKey: PitcherPropMarketKey
  displayName: string
  supportedLines: number[]
  providerOwnership: string
  providerCallsMade: number
  remoteMutationsMade: number
}

export type PitcherPropLine = {
  lineId: string
  eventId: string
  pitcherId: string | null
  providerPitcherId: string | null
  pitcherName: string | null
  sportsbook: string
  bookmakerId: string | null
  provider: string
  marketId: string | null
  marketKey: PitcherPropMarketKey
  outcome: PitcherPropOutcome
  line: number
  americanOdds: number | null
  decimalOdds: number | null
  impliedProbability: number | null
  lastUpdate: string | null
  snapshotId: string
}

export type PitcherPropEdge = {
  outcome: PitcherPropOutcome
  line: number
  modelProbability: number | null
  impliedProbability: number | null
  probabilityDifference: number | null
  fairAmericanOdds: number | null
  fairDecimalOdds: number | null
  edgePoints: number | null
  status: PitcherPropComparisonStatus
}

export type PitcherPropComparison = {
  comparisonId: string
  projectionId: string
  eventId: string
  pitcherId: string
  providerPitcherId: string | null
  historicalPitcherId: string | null
  pitcherName: string
  matchup: string
  starterStatus: string
  marketKey: PitcherPropMarketKey
  marketLabel: string
  sportsbook: string | null
  bookmakerId: string | null
  line: number | null
  overLine: PitcherPropLine | null
  underLine: PitcherPropLine | null
  overEdge: PitcherPropEdge | null
  underEdge: PitcherPropEdge | null
  bestStatus: PitcherPropComparisonStatus
  projectionConfidence: number
  projectionQuality: number
  dataSufficiency: string
  marketFreshness: string
  bookFreshness: string
  historicalStartsUsed: number
  generatedAt: string
  cutoffAt: string | null
  warnings: string[]
  notes: string[]
  recommendationStatus: 'MODEL_MARKET_COMPARISON_ONLY'
}

export type PitcherPropHealth = {
  success: boolean
  mode: string
  generatedAt: string
  providerCallsMade: number
  remoteMutationsMade: number
  projectionsEvaluated: number
  marketRowsEvaluated: number
  comparisonsGenerated: number
  noPropAvailable: number
  lineMismatchRows: number
  duplicateSportsbookLines: number
  supportedRecordedOutsRows: number
  sportsbooks: string[]
  freshness: {
    latestMarketUpdate: string | null
    oldestMarketUpdate: string | null
  }
  validation: {
    success: boolean
    failedChecks: string[]
  }
}
