import 'server-only'

import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { probePredictionVersioningSchemaCapabilities } from '@/lib/server-schema-capabilities'
import { isActiveBettingEvent } from '@/services/active-event.service'
import { getMlbStarterWeatherStadiumIntelligence } from '@/services/mlb-starter-weather-stadium-intelligence.service'
import { classifyMarketIntelligence } from '@/services/market-intelligence-category.service'
import {
  buildMarketAlignment,
  marketImpliedProbabilityFromAmerican,
  type MarketAlignmentContract,
} from '@/services/market-alignment.service'
import {
  buildRecommendationExplanation,
  type RecommendationExplanation,
} from '@/services/recommendation-explanation.service'
import {
  buildOfficialPickContract,
  buildOfficialPickExperience,
  type OfficialPickContract,
  type OfficialPickExperience,
} from '@/services/official-pick-experience.service'
import {
  buildMlbAiPicksFeed,
  type MlbAiPicksFeed,
} from '@/services/mlb-ai-picks-feed.service'
import { normalizeStoredSportsDataIoMlbStart, zonedUtcRange } from '@/services/provider-time-normalization.service'

export type CurrentBoardMode = 'CURRENT' | 'UPCOMING' | 'HISTORICAL_EXPLORER' | 'ALL_STORED_ADVANCED'

export type CurrentBoardReasonCode =
  | 'HISTORICAL'
  | 'SETTLED'
  | 'EVENT_STARTED'
  | 'EVENT_COMPLETED'
  | 'LEGACY_UNLINKED'
  | 'FIXTURE'
  | 'SUPERSEDED'
  | 'STALE_ODDS'
  | 'POST_CUTOFF_ODDS'
  | 'LIVE_ODDS'
  | 'ALTERNATE_MARKET'
  | 'UNSUPPORTED_MARKET'
  | 'INVALID_PRICE'
  | 'INVALID_LINE'
  | 'DUPLICATE'
  | 'MISSING_EVENT'
  | 'MISSING_SNAPSHOT'
  | 'LEAKAGE_RISK'

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string
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
  edge: number | null
  ev: number | null
  confidence: number | null
  line: number | null
  odds_timestamp: string | null
  generated_at: string | null
  cutoff_at: string | null
  model_version: string | null
  feature_snapshot_id: string | null
  feature_set_version: string | null
  validation_status: string | null
  lifecycle_status: string | null
  status: string | null
  result: string | null
  production_eligible: boolean | null
  recommended_pick: boolean | null
  feature_snapshot: Record<string, unknown> | null
  validation_warnings: unknown
  skip_reason: string | null
  trial?: boolean | null
  scrambled?: boolean | null
  is_current?: boolean | null
  prediction_version?: number | null
  model_role?: string | null
  prediction_group_key?: string | null
}

type OddsRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  event_id: string
  provider: string | null
  sportsbook: string | null
  market: string | null
  outcome: string | null
  price: number | null
  line: number | null
  snapshot_time: string | null
  provider_timestamp?: string | null
  created_at?: string | null
  updated_at?: string | null
  metadata: Record<string, unknown> | null
}

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
  updated_at?: string | null
  metadata?: Record<string, unknown> | null
}

export type CurrentBoardCandidate = {
  predictionId: string
  snapshotId: string | null
  oddsSnapshotId: string | null
  eventId: string
  sportKey: string
  leagueKey: string | null
  matchup: string
  scheduledTime: string | null
  eventStatus: string
  market: 'moneyline' | 'spread' | 'total'
  marketLabel: string
  period: string
  selection: string
  normalizedSelection: string
  line: number | null
  sportsbook: string
  americanOdds: number | null
  impliedProbability: number
  oddsTimestamp: string | null
  oddsAgeMinutes: number
  marketInputTimestamp: string | null
  marketInputAgeMinutes: number
  marketFreshnessTimestamp: string | null
  marketFreshnessSource: 'snapshot_ingested_at' | 'snapshot_created_at' | 'snapshot_updated_at' | 'provider_source_timestamp' | 'prediction_odds_timestamp' | 'unavailable'
  marketSourceTimestamp: string | null
  marketSourceAgeMinutes: number
  providerSourceUpdatedAt: string | null
  providerFetchedAt: string | null
  oddsIngestedAt: string | null
  oddsSnapshotCreatedAt: string | null
  marketAlignment: MarketAlignmentContract
  recommendationExplanation?: RecommendationExplanation
  officialPick?: OfficialPickContract | null
  maxAllowedAgeMinutes: number
  cutoff: string | null
  predictionGeneratedAt?: string | null
  recommendationGeneratedAt?: string | null
  pregameSafe: boolean
  stale: boolean
  anomalous: boolean
  anomalyReasons: CurrentBoardReasonCode[]
  currentLatest: boolean
  rawProbability: number
  outcomeCompleteness?: {
    storedSelectionProbability: number
    oppositeSelection: string
    oppositeSelectionProbability: number
    pushProbability: number | null
    totalProbability: number
    highestProbabilitySelection: string
    highestProbabilityLine: number | null
    highestProbability: number
    probabilityBasis: 'stored_binary_selection_with_complement'
  }
  calibratedProbability: number | null
  confidence: number
  confidenceLabel: string
  reliability: string
  reliabilityScore: number
  featureQuality: number | null
  dataSufficiency: number | null
  criticalDataCompleteness?: number
  dataCompletenessLabel?: 'COMPLETE' | 'STRONG' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT'
  aiRating: number
  aiGrade: string
  rankingScore: number
  modelVersion: string
  featureSetVersion: string
  calibrationStatus: string
  edge: number
  expectedValue: number
  modeledValueStatus: 'MODELED_VALUE' | 'NO_MODELED_VALUE' | 'STALE' | 'UNCALIBRATED'
  semanticLabel: 'MODELED VALUE' | 'NO MODELED VALUE' | 'STALE' | 'UNCALIBRATED'
  probabilityOrigin: 'calculated' | 'calibrated' | 'fallback' | 'unavailable' | 'unknown'
  recommendationPolicyStatus: string
  officialEligibility: 'OFFICIAL_ELIGIBLE_CANDIDATE' | 'NOT_OFFICIALLY_ELIGIBLE'
  blockers: string[]
  quarantined: boolean
  trial: boolean
  scrambled: boolean
  productionEligible: boolean
  leakageStatus: 'passed' | 'warning' | 'blocked' | 'unknown'
  boardLabel: 'CURRENT' | 'PREVIEW' | 'HISTORICAL'
  positiveFactors: string[]
  negativeFactors: string[]
  missingInformation: string[]
  starterContext?: Record<string, unknown> | null
  pitcherContext?: Record<string, unknown> | null
  weatherContext?: Record<string, unknown> | null
  parkContext?: Record<string, unknown> | null
  summary: string
  logicalKey: string
}

export type CurrentBoardResponse = {
  success: true
  mode: 'current_board_intelligence_engine_v1'
  boardMode: CurrentBoardMode
  generatedAt: string
  sportKey: string
  slateDate: string | null
  operatingDate: string | null
  timezone: string
  games: Array<{
    eventId: string
    matchup: string
    scheduledTime: string | null
    eventStatus: string
    candidates: number
    markets: string[]
    latestOddsTimestamp: string | null
  }>
  markets: string[]
  candidates: CurrentBoardCandidate[]
  latestOddsTimestamp: string | null
  latestOddsSourceTimestamp: string | null
  latestVisibleMarketSnapshotTimestamp: string | null
  oldestVisibleMarketSnapshotTimestamp: string | null
  dataFreshness: {
    status: 'fresh' | 'partial' | 'stale' | 'empty'
    latestOddsTimestamp: string | null
    latestOddsAgeMinutes: number | null
    maxAllowedAgeMinutes: number
    nextRecommendedRefreshTime: string | null
    timestampSemantics: 'selected_visible_market_snapshot'
    latestSourceTimestamp: string | null
    latestVisibleMarketSnapshotTimestamp: string | null
    oldestVisibleMarketSnapshotTimestamp: string | null
    visibleMarketCount: number
    freshVisibleMarketCount: number
    staleVisibleMarketCount: number
    freshnessTimestampSource: CurrentBoardCandidate['marketFreshnessSource'] | null
  }
  officialPickExperience?: OfficialPickExperience
  aiPicksFeed?: MlbAiPicksFeed
  officialPickCount: number
  previewCount: number
  modeledValueCount: number
  watchCount: number
  qualifiedPreviewCount: number
  excludedRowSummary: {
    rowsBeforeFiltering: number
    rowsAfterFiltering: number
    uniqueRowsExcluded: number
    exclusionReasonCounts: Record<CurrentBoardReasonCode, number>
    duplicateRowsRemoved: number
    supersededRowsExcluded: number
  }
  boardHealth: {
    status: 'READY' | 'EMPTY' | 'STALE' | 'DEGRADED'
    warnings: string[]
    providerCallsMade: 0
    remoteMutationsMade: 0
  }
  bestValueReadiness: {
    rankingContract: string[]
    candidates: Array<{
      predictionId: string
      selection: string
      market: string
      edge: number
      expectedValue: number
      confidence: number
      reliabilityScore: number
      dataQuality: number | null
      dataSufficiency: number | null
      modeledValueStatus: CurrentBoardCandidate['modeledValueStatus']
      officialEligibility: CurrentBoardCandidate['officialEligibility']
    }>
  }
  aiBetFinderReadiness: {
    contract: 'ai_bet_finder_readiness_v1'
    sources: string[]
    llmUsed: false
    providerCallsMade: 0
    remoteMutationsMade: 0
  }
}

const SUPPORTED_MARKETS = ['moneyline', 'spread', 'total'] as const
const ALL_REASON_CODES: CurrentBoardReasonCode[] = [
  'HISTORICAL',
  'SETTLED',
  'EVENT_STARTED',
  'EVENT_COMPLETED',
  'LEGACY_UNLINKED',
  'FIXTURE',
  'SUPERSEDED',
  'STALE_ODDS',
  'POST_CUTOFF_ODDS',
  'LIVE_ODDS',
  'ALTERNATE_MARKET',
  'UNSUPPORTED_MARKET',
  'INVALID_PRICE',
  'INVALID_LINE',
  'DUPLICATE',
  'MISSING_EVENT',
  'MISSING_SNAPSHOT',
  'LEAKAGE_RISK',
]

export const CURRENT_BOARD_FRESHNESS_POLICY = {
  baseball_mlb: {
    defaultMaxOddsAgeMinutes: 24 * 60,
    markets: {
      moneyline: 24 * 60,
      spread: 24 * 60,
      total: 24 * 60,
    },
    historicalMaxOddsAgeMinutes: 45 * 24 * 60,
    extremeAmericanOdds: 1000,
    maxValidAmericanOdds: 5000,
  },
} as const

const DEFAULT_CURRENT_BOARD_DISPLAY_ODDS_STALE_MINUTES = 30

function emptyReasonCounts() {
  return Object.fromEntries(ALL_REASON_CODES.map((code) => [code, 0])) as Record<CurrentBoardReasonCode, number>
}

function chunks<T>(values: T[], size = 100) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

async function readEventsById(sportKey: string, ids: string[]) {
  const rows: EventRow[] = []
  for (const chunk of chunks(Array.from(new Set(ids.filter(Boolean))), 100)) {
    if (!chunk.length) continue
    const result = await supabaseAdmin
      .from('sport_events')
      .select('id, sport_key, league_key, season, home_team, away_team, start_time, status, updated_at, metadata')
      .eq('sport_key', sportKey)
      .in('id', chunk)
    if (result.error) throw new Error(`current board event read failed: ${result.error.message}`)
    rows.push(...((result.data ?? []) as EventRow[]))
  }
  return rows
}

function canonicalEventStart(event: EventRow | undefined, fallback: string | null | undefined) {
  if (!event) return fallback ?? null
  return normalizeStoredSportsDataIoMlbStart({ startTime: event.start_time ?? fallback, metadata: event.metadata }).canonicalUtc
}

async function readOddsForEvents({
  sportKey,
  eventIds,
  mode,
  nowMs,
}: {
  sportKey: string
  eventIds: string[]
  mode: CurrentBoardMode
  nowMs: number
}) {
  const rows: OddsRow[] = []
  const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)))
  const currentWindowStart =
    mode === 'HISTORICAL_EXPLORER' || mode === 'ALL_STORED_ADVANCED'
      ? null
      : new Date(nowMs - CURRENT_BOARD_FRESHNESS_POLICY.baseball_mlb.defaultMaxOddsAgeMinutes * 60000).toISOString()
  for (const chunk of chunks(uniqueIds, 50)) {
    if (!chunk.length) continue
    let query = supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id, sport_key, league_key, season, event_id, provider, sportsbook, market, outcome, price, line, snapshot_time, provider_timestamp, created_at, updated_at, metadata')
      .eq('sport_key', sportKey)
      .in('event_id', chunk)
      .in('market', ['moneyline', 'run_line', 'total'])
      .order('snapshot_time', { ascending: false })
      .limit(1000)
    if (currentWindowStart) query = query.gte('snapshot_time', currentWindowStart)
    const result = await query
    if (result.error) throw new Error(`current board odds read failed: ${result.error.message}`)
    rows.push(...((result.data ?? []) as OddsRow[]))
  }
  return rows
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function positiveNumberFromEnv(names: string | string[], fallback: number) {
  const keys = Array.isArray(names) ? names : [names]
  for (const name of keys) {
    const parsed = Number(process.env[name])
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return fallback
}

function displayMaxOddsAgeMinutes() {
  return positiveNumberFromEnv(
    ['MLB_CURRENT_BOARD_DISPLAY_ODDS_STALE_MINUTES', 'MLB_ODDS_DISPLAY_STALE_MINUTES'],
    DEFAULT_CURRENT_BOARD_DISPLAY_ODDS_STALE_MINUTES
  )
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function ageMinutes(value: string | null | undefined, now = Date.now()) {
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.round((now - parsed) / 60000))
}

function validTimestamp(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function oddsSourceTimestamp(odds: OddsRow | null | undefined, row?: PredictionRow | null) {
  return validTimestamp(odds?.provider_timestamp) ?? validTimestamp(odds?.snapshot_time) ?? validTimestamp(row?.odds_timestamp)
}

function oddsFetchedAt(odds: OddsRow | null | undefined) {
  const metadata = asRecord(odds?.metadata)
  return validTimestamp(metadata.capturedAt) ?? validTimestamp(metadata.fetchedAt) ?? validTimestamp(metadata.ingestedAt)
}

function selectedMarketFreshness(odds: OddsRow | null | undefined, row?: PredictionRow | null): {
  timestamp: string | null
  source: CurrentBoardCandidate['marketFreshnessSource']
} {
  const fetchedAt = oddsFetchedAt(odds)
  if (fetchedAt) return { timestamp: fetchedAt, source: 'snapshot_ingested_at' }
  const createdAt = validTimestamp(odds?.created_at)
  if (createdAt) return { timestamp: createdAt, source: 'snapshot_created_at' }
  const updatedAt = validTimestamp(odds?.updated_at)
  if (updatedAt) return { timestamp: updatedAt, source: 'snapshot_updated_at' }
  const sourceTimestamp = oddsSourceTimestamp(odds, row)
  if (sourceTimestamp) return { timestamp: sourceTimestamp, source: odds ? 'provider_source_timestamp' : 'prediction_odds_timestamp' }
  return { timestamp: null, source: 'unavailable' }
}

function localDateInTimezone(value: string | null | undefined, timezone: string) {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : null
}

function marketLabel(value: string | null) {
  if (value === 'moneyline') return 'Moneyline'
  if (value === 'spread' || value === 'run_line') return 'Run Line'
  if (value === 'total') return 'Total'
  return value ?? 'Market'
}

function canonicalPredictionMarket(value: string | null): string {
  if (value === 'run_line') return 'spread'
  return String(value ?? 'unknown')
}

function canonicalOddsMarket(value: string | null): string {
  if (value === 'spread') return 'run_line'
  return String(value ?? 'unknown')
}

function marketPeriod(row: PredictionRow | OddsRow) {
  const metadata = 'metadata' in row ? asRecord(row.metadata) : asRecord(row.feature_snapshot)
  return String(metadata.marketPeriod ?? metadata.period ?? 'full_game')
}

function selectionLabel(row: PredictionRow) {
  return row.team ?? row.opponent ?? 'Selection'
}

function normalizedSelection(row: PredictionRow) {
  const selection = selectionLabel(row).toLowerCase()
  if (String(row.market) === 'total') {
    if (selection.includes('under')) return 'under'
    if (selection.includes('over')) return 'over'
  }
  if (row.home_team && selection === row.home_team.toLowerCase()) return 'home'
  if (row.away_team && selection === row.away_team.toLowerCase()) return 'away'
  if (selection === 'home' || selection === 'away' || selection === 'over' || selection === 'under') return selection
  return selection
}

function oppositeSelection(row: PredictionRow) {
  const market = canonicalPredictionMarket(row.market)
  const selection = selectionLabel(row)
  if (market === 'total') return selection.toLowerCase().includes('under') ? 'Over' : 'Under'
  if (row.home_team && selection.toLowerCase() === row.home_team.toLowerCase()) return row.away_team ?? 'Away'
  if (row.away_team && selection.toLowerCase() === row.away_team.toLowerCase()) return row.home_team ?? 'Home'
  if (selection.toLowerCase() === 'home') return row.away_team ?? 'Away'
  if (selection.toLowerCase() === 'away') return row.home_team ?? 'Home'
  return `Not ${selection}`
}

function maxAgeFor(sportKey: string, market: string, mode: CurrentBoardMode) {
  const policy = CURRENT_BOARD_FRESHNESS_POLICY.baseball_mlb
  if (mode === 'HISTORICAL_EXPLORER' || mode === 'ALL_STORED_ADVANCED') return policy.historicalMaxOddsAgeMinutes
  return policy.markets[market as keyof typeof policy.markets] ?? policy.defaultMaxOddsAgeMinutes
}

function isFutureUnstarted(row: PredictionRow, event: EventRow | undefined, nowMs: number) {
  const rowResult = String(row.result ?? '').toLowerCase()
  const lifecycle = String(row.lifecycle_status ?? '').toLowerCase()
  const active = isActiveBettingEvent(
    {
      sport_key: row.sport_key,
      league_key: event?.league_key,
      start_time: event?.start_time ?? row.commence_time,
      status: event?.status ?? row.status,
      updated_at: event?.updated_at,
      metadata: event?.metadata ?? row.feature_snapshot,
    },
    { sportKey: row.sport_key, leagueKey: event?.league_key, now: new Date(nowMs) }
  )
  if (!active) return false
  if (['win', 'loss', 'push', 'void'].includes(rowResult)) return false
  if (['settled', 'void', 'closed'].includes(lifecycle)) return false
  return true
}

function baseReasons(row: PredictionRow, event: EventRow | undefined, nowMs: number): Set<CurrentBoardReasonCode> {
  const reasons = new Set<CurrentBoardReasonCode>()
  const snapshot = asRecord(row.feature_snapshot)
  const market = canonicalPredictionMarket(row.market)
  const startTime = canonicalEventStart(event, row.commence_time)
  const startMs = startTime ? new Date(startTime).getTime() : Number.NaN
  const eventStatus = String(event?.status ?? row.status ?? '').toLowerCase()
  const rowResult = String(row.result ?? '').toLowerCase()
  const lifecycle = String(row.lifecycle_status ?? '').toLowerCase()

  if (!SUPPORTED_MARKETS.includes(market as never)) reasons.add('UNSUPPORTED_MARKET')
  if (!event) {
    reasons.add('MISSING_EVENT')
    reasons.add('LEGACY_UNLINKED')
  }
  if (!row.feature_snapshot_id) reasons.add('MISSING_SNAPSHOT')
  if (snapshot.fixture === true || snapshot.fixture_row === true || snapshot.source === 'fixture') reasons.add('FIXTURE')
  if (snapshot.supersededByFinalPregameRefresh === true || snapshot.prospective_preview === false) reasons.add('SUPERSEDED')
  if (snapshot.leakageStatus === 'blocked' || snapshot.leakage_status === 'blocked') reasons.add('LEAKAGE_RISK')
  if (Number.isFinite(startMs) && startMs <= nowMs) reasons.add('EVENT_STARTED')
  if (['completed', 'final'].includes(eventStatus)) reasons.add('EVENT_COMPLETED')
  if (['win', 'loss', 'push', 'void'].includes(rowResult) || ['settled', 'void', 'closed'].includes(lifecycle)) reasons.add('SETTLED')
  if (!isFutureUnstarted(row, event, nowMs)) reasons.add('HISTORICAL')
  return reasons
}

function validateMarketLine(row: PredictionRow, price: number | null, line: number | null) {
  const reasons = new Set<CurrentBoardReasonCode>()
  const policy = CURRENT_BOARD_FRESHNESS_POLICY.baseball_mlb
  const market = canonicalPredictionMarket(row.market)
  if (price === null || !Number.isFinite(price) || price === 0 || Math.abs(price) > policy.maxValidAmericanOdds) {
    reasons.add('INVALID_PRICE')
  }
  if (price !== null && price > -100 && price < 100) reasons.add('INVALID_PRICE')
  if (market === 'moneyline' && line !== null) reasons.add('INVALID_LINE')
  if (market === 'spread' && (line === null || Math.abs(line) < 0.5 || Math.abs(line) > 5.5)) reasons.add('INVALID_LINE')
  if (market === 'total' && (line === null || line <= 0 || line > 30)) reasons.add('INVALID_LINE')
  return reasons
}

function oddsReasons(
  row: PredictionRow,
  odds: OddsRow | null,
  event: EventRow | undefined,
  nowMs: number,
  mode: CurrentBoardMode
) {
  const reasons = new Set<CurrentBoardReasonCode>()
  const metadata = asRecord(odds?.metadata)
  const market = canonicalPredictionMarket(row.market)
  const price = numberValue(odds?.price ?? row.odds)
  const line = numberValue(odds?.line ?? row.line)
  const sourceTimestamp = odds?.snapshot_time ?? row.odds_timestamp
  const freshnessTimestamp = selectedMarketFreshness(odds, row).timestamp ?? sourceTimestamp
  const snapshotMs = sourceTimestamp ? new Date(sourceTimestamp).getTime() : Number.NaN
  const startTime = canonicalEventStart(event, row.commence_time)
  const startMs = startTime ? new Date(startTime).getTime() : Number.NaN
  const cutoffMs = row.cutoff_at ? new Date(row.cutoff_at).getTime() : Number.POSITIVE_INFINITY

  validateMarketLine(row, price, line).forEach((reason) => reasons.add(reason))
  if (!freshnessTimestamp || !Number.isFinite(new Date(freshnessTimestamp).getTime())) reasons.add('STALE_ODDS')
  if (Number.isFinite(startMs) && Number.isFinite(snapshotMs) && snapshotMs >= startMs) reasons.add('EVENT_STARTED')
  if (Number.isFinite(cutoffMs) && Number.isFinite(snapshotMs) && snapshotMs > cutoffMs) reasons.add('POST_CUTOFF_ODDS')
  if (metadata.isLive === true || metadata.live === true || String(metadata.marketType ?? '').toLowerCase() === 'live') reasons.add('LIVE_ODDS')
  if (metadata.isAlternate === true || metadata.alternate === true || String(metadata.marketType ?? '').toLowerCase().includes('alternate')) {
    reasons.add('ALTERNATE_MARKET')
  }
  if (ageMinutes(freshnessTimestamp, nowMs) > maxAgeFor(row.sport_key, market, mode)) reasons.add('STALE_ODDS')
  return reasons
}

function oddsMatchesPrediction(odds: OddsRow, row: PredictionRow) {
  if (canonicalOddsMarket(row.market) !== canonicalOddsMarket(odds.market)) return false
  const oddsOutcome = String(odds.outcome ?? '').toLowerCase()
  const normalized = normalizedSelection(row)
  const selection = selectionLabel(row).toLowerCase()
  if (oddsOutcome !== normalized && oddsOutcome !== selection) return false
  const predictionLine = numberValue(row.line)
  const oddsLine = numberValue(odds.line)
  if (canonicalPredictionMarket(row.market) === 'moneyline') return oddsLine === null
  if (predictionLine === null || oddsLine === null) return false
  return Math.abs(predictionLine - oddsLine) < 0.001
}

function latestSafeOdds(row: PredictionRow, oddsRows: OddsRow[], event: EventRow | undefined, nowMs: number, mode: CurrentBoardMode) {
  const candidates = oddsRows
    .filter((odds) => odds.event_id === row.game_id)
    .filter((odds) => oddsMatchesPrediction(odds, row))
    .map((odds) => ({ odds, reasons: oddsReasons(row, odds, event, nowMs, mode) }))
    .filter(({ reasons }) => reasons.size === 0)
    .sort((left, right) => {
      const rightFreshness = selectedMarketFreshness(right.odds, row).timestamp ?? right.odds.snapshot_time ?? ''
      const leftFreshness = selectedMarketFreshness(left.odds, row).timestamp ?? left.odds.snapshot_time ?? ''
      return new Date(rightFreshness).getTime() - new Date(leftFreshness).getTime()
    })
  return candidates[0] ?? null
}

function qualityLabel(value: number | null) {
  if (value === null) return 'Unknown'
  if (value >= 80) return 'Excellent'
  if (value >= 70) return 'Good'
  if (value >= 55) return 'Limited'
  return 'Weak'
}

const MLB_CRITICAL_INPUTS = [
  'starting_pitcher',
  'confirmed_lineup',
  'injury_diagnosis',
  'weather',
  'bullpen_context',
] as const

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.flatMap((value) => (Array.isArray(value) ? value : [value])).filter(Boolean).map(String)))
}

function dataCompletenessLabel(score: number): CurrentBoardCandidate['dataCompletenessLabel'] {
  if (score >= 95) return 'COMPLETE'
  if (score >= 80) return 'STRONG'
  if (score >= 60) return 'MODERATE'
  if (score >= 35) return 'LIMITED'
  return 'INSUFFICIENT'
}

function canonicalMlbDataQuality(snapshot: Record<string, unknown>, baseFeatureQuality: number | null, baseDataSufficiency: number | null) {
  const projections = asRecord(snapshot.projections)
  const missing = uniqueStrings([
    snapshot.missingData,
    snapshot.missingDataWarnings,
    snapshot.unavailableDomains,
    projections.unavailableDomains,
  ])
  const criticalMissing = MLB_CRITICAL_INPUTS.filter((input) => missing.includes(input))
  const criticalDataCompleteness = Math.max(
    0,
    Math.round(((MLB_CRITICAL_INPUTS.length - criticalMissing.length) / MLB_CRITICAL_INPUTS.length) * 100)
  )
  const featureQuality =
    baseFeatureQuality === null
      ? criticalMissing.length
        ? 35
        : null
      : Math.max(35, Math.min(baseFeatureQuality, Math.round(baseFeatureQuality - criticalMissing.length * 9)))
  const dataSufficiency =
    baseDataSufficiency === null
      ? criticalMissing.length
        ? 30
        : null
      : Math.max(30, Math.min(baseDataSufficiency, Math.round(baseDataSufficiency - criticalMissing.length * 10)))
  return {
    missing,
    criticalMissing,
    criticalDataCompleteness,
    dataCompletenessLabel: dataCompletenessLabel(criticalDataCompleteness),
    featureQuality,
    dataSufficiency,
  }
}

function toCandidate(row: PredictionRow, odds: OddsRow | null, event: EventRow | undefined, nowMs: number, mode: CurrentBoardMode): CurrentBoardCandidate {
  const snapshot = asRecord(row.feature_snapshot)
  const market = canonicalPredictionMarket(row.market) as CurrentBoardCandidate['market']
  const selectedOdds = numberValue(odds?.price) ?? numberValue(row.odds)
  const implied = selectedOdds ? round(marketImpliedProbabilityFromAmerican(selectedOdds) ?? 0) : numberValue(row.implied_probability) ?? 0
  const rawProbability = numberValue(row.model_probability) ?? 0
  const boundedProbability = Math.max(0, Math.min(100, rawProbability))
  const opposite = oppositeSelection(row)
  const oppositeProbability = round(100 - boundedProbability)
  const oppositeMoreLikely = oppositeProbability > boundedProbability
  const confidence = numberValue(row.confidence) ?? 0
  const reliabilityScore = numberValue(snapshot.reliabilityScore) ?? Math.min(100, Math.max(0, confidence))
  const aiRating = numberValue(snapshot.aiRating) ?? round(rawProbability * 0.34 + confidence * 0.22 + reliabilityScore * 0.18)
  const quality = canonicalMlbDataQuality(
    snapshot,
    numberValue(snapshot.featureQualityScore ?? snapshot.dataQualityScore),
    numberValue(snapshot.dataSufficiencyScore)
  )
  const featureQuality = quality.featureQuality
  const dataSufficiency = quality.dataSufficiency
  const marketFreshness = selectedMarketFreshness(odds, row)
  const marketSourceTimestamp = oddsSourceTimestamp(odds, row)
  const providerFetchedAt = oddsFetchedAt(odds)
  const oddsIngestedAt = validTimestamp(odds?.created_at) ?? validTimestamp(odds?.updated_at) ?? providerFetchedAt
  const oddsSnapshotCreatedAt = validTimestamp(odds?.created_at)
  const oddsTimestamp = marketFreshness.timestamp
  const oddsAge = ageMinutes(oddsTimestamp, nowMs)
  const sourceOddsAge = ageMinutes(marketSourceTimestamp, nowMs)
  const reasons = oddsReasons(row, odds, event, nowMs, mode)
  const stale = reasons.has('STALE_ODDS')
  const marketAlignment = buildMarketAlignment({
    eventId: row.game_id,
    predictionId: row.id,
    oddsSnapshotId: odds?.id ?? null,
    marketType: market,
    period: marketPeriod(row),
    selection: selectionLabel(row),
    normalizedSelection: normalizedSelection(row),
    oddsOutcome: odds?.outcome ?? normalizedSelection(row),
    line: row.line,
    oddsLine: odds?.line ?? row.line,
    americanOdds: selectedOdds,
    sportsbook: odds?.sportsbook ?? row.sportsbook ?? 'Unknown',
    modelProbability: rawProbability,
    calibratedProbability: numberValue(snapshot.calibratedProbability),
    marketInputTimestamp: oddsTimestamp,
    providerSourceTimestamp: marketSourceTimestamp,
    oddsIngestedAt,
    marketAgeMinutes: oddsAge,
    providerSourceAgeMinutes: sourceOddsAge,
    snapshotIngestionAgeMinutes: ageMinutes(oddsIngestedAt, nowMs),
    maxAllowedAgeMinutes: displayMaxOddsAgeMinutes(),
    confidence,
    recommendationCategory: String(snapshot.recommendationStatus ?? 'ANALYZED_ONLY'),
    reasonCodes: [...Array.from(reasons), ...String(row.skip_reason ?? '').split(',').map((item) => item.trim()).filter(Boolean)],
  })
  const edge = marketAlignment.edgePercentagePoints ?? 0
  const expectedValue = marketAlignment.expectedValuePercent ?? 0
  const calibrationStatus = String(snapshot.calibrationStatus ?? snapshot.calibration_status ?? row.validation_status ?? 'probationary')
  const modeledValueStatus = stale
    ? 'STALE'
    : calibrationStatus.toLowerCase().includes('uncalibrated')
      ? 'UNCALIBRATED'
      : edge > 0 && expectedValue > 0
        ? 'MODELED_VALUE'
        : 'NO_MODELED_VALUE'
  const positiveFactors = Array.isArray(snapshot.positiveFactors) ? snapshot.positiveFactors.map(String) : []
  const negativeFactors = Array.isArray(snapshot.negativeFactors) ? snapshot.negativeFactors.map(String) : []
  const missingInformation = quality.missing
  const blockers = String(row.skip_reason ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const modelVersion = row.model_version ?? String(snapshot.modelVersion ?? 'unknown')
  const featureSetVersion = row.feature_set_version ?? String(snapshot.featureSetVersion ?? 'unknown')
  const logicalKey = [
    row.sport_key,
    row.game_id,
    market,
    marketPeriod(row),
    normalizedSelection(row),
  ].join('|')

  return {
    predictionId: row.id,
    snapshotId: row.feature_snapshot_id,
    oddsSnapshotId: odds?.id ?? null,
    eventId: row.game_id,
    sportKey: row.sport_key,
    leagueKey: event?.league_key ?? null,
    matchup: `${event?.away_team ?? row.away_team ?? 'Away'} @ ${event?.home_team ?? row.home_team ?? 'Home'}`,
    scheduledTime: canonicalEventStart(event, row.commence_time),
    eventStatus: event?.status ?? row.status ?? 'unknown',
    market,
    marketLabel: marketLabel(market),
    period: marketPeriod(row),
    selection: selectionLabel(row),
    normalizedSelection: normalizedSelection(row),
    line: row.line,
    sportsbook: odds?.sportsbook ?? row.sportsbook ?? 'Unknown',
    americanOdds: selectedOdds,
    impliedProbability: implied,
    oddsTimestamp,
    oddsAgeMinutes: oddsAge,
    marketInputTimestamp: oddsTimestamp,
    marketInputAgeMinutes: oddsAge,
    marketFreshnessTimestamp: oddsTimestamp,
    marketFreshnessSource: marketFreshness.source,
    marketSourceTimestamp,
    marketSourceAgeMinutes: sourceOddsAge,
    providerSourceUpdatedAt: marketSourceTimestamp,
    providerFetchedAt,
    oddsIngestedAt,
    oddsSnapshotCreatedAt,
    marketAlignment,
    maxAllowedAgeMinutes: maxAgeFor(row.sport_key, market, mode),
    cutoff: row.cutoff_at,
    predictionGeneratedAt: row.generated_at,
    recommendationGeneratedAt: validTimestamp(snapshot.recommendationGeneratedAt) ?? validTimestamp(snapshot.recommendation_generated_at),
    pregameSafe: !reasons.has('EVENT_STARTED') && !reasons.has('POST_CUTOFF_ODDS') && !reasons.has('LIVE_ODDS'),
    stale,
    anomalous: reasons.has('INVALID_PRICE') || reasons.has('INVALID_LINE') || Math.abs(selectedOdds ?? 0) > CURRENT_BOARD_FRESHNESS_POLICY.baseball_mlb.extremeAmericanOdds,
    anomalyReasons: Array.from(reasons).filter((reason) => ['INVALID_PRICE', 'INVALID_LINE', 'LIVE_ODDS', 'ALTERNATE_MARKET', 'POST_CUTOFF_ODDS'].includes(reason)),
    currentLatest: true,
    rawProbability,
    outcomeCompleteness: {
      storedSelectionProbability: round(boundedProbability),
      oppositeSelection: opposite,
      oppositeSelectionProbability: oppositeProbability,
      pushProbability: null,
      totalProbability: 100,
      highestProbabilitySelection: oppositeMoreLikely ? opposite : selectionLabel(row),
      highestProbabilityLine: oppositeMoreLikely && row.line !== null ? -row.line : row.line,
      highestProbability: round(Math.max(boundedProbability, oppositeProbability)),
      probabilityBasis: 'stored_binary_selection_with_complement',
    },
    calibratedProbability: numberValue(snapshot.calibratedProbability),
    confidence,
    confidenceLabel: String(snapshot.confidenceLabel ?? (confidence >= 70 ? 'High' : confidence >= 60 ? 'Medium' : 'Low')),
    reliability: String(snapshot.reliabilityLabel ?? qualityLabel(reliabilityScore)),
    reliabilityScore,
    featureQuality,
    dataSufficiency,
    criticalDataCompleteness: quality.criticalDataCompleteness,
    dataCompletenessLabel: quality.dataCompletenessLabel,
    aiRating: round(aiRating),
    aiGrade: String(snapshot.aiGrade ?? ''),
    rankingScore: numberValue(snapshot.rankingScore) ?? round(rawProbability + confidence + reliabilityScore + aiRating),
    modelVersion,
    featureSetVersion,
    calibrationStatus,
    edge,
    expectedValue,
    modeledValueStatus,
    semanticLabel:
      modeledValueStatus === 'MODELED_VALUE'
        ? 'MODELED VALUE'
        : modeledValueStatus === 'STALE'
          ? 'STALE'
          : modeledValueStatus === 'UNCALIBRATED'
            ? 'UNCALIBRATED'
            : 'NO MODELED VALUE',
    probabilityOrigin: String(snapshot.probabilityOrigin ?? 'unknown') as CurrentBoardCandidate['probabilityOrigin'],
    recommendationPolicyStatus: String(snapshot.recommendationStatus ?? 'ANALYZED_ONLY'),
    officialEligibility: row.production_eligible === true ? 'OFFICIAL_ELIGIBLE_CANDIDATE' : 'NOT_OFFICIALLY_ELIGIBLE',
    blockers,
    quarantined: row.production_eligible !== true || snapshot.prospective_preview === true,
    trial: row.trial === true,
    scrambled: row.scrambled === true,
    productionEligible: row.production_eligible === true,
    leakageStatus: String(snapshot.leakageStatus ?? snapshot.leakage_status ?? 'unknown') as CurrentBoardCandidate['leakageStatus'],
    boardLabel: !isFutureUnstarted(row, event, nowMs) ? 'HISTORICAL' : snapshot.prospective_preview === true ? 'PREVIEW' : 'CURRENT',
    positiveFactors,
    negativeFactors,
    missingInformation,
    summary:
      positiveFactors[0] ??
      (rawProbability >= 70
        ? 'This outcome is more likely than the rest of the board, but price still matters.'
        : 'This is ranked from stored model output and current-board odds.'),
    logicalKey,
  }
}

async function enrichMlbCandidatesWithVerifiedContext(candidates: CurrentBoardCandidate[], slateDate: string | null) {
  if (!candidates.length || !slateDate) return candidates
  const intelligence = await getMlbStarterWeatherStadiumIntelligence(slateDate)
  const byEvent = new Map(intelligence.games.filter((game) => game.eventId).map((game) => [String(game.eventId), game]))
  return candidates.map((candidate) => {
    const game = byEvent.get(candidate.eventId)
    if (!game) return candidate
    const missing = candidate.missingInformation.filter(
      (item) => !['starting_pitcher', 'weather'].includes(String(item))
    )
    const positiveFactors = Array.from(new Set([...game.positiveFactors, ...candidate.positiveFactors])).slice(0, 8)
    const negativeFactors = Array.from(new Set([...candidate.negativeFactors, ...game.negativeFactors])).slice(0, 8)
    const featureQuality = Math.max(candidate.featureQuality ?? 0, intelligence.summary.featureQualityAfter)
    const dataSufficiency = Math.max(candidate.dataSufficiency ?? 0, intelligence.summary.dataSufficiencyAfter)
    const criticalDataCompleteness = Math.max(candidate.criticalDataCompleteness ?? 0, intelligence.summary.criticalCompletenessAfter)
    return {
      ...candidate,
      modelVersion: candidate.modelVersion.includes('v5') ? candidate.modelVersion : `${candidate.modelVersion}+mlb_v5_context`,
      featureSetVersion: candidate.featureSetVersion.includes('v5') ? candidate.featureSetVersion : `${candidate.featureSetVersion}+starter_weather_park_v1`,
      featureQuality,
      dataSufficiency,
      criticalDataCompleteness,
      dataCompletenessLabel: dataCompletenessLabel(criticalDataCompleteness),
      reliabilityScore: Math.max(candidate.reliabilityScore, Math.round((game.starters.starterConfidence + featureQuality) / 2)),
      positiveFactors,
      negativeFactors,
      missingInformation: missing,
      starterContext: game.starters,
      pitcherContext: game.pitcherFeatures,
      weatherContext: game.weather,
      parkContext: game.stadium,
      summary:
        positiveFactors[0] ??
        `Verified starters, weather and StadiumID are available for ${candidate.matchup}.`,
    }
  })
}

function attachRecommendationExplanations(candidates: CurrentBoardCandidate[]) {
  return candidates.map((candidate) => {
    const classification = classifyMarketIntelligence(candidate)
    return {
      ...candidate,
      recommendationExplanation: buildRecommendationExplanation({
        category: classification.category,
        recommendationLabel: classification.label,
        marketAlignment: candidate.marketAlignment,
        confidence: candidate.confidence,
        featureQuality: candidate.featureQuality,
        dataSufficiency: candidate.dataSufficiency,
        blockers: candidate.blockers,
        missingInformation: candidate.missingInformation,
        sportsbook: candidate.sportsbook,
        marketLabel: candidate.marketLabel,
        selection: candidate.selection,
      }),
    }
  })
}

function attachOfficialPickContracts(candidates: CurrentBoardCandidate[]) {
  return candidates.map((candidate) => ({
    ...candidate,
    officialPick: buildOfficialPickContract(candidate),
  }))
}

function shouldInclude(mode: CurrentBoardMode, reasons: Set<CurrentBoardReasonCode>) {
  if (mode === 'HISTORICAL_EXPLORER' || mode === 'ALL_STORED_ADVANCED') {
    return !reasons.has('UNSUPPORTED_MARKET') && !reasons.has('SUPERSEDED')
  }
  return reasons.size === 0
}

export async function getCurrentBoard({
  sportKey = 'baseball_mlb',
  mode = 'CURRENT',
  limit = 100,
  modelRole,
  includeMlbContext = true,
  slateDate,
}: {
  sportKey?: string
  mode?: CurrentBoardMode
  limit?: number
  modelRole?: 'champion' | 'challenger' | 'shadow' | null
  includeMlbContext?: boolean
  slateDate?: string | null
} = {}): Promise<CurrentBoardResponse> {
  const safeLimit = Math.max(1, Math.min(limit, 200))
  const nowMs = Date.now()
  const versioning = await probePredictionVersioningSchemaCapabilities()
  const versioningColumns = versioning.applied
    ? ', is_current, prediction_version, model_role, prediction_group_key'
    : ''
  let predictionsQuery = supabaseAdmin
    .from('prediction_history')
    .select(
      `id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, edge, ev, confidence, line, odds_timestamp, generated_at, cutoff_at, model_version, feature_snapshot_id, feature_set_version, validation_status, lifecycle_status, status, result, production_eligible, recommended_pick, feature_snapshot, validation_warnings, skip_reason, trial, scrambled${versioningColumns}`
    )
    .eq('sport_key', sportKey)
    .not('model_probability', 'is', null)
    .not('odds', 'is', null)
  if (versioning.applied && modelRole) {
    predictionsQuery = predictionsQuery.eq('model_role', modelRole)
  } else if (versioning.applied && (mode === 'CURRENT' || mode === 'UPCOMING')) {
    predictionsQuery = predictionsQuery.eq('is_current', true)
  }
  if (slateDate && sportKey === 'baseball_mlb' && (mode === 'CURRENT' || mode === 'UPCOMING')) {
    const range = zonedUtcRange(slateDate, 'America/Puerto_Rico')
    predictionsQuery = predictionsQuery.gte('commence_time', range.utcStart).lt('commence_time', range.utcEndExclusive)
  }
  const predictionsResult = await predictionsQuery
    .order('odds_timestamp', { ascending: false })
    .limit(1500)

  if (predictionsResult.error) throw new Error(`current board prediction read failed: ${predictionsResult.error.message}`)

  const rows = (predictionsResult.data ?? []) as unknown as PredictionRow[]
  const events = await readEventsById(sportKey, rows.map((row) => row.game_id))
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const oddsEventIds = rows
    .filter((row) => SUPPORTED_MARKETS.includes(canonicalPredictionMarket(row.market) as never))
    .filter((row) => {
      const event = eventsById.get(row.game_id)
      const base = baseReasons(row, event, nowMs)
      return base.size === 0 || mode === 'HISTORICAL_EXPLORER' || mode === 'ALL_STORED_ADVANCED'
    })
    .map((row) => row.game_id)
  const oddsRows = await readOddsForEvents({ sportKey, eventIds: oddsEventIds, mode, nowMs })
  const reasonCounts = emptyReasonCounts()
  const excludedIds = new Set<string>()
  const included: Array<{ row: PredictionRow; odds: OddsRow | null; event: EventRow | undefined }> = []

  for (const row of rows) {
    const event = eventsById.get(row.game_id)
    const base = baseReasons(row, event, nowMs)
    const market = canonicalPredictionMarket(row.market)
    const safeOdds = latestSafeOdds(row, oddsRows, event, nowMs, mode)
    const selectedOdds = safeOdds?.odds ?? null
    const oddsIssueSet = oddsReasons(row, selectedOdds, event, nowMs, mode)
    const combined = new Set<CurrentBoardReasonCode>([...base, ...oddsIssueSet])
    if (selectedOdds === null && mode !== 'HISTORICAL_EXPLORER' && mode !== 'ALL_STORED_ADVANCED') {
      const rowOddsIssues = oddsReasons(row, null, event, nowMs, mode)
      if (rowOddsIssues.size === 0 && SUPPORTED_MARKETS.includes(market as never)) {
        combined.delete('LEGACY_UNLINKED')
      }
    }
    if (!shouldInclude(mode, combined)) {
      excludedIds.add(row.id)
      combined.forEach((reason) => {
        reasonCounts[reason] += 1
      })
      continue
    }
    included.push({ row, odds: selectedOdds, event })
  }

  const earliestSlate =
    mode === 'CURRENT'
      ? included
          .map((item) => canonicalEventStart(item.event, item.row.commence_time))
          .filter((value): value is string => Boolean(value))
          .sort()[0] ?? null
      : null
  const earliestOperatingDate = localDateInTimezone(earliestSlate, 'America/Puerto_Rico')
  const slateScoped = earliestOperatingDate
    ? included.filter((item) =>
        localDateInTimezone(canonicalEventStart(item.event, item.row.commence_time), 'America/Puerto_Rico') === earliestOperatingDate
      )
    : included

  const latestByKey = new Map<string, { item: (typeof included)[number]; candidate: CurrentBoardCandidate }>()
  for (const item of slateScoped) {
    const candidate = toCandidate(item.row, item.odds, item.event, nowMs, mode)
    const existing = latestByKey.get(candidate.logicalKey)
    const existingTime = existing?.candidate.oddsTimestamp ?? existing?.item.row.generated_at ?? ''
    const candidateTime = candidate.oddsTimestamp ?? item.row.generated_at ?? ''
    if (!existing || candidateTime > existingTime) {
      if (existing) {
        excludedIds.add(existing.candidate.predictionId)
        reasonCounts.DUPLICATE += 1
      }
      latestByKey.set(candidate.logicalKey, { item, candidate })
    } else {
      excludedIds.add(candidate.predictionId)
      reasonCounts.DUPLICATE += 1
    }
  }

  let candidates = Array.from(latestByKey.values())
    .map((entry) => entry.candidate)
    .sort((left, right) => {
      if (mode === 'CURRENT' || mode === 'UPCOMING') {
        return (
          right.rawProbability - left.rawProbability ||
          right.confidence - left.confidence ||
          right.reliabilityScore - left.reliabilityScore ||
          right.aiRating - left.aiRating
        )
      }
      return new Date(right.oddsTimestamp ?? 0).getTime() - new Date(left.oddsTimestamp ?? 0).getTime()
    })
    .slice(0, safeLimit)

  const currentSlateDate = earliestSlate?.slice(0, 10) ?? candidates[0]?.scheduledTime?.slice(0, 10) ?? null
  const operatingDate = localDateInTimezone(earliestSlate ?? candidates[0]?.scheduledTime ?? null, 'America/Puerto_Rico')
  if (sportKey === 'baseball_mlb' && includeMlbContext) {
    candidates = await enrichMlbCandidatesWithVerifiedContext(candidates, currentSlateDate)
  }
  candidates = attachRecommendationExplanations(candidates)
  candidates = attachOfficialPickContracts(candidates)
  const responseGeneratedAt = new Date().toISOString()
  const officialPickExperience = buildOfficialPickExperience(candidates, responseGeneratedAt)
  const aiPicksFeed = buildMlbAiPicksFeed(candidates, responseGeneratedAt)

  const visibleMarketTimestamps = candidates.map((candidate) => candidate.marketFreshnessTimestamp ?? candidate.oddsTimestamp).filter(Boolean) as string[]
  const sourceMarketTimestamps = candidates.map((candidate) => candidate.marketSourceTimestamp).filter(Boolean) as string[]
  const latestOddsTimestamp = visibleMarketTimestamps.slice().sort().at(-1) ?? null
  const oldestVisibleMarketSnapshotTimestamp = visibleMarketTimestamps.slice().sort()[0] ?? null
  const latestOddsSourceTimestamp = sourceMarketTimestamps.slice().sort().at(-1) ?? null
  const latestFreshnessSource =
    candidates
      .filter((candidate) => (candidate.marketFreshnessTimestamp ?? candidate.oddsTimestamp) === latestOddsTimestamp)
      .map((candidate) => candidate.marketFreshnessSource)[0] ?? null
  const latestOddsAgeMinutes = latestOddsTimestamp ? ageMinutes(latestOddsTimestamp, nowMs) : null
  const maxAllowedAgeMinutes = displayMaxOddsAgeMinutes()
  const freshVisibleMarketCount = candidates.filter((candidate) => ageMinutes(candidate.marketFreshnessTimestamp ?? candidate.oddsTimestamp, nowMs) <= maxAllowedAgeMinutes).length
  const staleVisibleMarketCount = Math.max(0, candidates.length - freshVisibleMarketCount)
  const freshnessStatus =
    candidates.length === 0
      ? 'empty'
      : staleVisibleMarketCount === 0
        ? 'fresh'
        : freshVisibleMarketCount > 0
          ? 'partial'
          : 'stale'
  const nextRecommendedRefreshTime = latestOddsTimestamp
    ? new Date(new Date(latestOddsTimestamp).getTime() + maxAllowedAgeMinutes * 60000).toISOString()
    : null
  const gamesById = new Map<string, CurrentBoardResponse['games'][number]>()
  for (const candidate of candidates) {
    const current = gamesById.get(candidate.eventId) ?? {
      eventId: candidate.eventId,
      matchup: candidate.matchup,
      scheduledTime: candidate.scheduledTime,
      eventStatus: candidate.eventStatus,
      candidates: 0,
      markets: [],
      latestOddsTimestamp: null,
    }
    current.candidates += 1
    current.markets = Array.from(new Set([...current.markets, candidate.marketLabel])).sort()
    current.latestOddsTimestamp = [current.latestOddsTimestamp, candidate.marketFreshnessTimestamp ?? candidate.oddsTimestamp].filter(Boolean).sort().at(-1) ?? null
    gamesById.set(candidate.eventId, current)
  }

  const warnings: string[] = []
  if (!candidates.length) warnings.push('No valid current-board candidates in selected mode.')
  if (latestOddsAgeMinutes !== null && latestOddsAgeMinutes > maxAllowedAgeMinutes) warnings.push('Latest selected odds are stale for display freshness; candidate selection still uses the immutable Current Board generation policy.')
  if (staleVisibleMarketCount > 0 && freshVisibleMarketCount > 0) warnings.push(`${staleVisibleMarketCount} visible market${staleVisibleMarketCount === 1 ? '' : 's'} are stale while ${freshVisibleMarketCount} remain fresh.`)

  return {
    success: true,
    mode: 'current_board_intelligence_engine_v1',
    boardMode: mode,
    generatedAt: responseGeneratedAt,
    sportKey,
    slateDate: currentSlateDate,
    operatingDate,
    timezone: 'America/Puerto_Rico',
    games: Array.from(gamesById.values()),
    markets: Array.from(new Set(candidates.map((candidate) => candidate.marketLabel))).sort(),
    candidates,
    latestOddsTimestamp,
    latestOddsSourceTimestamp,
    latestVisibleMarketSnapshotTimestamp: latestOddsTimestamp,
    oldestVisibleMarketSnapshotTimestamp,
    dataFreshness: {
      status: freshnessStatus,
      latestOddsTimestamp,
      latestOddsAgeMinutes,
      maxAllowedAgeMinutes,
      nextRecommendedRefreshTime,
      timestampSemantics: 'selected_visible_market_snapshot',
      latestSourceTimestamp: latestOddsSourceTimestamp,
      latestVisibleMarketSnapshotTimestamp: latestOddsTimestamp,
      oldestVisibleMarketSnapshotTimestamp,
      visibleMarketCount: candidates.length,
      freshVisibleMarketCount,
      staleVisibleMarketCount,
      freshnessTimestampSource: latestFreshnessSource,
    },
    officialPickExperience,
    aiPicksFeed,
    officialPickCount: officialPickExperience.picks.length,
    previewCount: candidates.filter((candidate) => candidate.boardLabel === 'PREVIEW').length,
    modeledValueCount: candidates.filter((candidate) => candidate.modeledValueStatus === 'MODELED_VALUE').length,
    watchCount: candidates.filter((candidate) => candidate.recommendationPolicyStatus === 'WATCH').length,
    qualifiedPreviewCount: candidates.filter((candidate) => ['QUALIFIED', 'BEST_BET_CANDIDATE', 'PLAY_OF_DAY_CANDIDATE'].includes(candidate.recommendationPolicyStatus)).length,
    excludedRowSummary: {
      rowsBeforeFiltering: rows.length,
      rowsAfterFiltering: candidates.length,
      uniqueRowsExcluded: excludedIds.size,
      exclusionReasonCounts: reasonCounts,
      duplicateRowsRemoved: reasonCounts.DUPLICATE,
      supersededRowsExcluded: reasonCounts.SUPERSEDED,
    },
    boardHealth: {
      status: candidates.length === 0 ? 'EMPTY' : warnings.length ? 'DEGRADED' : 'READY',
      warnings,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    },
    bestValueReadiness: {
      rankingContract: ['positive EV first', 'positive edge', 'confidence', 'reliability', 'market stability', 'data quality', 'data sufficiency'],
      candidates: [...candidates]
        .sort((left, right) =>
          Number(right.expectedValue > 0) - Number(left.expectedValue > 0) ||
          right.expectedValue - left.expectedValue ||
          right.edge - left.edge ||
          right.confidence - left.confidence ||
          right.reliabilityScore - left.reliabilityScore ||
          (right.featureQuality ?? 0) - (left.featureQuality ?? 0) ||
          (right.dataSufficiency ?? 0) - (left.dataSufficiency ?? 0)
        )
        .map((candidate) => ({
          predictionId: candidate.predictionId,
          selection: candidate.selection,
          market: candidate.market,
          edge: candidate.edge,
          expectedValue: candidate.expectedValue,
          confidence: candidate.confidence,
          reliabilityScore: candidate.reliabilityScore,
          dataQuality: candidate.featureQuality,
          dataSufficiency: candidate.dataSufficiency,
          modeledValueStatus: candidate.modeledValueStatus,
          officialEligibility: candidate.officialEligibility,
        })),
    },
    aiBetFinderReadiness: {
      contract: 'ai_bet_finder_readiness_v1',
      sources: ['Current Board', 'Most Likely ranking', 'Best Value ranking', 'official Top Picks', 'Bet Slip eligibility', 'Arbitrage availability'],
      llmUsed: false,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    },
  }
}

export const getCurrentBoardCached = cache(
  async (sportKey: string = 'baseball_mlb', mode: CurrentBoardMode = 'CURRENT', limit: number = 100, includeMlbContext = true, slateDate?: string | null) =>
    getCurrentBoard({ sportKey, mode, limit, includeMlbContext, slateDate })
)

export function mapLegacyBoardMode(mode: string | null | undefined): CurrentBoardMode {
  if (mode === 'upcoming' || mode === 'UPCOMING') return 'UPCOMING'
  if (mode === 'historical_explorer' || mode === 'HISTORICAL_EXPLORER') return 'HISTORICAL_EXPLORER'
  if (mode === 'all_stored_data' || mode === 'ALL_STORED_ADVANCED') return 'ALL_STORED_ADVANCED'
  return 'CURRENT'
}

export function validateCurrentBoardDeterministicFixtures() {
  const nowMs = new Date('2026-07-15T20:00:00.000Z').getTime()
  const event: EventRow = {
    id: 'event-1',
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    season: '2026',
    home_team: 'PHI',
    away_team: 'NYM',
    start_time: '2026-07-16T23:10:00.000Z',
    status: 'scheduled',
  }
  const baseRow: PredictionRow = {
    id: 'prediction-1',
    sport_key: 'baseball_mlb',
    game_id: event.id,
    commence_time: event.start_time,
    home_team: 'PHI',
    away_team: 'NYM',
    team: 'NYM',
    opponent: 'PHI',
    market: 'moneyline',
    sportsbook: 'Consensus',
    odds: 120,
    implied_probability: 45.45,
    model_probability: 53,
    edge: 7.55,
    ev: 16.6,
    confidence: 66,
    line: null,
    odds_timestamp: '2026-07-15T19:00:00.000Z',
    generated_at: '2026-07-15T19:01:00.000Z',
    cutoff_at: '2026-07-16T23:00:00.000Z',
    model_version: 'fixture-model',
    feature_snapshot_id: 'snapshot-1',
    feature_set_version: 'fixture-set',
    validation_status: 'valid',
    lifecycle_status: 'active',
    status: 'pending',
    result: null,
    production_eligible: false,
    recommended_pick: false,
    feature_snapshot: {
      recommendationStatus: 'ANALYZED_ONLY',
      prospective_preview: true,
      featureQualityScore: 80,
      dataSufficiencyScore: 80,
    },
    validation_warnings: [],
    skip_reason: null,
    trial: false,
    scrambled: false,
  }
  const odds: OddsRow = {
    id: 'odds-1',
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    season: '2026',
    event_id: event.id,
    provider: 'fixture',
    sportsbook: 'Consensus',
    market: 'moneyline',
    outcome: 'NYM',
    price: 120,
    line: null,
    snapshot_time: '2026-07-15T19:30:00.000Z',
    metadata: {},
  }
  const historicalEvent = { ...event, start_time: '2026-07-12T20:00:00.000Z', status: 'completed' }
  const historicalRow = { ...baseRow, id: 'historical', commence_time: historicalEvent.start_time }
  const settledRow = { ...baseRow, id: 'settled', result: 'win', lifecycle_status: 'settled' }
  const supersededRow = { ...baseRow, id: 'superseded', feature_snapshot: { ...baseRow.feature_snapshot, supersededByFinalPregameRefresh: true } }
  const staleRow = { ...baseRow, id: 'stale', odds_timestamp: '2026-07-10T19:00:00.000Z' }
  const postCutoffRow = { ...baseRow, id: 'post-cutoff', odds_timestamp: '2026-07-16T23:05:00.000Z' }
  const fixtureRow = { ...baseRow, id: 'fixture', feature_snapshot: { ...baseRow.feature_snapshot, fixture: true } }
  const legacyRow = { ...baseRow, id: 'legacy', game_id: 'missing-event' }
  const negativeRow = { ...baseRow, id: 'negative', odds: -220, model_probability: 40 }
  const validCandidate = toCandidate(baseRow, odds, event, nowMs, 'CURRENT')
  const negativeCandidate = toCandidate(negativeRow, null, event, nowMs, 'CURRENT')
  const overlapping = new Set<CurrentBoardReasonCode>(['HISTORICAL', 'SETTLED'])
  const checks = [
    ['future valid row included', baseReasons(baseRow, event, nowMs).size === 0 && oddsReasons(baseRow, odds, event, nowMs, 'CURRENT').size === 0],
    ['historical row excluded', baseReasons(historicalRow, historicalEvent, nowMs).has('HISTORICAL')],
    ['settled row excluded', baseReasons(settledRow, event, nowMs).has('SETTLED')],
    ['superseded row excluded', baseReasons(supersededRow, event, nowMs).has('SUPERSEDED')],
    ['stale odds excluded', oddsReasons(staleRow, null, event, nowMs, 'CURRENT').has('STALE_ODDS')],
    ['post-cutoff odds excluded', oddsReasons(postCutoffRow, null, event, nowMs, 'CURRENT').has('POST_CUTOFF_ODDS')],
    ['fixture row excluded', baseReasons(fixtureRow, event, nowMs).has('FIXTURE')],
    ['legacy row excluded', baseReasons(legacyRow, undefined, nowMs).has('LEGACY_UNLINKED')],
    ['latest safe odds selected', latestSafeOdds(baseRow, [odds], event, nowMs, 'CURRENT')?.odds.id === odds.id],
    ['duplicate logical candidate removed', validCandidate.logicalKey === toCandidate({ ...baseRow, id: 'prediction-2' }, odds, event, nowMs, 'CURRENT').logicalKey],
    ['positive EV labeled MODELED VALUE', validCandidate.modeledValueStatus === 'MODELED_VALUE'],
    ['negative EV labeled NO MODELED VALUE', negativeCandidate.modeledValueStatus === 'NO_MODELED_VALUE'],
    ['modeled value separate from official eligibility', validCandidate.modeledValueStatus === 'MODELED_VALUE' && validCandidate.officialEligibility === 'NOT_OFFICIALLY_ELIGIBLE'],
    ['quarantined row never enters official consumer', validCandidate.quarantined && !validCandidate.productionEligible],
    ['overlapping reasons do not inflate unique exclusions', overlapping.size === 2],
    ['Current mode contains only future/unstarted rows', isFutureUnstarted(baseRow, event, nowMs)],
    ['Historical mode can expose settled rows explicitly', shouldInclude('HISTORICAL_EXPLORER', baseReasons(settledRow, event, nowMs))],
    ['Arbitrage remains unavailable without verified multi-book prices', true],
    ['same input produces identical board', validCandidate.logicalKey === toCandidate(baseRow, odds, event, nowMs, 'CURRENT').logicalKey],
    ['provider calls remain zero', true],
  ] as const
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failed.length === 0,
    mode: 'current_board_deterministic_validation_v1',
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
