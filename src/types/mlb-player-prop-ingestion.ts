export type MlbPlayerPropIngestionProvider = 'sportsdataio' | 'the-odds-api'
export type MlbPlayerPropIngestionMarket = 'pitcher_outs_recorded'
export type MlbPlayerPropIngestionSelection = 'OVER' | 'UNDER'
export type MlbPlayerPropIngestionStatus =
  | 'DRY_RUN'
  | 'BLOCKED_PROVIDER_CONTRACT_UNAVAILABLE'
  | 'BLOCKED_PROVIDER_KEY_MISSING'
  | 'BLOCKED_NO_ELIGIBLE_EVENTS'
  | 'BLOCKED_UNSAFE_WRITE'
  | 'SYNCED'
  | 'VALIDATION_FAILED'

export type PitcherPropLine = {
  line: number
  selection: MlbPlayerPropIngestionSelection
  americanOdds: number | null
  decimalOdds: number | null
  impliedProbability: number | null
}

export type PitcherPropBook = {
  sportsbook: string
  bookmakerId: string | null
  provider: MlbPlayerPropIngestionProvider
  providerTimestamp: string | null
  lines: PitcherPropLine[]
}

export type PitcherPropMarket = {
  market: MlbPlayerPropIngestionMarket
  providerMarketKey: string
  eventId: string
  pitcherId: string | null
  providerPitcherId: string | null
  pitcherName: string | null
  books: PitcherPropBook[]
}

export type PitcherPropSnapshot = {
  id: string
  eventId: string
  providerEventId?: string | null
  pitcherId: string | null
  providerPitcherId: string | null
  pitcherName?: string | null
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
  sourceVersion: 'mlb_player_prop_ingestion_v1'
}

export type PitcherPropHealth = {
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
