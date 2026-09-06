export type MlbDecisionStatus = 'APOSTAR' | 'LEAN' | 'NO_BET' | 'BLOCKED'
export type MlbDecisionConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKED'
export type MlbDecisionKind = 'market' | 'prop'
export type MlbPropGroup = 'pitcher' | 'batter'

export type MlbBookQuote = {
  book: 'FanDuel' | 'Caesars'
  // The raw odds snapshot schema permits null prices. Decision construction filters
  // unusable quotes before comparison, but this boundary intentionally mirrors the source.
  odds: any
  line: number | null
  observedAt: string | null
}

export type MlbDecisionItem = {
  id: string
  kind: MlbDecisionKind
  eventId: string
  matchup: string
  scheduledTime: string | null
  eventStatus: string
  category: string
  marketKey: string
  label: string
  subject: string
  propGroup: MlbPropGroup | null
  side: string
  line: number | null
  bestBook: 'FanDuel' | 'Caesars' | null
  bestOdds: number | null
  quotes: MlbBookQuote[]
  projectedValue: number | null
  modelProbability: number | null
  noVigProbability: number | null
  edge: number | null
  confidence: MlbDecisionConfidence
  decision: MlbDecisionStatus
  reasons: string[]
  risks: string[]
  blockers: string[]
  modelVersion: string
  capturedAt: string | null
  maxPrice: number | null
  lineupStatus: string | null
  starterStatus: string | null
  dataSufficiency: number | null
  featureQuality: number | null
}

export type MlbDecisionBoardData = {
  success: boolean
  mode: 'mlb_decision_board_v1'
  selectedDate: string
  generatedAt: string
  refreshSeconds: number
  productionActivationEnabled: false
  summary: {
    games: number
    pregameGames: number
    decisions: number
    betCount: number
    leanCount: number
    noBetCount: number
    blockedCount: number
    props: number
    markets: number
    confirmedLineups: number
    expectedLineups: number
    confirmedStarters: number
    latestOddsAt: string | null
    sportsbooks: string[]
  }
  props: MlbDecisionItem[]
  markets: MlbDecisionItem[]
  blockers: string[]
  diagnostics: {
    playerProjectionMode: string | null
    marketInventoryMode: string | null
    projectionMode: string | null
    rawPropOddsRows: number
    mappedPropPairs: number
    currentMarketRows: number
    notes: string[]
  }
}
