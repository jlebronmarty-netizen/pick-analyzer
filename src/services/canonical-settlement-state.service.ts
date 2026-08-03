import { classifyPredictionCutoff } from '@/services/prediction-cutoff-enforcement.service'

const FINAL_RESULTS = new Set(['win', 'loss', 'push', 'void'])
const SCORED_RESULTS = new Set(['win', 'loss', 'push'])
const AUDIT_LIFECYCLES = new Set(['legacy', 'historical', 'replay', 'shadow', 'ignored', 'unknown', 'cancelled', 'canceled', 'voided', 'void'])
const TERMINAL_LIFECYCLE_V2 = new Set(['Legacy', 'Historical', 'Replay', 'Shadow', 'Ignored', 'Unknown', 'Cancelled', 'Voided'])
const SUPPORTED_MARKETS = new Set(['moneyline', 'spread', 'run_line', 'run line', 'total'])

export type CanonicalSettlementOutcome = 'win' | 'loss' | 'push' | 'void' | 'pending' | 'legacy' | 'historical' | 'replay' | 'shadow' | 'ignored' | 'unknown' | 'cancelled'

export type CanonicalPredictionLike = {
  id?: string | null
  sport_key?: string | null
  game_id?: string | null
  commence_time?: string | null
  generated_at?: string | null
  cutoff_at?: string | null
  home_team?: string | null
  away_team?: string | null
  team?: string | null
  opponent?: string | null
  market?: string | null
  line?: number | string | null
  result?: string | null
  status?: string | null
  lifecycle_status?: string | null
  settlement_details?: Record<string, unknown> | null
  validation_warnings?: unknown
  model_role?: string | null
  trial?: boolean | null
  scrambled?: boolean | null
  production_eligible?: boolean | null
  feature_snapshot_id?: string | null
  feature_snapshot_key?: string | null
  feature_snapshot?: Record<string, unknown> | null
  odds_snapshot_id?: string | null
  operating_day_id?: string | null
  idempotency_key?: string | null
  model_version?: string | null
  is_current?: boolean | null
}

export type CanonicalEventLike = {
  id?: string | null
  start_time?: string | null
  status?: string | null
  home_team?: string | null
  away_team?: string | null
  home_score?: number | null
  away_score?: number | null
}

export type CanonicalGameResultLike = {
  id?: string | null
  game_id?: string | null
  status?: string | null
  home_team?: string | null
  away_team?: string | null
  home_score?: number | null
  away_score?: number | null
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function v2Settlement(row: CanonicalPredictionLike) {
  return asObject(asObject(row.settlement_details).settlement_reconciliation_v2)
}

function canonicalMarketPrediction(row: CanonicalPredictionLike) {
  return asObject(asObject(row.feature_snapshot).canonicalMarketPrediction)
}

function isSelectionUniverseContext(row: CanonicalPredictionLike) {
  const snapshot = asObject(row.feature_snapshot)
  const canonical = canonicalMarketPrediction(row)
  return (
    snapshot.canonicalPredictionGranularity === 'selection_universe_context_v1' ||
    canonical.canonicalEvaluationEligible === false ||
    canonical.performanceEligible === false ||
    canonical.settlementLearningEligible === false
  )
}

export function canonicalStoredOutcome(row: CanonicalPredictionLike): CanonicalSettlementOutcome {
  const v2 = v2Settlement(row)
  if (v2.lifecycle === 'Legacy') return 'legacy'
  if (v2.lifecycle === 'Historical') return 'historical'
  if (v2.lifecycle === 'Replay') return 'replay'
  if (v2.lifecycle === 'Shadow') return 'shadow'
  if (v2.lifecycle === 'Ignored') return 'ignored'
  if (v2.lifecycle === 'Unknown') return 'unknown'
  if (v2.lifecycle === 'Cancelled') return 'cancelled'
  if (v2.lifecycle === 'Voided') return 'void'
  const result = normalize(row.result)
  if (FINAL_RESULTS.has(result)) return result as CanonicalSettlementOutcome
  const status = normalize(row.status)
  if (FINAL_RESULTS.has(status)) return status as CanonicalSettlementOutcome
  if (normalize(row.lifecycle_status) === 'closed') return 'unknown'
  return 'pending'
}

export function canonicalResultLabel(row: CanonicalPredictionLike) {
  const result = canonicalStoredOutcome(row)
  return SCORED_RESULTS.has(result) ? result : null
}

export function canonicalLifecycle(row: CanonicalPredictionLike) {
  const v2 = v2Settlement(row)
  return normalize(v2.lifecycle ?? v2.state ?? row.lifecycle_status ?? row.status)
}

export function isCanonicalAuditLifecycle(row: CanonicalPredictionLike) {
  return AUDIT_LIFECYCLES.has(canonicalLifecycle(row))
}

export function isCanonicalTestFixture(row: CanonicalPredictionLike) {
  const warnings = Array.isArray(row.validation_warnings) ? row.validation_warnings.map(String) : []
  return (
    row.trial === true ||
    row.scrambled === true ||
    normalize(row.model_role) === 'shadow' ||
    warnings.some((warning) => /trial|scrambled|fixture|quarantine/i.test(warning))
  )
}

export function isCanonicalLegacyRow(row: CanonicalPredictionLike) {
  return (
    !row.feature_snapshot_id &&
    !row.odds_snapshot_id &&
    !row.operating_day_id &&
    !row.idempotency_key &&
    !row.model_version &&
    row.production_eligible !== true
  )
}

export function isCanonicalSupportedMarket(row: CanonicalPredictionLike) {
  return SUPPORTED_MARKETS.has(normalize(row.market))
}

export function canonicalPendingReason(row: CanonicalPredictionLike, event?: CanonicalEventLike) {
  if (canonicalStoredOutcome(row) !== 'pending') return null
  if (isSelectionUniverseContext(row)) return 'P2_1_SELECTION_LEVEL_PREVIEW_NOT_CANONICAL'
  if (isCanonicalTestFixture(row)) return 'TEST_FIXTURE'
  const cutoff = classifyPredictionCutoff(row, event)
  if (cutoff.state === 'POST_START' || cutoff.state === 'POST_FINAL') return 'PREDICTION_POST_START'
  if (!event && isCanonicalLegacyRow(row)) return 'LEGACY'
  if (!event) return 'EXACT_EVENT_MAPPING_MISSING'
  if (row.is_current === false) return 'DUPLICATE_SUPERSEDED'
  const status = normalize(event.status)
  if (['cancelled', 'canceled', 'postponed', 'suspended'].includes(status)) return 'NO_OUTCOME'
  if (!isCanonicalSupportedMarket(row)) return 'MARKET_UNSUPPORTED'
  if (status === 'completed' && event.home_score !== null && event.away_score !== null) return 'ELIGIBLE_FOR_SETTLEMENT'
  const start = Date.parse(event.start_time ?? row.commence_time ?? '')
  if (Number.isFinite(start) && Date.now() - start > 24 * 60 * 60 * 1000) return 'RESULT_NOT_IMPORTED'
  return 'EVENT_NOT_FINAL'
}

export function canonicalEligibility(row: CanonicalPredictionLike, event?: CanonicalEventLike) {
  const result = canonicalStoredOutcome(row)
  if (isSelectionUniverseContext(row)) return { eligible: false, reason: 'P2_1_SELECTION_LEVEL_PREVIEW_NOT_CANONICAL' }
  if (isCanonicalTestFixture(row)) return { eligible: false, reason: 'TEST_FIXTURE' }
  const cutoff = classifyPredictionCutoff(row, event)
  if (!cutoff.eligible) return { eligible: false, reason: cutoff.state }
  if (['legacy', 'historical', 'replay', 'shadow', 'ignored', 'unknown', 'cancelled', 'void'].includes(result)) {
    return { eligible: false, reason: result.toUpperCase() }
  }
  if (result === 'win' || result === 'loss' || result === 'push') return { eligible: true, reason: 'ELIGIBLE' }
  if (isCanonicalLegacyRow(row)) return { eligible: false, reason: 'LEGACY' }
  if (row.is_current === false) return { eligible: false, reason: 'DUPLICATE_SUPERSEDED' }
  if (result === 'pending') return { eligible: false, reason: canonicalPendingReason(row, event) ?? 'EVENT_NOT_FINAL' }
  return { eligible: true, reason: 'ELIGIBLE' }
}

export function isCanonicalProductionSettled(row: CanonicalPredictionLike, event?: CanonicalEventLike) {
  return Boolean(canonicalResultLabel(row)) && !isCanonicalTestFixture(row) && !isCanonicalAuditLifecycle(row) && classifyPredictionCutoff(row, event).eligible
}

export function canonicalLifecycleBadge(row: CanonicalPredictionLike, event?: CanonicalEventLike) {
  const cutoff = classifyPredictionCutoff(row, event)
  if (cutoff.state === 'POST_START') return 'Post-start'
  if (cutoff.state === 'POST_FINAL') return 'Post-final'
  if (cutoff.state === 'INVALID_CUTOFF') return 'Invalid cutoff'
  const v2 = v2Settlement(row)
  if (typeof v2.badge === 'string' && v2.badge) return v2.badge
  const result = canonicalStoredOutcome(row)
  if (result === 'win') return 'Settled Win'
  if (result === 'loss') return 'Settled Loss'
  if (result === 'push') return 'Push'
  if (result === 'void') return 'Voided'
  if (TERMINAL_LIFECYCLE_V2.has(String(v2.lifecycle))) return String(v2.lifecycle)
  const reason = canonicalPendingReason(row, event)
  if (reason === 'EVENT_NOT_FINAL' || reason === 'RESULT_NOT_IMPORTED') return 'Awaiting Result'
  if (reason === 'LEGACY') return 'Legacy'
  if (reason === 'EXACT_EVENT_MAPPING_MISSING') return 'Unknown'
  return 'Scheduled'
}

function selectedScorePair(row: CanonicalPredictionLike, result: CanonicalGameResultLike) {
  const selection = normalize(row.team)
  const home = normalize(result.home_team)
  const away = normalize(result.away_team)
  if (selection === home) return { selectedScore: result.home_score, opponentScore: result.away_score, selectedTeamMatched: true }
  if (selection === away) return { selectedScore: result.away_score, opponentScore: result.home_score, selectedTeamMatched: true }
  return { selectedScore: null, opponentScore: null, selectedTeamMatched: false }
}

export function canonicalDeterministicOutcome(row: CanonicalPredictionLike, result?: CanonicalGameResultLike | null) {
  if (isSelectionUniverseContext(row)) return { outcome: null, reason: 'P2_1_SELECTION_LEVEL_PREVIEW_NOT_CANONICAL' }
  if (!result || !result.game_id || result.home_score === null || result.away_score === null) {
    return { outcome: null, reason: 'CANONICAL_RESULT_MISSING_OR_INCOMPLETE' }
  }
  if (!isCanonicalSupportedMarket(row)) return { outcome: null, reason: 'MARKET_UNSUPPORTED' }
  const market = normalize(row.market)
  const line = Number(row.line ?? 0)
  if ((market === 'spread' || market === 'run_line' || market === 'run line' || market === 'total') && !Number.isFinite(line)) {
    return { outcome: null, reason: 'LINE_MISSING_OR_INVALID' }
  }
  if (market === 'moneyline') {
    const scores = selectedScorePair(row, result)
    if (!scores.selectedTeamMatched) return { outcome: null, reason: 'SELECTION_TEAM_NOT_MATCHED' }
    if (result.home_score === result.away_score) return { outcome: 'push' as const, reason: 'MONEYLINE_TIE' }
    return {
      outcome: Number(scores.selectedScore) > Number(scores.opponentScore) ? 'win' as const : 'loss' as const,
      reason: 'MONEYLINE_CANONICAL_RESULT',
    }
  }
  if (market === 'spread' || market === 'run_line' || market === 'run line') {
    const scores = selectedScorePair(row, result)
    if (!scores.selectedTeamMatched) return { outcome: null, reason: 'SELECTION_TEAM_NOT_MATCHED' }
    const margin = Number(scores.selectedScore) + line - Number(scores.opponentScore)
    if (margin === 0) return { outcome: 'push' as const, reason: 'SPREAD_PUSH_CANONICAL_RESULT' }
    return { outcome: margin > 0 ? 'win' as const : 'loss' as const, reason: 'SPREAD_CANONICAL_RESULT' }
  }
  const total = Number(result.home_score) + Number(result.away_score)
  const selection = normalize(row.team)
  if (total === line) return { outcome: 'push' as const, reason: 'TOTAL_PUSH_CANONICAL_RESULT' }
  if (selection.includes('over')) return { outcome: total > line ? 'win' as const : 'loss' as const, reason: 'TOTAL_OVER_CANONICAL_RESULT' }
  if (selection.includes('under')) return { outcome: total < line ? 'win' as const : 'loss' as const, reason: 'TOTAL_UNDER_CANONICAL_RESULT' }
  return { outcome: null, reason: 'TOTAL_SELECTION_NOT_OVER_UNDER' }
}

export function classifyCanonicalSettlementState(row: CanonicalPredictionLike, result?: CanonicalGameResultLike | null, event?: CanonicalEventLike) {
  const stored = canonicalStoredOutcome(row)
  const deterministic = canonicalDeterministicOutcome(row, result)
  const cutoff = classifyPredictionCutoff(row, event)
  const performanceIncluded = canonicalEligibility(row, event).eligible
  const learningIncluded = isCanonicalProductionSettled(row, event) && Boolean(row.feature_snapshot_id || row.feature_snapshot_key || Object.keys(asObject(row.feature_snapshot)).length)
  const storedTerminal = FINAL_RESULTS.has(stored)
  const deterministicTerminal = Boolean(deterministic.outcome && FINAL_RESULTS.has(deterministic.outcome))
  const lifecycle = canonicalLifecycle(row)
  let classification = 'OTHER_PROVEN_CAUSE'
  if (isSelectionUniverseContext(row)) classification = 'P2_1_SELECTION_LEVEL_PREVIEW_NOT_CANONICAL'
  else if (isCanonicalTestFixture(row) || lifecycle === 'shadow') classification = 'SHADOW_ROW'
  else if (AUDIT_LIFECYCLES.has(lifecycle)) classification = 'LEGACY_SETTLEMENT_REPRESENTATION'
  else if (!cutoff.eligible) classification = 'INVALID_CUTOFF_ROW'
  else if (storedTerminal && deterministicTerminal && stored === deterministic.outcome) classification = 'STORED_SETTLED_AND_DETERMINISTIC_SETTLED'
  else if (storedTerminal && !result) classification = 'STORED_SETTLED_NO_CANONICAL_RESULT'
  else if (storedTerminal && !isCanonicalSupportedMarket(row)) classification = 'STORED_SETTLED_UNSUPPORTED_MARKET'
  else if (storedTerminal && deterministicTerminal && stored !== deterministic.outcome) classification = 'STORED_SETTLED_RESULT_CONFLICT'
  else if (stored === 'pending' && deterministicTerminal) classification = 'STORED_PENDING_DETERMINISTIC_SETTLED'
  else if (stored === 'pending' && !result) classification = 'STORED_PENDING_CANONICAL_RESULT_MISSING'
  else if (stored === 'pending' && !isCanonicalSupportedMarket(row)) classification = 'STORED_PENDING_MARKET_UNSUPPORTED'
  else if (stored === 'void' || deterministic.outcome === 'push') classification = 'VOID_OR_PUSH_REPRESENTATION'
  else if (!row.game_id) classification = 'ORPHANED_PREDICTION'

  return {
    storedOutcome: stored,
    storedTerminal,
    deterministicOutcome: deterministic.outcome,
    deterministicReason: deterministic.reason,
    deterministicTerminal,
    performanceIncluded,
    learningIncluded,
    schedulerAlreadySettled: storedTerminal,
    pending: stored === 'pending',
    awaitingResult: stored === 'pending' && !result,
    classification,
  }
}

export function validateCanonicalSettlementStateFixtures() {
  const result = { id: 'r1', game_id: 'event-1', home_team: 'Home', away_team: 'Away', home_score: 5, away_score: 3 }
  const base: CanonicalPredictionLike = {
    id: 'p1',
    game_id: 'event-1',
    commence_time: '2026-07-01T23:00:00.000Z',
    generated_at: '2026-07-01T20:00:00.000Z',
    team: 'Home',
    market: 'moneyline',
    result: 'win',
    status: 'settled',
    trial: false,
    scrambled: false,
    validation_warnings: [],
    feature_snapshot_id: 'snapshot-1',
    model_version: 'v1',
    production_eligible: true,
  }
  const checks = [
    ['stored settled + deterministic settled', classifyCanonicalSettlementState(base, result).classification === 'STORED_SETTLED_AND_DETERMINISTIC_SETTLED'],
    ['stored settled without canonical result', classifyCanonicalSettlementState(base, null).classification === 'STORED_SETTLED_NO_CANONICAL_RESULT'],
    ['stored pending with canonical result', classifyCanonicalSettlementState({ ...base, result: null, status: 'pending' }, result).classification === 'STORED_PENDING_DETERMINISTIC_SETTLED'],
    ['preview/shadow exclusion', classifyCanonicalSettlementState({ ...base, result: null, status: 'pending', model_role: 'shadow' }, result).classification === 'SHADOW_ROW'],
    ['unsupported market', classifyCanonicalSettlementState({ ...base, market: 'player_prop' }, result).classification === 'STORED_SETTLED_UNSUPPORTED_MARKET'],
    ['legacy compatibility', classifyCanonicalSettlementState({ ...base, settlement_details: { settlement_reconciliation_v2: { lifecycle: 'Legacy' } } }, result).classification === 'LEGACY_SETTLEMENT_REPRESENTATION'],
    ['invalid cutoff', classifyCanonicalSettlementState({ ...base, generated_at: '2026-07-02T20:00:00.000Z' }, result).classification === 'INVALID_CUTOFF_ROW'],
    ['performance inclusion', classifyCanonicalSettlementState(base, result).performanceIncluded === true],
    ['learning inclusion', classifyCanonicalSettlementState(base, result).learningIncluded === true],
    ['scheduler inclusion', classifyCanonicalSettlementState(base, result).schedulerAlreadySettled === true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'canonical_settlement_state_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
