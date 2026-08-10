import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { FeatureSnapshot } from '@/services/feature-store-core.service'
import {
  getOddsPrimaryAuthorityRuntimeStatus,
  buildLineVersionedRepredictionPlan,
  type OddsAuthorityMarket,
} from '@/services/odds-primary-authority.service'
import { buildSportPrediction } from '@/services/sport-prediction-engine-sdk.service'
import { evaluateRecommendationEligibility } from '@/services/recommendation-eligibility-policy.service'
import { evaluatePredictionEvaluationPolicy } from '@/services/prediction-evaluation-policy.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const MODE = 'line_versioned_reprediction_writer_v1'
const MODEL_VERSION = 'baseball_mlb_line_versioned_reprediction_v1'
const FEATURE_SET_VERSION = 'baseball_mlb_line_versioned_reprediction_feature_set_v1'
const MAX_FRESH_EVIDENCE_AGE_MINUTES = 15

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  home_team: string | null
  away_team: string | null
  start_time: string
  status: string | null
}

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  team: string | null
  opponent: string | null
  market: string
  selection: string | null
  sportsbook: string | null
  odds: number | null
  implied_probability: number | null
  model_probability: number | null
  confidence: number | null
  edge: number | null
  ev: number | null
  line: number | null
  projected_line: number | null
  status: string | null
  result: string | null
  recommended_pick: boolean | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  validation_status: string | null
  validation_warnings: string[] | null
  skip_reason: string | null
  model_role: string | null
  model_version: string | null
  feature_set_version: string | null
  feature_snapshot_id: string | null
  feature_snapshot_key: string | null
  feature_snapshot_generated_at: string | null
  feature_snapshot: Record<string, unknown> | null
  odds_snapshot_id: string | null
  operating_day_id: string | null
  idempotency_key: string | null
  generated_at: string | null
  created_at: string | null
  cutoff_at: string | null
  is_current: boolean | null
  prediction_version: number | null
  prediction_group_key: string | null
  superseded_at: string | null
  superseded_by_prediction_id: string | null
  version_lineage: Record<string, unknown> | null
}

type OddsRow = {
  id: string
  event_id: string
  provider: string
  sportsbook: string
  market: string
  outcome: string
  price: number | null
  line: number | null
  snapshot_time: string
  provider_timestamp: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

export type LineVersionedRepredictionStatus =
  | 'CREATED'
  | 'WOULD_CREATE'
  | 'ALREADY_EXISTS'
  | 'BLOCKED_BY_CUTOFF'
  | 'BLOCKED_BY_START'
  | 'BLOCKED_BY_FEATURES'
  | 'BLOCKED_BY_FRESHNESS'
  | 'BLOCKED_BY_POLICY'
  | 'CURRENT_LINE_PREDICTION_UNAVAILABLE'
  | 'FAILED'

export type LineVersionedRepredictionRequest = {
  operatingDate: string
  dryRun?: boolean | null
  observedAt?: string | null
  source?: string | null
  requestId?: string | null
  maxCases?: number | null
}

function nowIso() {
  return new Date().toISOString()
}

function stableId(parts: unknown[]) {
  return parts.map((part) => String(part ?? 'null').trim().toLowerCase().replace(/[^a-z0-9.-]+/g, '_')).join(':')
}

function stableUuid(parts: unknown[]) {
  const hex = createHash('sha256').update(stableId(parts)).digest('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

function parseMs(value: string | null | undefined) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function ageMinutes(timestamp: string | null, now: string) {
  const source = parseMs(timestamp)
  const at = parseMs(now)
  if (source === null || at === null) return null
  return Math.round((at - source) / 60000)
}

function normalizeMarket(value: string | null | undefined): OddsAuthorityMarket {
  const market = String(value ?? '').toLowerCase()
  if (market === 'run_line' || market === 'spread') return 'spread'
  if (market === 'total') return 'total'
  return 'moneyline'
}

function comparableLine(market: OddsAuthorityMarket, value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return market === 'total' ? Math.abs(value) : value
}

function sameLine(market: OddsAuthorityMarket, left: number | null | undefined, right: number | null | undefined) {
  const a = comparableLine(market, left)
  const b = comparableLine(market, right)
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return Math.abs(a - b) < 0.001
}

function titleCaseSide(value: string) {
  const normalized = value.toLowerCase()
  if (normalized === 'over') return 'Over'
  if (normalized === 'under') return 'Under'
  return value
}

function predictionSelection(row: PredictionRow, event: EventRow) {
  const selection = String(row.selection ?? row.team ?? '').trim()
  if (normalizeMarket(row.market) === 'total') return titleCaseSide(selection)
  if (selection === event.home_team) return 'home'
  if (selection === event.away_team) return 'away'
  return selection
}

function displaySelection(row: PredictionRow, outcome: string, event: EventRow) {
  if (normalizeMarket(row.market) === 'total') return titleCaseSide(outcome)
  if (outcome === 'home') return event.home_team ?? row.selection ?? row.team ?? 'home'
  if (outcome === 'away') return event.away_team ?? row.selection ?? row.team ?? 'away'
  return row.selection ?? row.team ?? outcome
}

function opponentFor(selection: string, event: EventRow) {
  if (selection === event.home_team) return event.away_team ?? 'Opponent'
  if (selection === event.away_team) return event.home_team ?? 'Opponent'
  return selection === 'Over' ? 'Under' : selection === 'Under' ? 'Over' : 'Opponent'
}

function sourceTimestamp(row: OddsRow) {
  const metadataTimestamp = typeof row.metadata?.providerTimestamp === 'string' ? row.metadata.providerTimestamp : null
  return metadataTimestamp ?? row.provider_timestamp ?? row.snapshot_time ?? null
}

function capturedAt(row: OddsRow) {
  const metadataCapturedAt = typeof row.metadata?.capturedAt === 'string' ? row.metadata.capturedAt : null
  return metadataCapturedAt ?? row.created_at
}

function bookmakerKey(row: OddsRow) {
  return typeof row.metadata?.bookmakerKey === 'string' ? row.metadata.bookmakerKey : row.sportsbook
}

function featureSnapshotFrom(row: PredictionRow, generatedAt: string, cutoffAt: string, event: EventRow, market: OddsAuthorityMarket): FeatureSnapshot | null {
  const source = row.feature_snapshot
  if (!source) return null
  const quality = Number(source.featureQualityScore ?? source.quality ?? 0)
  const sufficiency = Number(source.dataSufficiencyScore ?? source.sufficiency ?? 0)
  if (!Number.isFinite(quality) || !Number.isFinite(sufficiency) || quality <= 0 || sufficiency <= 0) return null
  return {
    id: stableId([MODE, row.id, market, generatedAt]),
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    eventId: event.id,
    market,
    generatedAt,
    cutoffAt,
    eventStartTime: event.start_time,
    storeVersion: 'feature_store_core_v1',
    featureQualityScore: quality,
    dataSufficiencyScore: sufficiency,
    noLeakage: source.noLeakage !== false,
    values: Array.isArray(source.values) ? source.values as FeatureSnapshot['values'] : [],
    invalidationKeys: Array.isArray(source.invalidationKeys) ? source.invalidationKeys as string[] : [],
    warnings: [
      ...(Array.isArray(source.warnings) ? source.warnings.map(String) : []),
      'LINE-VERSIONED RE-PREDICTION - existing pregame feature context reused; no provider call.',
    ],
  }
}

function projectionForNewLine(row: PredictionRow, market: OddsAuthorityMarket, oldLine: number | null, newLine: number | null) {
  const oldMargin = typeof row.projected_line === 'number' && Number.isFinite(row.projected_line)
    ? row.projected_line
    : null
  if (oldMargin === null) return null
  const uncertainty = Math.max(12, Math.min(38, 30 - Number(row.confidence ?? 50) * 0.12))
  if (market === 'total') {
    if (oldLine === null || newLine === null) return null
    const selection = String(row.selection ?? row.team ?? '')
    const projectedTotal = selection.toLowerCase() === 'under'
      ? oldLine - oldMargin
      : oldLine + oldMargin
    const newMargin = selection.toLowerCase() === 'under'
      ? newLine - projectedTotal
      : projectedTotal - newLine
    return {
      selectionScore: Number((projectedTotal / 2).toFixed(2)),
      opponentScore: Number((projectedTotal / 2).toFixed(2)),
      total: newLine,
      margin: Number(newMargin.toFixed(2)),
      uncertainty,
    }
  }
  if (market === 'spread') {
    if (oldLine === null || newLine === null) return null
    const sideMargin = oldMargin - oldLine
    const newMargin = sideMargin + newLine
    return {
      selectionScore: Number((4.4 + sideMargin / 2).toFixed(2)),
      opponentScore: Number((4.4 - sideMargin / 2).toFixed(2)),
      margin: Number(newMargin.toFixed(2)),
      uncertainty,
    }
  }
  return null
}

function bestFreshNewLineEvidence(rows: OddsRow[], market: OddsAuthorityMarket, now: string) {
  const fresh = rows
    .filter((row) => {
      const age = ageMinutes(sourceTimestamp(row), now)
      return age !== null && age >= 0 && age <= MAX_FRESH_EVIDENCE_AGE_MINUTES && row.price !== null
    })
    .sort((left, right) => {
      const leftAge = ageMinutes(sourceTimestamp(left), now) ?? Number.POSITIVE_INFINITY
      const rightAge = ageMinutes(sourceTimestamp(right), now) ?? Number.POSITIVE_INFINITY
      if (leftAge !== rightAge) return leftAge - rightAge
      return Math.abs(Number(right.price ?? 0)) - Math.abs(Number(left.price ?? 0))
    })
  return market === 'total' || market === 'spread' ? fresh[0] ?? null : null
}

async function loadEventsForDate(operatingDate: string) {
  const start = `${operatingDate}T04:00:00+00:00`
  const endDate = new Date(Date.parse(start) + 24 * 60 * 60 * 1000).toISOString()
  const result = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team, away_team, start_time, status')
    .eq('sport_key', SPORT_KEY)
    .gte('start_time', start)
    .lt('start_time', endDate)
    .order('start_time', { ascending: true })
  if (result.error) throw new Error(`line-versioned event read failed: ${result.error.message}`)
  return (result.data ?? []) as EventRow[]
}

async function loadPredictions(eventIds: string[]) {
  if (!eventIds.length) return []
  const result = await supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, selection, sportsbook, odds, implied_probability, model_probability, confidence, edge, ev, line, projected_line, status, result, recommended_pick, production_eligible, trial, scrambled, validation_status, validation_warnings, skip_reason, model_role, model_version, feature_set_version, feature_snapshot_id, feature_snapshot_key, feature_snapshot_generated_at, feature_snapshot, odds_snapshot_id, operating_day_id, idempotency_key, generated_at, created_at, cutoff_at, is_current, prediction_version, prediction_group_key, superseded_at, superseded_by_prediction_id, version_lineage')
    .eq('sport_key', SPORT_KEY)
    .in('game_id', eventIds)
    .eq('is_current', true)
    .order('generated_at', { ascending: false })
    .limit(500)
  if (result.error) throw new Error(`line-versioned prediction read failed: ${result.error.message}`)
  return (result.data ?? []) as PredictionRow[]
}

async function loadTheOddsApiRows(eventIds: string[]) {
  if (!eventIds.length) return []
  const result = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id, event_id, provider, sportsbook, market, outcome, price, line, snapshot_time, provider_timestamp, created_at, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('provider', 'the-odds-api')
    .in('event_id', eventIds)
    .in('market', ['run_line', 'total'])
    .order('created_at', { ascending: false })
    .limit(5000)
  if (result.error) throw new Error(`line-versioned odds read failed: ${result.error.message}`)
  return (result.data ?? []) as OddsRow[]
}

function latestOddsRows(rows: OddsRow[]) {
  const latest = new Map<string, OddsRow>()
  for (const row of rows) {
    const key = [
      row.event_id,
      bookmakerKey(row),
      normalizeMarket(row.market),
      String(row.outcome).toLowerCase(),
      row.line === null ? 'null' : Number(row.line).toFixed(3),
    ].join('|')
    if (!latest.has(key)) latest.set(key, row)
  }
  return Array.from(latest.values())
}

function equivalentPredictionExists(predictions: PredictionRow[], input: {
  oldPredictionId: string
  eventId: string
  market: OddsAuthorityMarket
  selection: string
  line: number | null
}) {
  return predictions.some((row) => (
    row.id !== input.oldPredictionId &&
    row.game_id === input.eventId &&
    normalizeMarket(row.market) === input.market &&
    String(row.selection ?? row.team ?? '').toLowerCase() === input.selection.toLowerCase() &&
    sameLine(input.market, row.line, input.line)
  ))
}

function latestPredictionByIdentity(rows: PredictionRow[]) {
  const latest = new Map<string, PredictionRow>()
  for (const row of rows) {
    const market = normalizeMarket(row.market)
    const line = row.line === null ? 'null' : String(comparableLine(market, row.line))
    const key = [row.game_id, market, String(row.selection ?? row.team ?? '').toLowerCase(), line].join('|')
    if (!latest.has(key)) latest.set(key, row)
  }
  return Array.from(latest.values())
}

function statusFromBlockers(blockers: string[]): LineVersionedRepredictionStatus {
  if (blockers.includes('EVENT_NOT_PREGAME')) return 'BLOCKED_BY_START'
  if (blockers.includes('CUTOFF_NOT_SAFE')) return 'BLOCKED_BY_CUTOFF'
  if (blockers.includes('REQUIRED_FEATURES_MISSING')) return 'BLOCKED_BY_FEATURES'
  if (blockers.includes('FRESH_CURRENT_PRICE_MISSING')) return 'BLOCKED_BY_FRESHNESS'
  if (blockers.includes('EXACT_NEW_LINE_PREDICTION_ALREADY_EXISTS')) return 'ALREADY_EXISTS'
  return 'BLOCKED_BY_POLICY'
}

async function persistPredictionRow(row: Record<string, unknown>, oldPredictionId: string, now: string, dryRun: boolean) {
  if (dryRun) return { status: 'WOULD_CREATE' as const, predictionWrites: 0, databaseMutations: 0 }
  const existing = await supabaseAdmin
    .from('prediction_history')
    .select('id')
    .eq('id', row.id)
    .maybeSingle()
  if (existing.error) throw new Error(`line-versioned duplicate check failed: ${existing.error.message}`)
  if (existing.data?.id) return { status: 'ALREADY_EXISTS' as const, predictionWrites: 0, databaseMutations: 0 }
  const inserted = await supabaseAdmin.from('prediction_history').insert(row)
  if (inserted.error) throw new Error(`line-versioned prediction insert failed: ${inserted.error.message}`)
  const updated = await supabaseAdmin
    .from('prediction_history')
    .update({
      is_current: false,
      superseded_at: now,
      superseded_by_prediction_id: row.id,
      version_lineage: {
        lineVersionedReprediction: true,
        supersedeReason: 'MARKET_LINE_CHANGED',
        supersededByPredictionId: row.id,
      },
    })
    .eq('id', oldPredictionId)
  if (updated.error) throw new Error(`line-versioned supersession update failed: ${updated.error.message}`)
  return { status: 'CREATED' as const, predictionWrites: 1, databaseMutations: 2 }
}

export async function executeLineVersionedRepredictionWriter(request: LineVersionedRepredictionRequest) {
  const authority = getOddsPrimaryAuthorityRuntimeStatus()
  const stageAllowsPersistence = authority.productAuthority === 'THE_ODDS_API'
  const dryRun = request.dryRun !== false || !stageAllowsPersistence
  const generatedAt = dryRun && request.observedAt ? request.observedAt : nowIso()
  const events = await loadEventsForDate(request.operatingDate)
  const eventMap = new Map(events.map((event) => [event.id, event]))
  const predictions = latestPredictionByIdentity(await loadPredictions(events.map((event) => event.id)))
  const oddsRows = latestOddsRows(await loadTheOddsApiRows(events.map((event) => event.id)))
  const cases: Array<Record<string, unknown>> = []
  let predictionWrites = 0
  let databaseMutations = 0

  for (const prediction of predictions) {
    if (cases.length >= (request.maxCases ?? 50)) break
    const market = normalizeMarket(prediction.market)
    if (market !== 'total' && market !== 'spread') continue
    const event = eventMap.get(prediction.game_id)
    if (!event) continue
    const selection = predictionSelection(prediction, event)
    const comparablePredictionLine = comparableLine(market, prediction.line)
    const evidenceRows = oddsRows.filter((row) => (
      row.event_id === prediction.game_id &&
      normalizeMarket(row.market) === market &&
      String(row.outcome).toLowerCase() === selection.toLowerCase()
    ))
    if (!evidenceRows.length) continue
    const exactRows = evidenceRows.filter((row) => sameLine(market, row.line, prediction.line))
    if (exactRows.length) continue
    const currentLines = Array.from(new Set(evidenceRows.map((row) => comparableLine(market, row.line)).filter((line): line is number => line !== null))).sort((left, right) => left - right)
    if (!currentLines.length || comparablePredictionLine === null) continue
    const newLine = currentLines.reduce((best, line) => (
      Math.abs(line - comparablePredictionLine) < Math.abs(best - comparablePredictionLine) ? line : best
    ), currentLines[0])
    const newLineRows = evidenceRows.filter((row) => sameLine(market, row.line, newLine))
    const bestEvidence = bestFreshNewLineEvidence(newLineRows, market, generatedAt)
    const featureSnapshot = featureSnapshotFrom(prediction, generatedAt, prediction.cutoff_at ?? '', event, market)
    const exactPredictionAlreadyExists = equivalentPredictionExists(predictions, {
      oldPredictionId: prediction.id,
      eventId: prediction.game_id,
      market,
      selection: displaySelection(prediction, selection, event),
      line: newLine,
    })
    const plan = buildLineVersionedRepredictionPlan({
      prediction: {
        predictionId: prediction.id,
        eventId: prediction.game_id,
        market,
        selection: displaySelection(prediction, selection, event),
        line: prediction.line,
        generatedAt: prediction.generated_at,
        cutoffAt: prediction.cutoff_at,
      },
      currentEvidence: newLineRows.map((row) => ({
        provider: 'the-odds-api',
        eventId: row.event_id,
        bookmaker: String(row.metadata?.bookmakerTitle ?? row.sportsbook),
        bookmakerKey: bookmakerKey(row),
        market,
        selection: displaySelection(prediction, String(row.outcome), event),
        line: row.line,
        price: Number(row.price),
        sourceTimestamp: sourceTimestamp(row),
        capturedAt: capturedAt(row),
      })),
      now: generatedAt,
      eventStartTime: event.start_time,
      requiredFeaturesAvailable: Boolean(featureSnapshot && prediction.projected_line !== null),
      exactPredictionAlreadyExists,
      newLine,
    })
    const projection = featureSnapshot ? projectionForNewLine(prediction, market, prediction.line, newLine) : null
    let status: LineVersionedRepredictionStatus = plan.eligibleToExecute ? 'WOULD_CREATE' : statusFromBlockers(plan.eligibility.blockers)
    let newPrediction: Record<string, unknown> | null = null
    if (plan.eligibleToExecute && bestEvidence && featureSnapshot && projection) {
      const teamSelection = displaySelection(prediction, selection, event)
      const sdk = buildSportPrediction({
        sportKey: SPORT_KEY,
        leagueKey: LEAGUE_KEY,
        eventId: event.id,
        market,
        selection: teamSelection,
        opponent: opponentFor(teamSelection, event),
        sportsbook: String(bestEvidence.metadata?.bookmakerTitle ?? bestEvidence.sportsbook),
        americanOdds: Number(bestEvidence.price),
        line: newLine,
        bankroll: 0,
        generatedAt,
        cutoffAt: prediction.cutoff_at ?? generatedAt,
        eventStartTime: event.start_time,
        featureSnapshot,
        projection,
      })
      const predictionId = stableUuid([MODE, prediction.id, event.id, market, teamSelection, newLine, sourceTimestamp(bestEvidence)])
      const idempotencyKey = stableId([MODE, event.id, market, teamSelection, newLine])
      const policy = evaluateRecommendationEligibility({
        id: predictionId,
        sport_key: SPORT_KEY,
        game_id: event.id,
        commence_time: event.start_time,
        home_team: event.home_team,
        away_team: event.away_team,
        team: teamSelection,
        opponent: opponentFor(teamSelection, event),
        market,
        sportsbook: String(bestEvidence.metadata?.bookmakerTitle ?? bestEvidence.sportsbook),
        odds: bestEvidence.price,
        implied_probability: sdk.impliedProbability,
        model_probability: sdk.modelProbability,
        confidence: sdk.confidence,
        edge: sdk.edge,
        ev: sdk.expectedValue,
        production_eligible: false,
        trial: false,
        scrambled: false,
        status: 'pending',
        odds_timestamp: sourceTimestamp(bestEvidence),
        generated_at: generatedAt,
        cutoff_at: prediction.cutoff_at,
        model_version: MODEL_VERSION,
        feature_snapshot_id: featureSnapshot.id,
        feature_set_version: FEATURE_SET_VERSION,
        data_quality_score: featureSnapshot.featureQualityScore,
        data_sufficiency_score: featureSnapshot.dataSufficiencyScore,
        calibrationStatus: 'probationary',
      }, { now: new Date(generatedAt), allowProbationaryPreview: true })
      const evaluationPolicy = evaluatePredictionEvaluationPolicy({
        id: predictionId,
        sport_key: SPORT_KEY,
        game_id: event.id,
        commence_time: event.start_time,
        home_team: event.home_team,
        away_team: event.away_team,
        team: teamSelection,
        opponent: opponentFor(teamSelection, event),
        market,
        sportsbook: String(bestEvidence.metadata?.bookmakerTitle ?? bestEvidence.sportsbook),
        odds: bestEvidence.price,
        implied_probability: sdk.impliedProbability,
        model_probability: sdk.modelProbability,
        confidence: sdk.confidence,
        edge: sdk.edge,
        ev: sdk.expectedValue,
        production_eligible: false,
        trial: false,
        scrambled: false,
        status: 'pending',
        odds_timestamp: sourceTimestamp(bestEvidence),
        generated_at: generatedAt,
        cutoff_at: prediction.cutoff_at,
        model_version: MODEL_VERSION,
        feature_snapshot_id: featureSnapshot.id,
        feature_set_version: FEATURE_SET_VERSION,
        feature_snapshot_generated_at: generatedAt,
        data_quality_score: featureSnapshot.featureQualityScore,
        data_sufficiency_score: featureSnapshot.dataSufficiencyScore,
        calibrationStatus: 'probationary',
        modelRole: 'champion',
        productionScope: 'line_versioned_reprediction_writer_v1',
      }, policy, { now: new Date(generatedAt) })
      newPrediction = {
        id: predictionId,
        sport_key: SPORT_KEY,
        operating_day_id: prediction.operating_day_id,
        game_id: event.id,
        home_team: event.home_team,
        away_team: event.away_team,
        team: teamSelection,
        opponent: opponentFor(teamSelection, event),
        market,
        selection: teamSelection,
        line: newLine,
        odds: bestEvidence.price,
        sportsbook: String(bestEvidence.metadata?.bookmakerTitle ?? bestEvidence.sportsbook),
        implied_probability: sdk.impliedProbability,
        model_probability: sdk.modelProbability,
        confidence: sdk.confidence,
        edge: sdk.edge,
        ev: sdk.expectedValue,
        projected_line: sdk.projectedLine,
        recommended_pick: false,
        status: 'pending',
        lifecycle_status: 'active',
        result: null,
        stake: 0,
        profit: null,
        trial: false,
        scrambled: false,
        production_eligible: false,
        validation_status: 'skipped',
        validation_warnings: [
          ...policy.warnings,
          'LINE_VERSIONED_REPREDICTION_EVIDENCE_ONLY',
        ],
        skip_reason: Array.from(new Set([...policy.blockers, 'LINE_VERSIONED_REPREDICTION_EVIDENCE_ONLY'])).join(','),
        generated_at: generatedAt,
        cutoff_at: prediction.cutoff_at,
        commence_time: event.start_time,
        odds_timestamp: sourceTimestamp(bestEvidence),
        odds_snapshot_id: bestEvidence.id,
        model_version: MODEL_VERSION,
        feature_set_version: FEATURE_SET_VERSION,
        feature_snapshot_id: featureSnapshot.id,
        feature_snapshot_key: stableId([MODE, prediction.id, newLine]),
        feature_snapshot_generated_at: generatedAt,
        is_current: true,
        prediction_version: Number(prediction.prediction_version ?? 1) + 1,
        model_role: 'champion',
        prediction_group_key: stableId([SPORT_KEY, event.id, market, teamSelection, newLine]),
        parent_prediction_id: prediction.id,
        challenger_of_prediction_id: null,
        superseded_at: null,
        superseded_by_prediction_id: null,
        version_created_reason: 'MARKET_LINE_CHANGED',
        idempotency_key: idempotencyKey,
        version_lineage: {
          lineVersionedReprediction: true,
          supersedesPredictionId: prediction.id,
          supersedeReason: 'MARKET_LINE_CHANGED',
          oldLine: prediction.line,
          newLine,
          sourcePriceTimestamp: sourceTimestamp(bestEvidence),
          sourceOddsSnapshotId: bestEvidence.id,
          returnToPriorLinePolicy: 'CREATE_NEW_VERSION_IF_FEATURE_OR_TIME_CONTEXT_CHANGED',
          productionMutation: !dryRun,
        },
        feature_snapshot: {
          ...featureSnapshot,
          lineVersionedReprediction: {
            source: MODE,
            supersedesPredictionId: prediction.id,
            oldLine: prediction.line,
            newLine,
            sourceOddsSnapshotId: bestEvidence.id,
            sourceTimestamp: sourceTimestamp(bestEvidence),
            capturedAt: capturedAt(bestEvidence),
            policy: evaluationPolicy,
          },
        },
      }
      const persisted = await persistPredictionRow(newPrediction, prediction.id, generatedAt, dryRun)
      status = persisted.status
      predictionWrites += persisted.predictionWrites
      databaseMutations += persisted.databaseMutations
    } else if (plan.eligibleToExecute && (!bestEvidence || !featureSnapshot || !projection)) {
      status = !bestEvidence ? 'BLOCKED_BY_FRESHNESS' : 'BLOCKED_BY_FEATURES'
    }
    cases.push({
      eventId: event.id,
      matchup: `${event.away_team} @ ${event.home_team}`,
      oldPredictionId: prediction.id,
      market,
      selection: displaySelection(prediction, selection, event),
      oldLine: prediction.line,
      newLine,
      status,
      eventPregame: parseMs(generatedAt)! < parseMs(event.start_time)!,
      cutoffSafe: parseMs(prediction.cutoff_at) !== null && parseMs(generatedAt)! < parseMs(prediction.cutoff_at)!,
      freshEvidence: Boolean(bestEvidence),
      exactPredictionAlreadyExists,
      dryRun: {
        eligibleToExecute: plan.eligibleToExecute,
        wouldCreate: status === 'WOULD_CREATE',
        wouldSupersede: plan.eligibleToExecute,
        deduplicationKey: plan.deduplicationKey,
        blockers: plan.eligibility.blockers,
      },
      generatedPrediction: newPrediction ? {
        id: newPrediction.id,
        line: newPrediction.line,
        modelProbability: newPrediction.model_probability,
        confidence: newPrediction.confidence,
        edge: newPrediction.edge,
        ev: newPrediction.ev,
        supersedesPredictionId: prediction.id,
      } : null,
    })
  }

  const statusCounts = cases.reduce<Record<string, number>>((acc, item) => {
    const status = String(item.status)
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})

  return {
    success: true,
    mode: MODE,
    status: dryRun ? 'SHADOW_EXECUTION_WOULD_WRITE' : predictionWrites > 0 ? 'CREATED' : 'NO_NEW_LINE_PREDICTIONS',
    generatedAt,
    operatingDate: request.operatingDate,
    source: request.source ?? null,
    requestId: request.requestId ?? null,
    authorityStage: authority.stage,
    productAuthority: authority.productAuthority,
    stageBehavior: authority.productAuthority === 'THE_ODDS_API' ? 'PERSISTENT_PRIMARY_WRITER' : 'NON_PERSISTENT_SHADOW_EXECUTION',
    dryRun,
    providerCallsMade: 0,
    databaseMutationsMade: databaseMutations,
    productionPredictionWrites: predictionWrites,
    movedLineCases: cases.length,
    wouldCreateCount: statusCounts.WOULD_CREATE ?? 0,
    createdCount: statusCounts.CREATED ?? 0,
    wouldDedupeCount: statusCounts.ALREADY_EXISTS ?? 0,
    wouldBlockCount: cases.length - (statusCounts.WOULD_CREATE ?? 0) - (statusCounts.CREATED ?? 0) - (statusCounts.ALREADY_EXISTS ?? 0),
    statusCounts,
    cases,
    safety: {
      noProviderCalls: true,
      noCrossLineProbabilityReuse: true,
      noCrossLinePriceBinding: true,
      noPostStartPredictionFabrication: true,
      officialPickThresholdsChanged: false,
      hr03CalibrationStatus: 'SHADOW_ONLY',
      sportsDataIoAuthorityChanged: false,
      oddsAuthorityPromoted: false,
      settlementFormulaChanged: false,
      learningWeightsChanged: false,
      recommendationExposureSeparated: true,
      returnToPriorLinePolicy: 'CREATE_NEW_VERSION_IF_FEATURE_OR_TIME_CONTEXT_CHANGED',
    },
  }
}

export function validateLineVersionedRepredictionWriterFixtures() {
  const base = {
    id: 'old-total-8',
    sport_key: SPORT_KEY,
    game_id: 'event-1',
    commence_time: '2026-08-10T23:00:00.000Z',
    home_team: 'Home',
    away_team: 'Away',
    team: 'Over',
    opponent: 'Under',
    market: 'total',
    selection: 'Over',
    sportsbook: 'Consensus',
    odds: -110,
    implied_probability: 52.38,
    model_probability: 55,
    confidence: 60,
    edge: 2.62,
    ev: 5,
    line: 8,
    projected_line: 1,
    status: 'pending',
    result: null,
    recommended_pick: false,
    production_eligible: false,
    trial: false,
    scrambled: false,
    validation_status: 'skipped',
    validation_warnings: [],
    skip_reason: null,
    model_role: 'champion',
    model_version: 'fixture',
    feature_set_version: 'fixture',
    feature_snapshot_id: 'feature-1',
    feature_snapshot_key: 'feature-key-1',
    feature_snapshot_generated_at: '2026-08-10T20:00:00.000Z',
    feature_snapshot: { featureQualityScore: 80, dataSufficiencyScore: 80, noLeakage: true, warnings: [], values: [], invalidationKeys: [] },
    odds_snapshot_id: 'odds-1',
    operating_day_id: 'day-1',
    idempotency_key: 'old-key',
    generated_at: '2026-08-10T20:00:00.000Z',
    created_at: '2026-08-10T20:00:00.000Z',
    cutoff_at: '2026-08-10T22:50:00.000Z',
    is_current: true,
    prediction_version: 1,
    prediction_group_key: 'old-group',
    superseded_at: null,
    superseded_by_prediction_id: null,
    version_lineage: null,
  } satisfies PredictionRow
  const projection = projectionForNewLine(base, 'total', 8, 8.5)
  const featureSnapshot = featureSnapshotFrom(base, '2026-08-10T21:00:00.000Z', base.cutoff_at!, {
    id: 'event-1',
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: '2026',
    home_team: 'Home',
    away_team: 'Away',
    start_time: '2026-08-10T23:00:00.000Z',
    status: 'scheduled',
  }, 'total')
  const prediction = projection && featureSnapshot ? buildSportPrediction({
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    eventId: 'event-1',
    market: 'total',
    selection: 'Over',
    opponent: 'Under',
    sportsbook: 'FanDuel',
    americanOdds: -105,
    line: 8.5,
    bankroll: 0,
    generatedAt: '2026-08-10T21:00:00.000Z',
    cutoffAt: base.cutoff_at!,
    eventStartTime: '2026-08-10T23:00:00.000Z',
    featureSnapshot,
    projection,
  }) : null
  return {
    success: Boolean(prediction && prediction.line === 8.5 && prediction.modelProbability !== base.model_probability),
    mode: 'line_versioned_reprediction_writer_fixture_validation_v1',
    oldProbability: base.model_probability,
    newProbability: prediction?.modelProbability ?? null,
    oldLine: base.line,
    newLine: prediction?.line ?? null,
    projectionUsesNewLine: projection?.total === 8.5,
    providerCallsMade: 0,
    databaseMutationsMade: 0,
  }
}
