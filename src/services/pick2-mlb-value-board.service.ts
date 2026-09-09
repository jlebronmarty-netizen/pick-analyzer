import 'server-only'


import type {
  Pick2MlbValueBoardContract,
  Pick2MlbValueBoardFactorEdge,
  Pick2MlbValueBoardMarket,
  Pick2MlbValueBoardRow,
  Pick2MlbValueBoardSide,
  Pick2MlbValueBoardStatus,
} from '@/types/pick2-value-board'

export const PICK2_MLB_VALUE_BOARD_POLICY_VERSION = 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1'

export const PICK2_MLB_VALUE_BOARD_STATUSES: Pick2MlbValueBoardStatus[] = [
  'OFFICIAL_PICK',
  'VALUE_CANDIDATE',
  'WATCHLIST',
  'BLOCKED',
]

export const PICK2_MLB_VALUE_BOARD_STATUS_RANK: Record<Pick2MlbValueBoardStatus, number> = {
  OFFICIAL_PICK: 1,
  VALUE_CANDIDATE: 2,
  WATCHLIST: 3,
  BLOCKED: 4,
}

export function isPick2MlbValueBoardEnabled(): boolean {
  return process.env.PICK2_MLB_VALUE_BOARD_ENABLED === 'true'
}

export type Pick2MlbValueBoardSourceStatus =
  | 'OFFICIAL_PICK'
  | 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN'
  | 'VALUE_CANDIDATE'
  | 'VALUE_CANDIDATE_ONLY'
  | 'WATCHLIST'
  | 'BLOCKED'

export interface Pick2MlbValueBoardSourceRow {
  game_pk: number
  game_date?: string | null
  start_time?: string | null
  home_team?: string | null
  away_team?: string | null
  teams?: string | null
  side: Pick2MlbValueBoardSide
  market?: Pick2MlbValueBoardMarket
  status: Pick2MlbValueBoardSourceStatus
  best_book?: string
  bookmaker_key?: string
  bookmaker_name?: string | null
  best_american_odds?: number
  american_odds?: number
  model_probability: number
  consensus_probability?: number | null
  consensus_edge: number
  best_price_unit_ev?: number
  unit_ev?: number
  book_count: number
  market_dispersion?: number | null
  freshness?: string
  market_freshness?: string
  starter_status?: string | null
  riskFlags?: string[]
  risk_flags?: string[]
  reason_codes?: string[]
  blockers?: string[]
  blocker_codes?: string[]
  policy_version?: string
  prediction_id: string
  value_evaluation_id: string
  official_pick_identity?: string | null
  prediction_as_of?: string
  market_acquired_at?: string
  evaluated_at?: string
  decision_at?: string | null
}

export function normalizeMlbValueBoardStatus(status: Pick2MlbValueBoardSourceStatus): Pick2MlbValueBoardStatus {
  if (status === 'OFFICIAL_PICK' || status === 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN') return 'OFFICIAL_PICK'
  if (status === 'VALUE_CANDIDATE' || status === 'VALUE_CANDIDATE_ONLY') return 'VALUE_CANDIDATE'
  if (status === 'BLOCKED') return 'BLOCKED'
  return 'WATCHLIST'
}

export function buildPick2MlbValueScore(input: {
  consensus_edge: number
  unit_ev: number
  book_count: number
  market_dispersion?: number | null
  market_freshness?: string | null
  starter_status?: string | null
  risk_flags?: string[]
}): number {
  const edge = Math.max(0, input.consensus_edge) * 100
  const ev = Math.max(0, input.unit_ev) * 100
  const bookCoverage = Math.min(1, input.book_count / 11) * 10
  const dispersion = Math.max(0, 0.03 - Number(input.market_dispersion ?? 0.03)) * 100
  const freshness = input.market_freshness === 'FRESH' ? 10 : input.market_freshness === 'AGING' ? 4 : 0
  const starter = input.starter_status === 'CONFIRMED' ? 8 : input.starter_status === 'PROBABLE' ? 5 : 0
  const riskPenalty = Math.min(input.risk_flags?.length ?? 0, 5) * 1.5

  return Number((edge * 2.5 + ev * 1.5 + bookCoverage + dispersion + freshness + starter - riskPenalty).toFixed(3))
}

export function buildPick2MlbValueBoardWhy(row: Pick2MlbValueBoardSourceRow): string[] {
  const book = row.best_book ?? row.bookmaker_key ?? 'selected book'
  const messages = [
    `Model probability exceeds market consensus by ${(row.consensus_edge * 100).toFixed(1)} percentage points.`,
    `Best current price is at ${book}.`,
    row.unit_ev ?? row.best_price_unit_ev
      ? `Best-price unit EV is ${(((row.unit_ev ?? row.best_price_unit_ev) ?? 0) * 100).toFixed(1)}%.`
      : 'Best-price EV is available from persisted value evidence.',
    `${row.book_count} books support the current market view.`,
  ]
  if ((row.market_dispersion ?? 1) <= 0.015) messages.push('Market dispersion is low.')
  if (row.starter_status === 'PROBABLE') messages.push('Starter is probable, so the row carries an explicit risk flag.')
  if (row.starter_status === 'CONFIRMED') messages.push('Starter state is confirmed in the persisted source evidence.')
  return messages
}

export function explainPick2MlbValueBoardRisk(flags: string[]): string[] {
  if (flags.length === 0) return ['No certified risk flags were attached to this row.']
  return flags.map((flag) => {
    if (flag === 'PROBABLE_STARTER') return 'Starter is probable rather than confirmed.'
    if (flag === 'MODERATE_MARKET_DISPERSION') return 'Books disagree enough to mark market dispersion as moderate.'
    if (flag === 'HIGH_MARKET_DISPERSION') return 'Books disagree enough to block confident actionability.'
    if (flag === 'EXTREME_PRICE') return 'The best price is in a more volatile plus-money range.'
    if (flag === 'LOW_BOOK_COVERAGE') return 'Book coverage is below the Official Pick threshold.'
    if (flag === 'MODEL_PROBABILITY_NEAR_50') return 'The model probability is close to a coin-flip zone.'
    return flag.replaceAll('_', ' ').toLowerCase()
  })
}

export function explainPick2MlbValueBoardBlockers(blockers: string[]): string[] {
  if (blockers.length === 0) return []
  return blockers.map((blocker) => blocker.replaceAll('_', ' ').toLowerCase())
}

export function buildPick2MlbValueBoardFactorEdge(row: Pick2MlbValueBoardSourceRow): Pick2MlbValueBoardFactorEdge[] {
  const dispersion = row.market_dispersion ?? null
  return [
    {
      family: 'market_consensus',
      direction: row.consensus_edge > 0 ? 'supports_pick' : 'adds_risk',
      label: 'Market consensus',
      detail: `Persisted model edge vs consensus is ${(row.consensus_edge * 100).toFixed(1)} percentage points.`,
    },
    {
      family: 'market_dispersion',
      direction: dispersion !== null && dispersion <= 0.03 ? 'supports_pick' : 'adds_risk',
      label: 'Market dispersion',
      detail: dispersion === null ? 'Market dispersion is unavailable.' : `Book dispersion is ${(dispersion * 100).toFixed(1)} percentage points.`,
    },
    {
      family: 'starter_certainty',
      direction: row.starter_status === 'CONFIRMED' ? 'supports_pick' : row.starter_status === 'PROBABLE' ? 'adds_risk' : 'context_only',
      label: 'Starter certainty',
      detail: `Starter status is ${row.starter_status ?? 'UNKNOWN'}.`,
    },
    {
      family: 'team_form_strength',
      direction: 'context_only',
      label: 'Team form / strength',
      detail: 'Included through the certified MLB moneyline feature set; no causal claim is made.',
    },
    {
      family: 'starter_context',
      direction: 'context_only',
      label: 'Starter context',
      detail: 'Included through the certified starter feature family.',
    },
    {
      family: 'bullpen_context',
      direction: 'context_only',
      label: 'Bullpen context',
      detail: 'Included through the certified bullpen feature family.',
    },
    {
      family: 'offense_context',
      direction: 'context_only',
      label: 'Offense context',
      detail: 'Included through the certified offense feature family.',
    },
    {
      family: 'matchup_context',
      direction: 'context_only',
      label: 'Matchup context',
      detail: 'Included through the certified matchup feature family.',
    },
    {
      family: 'first_inning_context',
      direction: 'context_only',
      label: 'First-inning context',
      detail: 'Included through the certified first-inning feature family.',
    },
  ]
}

export function buildPick2MlbValueBoardRows(sourceRows: Pick2MlbValueBoardSourceRow[]): Pick2MlbValueBoardRow[] {
  const rows = sourceRows.map((row) => {
    const status = normalizeMlbValueBoardStatus(row.status)
    const riskFlags = row.risk_flags ?? row.riskFlags ?? []
    const blockerCodes = row.blocker_codes ?? row.blockers ?? []
    const marketFreshness = row.market_freshness ?? row.freshness ?? 'UNKNOWN'
    const starterStatus = row.starter_status ?? 'UNKNOWN'
    return {
      game_pk: row.game_pk,
      game_date: row.game_date ?? null,
      start_time: row.start_time ?? null,
      home_team: row.home_team ?? row.teams?.split(' @ ')[1] ?? null,
      away_team: row.away_team ?? row.teams?.split(' @ ')[0] ?? null,
      side: row.side,
      market: row.market ?? 'MONEYLINE',
      status,
      status_rank: PICK2_MLB_VALUE_BOARD_STATUS_RANK[status],
      board_rank: 0,
      value_score: buildPick2MlbValueScore({
        consensus_edge: row.consensus_edge,
        unit_ev: row.unit_ev ?? row.best_price_unit_ev ?? 0,
        book_count: row.book_count,
        market_dispersion: row.market_dispersion,
        market_freshness: marketFreshness,
        starter_status: starterStatus,
        risk_flags: riskFlags,
      }),
      best_book: row.best_book ?? row.bookmaker_key ?? 'unknown',
      bookmaker_name: row.bookmaker_name ?? null,
      american_odds: row.american_odds ?? row.best_american_odds ?? 0,
      model_probability: row.model_probability,
      consensus_probability: row.consensus_probability ?? null,
      consensus_edge: row.consensus_edge,
      unit_ev: row.unit_ev ?? row.best_price_unit_ev ?? 0,
      book_count: row.book_count,
      market_dispersion: row.market_dispersion ?? null,
      market_freshness: marketFreshness,
      starter_status: starterStatus,
      risk_flags: riskFlags,
      reason_codes: row.reason_codes ?? [],
      blocker_codes: blockerCodes,
      why: buildPick2MlbValueBoardWhy(row),
      risk_explanation: explainPick2MlbValueBoardRisk(riskFlags),
      blocker_explanation: explainPick2MlbValueBoardBlockers(blockerCodes),
      factor_edge: buildPick2MlbValueBoardFactorEdge(row),
      policy_version: row.policy_version ?? PICK2_MLB_VALUE_BOARD_POLICY_VERSION,
      prediction_id: row.prediction_id,
      value_evaluation_id: row.value_evaluation_id,
      official_pick_identity: row.official_pick_identity ?? null,
      prediction_as_of: row.prediction_as_of ?? '',
      market_acquired_at: row.market_acquired_at ?? '',
      evaluated_at: row.evaluated_at ?? '',
      decision_at: status === 'OFFICIAL_PICK' ? row.decision_at ?? null : null,
    } satisfies Pick2MlbValueBoardRow
  })

  return rows
    .sort((a, b) =>
      a.status_rank - b.status_rank ||
      b.value_score - a.value_score ||
      b.consensus_edge - a.consensus_edge ||
      b.unit_ev - a.unit_ev ||
      a.game_pk - b.game_pk,
    )
    .map((row, index) => ({ ...row, board_rank: index + 1 }))
}

/** Compatibility entrypoint; all callers now receive canonical read-only data. */
export async function getPreparedPick2MlbValueBoard(): Promise<Pick2MlbValueBoardContract> {
  const { getMlbOperationalView } = await import('./pick2-operational-read.service')
  return (await getMlbOperationalView()).board
}
