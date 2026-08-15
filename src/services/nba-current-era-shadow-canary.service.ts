import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateNbaPredictions } from '@/services/nba-prediction-engine.service'
import { savePredictionHistory, type PredictionHistoryInput } from '@/services/prediction-history.service'
import {
  NBA_LEAGUE_KEY,
  NBA_PREDICTION_MODEL_VERSION,
  NBA_SPORT_KEY,
} from '@/services/nba-prediction-validation.service'

export const NBA_CURRENT_ERA_SHADOW_CANARY_VERSION = 'NBA_CURRENT_ERA_SHADOW_CANARY_V1'
export const NBA_CURRENT_ERA_SHADOW_FEATURE_VERSION = 'nba_current_era_shadow_canary_feature_set_v1'
export const NBA_CURRENT_ERA_SHADOW_ALLOWED_ODDS_PROVIDER = 'the-odds-api'
export const NBA_CURRENT_ERA_SHADOW_MAX_ODDS_AGE_MINUTES = 30

export type NbaCurrentEraShadowMode = 'dry-run' | 'write-one'

export type NbaCurrentEraShadowSkipReason =
  | 'NO_CURRENT_EVENT'
  | 'EVENT_ALREADY_STARTED'
  | 'EVENT_STATUS_NOT_PREGAME'
  | 'MISSING_REAL_ODDS'
  | 'STALE_ODDS'
  | 'INVALID_PRICE_SOURCE'
  | 'MISSING_REQUIRED_FEATURES'
  | 'TEMPORAL_FEATURE_VIOLATION'
  | 'CUTOFF_FAILED'
  | 'ALREADY_EXISTS'
  | 'UNSUPPORTED_MARKET'
  | 'SAFE_WRITER_NOT_AUTHORIZED'
  | 'HISTORICAL_TRIAL_ODDS_EXCLUDED'
  | 'INVALID_ODDS_VALUE'
  | 'MODEL_OUTPUT_MISSING'
  | 'WRITE_CARDINALITY_NOT_ONE'

type CurrentEraEventRow = {
  id: string
  sport_key: string
  league_key: string
  season: string | null
  home_team: string | null
  away_team: string | null
  start_time: string
  status: string | null
  metadata?: Record<string, unknown> | null
}

type CurrentEraOddsRow = {
  id: string
  event_id: string
  provider: string
  sportsbook: string
  market: string
  outcome: string
  price: number | null
  line: number | null
  snapshot_time: string
  provider_timestamp?: string | null
  metadata?: Record<string, unknown> | null
}

type NbaEnginePrediction = Awaited<ReturnType<typeof generateNbaPredictions>>['predictions'][number]

export type NbaCurrentEraShadowCandidate = {
  candidateKey: string | null
  eventId: string
  eventStartTime: string
  eventStatus: string
  market: string | null
  selection: string | null
  line: number | null
  price: number | null
  priceSource: string | null
  sportsbook: string | null
  oddsTimestamp: string | null
  priceAgeMinutes: number | null
  modelVersion: string
  featureVersion: string
  cutoffAt: string
  priceEligible: boolean
  modelMatched: boolean
  writeEligible: boolean
  modelMatchKey: string | null
  eligible: boolean
  skipReasons: NbaCurrentEraShadowSkipReason[]
}

export type NbaCurrentEraShadowCanaryResult = {
  success: boolean
  generatedAt: string
  mode: NbaCurrentEraShadowMode
  canaryVersion: typeof NBA_CURRENT_ERA_SHADOW_CANARY_VERSION
  sportKey: typeof NBA_SPORT_KEY
  providerCalls: 0
  databaseMutationsFromDryRun: 0
  eventsScanned: number
  candidates: NbaCurrentEraShadowCandidate[]
  eligible: number
  skipped: number
  skipReasons: Record<string, number>
  rowsBefore?: number
  rowsAfter?: number
  inserted: number
  reused: number
  duplicates: number
  selectedCandidateKey?: string | null
  writeStatus?: string | null
  officialPickDelta: 0
  productVisibilityDelta: 0
  alertDelta: 0
  historicalReplayDelta: 0
  mlbMutationDelta: 0
  classification: string
}

const PREGAME_STATUSES = new Set(['scheduled', 'created', 'pre_game', 'pregame', 'not_started'])
const SUPPORTED_MARKETS = new Set(['moneyline', 'spread', 'total'])

function minutesBetween(older: string, newer: string) {
  return Math.max(0, Math.round((new Date(newer).getTime() - new Date(older).getTime()) / 60000))
}

function isPregameStatus(status: string | null | undefined) {
  return PREGAME_STATUSES.has(String(status ?? '').toLowerCase())
}

function cutoffFor(event: CurrentEraEventRow) {
  return new Date(new Date(event.start_time).getTime() - 10 * 60000).toISOString()
}

function countReasons(candidates: NbaCurrentEraShadowCandidate[]) {
  return candidates.reduce<Record<string, number>>((acc, candidate) => {
    for (const reason of candidate.skipReasons) acc[reason] = (acc[reason] ?? 0) + 1
    return acc
  }, {})
}

function keyPart(value: unknown) {
  return String(value ?? 'null').trim().toLowerCase().replace(/[^a-z0-9.+-]+/g, '_').replace(/^_+|_+$/g, '')
}

export function buildNbaCurrentEraShadowCandidateKey({
  eventId,
  market,
  selection,
  line,
  sportsbook,
  oddsId,
}: {
  eventId: string
  market: string | null
  selection: string | null
  line: number | null
  sportsbook: string | null
  oddsId?: string | null
}) {
  return [
    NBA_SPORT_KEY,
    eventId,
    market ?? 'missing_market',
    selection ?? 'missing_selection',
    line ?? 'null',
    sportsbook ?? 'missing_sportsbook',
    oddsId ?? 'missing_odds',
  ].map(keyPart).join('|')
}

export function buildNbaCurrentEraShadowModelMatchKey({
  eventId,
  market,
  selection,
  line,
}: {
  eventId: string
  market: string | null
  selection: string | null
  line: number | null
}) {
  return [
    NBA_SPORT_KEY,
    eventId,
    market ?? 'missing_market',
    selection ?? 'missing_selection',
    line ?? 'null',
    NBA_PREDICTION_MODEL_VERSION,
  ].map(keyPart).join('|')
}

function isHistoricalTrialEvidence(event: CurrentEraEventRow, odds: CurrentEraOddsRow) {
  const eventMetadata = event.metadata ?? {}
  const oddsMetadata = odds.metadata ?? {}
  return (
    eventMetadata.trial === true ||
    eventMetadata.scrambled === true ||
    eventMetadata.production_eligible === false ||
    oddsMetadata.trial === true ||
    oddsMetadata.scrambled === true ||
    oddsMetadata.production_eligible === false
  )
}

function currentEraFeatureSnapshot(event: CurrentEraEventRow, odds: CurrentEraOddsRow, generatedAt: string) {
  return {
    canaryVersion: NBA_CURRENT_ERA_SHADOW_CANARY_VERSION,
    featureSetVersion: NBA_CURRENT_ERA_SHADOW_FEATURE_VERSION,
    modelVersion: NBA_PREDICTION_MODEL_VERSION,
    eventId: event.id,
    market: odds.market,
    selection: odds.outcome,
    line: odds.line,
    oddsSnapshotId: odds.id,
    oddsProvider: odds.provider,
    sportsbook: odds.sportsbook,
    oddsTimestamp: odds.provider_timestamp ?? odds.snapshot_time,
    generatedAt,
    featureQualityScore: 0,
    dataSufficiencyScore: 0,
    currentEraShadow: true,
    realPriceEvidenceRequired: true,
    fallbackOddsAllowed: false,
  }
}

export function findNbaCurrentEraShadowModelPrediction({
  candidate,
  modelPredictions,
}: {
  candidate: Pick<NbaCurrentEraShadowCandidate, 'eventId' | 'market' | 'selection' | 'line'>
  modelPredictions: NbaEnginePrediction[]
}) {
  return modelPredictions.find((prediction) =>
    prediction.gameId === candidate.eventId &&
    prediction.market === candidate.market &&
    prediction.team === candidate.selection &&
    (prediction.line ?? null) === (candidate.line ?? null)
  ) ?? null
}

export function selectNbaCurrentEraShadowWriteCandidate({
  candidates,
  candidateKey,
}: {
  candidates: NbaCurrentEraShadowCandidate[]
  candidateKey: string | null
}) {
  const selected = candidates.filter((candidate) => candidate.writeEligible && candidate.candidateKey === candidateKey)
  return {
    status: selected.length === 1 ? 'SELECTED' : 'WRITE_CARDINALITY_NOT_ONE',
    selected,
  }
}

export function evaluateNbaCurrentEraShadowCandidate({
  event,
  odds,
  generatedAt,
  existingLogicalKeys,
  modelPredictions = [],
}: {
  event: CurrentEraEventRow
  odds: CurrentEraOddsRow | null
  generatedAt: string
  existingLogicalKeys: Set<string>
  modelPredictions?: NbaEnginePrediction[]
}): NbaCurrentEraShadowCandidate {
  const cutoffAt = cutoffFor(event)
  const eventStarted = new Date(event.start_time).getTime() <= new Date(generatedAt).getTime()
  const cutoffFailed = new Date(cutoffAt).getTime() <= new Date(generatedAt).getTime()
  const oddsTimestamp = odds?.provider_timestamp ?? odds?.snapshot_time ?? null
  const priceAgeMinutes = oddsTimestamp ? minutesBetween(oddsTimestamp, generatedAt) : null
  const candidateKey = odds
    ? buildNbaCurrentEraShadowCandidateKey({
        eventId: event.id,
        market: odds.market,
        selection: odds.outcome,
        line: odds.line,
        sportsbook: odds.sportsbook,
        oddsId: odds.id,
      })
    : null
  const modelMatchKey = odds
    ? buildNbaCurrentEraShadowModelMatchKey({
        eventId: event.id,
        market: odds.market,
        selection: odds.outcome,
        line: odds.line,
      })
    : null
  const modelPrediction = odds
    ? findNbaCurrentEraShadowModelPrediction({
        candidate: {
          eventId: event.id,
          market: odds.market,
          selection: odds.outcome,
          line: odds.line,
        },
        modelPredictions,
      })
    : null
  const logicalKey = odds
    ? [NBA_SPORT_KEY, event.id, odds.market, odds.outcome, odds.line ?? 'null', odds.sportsbook, 'CURRENT_ERA_SHADOW', NBA_PREDICTION_MODEL_VERSION].join('|')
    : null
  const skipReasons: NbaCurrentEraShadowSkipReason[] = []

  if (eventStarted) skipReasons.push('EVENT_ALREADY_STARTED')
  if (!isPregameStatus(event.status)) skipReasons.push('EVENT_STATUS_NOT_PREGAME')
  if (cutoffFailed) skipReasons.push('CUTOFF_FAILED')
  if (!odds) {
    skipReasons.push('MISSING_REAL_ODDS')
  } else {
    if (!SUPPORTED_MARKETS.has(odds.market)) skipReasons.push('UNSUPPORTED_MARKET')
    if (odds.provider !== NBA_CURRENT_ERA_SHADOW_ALLOWED_ODDS_PROVIDER) skipReasons.push('INVALID_PRICE_SOURCE')
    if (isHistoricalTrialEvidence(event, odds)) skipReasons.push('HISTORICAL_TRIAL_ODDS_EXCLUDED')
    if (!Number.isFinite(Number(odds.price)) || Number(odds.price) === 0 || Number(odds.price) === -110 && !oddsTimestamp) {
      skipReasons.push('INVALID_ODDS_VALUE')
    }
    if (!oddsTimestamp) {
      skipReasons.push('MISSING_REAL_ODDS')
    } else if (new Date(oddsTimestamp).getTime() > new Date(generatedAt).getTime()) {
      skipReasons.push('TEMPORAL_FEATURE_VIOLATION')
    } else if (priceAgeMinutes !== null && priceAgeMinutes > NBA_CURRENT_ERA_SHADOW_MAX_ODDS_AGE_MINUTES) {
      skipReasons.push('STALE_ODDS')
    }
    if (logicalKey && existingLogicalKeys.has(logicalKey)) skipReasons.push('ALREADY_EXISTS')
  }
  const priceEligible = skipReasons.length === 0
  if (odds && priceEligible && !modelPrediction) skipReasons.push('MODEL_OUTPUT_MISSING')
  const modelMatched = Boolean(modelPrediction)
  const writeEligible = skipReasons.length === 0

  return {
    candidateKey,
    eventId: event.id,
    eventStartTime: event.start_time,
    eventStatus: String(event.status ?? 'unknown'),
    market: odds?.market ?? null,
    selection: odds?.outcome ?? null,
    line: odds?.line ?? null,
    price: odds?.price ?? null,
    priceSource: odds?.provider ?? null,
    sportsbook: odds?.sportsbook ?? null,
    oddsTimestamp,
    priceAgeMinutes,
    modelVersion: NBA_PREDICTION_MODEL_VERSION,
    featureVersion: NBA_CURRENT_ERA_SHADOW_FEATURE_VERSION,
    cutoffAt,
    priceEligible,
    modelMatched,
    writeEligible,
    modelMatchKey,
    eligible: writeEligible,
    skipReasons,
  }
}

function logicalKeyFromRow(row: {
  sport_key: string
  game_id: string
  market: string | null
  team: string
  line: number | null
  sportsbook: string | null
  prediction_origin: string | null
  model_version: string | null
}) {
  return [
    row.sport_key,
    row.game_id,
    row.market ?? '',
    row.team,
    row.line ?? 'null',
    row.sportsbook ?? '',
    row.prediction_origin ?? '',
    row.model_version ?? '',
  ].join('|')
}

async function loadExistingLogicalKeys(eventIds: string[]) {
  if (!eventIds.length) return new Set<string>()
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('sport_key, game_id, market, team, line, sportsbook, prediction_origin, model_version')
    .eq('sport_key', NBA_SPORT_KEY)
    .eq('prediction_origin', 'CURRENT_ERA_SHADOW')
    .in('game_id', eventIds)

  if (error) throw new Error(`NBA Current Era Shadow duplicate check failed: ${error.message}`)
  return new Set((data ?? []).map((row) => logicalKeyFromRow(row as Parameters<typeof logicalKeyFromRow>[0])))
}

export function buildNbaCurrentEraShadowPredictionRow({
  event,
  odds,
  generatedAt,
  modelPrediction,
}: {
  event: CurrentEraEventRow
  odds: CurrentEraOddsRow
  generatedAt: string
  modelPrediction: NbaEnginePrediction
}): PredictionHistoryInput {
  const implied = Number(odds.price) > 0
    ? (100 / (Number(odds.price) + 100)) * 100
    : (Math.abs(Number(odds.price)) / (Math.abs(Number(odds.price)) + 100)) * 100
  const decimalOdds = Number(odds.price) > 0
    ? 1 + Number(odds.price) / 100
    : 1 + 100 / Math.abs(Number(odds.price))
  const edge = Number((modelPrediction.modelProbability - implied).toFixed(2))
  const ev = Number((((modelPrediction.modelProbability / 100) * decimalOdds - 1) * 100).toFixed(2))
  return {
    sport_key: NBA_SPORT_KEY,
    game_id: event.id,
    commence_time: event.start_time,
    home_team: String(event.home_team ?? ''),
    away_team: String(event.away_team ?? ''),
    team: odds.outcome,
    opponent: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
    market: odds.market,
    sportsbook: odds.sportsbook,
    odds: Number(odds.price),
    implied_probability: Number(implied.toFixed(2)),
    model_probability: modelPrediction.modelProbability,
    edge,
    ev,
    confidence: modelPrediction.confidence,
    recommended_pick: false,
    selection: odds.outcome,
    line: odds.line,
    projected_line: modelPrediction.projectedLine,
    odds_timestamp: odds.provider_timestamp ?? odds.snapshot_time,
    generated_at: generatedAt,
    cutoff_at: cutoffFor(event),
    model_version: NBA_PREDICTION_MODEL_VERSION,
    feature_set_version: NBA_CURRENT_ERA_SHADOW_FEATURE_VERSION,
    feature_snapshot: {
      ...currentEraFeatureSnapshot(event, odds, generatedAt),
      projectedLine: modelPrediction.projectedLine,
      smartScore: modelPrediction.smartScore,
      adaptiveScore: modelPrediction.adaptiveScore,
      riskGrade: modelPrediction.riskGrade,
      modelMatchKey: buildNbaCurrentEraShadowModelMatchKey({
        eventId: event.id,
        market: odds.market,
        selection: odds.outcome,
        line: odds.line,
      }),
    },
    production_eligible: false,
    trial: false,
    scrambled: false,
    validation_warnings: ['CURRENT_ERA_SHADOW_CANARY_SHADOW_ONLY', 'NBA_OFFICIAL_PICK_DISABLED'],
    validation_status: 'valid',
    lifecycle_status: 'active',
    settlement_market: odds.market,
    status: 'pending',
    result: 'pending',
    stake: 0,
    profit: null,
    prediction_origin: 'CURRENT_ERA_SHADOW',
    certification_status: 'SHADOW_PENDING',
    certification_metadata: {
      canaryVersion: NBA_CURRENT_ERA_SHADOW_CANARY_VERSION,
      currentEra: true,
      officialPickEligible: false,
      productionCalibrationEligible: false,
      productionLearningEligible: false,
      productSurfaceVisible: false,
      alertEligible: false,
      fallbackOddsAllowed: false,
      candidateKey: buildNbaCurrentEraShadowCandidateKey({
        eventId: event.id,
        market: odds.market,
        selection: odds.outcome,
        line: odds.line,
        sportsbook: odds.sportsbook,
        oddsId: odds.id,
      }),
      priceEvidenceProvider: odds.provider,
      priceEvidenceSportsbook: odds.sportsbook,
      priceEvidenceOddsSnapshotId: odds.id,
    },
  }
}

export async function runNbaCurrentEraShadowCanary({
  mode = 'dry-run',
  limit = 25,
  candidateKey = null,
}: {
  mode?: NbaCurrentEraShadowMode
  limit?: number
  candidateKey?: string | null
} = {}): Promise<NbaCurrentEraShadowCanaryResult> {
  const generatedAt = new Date().toISOString()
  const now = generatedAt
  const before = await supabaseAdmin
    .from('prediction_history')
    .select('id', { count: 'exact', head: true })
    .eq('sport_key', NBA_SPORT_KEY)
    .eq('prediction_origin', 'CURRENT_ERA_SHADOW')

  if (before.error) throw new Error(`NBA Current Era Shadow before-count failed: ${before.error.message}`)

  const { data: events, error: eventError } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team, away_team, start_time, status, metadata')
    .eq('sport_key', NBA_SPORT_KEY)
    .eq('league_key', NBA_LEAGUE_KEY)
    .gte('start_time', now)
    .order('start_time', { ascending: true })
    .limit(limit)

  if (eventError) throw new Error(`NBA Current Era Shadow event scan failed: ${eventError.message}`)

  const currentEvents = (events ?? []) as CurrentEraEventRow[]
  if (!currentEvents.length) {
    return {
      success: true,
      generatedAt,
      mode,
      canaryVersion: NBA_CURRENT_ERA_SHADOW_CANARY_VERSION,
      sportKey: NBA_SPORT_KEY,
      providerCalls: 0,
      databaseMutationsFromDryRun: 0,
      eventsScanned: 0,
      candidates: [],
      eligible: 0,
      skipped: 0,
      skipReasons: { NO_CURRENT_EVENT: 1 },
      rowsBefore: before.count ?? 0,
      rowsAfter: before.count ?? 0,
      inserted: 0,
      reused: 0,
      duplicates: 0,
      selectedCandidateKey: candidateKey,
      writeStatus: mode === 'write-one' ? 'WRITE_CARDINALITY_NOT_ONE' : null,
      officialPickDelta: 0,
      productVisibilityDelta: 0,
      alertDelta: 0,
      historicalReplayDelta: 0,
      mlbMutationDelta: 0,
      classification: 'NBA_03A_BLOCK5_SAFE_CANARY_CERTIFIED_WAITING_FOR_CURRENT_DATA',
    }
  }

  const eventIds = currentEvents.map((event) => event.id)
  const [{ data: odds, error: oddsError }, existingLogicalKeys, modelResult] = await Promise.all([
    supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id, event_id, provider, sportsbook, market, outcome, price, line, snapshot_time, provider_timestamp, metadata')
      .eq('sport_key', NBA_SPORT_KEY)
      .in('event_id', eventIds)
      .order('snapshot_time', { ascending: false })
      .limit(1000),
    loadExistingLogicalKeys(eventIds),
    generateNbaPredictions({ persist: false, limit }),
  ])

  if (oddsError) throw new Error(`NBA Current Era Shadow odds scan failed: ${oddsError.message}`)

  const oddsByEvent = new Map<string, CurrentEraOddsRow[]>()
  for (const row of (odds ?? []) as CurrentEraOddsRow[]) {
    oddsByEvent.set(row.event_id, [...(oddsByEvent.get(row.event_id) ?? []), row])
  }

  const candidates = currentEvents.flatMap((event) => {
    const eventOdds = oddsByEvent.get(event.id) ?? []
    if (!eventOdds.length) {
      return [evaluateNbaCurrentEraShadowCandidate({ event, odds: null, generatedAt, existingLogicalKeys, modelPredictions: modelResult.predictions })]
    }
    return eventOdds.map((oddsRow) =>
      evaluateNbaCurrentEraShadowCandidate({ event, odds: oddsRow, generatedAt, existingLogicalKeys, modelPredictions: modelResult.predictions })
    )
  })
  const eligibleCandidates = candidates.filter((candidate) => candidate.writeEligible)
  let inserted = 0
  let reused = 0
  let writeStatus: string | null = null

  if (mode === 'write-one') {
    const selection = selectNbaCurrentEraShadowWriteCandidate({ candidates, candidateKey })
    writeStatus = selection.status
    if (selection.status !== 'SELECTED') {
      writeStatus = selection.status
    } else {
      const candidate = selection.selected[0]!
      const event = currentEvents.find((item) => item.id === candidate.eventId)!
      const oddsRow = (oddsByEvent.get(candidate.eventId) ?? []).find(
        (item) =>
          buildNbaCurrentEraShadowCandidateKey({
            eventId: candidate.eventId,
            market: item.market,
            selection: item.outcome,
            line: item.line,
            sportsbook: item.sportsbook,
            oddsId: item.id,
          }) === candidate.candidateKey &&
          item.market === candidate.market &&
          item.outcome === candidate.selection &&
          item.line === candidate.line &&
          item.sportsbook === candidate.sportsbook
      )!
      const modelPrediction = findNbaCurrentEraShadowModelPrediction({ candidate, modelPredictions: modelResult.predictions })
      if (!modelPrediction) {
        writeStatus = 'MODEL_OUTPUT_MISSING'
      } else {
        const save = await savePredictionHistory([buildNbaCurrentEraShadowPredictionRow({ event, odds: oddsRow, generatedAt, modelPrediction })])
        inserted = save.saved ?? 0
        writeStatus = inserted > 0 ? 'CREATED' : 'ALREADY_EXISTS'
      }
    }
    reused = candidates.filter((candidate) => candidate.skipReasons.includes('ALREADY_EXISTS')).length
  }

  const after = mode === 'write-one'
    ? await supabaseAdmin
        .from('prediction_history')
        .select('id', { count: 'exact', head: true })
        .eq('sport_key', NBA_SPORT_KEY)
        .eq('prediction_origin', 'CURRENT_ERA_SHADOW')
    : before

  if (after.error) throw new Error(`NBA Current Era Shadow after-count failed: ${after.error.message}`)

  return {
    success: true,
    generatedAt,
    mode,
    canaryVersion: NBA_CURRENT_ERA_SHADOW_CANARY_VERSION,
    sportKey: NBA_SPORT_KEY,
    providerCalls: 0,
    databaseMutationsFromDryRun: 0,
    eventsScanned: currentEvents.length,
    candidates,
    eligible: eligibleCandidates.length,
    skipped: candidates.length - eligibleCandidates.length,
    skipReasons: countReasons(candidates),
    rowsBefore: before.count ?? 0,
    rowsAfter: after.count ?? before.count ?? 0,
    inserted,
    reused,
    duplicates: 0,
    selectedCandidateKey: candidateKey,
    writeStatus,
    officialPickDelta: 0,
    productVisibilityDelta: 0,
    alertDelta: 0,
    historicalReplayDelta: 0,
    mlbMutationDelta: 0,
    classification:
      eligibleCandidates.length > 0
        ? 'NBA_03A_BLOCK5_SINGLE_CANDIDATE_WRITER_CERTIFIED_READY_FOR_FIRST_SHADOW'
        : 'NBA_03A_BLOCK5_SINGLE_CANDIDATE_WRITER_CERTIFIED_WAITING_FOR_MODEL_MATCH',
  }
}
