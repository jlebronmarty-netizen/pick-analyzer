export type Pick2MlbOfficialPickSport = 'MLB'

export type Pick2MlbOfficialPickMarket = 'MONEYLINE'

export type Pick2MlbOfficialPickSide = 'HOME' | 'AWAY'

export type Pick2MlbOfficialPickDecisionStatus = 'OFFICIAL_PICK'

export type Pick2MlbOfficialPickInsertClassification =
  | 'INSERT_ELIGIBLE'
  | 'REUSE_NO_OP'
  | 'BLOCK_CONFLICT'

export interface Pick2MlbOfficialPick {
  id?: string
  official_pick_identity: string
  prediction_id: string
  value_evaluation_id: string
  game_pk: number
  sport: Pick2MlbOfficialPickSport
  market: Pick2MlbOfficialPickMarket
  side: Pick2MlbOfficialPickSide
  bookmaker_key: string
  bookmaker_name?: string | null
  american_odds: number
  model_version: string
  model_probability: number
  consensus_probability?: number | null
  consensus_edge: number
  unit_ev: number
  policy_version: string
  decision_status: Pick2MlbOfficialPickDecisionStatus
  eligibility_flags: string[]
  risk_flags: string[]
  reason_codes: string[]
  blocker_codes: string[]
  prediction_as_of: string
  market_acquired_at: string
  evaluated_at: string
  decision_at: string
  source_payload_digest: string
  decision_payload_digest: string
  metadata: Record<string, unknown>
  created_at?: string
}

export interface Pick2MlbOfficialPickClassification {
  official_pick_identity: string
  classification: Pick2MlbOfficialPickInsertClassification
  existing_id?: string
  conflict_fields?: string[]
}

export interface Pick2MlbOfficialPickReadback {
  rowCount: number
  duplicateOfficialPickIdentities: number
  missingPredictionLinks: number
  missingValueEvaluationLinks: number
  missingGameLinks: number
  payloadMismatches: number
  bookPriceMismatches: number
  policyVersionMismatches: number
  reasonCodeMismatches: number
  riskFlagMismatches: number
  timestampMismatches: number
  digestMismatches: number
}
