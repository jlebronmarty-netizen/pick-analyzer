export type Pick2MlbValueBoardStatus =
  | 'OFFICIAL_PICK'
  | 'VALUE_CANDIDATE'
  | 'WATCHLIST'
  | 'BLOCKED'

export type Pick2MlbValueBoardSide = 'HOME' | 'AWAY'

export type Pick2MlbValueBoardMarket = 'MONEYLINE'

export interface Pick2MlbValueBoardFactorEdge {
  family:
    | 'team_form_strength'
    | 'starter_context'
    | 'bullpen_context'
    | 'offense_context'
    | 'matchup_context'
    | 'first_inning_context'
    | 'market_consensus'
    | 'market_dispersion'
    | 'starter_certainty'
  direction: 'supports_pick' | 'adds_risk' | 'context_only'
  label: string
  detail: string
}

export interface Pick2MlbValueBoardRow {
  game_pk: number
  game_date: string | null
  start_time: string | null
  home_team: string | null
  away_team: string | null
  side: Pick2MlbValueBoardSide
  market: Pick2MlbValueBoardMarket
  status: Pick2MlbValueBoardStatus
  status_rank: number
  board_rank: number
  value_score: number
  best_book: string
  bookmaker_name: string | null
  american_odds: number
  model_probability: number
  consensus_probability: number | null
  consensus_edge: number
  unit_ev: number
  book_count: number
  market_dispersion: number | null
  market_freshness: string
  starter_status: string
  risk_flags: string[]
  reason_codes: string[]
  blocker_codes: string[]
  why: string[]
  risk_explanation: string[]
  blocker_explanation: string[]
  factor_edge: Pick2MlbValueBoardFactorEdge[]
  policy_version: string
  prediction_id: string
  value_evaluation_id: string
  official_pick_identity: string | null
  prediction_as_of: string
  market_acquired_at: string
  evaluated_at: string
  decision_at: string | null
}

export interface Pick2MlbValueBoardFilters {
  statuses: Pick2MlbValueBoardStatus[]
  game_pk?: number
  team?: string
  side?: Pick2MlbValueBoardSide
  bookmaker_key?: string
  starter_status?: string
  market_freshness?: string
  minimum_edge?: number
  minimum_ev?: number
  risk_flags?: string[]
}

export interface Pick2MlbValueBoardSortOption {
  key: 'board_priority' | 'consensus_edge' | 'unit_ev' | 'model_probability' | 'start_time' | 'american_odds'
  direction: 'asc' | 'desc'
}

export interface Pick2MlbValueBoardContract {
  policy_version: string
  statuses: Pick2MlbValueBoardStatus[]
  rows: Pick2MlbValueBoardRow[]
  filters: Pick2MlbValueBoardFilters
  default_sort: Pick2MlbValueBoardSortOption
  publication_state: 'PREPARED_NOT_PUBLIC'
  feature_gate: 'READY_DISABLED'
  model_limitation_note: string
  profitability_claim_state: 'NO_HISTORICAL_PROFITABILITY_CLAIM'
}
