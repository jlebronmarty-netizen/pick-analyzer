import type { MlbPlayerPropMarketKey } from '@/config/mlb-player-prop-markets'

export type MlbPlayerPropIngestionProvider = 'sportsdataio' | 'the-odds-api'
export type MlbPlayerPropIngestionMarket = MlbPlayerPropMarketKey
export type MlbPlayerPropIngestionSelection = 'OVER' | 'UNDER'
export type MlbPlayerPropIngestionStatus =
  | 'DRY_RUN'
  | 'BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE'
  | 'BLOCKED_PROVIDER_KEY_MISSING'
  | 'BLOCKED_NO_ELIGIBLE_EVENTS'
  | 'BLOCKED_UNSAFE_WRITE'
  | 'SYNCED'
  | 'VALIDATION_FAILED'

export type MlbPlayerPropLine = {
  line: number
  selection: MlbPlayerPropIngestionSelection
  americanOdds: number | null
  decimalOdds: number | null
  impliedProbability: number | null
}

export type MlbPlayerPropBook = {
  sportsbook: string
  bookmakerId: string | null
  provider: MlbPlayerPropIngestionProvider
  providerTimestamp: string | null
  lines: MlbPlayerPropLine[]
}

export type MlbPlayerPropMarket = {
  market: MlbPlayerPropIngestionMarket
  providerMarketKey: string
  eventId: string
  playerId: string | null
  providerPlayerId: string | null
  playerName: string | null
  books: MlbPlayerPropBook[]
}

export type MlbPlayerPropSnapshot = {
  id: string
  eventId: string
  providerEventId?: string | null
  playerId: string | null
  providerPlayerId: string | null
  playerName?: string | null
  market: MlbPlayerPropIngestionMarket
  providerMarketKey: string
  line: number
  selection: MlbPlayerPropIngestionSelection
  sportsbook: string
  bookmakerId: string | null
  americanOdds: number | null
  decimalOdds: number | null
  impliedProbability: number | null
  providerTimestamp: string
  storedTimestamp: string
  snapshotId: string
  provider: MlbPlayerPropIngestionProvider
  sourceVersion: 'mlb_player_prop_ingestion_v1' | 'mlb_player_prop_multi_market_v1'
}

export type MlbPlayerPropHealth = {
  success: boolean
  mode: 'mlb_player_prop_ingestion_health_v1'
  generatedAt: string
  status: MlbPlayerPropIngestionStatus
  providerCallsMade: number
  remoteMutationsMade: number
  rowsRead: number
  rowsNormalized: number
  rowsEligibleForStorage: number
  rowsPersisted: number
  duplicateSnapshots: number
  supportedRecordedOutsRows: number
  supportedRowsByMarket: Record<MlbPlayerPropIngestionMarket, number>
  sportsbooks: string[]
  markets: MlbPlayerPropIngestionMarket[]
  freshness: {
    latestProviderTimestamp: string | null
    latestStoredTimestamp: string | null
  }
  blockers: string[]
  validation: {
    success: boolean
    failedChecks: string[]
  }
}

export type PitcherPropLine = MlbPlayerPropLine
export type PitcherPropBook = MlbPlayerPropBook
export type PitcherPropMarket = MlbPlayerPropMarket & {
  pitcherId?: string | null
  providerPitcherId?: string | null
  pitcherName?: string | null
}
export type PitcherPropSnapshot = MlbPlayerPropSnapshot & {
  pitcherId?: string | null
  providerPitcherId?: string | null
  pitcherName?: string | null
}
export type PitcherPropHealth = MlbPlayerPropHealth
