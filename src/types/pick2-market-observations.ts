export type Pick2MlbMarket = 'MONEYLINE'

export type Pick2MlbMarketProviderKey = 'h2h'

export type Pick2MlbMarketSide = 'HOME' | 'AWAY'

export type Pick2MlbMarketInsertClassification =
  | 'INSERT_ELIGIBLE'
  | 'REUSE_NO_OP'
  | 'BLOCK_CONFLICT'

export interface Pick2MlbMarketPriceObservation {
  id?: string
  observation_identity: string
  game_pk: number
  provider: string
  provider_event_id: string
  market_event_mapping_id?: string | null
  region?: string | null
  bookmaker_key: string
  bookmaker_name?: string | null
  market: Pick2MlbMarket
  provider_market_key: Pick2MlbMarketProviderKey
  side: Pick2MlbMarketSide
  outcome_name?: string | null
  american_odds: number
  provider_last_update?: string | null
  acquired_at: string
  commence_time?: string | null
  source_payload_digest: string
  source_response_digest?: string | null
  source_provenance: Record<string, unknown>
  created_at?: string
}

export interface Pick2MlbMarketPriceObservationReadback {
  rowCount: number
  duplicateObservationIdentities: number
  duplicateNativeBookSideStates: number
  gamePkCount: number
  bookmakerCount: number
  moneylineRows: number
  homeSideRows: number
  awaySideRows: number
  invalidAmericanOdds: number
  missingProviderOrAcquisitionTimestamp: number
  missingSourceProvenance: number
}
