export type Pick2MlbValueSide = 'HOME' | 'AWAY'

export type Pick2MlbValueMarket = 'MONEYLINE'

export type Pick2MlbValueProviderMarketKey = 'h2h'

export type Pick2MlbMarketFreshness = 'FRESH' | 'AGING' | 'STALE'

export type Pick2MlbValueTemporalEligibility =
  | 'PREGAME_VALID'
  | 'PREGAME_VALID_AT_MARKET_ACQUISITION'
  | 'STARTED_GAME_BLOCKED'
  | 'STALE_MARKET_BLOCKED'
  | 'AGING_ANALYTICAL_ONLY'

export type Pick2MlbValueInsertClassification =
  | 'INSERT_ELIGIBLE'
  | 'REUSE_NO_OP'
  | 'BLOCK_CONFLICT'

export interface Pick2MlbMarketValueEvaluation {
  id?: string
  value_identity: string
  prediction_id: string
  game_pk: number
  side: Pick2MlbValueSide
  model_version_id?: string | null
  model_version: string
  model_probability: number
  provider: string
  provider_event_id: string
  bookmaker_key: string
  bookmaker_name?: string | null
  market: Pick2MlbValueMarket
  provider_market_key: Pick2MlbValueProviderMarketKey
  american_odds: number
  home_market_observation_id: string
  away_market_observation_id: string
  selected_side_market_observation_id: string
  raw_implied_probability: number
  no_vig_probability: number
  edge: number
  unit_ev: number
  consensus_probability?: number | null
  consensus_edge?: number | null
  market_dispersion?: number | null
  book_count: number
  market_freshness: Pick2MlbMarketFreshness
  starter_status?: string | null
  temporal_eligibility: Pick2MlbValueTemporalEligibility
  eligibility_flags: string[]
  risk_flags: string[]
  evaluation_method_version: string
  prediction_as_of: string
  provider_last_update?: string | null
  market_acquired_at: string
  evaluated_at: string
  source_payload_digest: string
  evaluation_payload_digest: string
  metadata: Record<string, unknown>
  created_at?: string
}

export interface Pick2MlbMarketValueClassification {
  value_identity: string
  classification: Pick2MlbValueInsertClassification
  existing_id?: string
  conflict_fields?: string[]
}

export interface Pick2MlbMarketValueReadback {
  rowCount: number
  duplicateValueIdentities: number
  missingPredictionLinks: number
  missingGameLinks: number
  missingHomeObservationLinks: number
  missingAwayObservationLinks: number
  missingSelectedObservationLinks: number
  payloadMismatches: number
  mathParityFailures: number
  bookIdentityFailures: number
  temporalEligibilityFailures: number
}
