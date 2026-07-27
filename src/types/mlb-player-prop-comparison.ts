import type { MlbPlayerPropMarketKey } from '@/config/mlb-player-prop-markets'

export type PitcherPropMarketKey = MlbPlayerPropMarketKey
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
  shortLabel?: string
  family?: 'pitcher' | 'batter'
  providerMarketKeys?: string[]
  supportedLines: number[]
  storedRows?: number
  availableBookmakers?: string[]
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
  playerId?: string
  providerPitcherId: string | null
  providerPlayerId?: string | null
  historicalPitcherId: string | null
  pitcherName: string
  playerName?: string
  matchup: string
  starterStatus: string
  marketKey: PitcherPropMarketKey
  marketLabel: string
  marketFamily?: 'pitcher' | 'batter'
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
  emptyStateReason?: 'NO_CURRENT_SPORTSBOOK_LINE' | 'NO_PROJECTION_EXISTS' | 'IDENTITY_UNRESOLVED' | 'PROVIDER_UNAVAILABLE' | 'NO_PROP_AVAILABLE'
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
  supportedRowsByMarket?: Record<PitcherPropMarketKey, number>
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
