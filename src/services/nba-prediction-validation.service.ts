import { supabaseAdmin } from '@/lib/supabase-admin'
import type { PredictionHistoryInput } from '@/services/prediction-history.service'

export const NBA_SPORT_KEY = 'basketball_nba'
export const NBA_LEAGUE_KEY = 'nba'
export const NBA_PREDICTION_MODEL_VERSION = 'nba_prediction_engine_v1'

export type NbaMarketType =
  | 'moneyline'
  | 'spread'
  | 'total'
  | 'first_half'
  | 'first_half_spread'
  | 'first_half_total'

export type NbaValidationReason =
  | 'event_not_found'
  | 'event_not_predictable'
  | 'invalid_teams'
  | 'unsupported_market'
  | 'invalid_selection'
  | 'invalid_line'
  | 'invalid_odds'
  | 'future_odds_snapshot'
  | 'insufficient_data'
  | 'duplicate_prediction'
  | 'missing_model_version'
  | 'missing_feature_snapshot'
  | 'non_production_event'
  | 'leakage_risk'

export type NbaPredictionCandidate = {
  sport_key: string
  game_id: string
  commence_time: string
  home_team: string
  away_team: string
  team: string
  opponent: string
  market: NbaMarketType
  sportsbook: string
  odds: number
  implied_probability: number
  model_probability: number
  edge: number
  ev: number
  confidence: number
  recommended_pick: boolean
  line: number | null
  projected_line: number | null
  odds_timestamp: string | null
  generated_at: string
  cutoff_at: string
  model_version: string
  feature_snapshot: Record<string, unknown>
  validation_warnings: string[]
}

export type NbaValidationItem = {
  candidate: NbaPredictionCandidate
  status: 'valid' | 'skipped'
  reason: NbaValidationReason | null
  warnings: string[]
}

type EventRow = {
  id: string
  home_team: string
  away_team: string
  start_time: string
  status: string
  home_team_id: string | null
  away_team_id: string | null
  metadata?: Record<string, unknown> | null
}

const SUPPORTED_MARKETS = new Set<NbaMarketType>([
  'moneyline',
  'spread',
  'total',
  'first_half',
  'first_half_spread',
  'first_half_total',
])

const NON_PREDICTABLE_STATUSES = new Set([
  'completed',
  'cancelled',
  'postponed',
])

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isTeamMarket(market: NbaMarketType) {
  return market === 'moneyline' || market === 'spread' || market === 'first_half_spread'
}

function isTotalMarket(market: NbaMarketType) {
  return market === 'total' || market === 'first_half' || market === 'first_half_total'
}

function candidateKey(candidate: NbaPredictionCandidate) {
  return [
    candidate.sport_key,
    candidate.game_id,
    candidate.team,
    candidate.market,
    candidate.sportsbook,
  ].join('|')
}

function getSnapshotScore(
  snapshot: Record<string, unknown>,
  key: 'featureQualityScore' | 'dataSufficiencyScore'
) {
  return safeNumber(snapshot[key], 0)
}

function validateCandidate(
  candidate: NbaPredictionCandidate,
  event: EventRow | undefined,
  duplicateKeys: Set<string>
): NbaValidationItem {
  const warnings = [...candidate.validation_warnings]

  if (!event) {
    return { candidate, status: 'skipped', reason: 'event_not_found', warnings }
  }

  const eventMetadata = event.metadata ?? {}
  if (eventMetadata.trial === true || eventMetadata.production_eligible === false) {
    warnings.push('Event is marked as non-production trial data and cannot be used for NBA predictions.')
    return { candidate, status: 'skipped', reason: 'non_production_event', warnings }
  }

  const eventStart = new Date(event.start_time).getTime()
  const generatedAt = new Date(candidate.generated_at).getTime()
  const cutoffAt = new Date(candidate.cutoff_at).getTime()
  const oddsAt = candidate.odds_timestamp
    ? new Date(candidate.odds_timestamp).getTime()
    : null

  if (
    NON_PREDICTABLE_STATUSES.has(String(event.status).toLowerCase()) ||
    eventStart <= generatedAt
  ) {
    return { candidate, status: 'skipped', reason: 'event_not_predictable', warnings }
  }

  if (
    !event.home_team ||
    !event.away_team ||
    !candidate.home_team ||
    !candidate.away_team ||
    event.home_team !== candidate.home_team ||
    event.away_team !== candidate.away_team
  ) {
    return { candidate, status: 'skipped', reason: 'invalid_teams', warnings }
  }

  if (!SUPPORTED_MARKETS.has(candidate.market)) {
    return { candidate, status: 'skipped', reason: 'unsupported_market', warnings }
  }

  if (
    isTeamMarket(candidate.market) &&
    candidate.team !== event.home_team &&
    candidate.team !== event.away_team
  ) {
    return { candidate, status: 'skipped', reason: 'invalid_selection', warnings }
  }

  if (isTotalMarket(candidate.market)) {
    const normalized = candidate.team.toLowerCase()
    if (!normalized.includes('over') && !normalized.includes('under')) {
      return { candidate, status: 'skipped', reason: 'invalid_selection', warnings }
    }
  }

  if (candidate.market !== 'moneyline' && !Number.isFinite(Number(candidate.line))) {
    return { candidate, status: 'skipped', reason: 'invalid_line', warnings }
  }

  if (!Number.isFinite(Number(candidate.odds)) || Number(candidate.odds) === 0) {
    return { candidate, status: 'skipped', reason: 'invalid_odds', warnings }
  }

  if (oddsAt !== null && oddsAt > generatedAt) {
    return { candidate, status: 'skipped', reason: 'future_odds_snapshot', warnings }
  }

  if (cutoffAt >= eventStart) {
    return { candidate, status: 'skipped', reason: 'leakage_risk', warnings }
  }

  if (getSnapshotScore(candidate.feature_snapshot, 'dataSufficiencyScore') < 35) {
    return { candidate, status: 'skipped', reason: 'insufficient_data', warnings }
  }

  if (!candidate.model_version) {
    return { candidate, status: 'skipped', reason: 'missing_model_version', warnings }
  }

  if (Object.keys(candidate.feature_snapshot).length === 0) {
    return { candidate, status: 'skipped', reason: 'missing_feature_snapshot', warnings }
  }

  if (duplicateKeys.has(candidateKey(candidate))) {
    return { candidate, status: 'skipped', reason: 'duplicate_prediction', warnings }
  }

  if (!candidate.odds_timestamp) {
    warnings.push('No provider odds timestamp was available; model projection odds were used.')
  }

  if (getSnapshotScore(candidate.feature_snapshot, 'featureQualityScore') < 50) {
    warnings.push('Feature quality is below the preferred NBA production threshold.')
  }

  return { candidate, status: 'valid', reason: null, warnings }
}

async function loadDuplicateKeys(candidates: NbaPredictionCandidate[]) {
  const gameIds = Array.from(new Set(candidates.map((candidate) => candidate.game_id)))
  const duplicateKeys = new Set<string>()

  if (!gameIds.length) return duplicateKeys

  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('sport_key, game_id, team, market, sportsbook, lifecycle_status, result')
    .eq('sport_key', NBA_SPORT_KEY)
    .in('game_id', gameIds)

  if (error) {
    throw new Error(`Failed to check NBA prediction duplicates: ${error.message}`)
  }

  for (const row of data ?? []) {
    const lifecycle = String(row.lifecycle_status ?? '')
    const result = String(row.result ?? 'pending')
    if (
      lifecycle === 'active' ||
      lifecycle === 'generated' ||
      result === 'pending' ||
      result === ''
    ) {
      duplicateKeys.add(
        [
          row.sport_key,
          row.game_id,
          row.team,
          row.market,
          row.sportsbook,
        ].join('|')
      )
    }
  }

  return duplicateKeys
}

export async function validateNbaPredictionCandidates(
  candidates: NbaPredictionCandidate[]
) {
  const eventIds = Array.from(new Set(candidates.map((candidate) => candidate.game_id)))
  const duplicateKeys = await loadDuplicateKeys(candidates)

  const { data: events, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, home_team, away_team, start_time, status, home_team_id, away_team_id, metadata')
    .eq('sport_key', NBA_SPORT_KEY)
    .in('id', eventIds.length ? eventIds : ['__empty__'])

  if (error) {
    throw new Error(`Failed to load NBA events for validation: ${error.message}`)
  }

  const eventsById = new Map((events ?? []).map((event) => [event.id, event as EventRow]))
  const items = candidates.map((candidate) =>
    validateCandidate(candidate, eventsById.get(candidate.game_id), duplicateKeys)
  )
  const valid = items.filter((item) => item.status === 'valid')
  const skipped = items.filter((item) => item.status === 'skipped')

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    mode: 'nba_prediction_validation_v1',
    checked: items.length,
    valid: valid.length,
    skipped: skipped.length,
    items,
    acceptedRows: valid.map(({ candidate, warnings }) =>
      buildPredictionHistoryRow(candidate, warnings, 'active')
    ),
    skippedRows: skipped.map(({ candidate, warnings, reason }) =>
      buildPredictionHistoryRow(candidate, warnings, 'skipped', reason)
    ),
  }
}

export function buildPredictionHistoryRow(
  candidate: NbaPredictionCandidate,
  warnings: string[],
  lifecycleStatus: 'active' | 'skipped',
  skipReason: NbaValidationReason | null = null
): PredictionHistoryInput {
  return {
    sport_key: candidate.sport_key,
    game_id: candidate.game_id,
    commence_time: candidate.commence_time,
    home_team: candidate.home_team,
    away_team: candidate.away_team,
    team: candidate.team,
    opponent: candidate.opponent,
    market: candidate.market,
    sportsbook: candidate.sportsbook,
    odds: candidate.odds,
    implied_probability: candidate.implied_probability,
    model_probability: candidate.model_probability,
    edge: candidate.edge,
    ev: candidate.ev,
    confidence: candidate.confidence,
    recommended_pick: candidate.recommended_pick,
    selection: candidate.team,
    line: candidate.line,
    projected_line: candidate.projected_line,
    odds_timestamp: candidate.odds_timestamp,
    generated_at: candidate.generated_at,
    cutoff_at: candidate.cutoff_at,
    model_version: candidate.model_version,
    feature_snapshot: candidate.feature_snapshot,
    validation_warnings: warnings,
    validation_status: lifecycleStatus === 'active' ? 'valid' : 'skipped',
    lifecycle_status: lifecycleStatus,
    skip_reason: skipReason,
    settlement_market: candidate.market,
    status: lifecycleStatus === 'active' ? 'pending' : 'skipped',
    result: lifecycleStatus === 'active' ? 'pending' : 'skipped',
    stake: 100,
    profit: null,
  }
}
