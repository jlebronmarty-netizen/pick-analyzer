export const PICK_EDGE_CONSUMER_CONTRACT_VERSION = 'pick-edge-consumer-v1' as const

export type ConsumerGameStatus =
  | 'SCHEDULED'
  | 'PREGAME'
  | 'LIVE'
  | 'FINAL'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'UNKNOWN'

export type ConsumerFreshness = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN'
export type ConsumerConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNRATED'
export type ConsumerRecommendationStatus = 'RECOMMENDED' | 'WATCH' | 'NO_PLAY'

export type ConsumerMarketFamily =
  | 'MONEYLINE'
  | 'RUN_LINE'
  | 'TOTAL'
  | 'TEAM_TOTAL'
  | 'NRFI'
  | 'YRFI'
  | 'F5_MONEYLINE'
  | 'F5_RUN_LINE'
  | 'F5_TOTAL'
  | 'PITCHER_STRIKEOUTS'
  | 'PITCHER_OUTS'
  | 'PITCHER_EARNED_RUNS'
  | 'PITCHER_HITS_ALLOWED'
  | 'PITCHER_WALKS'
  | 'BATTER_HITS'
  | 'BATTER_TOTAL_BASES'
  | 'BATTER_HOME_RUNS'
  | 'BATTER_RUNS'
  | 'BATTER_RBI'
  | 'BATTER_HRRBI'
  | string

export type ConsumerTeamRef = {
  id: string | null
  mlbTeamId: number | null
  name: string
  abbreviation: string | null
  logoUrl?: string | null
}

export type ConsumerPlayerRef = {
  id: string | null
  mlbamPersonId: number | null
  name: string
  teamId: string | null
  position?: string | null
  handedness?: 'L' | 'R' | 'S' | null
}

export type ConsumerStarter = {
  player: ConsumerPlayerRef
  status: 'CONFIRMED' | 'PROBABLE' | 'EXPECTED' | 'UNDECIDED' | 'SCRATCHED' | 'UNKNOWN'
  confidence: number | null
  observedAt: string | null
}

export type ConsumerBookQuote = {
  quoteId: string | null
  bookKey: string
  bookName: string
  line: number | null
  americanOdds: number | null
  impliedProbability: number | null
  noVigProbability: number | null
  acquiredAt: string | null
  providerLastUpdate: string | null
  freshness: ConsumerFreshness
  isBestPrice: boolean
  suspended?: boolean
}

export type ConsumerProjection = {
  value: number | null
  unit: string | null
  low?: number | null
  high?: number | null
  modelVersion: string | null
  generatedAt: string | null
}

export type ConsumerRecommendationMetadata = {
  status: ConsumerRecommendationStatus
  label: string
  confidenceTier: ConsumerConfidenceTier
  confidenceScore: number | null
  reasonCodes: string[]
  riskFlags: string[]
  explanation: string
  productAction: 'ANALYSIS_ONLY'
}

export type ConsumerOpportunity = {
  opportunityId: string
  sport: 'MLB'
  gamePk: number
  family: ConsumerMarketFamily
  market: string
  subjectType: 'GAME' | 'TEAM' | 'PLAYER'
  subjectId: string | null
  subjectName: string
  selection: string
  line: number | null
  projection: ConsumerProjection
  modelProbability: number | null
  impliedProbability: number | null
  noVigProbability: number | null
  fairAmericanOdds: number | null
  edge: number | null
  expectedValue: number | null
  consensusProbability: number | null
  consensusEdge: number | null
  marketDispersion: number | null
  bestQuote: ConsumerBookQuote | null
  quotes: ConsumerBookQuote[]
  recommendation: ConsumerRecommendationMetadata
  freshness: ConsumerFreshness
  dataAsOf: string | null
  dataQualityScore: number | null
  sourceLineageAvailable: boolean
}

export type ConsumerMainLine = {
  family: 'MONEYLINE' | 'RUN_LINE' | 'TOTAL'
  home: ConsumerBookQuote | null
  away: ConsumerBookQuote | null
  over?: ConsumerBookQuote | null
  under?: ConsumerBookQuote | null
}

export type ConsumerGame = {
  sport: 'MLB'
  gamePk: number
  officialDate: string
  startTime: string | null
  status: ConsumerGameStatus
  venue: string | null
  away: ConsumerTeamRef
  home: ConsumerTeamRef
  awayStarter: ConsumerStarter | null
  homeStarter: ConsumerStarter | null
  projectedAwayRuns: number | null
  projectedHomeRuns: number | null
  awayWinProbability: number | null
  homeWinProbability: number | null
  mainLines: ConsumerMainLine[]
  smartPlay: ConsumerOpportunity | null
  bestByMarket: ConsumerOpportunity[]
  dataAsOf: string | null
  freshness: ConsumerFreshness
}

export type ConsumerMeta = {
  contractVersion: typeof PICK_EDGE_CONSUMER_CONTRACT_VERSION
  generatedAt: string
  dataAsOf: string | null
  timezone: 'America/Puerto_Rico'
  source: 'pick-analyzer'
  stale: boolean
  warnings: string[]
}

export type ConsumerEnvelope<T> = {
  meta: ConsumerMeta
  data: T
}

export type ConsumerSort = 'probability' | 'edge' | 'ev' | 'game_time'

export type ConsumerHealth = {
  gamesAsOf: string | null
  oddsAsOf: string | null
  projectionsAsOf: string | null
  lineupsAsOf: string | null
  statcastThrough: string | null
  modelReadiness: string | null
  freshness: ConsumerFreshness
  staleComponents: string[]
  warnings: string[]
}
