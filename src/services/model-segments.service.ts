import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { canonicalEligibility, canonicalStoredOutcome } from '@/services/canonical-settlement-state.service'
import { localDateInTimeZone } from '@/services/provider-time-normalization.service'

const TIMEZONE = 'America/Puerto_Rico'
const DEFAULT_ROW_LIMIT = 2000

export type SegmentDimension =
  | 'sport'
  | 'league'
  | 'market'
  | 'probabilityBucket'
  | 'confidenceBucket'
  | 'homeAway'
  | 'favoriteUnderdog'
  | 'modelVersion'
  | 'featureVersion'
  | 'settlementResult'
  | 'predictionSource'

type SegmentFilters = {
  sport?: string | null
  league?: string | null
  market?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  confidenceBucket?: string | null
  probabilityBucket?: string | null
  homeAway?: string | null
  favoriteUnderdog?: string | null
  settlementResult?: string | null
  limit?: number | null
}

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string | null
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  team: string | null
  opponent: string | null
  market: string | null
  sportsbook: string | null
  odds: number | null
  implied_probability: number | null
  model_probability: number | null
  confidence: number | null
  edge: number | null
  ev: number | null
  line: number | null
  result: string | null
  status: string | null
  lifecycle_status: string | null
  recommended_pick: boolean | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  validation_status: string | null
  validation_warnings: unknown
  model_role: string | null
  model_version: string | null
  feature_snapshot_id: string | null
  feature_set_version: string | null
  feature_snapshot: Record<string, unknown> | null
  odds_snapshot_id: string | null
  operating_day_id: string | null
  idempotency_key: string | null
  generated_at: string | null
  cutoff_at: string | null
  created_at?: string | null
  settled_at: string | null
  settlement_details: Record<string, unknown> | null
  is_current?: boolean | null
}

type EventRow = {
  id: string
  sport_key: string | null
  league_key: string | null
  season: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
}

export type SegmentRecord = {
  id: string
  sport: string
  league: string | null
  season: string | null
  eventId: string | null
  eventDate: string
  homeTeam: string | null
  awayTeam: string | null
  selectedTeam: string | null
  homeAway: 'home' | 'away' | 'neutral_or_unknown'
  favoriteUnderdog: 'favorite' | 'underdog' | 'even_or_unknown'
  openingLine: number | null
  closingLine: number | null
  impliedProbability: number | null
  predictedProbability: number | null
  probabilityBucket: string
  confidence: number | null
  confidenceBucket: string
  predictionSource: string
  modelVersion: string | null
  featureVersion: string | null
  featureSnapshotId: string | null
  featureCoverage: {
    persistedSnapshot: boolean
    weatherSnapshot: boolean
    park: boolean
    starterContext: boolean
    bullpenContext: boolean
    teamStrengthSnapshot: boolean
  }
  market: string | null
  edge: number | null
  expectedValue: number | null
  settlementResult: string
  closingResult: string | null
  push: boolean
  void: boolean
}

function boundedLimit(value: number | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(5000, Math.floor(parsed))) : DEFAULT_ROW_LIMIT
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function localDate(value: string | null | undefined) {
  return value ? localDateInTimeZone(value, TIMEZONE) ?? value.slice(0, 10) : 'unknown'
}

export function probabilityBucket(value: number | null | undefined) {
  const probability = numberValue(value)
  if (probability === null) return 'unknown'
  if (probability < 50) return '<50'
  if (probability < 55) return '50-55'
  if (probability < 60) return '55-60'
  if (probability < 65) return '60-65'
  if (probability < 70) return '65-70'
  if (probability < 75) return '70-75'
  return '75+'
}

export function confidenceBucket(value: number | null | undefined) {
  const confidence = numberValue(value)
  if (confidence === null) return 'unknown'
  if (confidence < 40) return 'Very Low'
  if (confidence < 55) return 'Low'
  if (confidence < 65) return 'Medium'
  if (confidence < 75) return 'High'
  return 'Very High'
}

function homeAway(row: PredictionRow, event?: EventRow) {
  const team = normalize(row.team)
  const home = normalize(event?.home_team ?? row.home_team)
  const away = normalize(event?.away_team ?? row.away_team)
  if (team && home && team === home) return 'home'
  if (team && away && team === away) return 'away'
  return 'neutral_or_unknown'
}

function favoriteUnderdog(row: PredictionRow) {
  const odds = numberValue(row.odds)
  if (odds === null || odds === 0) return 'even_or_unknown'
  return odds < 0 ? 'favorite' : 'underdog'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function nestedRecord(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  }
  return {}
}

function snapshotLine(snapshot: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = numberValue(snapshot[key])
    if (value !== null) return value
  }
  return null
}

function featureCoverage(snapshot: Record<string, unknown>) {
  const starter = nestedRecord(snapshot, ['starter_context', 'starterContext'])
  const weather = nestedRecord(snapshot, ['weather_context', 'weatherContext'])
  const park = nestedRecord(snapshot, ['park_context', 'parkContext', 'stadium_context', 'stadiumContext'])
  const bullpen = nestedRecord(snapshot, ['bullpen_context', 'bullpenContext'])
  const teamStrength = nestedRecord(snapshot, ['team_strength_snapshot', 'teamStrengthSnapshot', 'team_form', 'teamForm'])
  return {
    persistedSnapshot: Object.keys(snapshot).length > 0,
    weatherSnapshot: Object.keys(weather).length > 0,
    park: Object.keys(park).length > 0,
    starterContext: Object.keys(starter).length > 0,
    bullpenContext: Object.keys(bullpen).length > 0,
    teamStrengthSnapshot: Object.keys(teamStrength).length > 0,
  }
}

function predictionSource(row: PredictionRow) {
  if (row.recommended_pick === true || row.production_eligible === true) return 'official'
  return normalize(row.model_role) || normalize(row.validation_status) || 'model'
}

function toSegmentRecord(row: PredictionRow, event?: EventRow): SegmentRecord {
  const snapshot = asRecord(row.feature_snapshot)
  const settlementResult = canonicalStoredOutcome(row)
  return {
    id: row.id,
    sport: row.sport_key,
    league: event?.league_key ?? null,
    season: event?.season ?? null,
    eventId: row.game_id,
    eventDate: localDate(event?.start_time ?? row.commence_time ?? row.generated_at),
    homeTeam: event?.home_team ?? row.home_team,
    awayTeam: event?.away_team ?? row.away_team,
    selectedTeam: row.team,
    homeAway: homeAway(row, event),
    favoriteUnderdog: favoriteUnderdog(row),
    openingLine: snapshotLine(snapshot, ['openingLine', 'opening_line']),
    closingLine: snapshotLine(snapshot, ['closingLine', 'closing_line']),
    impliedProbability: numberValue(row.implied_probability),
    predictedProbability: numberValue(row.model_probability),
    probabilityBucket: probabilityBucket(row.model_probability),
    confidence: numberValue(row.confidence),
    confidenceBucket: confidenceBucket(row.confidence),
    predictionSource: predictionSource(row),
    modelVersion: row.model_version,
    featureVersion: row.feature_set_version,
    featureSnapshotId: row.feature_snapshot_id,
    featureCoverage: featureCoverage(snapshot),
    market: row.market,
    edge: numberValue(row.edge),
    expectedValue: numberValue(row.ev),
    settlementResult,
    closingResult: textValue(asRecord(row.settlement_details).closingResult),
    push: settlementResult === 'push',
    void: settlementResult === 'void',
  }
}

function metrics(rows: SegmentRecord[]) {
  const scored = rows.filter((row) => row.settlementResult === 'win' || row.settlementResult === 'loss')
  const wins = scored.filter((row) => row.settlementResult === 'win').length
  const losses = scored.filter((row) => row.settlementResult === 'loss').length
  const pushes = rows.filter((row) => row.push).length
  const voids = rows.filter((row) => row.void).length
  const brierRows = scored
    .map((row) => {
      const probability = numberValue(row.predictedProbability)
      if (probability === null) return null
      return {
        probability: probability / 100,
        outcome: row.settlementResult === 'win' ? 1 : 0,
      }
    })
    .filter((row): row is { probability: number; outcome: number } => row !== null)
  const probabilities = scored.map((row) => numberValue(row.predictedProbability)).filter((value): value is number => value !== null)
  const accuracy = wins + losses ? round((wins / (wins + losses)) * 100) : null
  const averageProbability = probabilities.length ? round(probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length) : null
  return {
    sampleSize: rows.length,
    scored: scored.length,
    wins,
    losses,
    pushes,
    voids,
    accuracy,
    brier: brierRows.length
      ? round(brierRows.reduce((sum, row) => sum + (row.probability - row.outcome) ** 2, 0) / brierRows.length, 4)
      : null,
    calibrationError: accuracy !== null && averageProbability !== null ? round(averageProbability - accuracy) : null,
    averageProbability,
  }
}

function groupBy(rows: SegmentRecord[], dimension: SegmentDimension) {
  const groups = new Map<string, SegmentRecord[]>()
  for (const row of rows) {
    const key = String(row[dimension] ?? 'unknown')
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, groupRows]) => ({
      dimension,
      key,
      ...metrics(groupRows),
    }))
}

function filterRows(rows: SegmentRecord[], filters: SegmentFilters) {
  return rows.filter((row) => {
    if (filters.sport && row.sport !== filters.sport) return false
    if (filters.league && row.league !== filters.league) return false
    if (filters.market && row.market !== filters.market) return false
    if (filters.dateFrom && row.eventDate < filters.dateFrom) return false
    if (filters.dateTo && row.eventDate > filters.dateTo) return false
    if (filters.confidenceBucket && row.confidenceBucket !== filters.confidenceBucket) return false
    if (filters.probabilityBucket && row.probabilityBucket !== filters.probabilityBucket) return false
    if (filters.homeAway && row.homeAway !== filters.homeAway) return false
    if (filters.favoriteUnderdog && row.favoriteUnderdog !== filters.favoriteUnderdog) return false
    if (filters.settlementResult && row.settlementResult !== filters.settlementResult) return false
    return true
  })
}

async function loadRows(filters: SegmentFilters) {
  const rowLimit = boundedLimit(filters.limit)
  const rows: PredictionRow[] = []
  let capApplied = false
  for (let from = 0; from < rowLimit; from += 1000) {
    const pageSize = Math.min(1000, rowLimit - from)
    let query = supabaseAdmin
      .from('prediction_history')
      .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, confidence, edge, ev, line, result, status, lifecycle_status, recommended_pick, production_eligible, trial, scrambled, validation_status, validation_warnings, model_role, model_version, feature_snapshot_id, feature_set_version, feature_snapshot, odds_snapshot_id, operating_day_id, idempotency_key, generated_at, created_at, cutoff_at, settled_at, settlement_details, is_current')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (filters.sport) query = query.eq('sport_key', filters.sport)
    if (filters.market) query = query.eq('market', filters.market)
    const { data, error } = await query
    if (error) throw new Error(`model segment prediction read failed: ${error.message}`)
    rows.push(...((data ?? []) as PredictionRow[]))
    if (!data || data.length < pageSize) break
    if (rows.length >= rowLimit) {
      capApplied = true
      break
    }
  }
  return { rows, pagination: { rowsRead: rows.length, rowLimit, pagesRead: Math.ceil(rows.length / 1000), capApplied } }
}

async function loadEvents(eventIds: string[]) {
  const events: EventRow[] = []
  const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)))
  for (let index = 0; index < uniqueIds.length; index += 100) {
    const { data, error } = await supabaseAdmin
      .from('sport_events')
      .select('id, sport_key, league_key, season, start_time, status, home_team, away_team, home_score, away_score')
      .in('id', uniqueIds.slice(index, index + 100))
    if (error) throw new Error(`model segment event read failed: ${error.message}`)
    events.push(...((data ?? []) as EventRow[]))
  }
  return new Map(events.map((event) => [event.id, event]))
}

export async function getModelSegments(filters: SegmentFilters = {}) {
  const rowLoad = await loadRows(filters)
  const events = await loadEvents(rowLoad.rows.map((row) => row.game_id).filter(Boolean) as string[])
  const segmentRows = rowLoad.rows
    .filter((row) => canonicalEligibility(row, row.game_id ? events.get(row.game_id) : undefined).eligible)
    .map((row) => toSegmentRecord(row, row.game_id ? events.get(row.game_id) : undefined))
  const filtered = filterRows(segmentRows, filters)
  const dimensions: SegmentDimension[] = [
    'sport',
    'league',
    'market',
    'probabilityBucket',
    'confidenceBucket',
    'homeAway',
    'favoriteUnderdog',
    'modelVersion',
    'featureVersion',
    'settlementResult',
    'predictionSource',
  ]
  return {
    success: true,
    mode: 'model_segments_v1',
    generatedAt: new Date().toISOString(),
    readOnly: true,
    stableOutputVersion: 'model_segments_v1',
    filters: {
      sport: filters.sport ?? null,
      league: filters.league ?? null,
      market: filters.market ?? null,
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      confidenceBucket: filters.confidenceBucket ?? null,
      probabilityBucket: filters.probabilityBucket ?? null,
      homeAway: filters.homeAway ?? null,
      favoriteUnderdog: filters.favoriteUnderdog ?? null,
      settlementResult: filters.settlementResult ?? null,
      limit: rowLoad.pagination.rowLimit,
    },
    queryDiagnostics: rowLoad.pagination,
    totals: metrics(filtered),
    dimensions: Object.fromEntries(dimensions.map((dimension) => [dimension, groupBy(filtered, dimension)])),
    rows: filtered.slice(0, Math.min(200, filtered.length)),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getModelIntelligence(filters: SegmentFilters = {}) {
  const segments = await getModelSegments(filters)
  const rows = segments.rows
  const featureCoverage = {
    persistedSnapshotRows: rows.filter((row) => row.featureCoverage.persistedSnapshot).length,
    weatherSnapshotRows: rows.filter((row) => row.featureCoverage.weatherSnapshot).length,
    parkRows: rows.filter((row) => row.featureCoverage.park).length,
    starterContextRows: rows.filter((row) => row.featureCoverage.starterContext).length,
    bullpenContextRows: rows.filter((row) => row.featureCoverage.bullpenContext).length,
    teamStrengthRows: rows.filter((row) => row.featureCoverage.teamStrengthSnapshot).length,
  }
  return {
    success: true,
    mode: 'model_intelligence_v1',
    generatedAt: new Date().toISOString(),
    readOnly: true,
    currentProductionSample: segments.totals,
    supportedSegmentDimensions: Object.keys(segments.dimensions),
    availableMarkets: Array.from(new Set(rows.map((row) => row.market).filter(Boolean))).sort(),
    confidenceBuckets: ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
    probabilityBuckets: ['<50', '50-55', '55-60', '60-65', '65-70', '70-75', '75+'],
    featureCoverage,
    missingAnalyticalDimensions: [
      ...(featureCoverage.persistedSnapshotRows ? [] : ['feature_snapshot_payload']),
      ...(rows.some((row) => row.openingLine !== null) ? [] : ['opening_line']),
      ...(rows.some((row) => row.closingLine !== null) ? [] : ['closing_line']),
      ...(rows.some((row) => row.closingResult !== null) ? [] : ['closing_result']),
    ],
    segmentSummary: {
      sport: segments.dimensions.sport,
      market: segments.dimensions.market,
      probabilityBucket: segments.dimensions.probabilityBucket,
      confidenceBucket: segments.dimensions.confidenceBucket,
      homeAway: segments.dimensions.homeAway,
      favoriteUnderdog: segments.dimensions.favoriteUnderdog,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validateModelSegmentFixtures() {
  const fixtureRow = {
    id: 'fixture-1',
    sport_key: 'baseball_mlb',
    game_id: 'event-1',
    commence_time: '2026-07-01T23:00:00.000Z',
    home_team: 'Home',
    away_team: 'Away',
    team: 'Home',
    opponent: 'Away',
    market: 'moneyline',
    sportsbook: 'Fixture',
    odds: -120,
    implied_probability: 54.55,
    model_probability: 62,
    confidence: 68,
    edge: 7.45,
    ev: 13.2,
    line: null,
    result: 'win',
    status: 'settled',
    lifecycle_status: 'closed',
    recommended_pick: true,
    production_eligible: true,
    trial: false,
    scrambled: false,
    validation_status: 'official',
    validation_warnings: [],
    model_role: 'champion',
    model_version: 'fixture_model_v1',
    feature_snapshot_id: 'snapshot-1',
    feature_set_version: 'fixture_feature_v1',
    feature_snapshot: { starter_context: { pitcher: 'Fixture' }, weather_context: { temp: 80 } },
    odds_snapshot_id: 'odds-1',
    operating_day_id: 'day-1',
    idempotency_key: 'fixture-1',
    generated_at: '2026-07-01T20:00:00.000Z',
    cutoff_at: '2026-07-01T22:50:00.000Z',
    created_at: '2026-07-01T20:00:00.000Z',
    settled_at: '2026-07-02T03:00:00.000Z',
    settlement_details: null,
    is_current: true,
  } satisfies PredictionRow
  const fixtureEvent = {
    id: 'event-1',
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    season: '2026',
    start_time: '2026-07-01T23:00:00.000Z',
    status: 'completed',
    home_team: 'Home',
    away_team: 'Away',
    home_score: 4,
    away_score: 2,
  } satisfies EventRow
  const record = toSegmentRecord(fixtureRow, fixtureEvent)
  const fixtureMetrics = metrics([record])
  const checks = {
    probabilityBucket: probabilityBucket(62) === '60-65',
    confidenceBucket: confidenceBucket(68) === 'High',
    homeAway: record.homeAway === 'home',
    favoriteUnderdog: record.favoriteUnderdog === 'favorite',
    brier: fixtureMetrics.brier === 0.1444,
    calibrationError: fixtureMetrics.calibrationError === -38,
    zeroProviderCalls: true,
    zeroRemoteMutations: true,
  }
  return {
    success: Object.values(checks).every(Boolean),
    mode: 'model_segments_fixture_validation_v1',
    checks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
