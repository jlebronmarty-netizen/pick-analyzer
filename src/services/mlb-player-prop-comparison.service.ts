import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  MLB_PLAYER_PROP_MARKETS,
  playerPropMarketByKey,
  playerPropMarketFromStorage,
  playerPropSupportedLine,
} from '@/config/mlb-player-prop-markets'
import { previewPitcherProjection } from '@/services/mlb-pitcher-projection-engine.service'
import type { MlbPitcherProjection, PitcherDataSufficiency, PitcherStarterStatus, PitcherWorkloadContext } from '@/types/mlb-pitcher-projections'
import type {
  PitcherPropComparison,
  PitcherPropComparisonStatus,
  PitcherPropEdge,
  PitcherPropHealth,
  PitcherPropLine,
  PitcherPropMarket,
  PitcherPropMarketKey,
  PitcherPropOutcome,
} from '@/types/mlb-player-prop-comparison'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const MODE = 'mlb_player_prop_market_comparison_v1'
const MARKET_KEY = 'pitcher_outs_recorded'
const MARKET_LABEL = 'Pitcher Recorded Outs'
const MARKET_ALIGNED_THRESHOLD = 0.025

type OddsRow = {
  id: string
  event_id: string
  provider: string
  sportsbook: string
  market: string
  outcome: string
  price: number | string | null
  line: number | string | null
  snapshot_time: string | null
  metadata: Record<string, unknown> | null
}

type StoredPitcherProjectionRow = {
  id: string
  event_id: string
  pitcher_id: string
  provider_pitcher_id: string | null
  starter_status: string
  projected_outs: number | string | null
  projected_innings: number | string | null
  projected_pitch_count: number | string | null
  projected_strikeouts: number | string | null
  projected_hits_allowed: number | string | null
  projected_earned_runs: number | string | null
  outs_distribution: Record<string, unknown> | null
  threshold_probabilities: Record<string, unknown> | null
  confidence: number | string
  quality_score: number | string
  data_sufficiency: string
  feature_snapshot: Record<string, unknown> | null
  drivers: string[] | null
  risks: string[] | null
  warnings: string[] | null
  model_version: string
  generated_at: string
  cutoff_at: string | null
}

function nowIso() {
  return new Date().toISOString()
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 24)
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function arr(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

function round(value: number | null, digits = 4) {
  if (value === null || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function normalizeOutcome(value: unknown): PitcherPropOutcome | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'over' || raw === 'o') return 'OVER'
  if (raw === 'under' || raw === 'u') return 'UNDER'
  return null
}

function normalizeMarket(value: unknown) {
  return playerPropMarketFromStorage(value)?.key ?? null
}

export function americanToDecimal(american: number | null) {
  if (american === null || american === 0) return null
  return round(american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american), 4)
}

export function americanToImpliedProbability(american: number | null) {
  if (american === null || american === 0) return null
  return round(american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100), 4)
}

export function probabilityToFairAmerican(probability: number | null) {
  if (probability === null || probability <= 0 || probability >= 1) return null
  return probability >= 0.5
    ? Math.round(-(probability / (1 - probability)) * 100)
    : Math.round(((1 - probability) / probability) * 100)
}

export function probabilityToFairDecimal(probability: number | null) {
  if (probability === null || probability <= 0 || probability >= 1) return null
  return round(1 / probability, 4)
}

function marketProbability(projection: MlbPitcherProjection, outcome: PitcherPropOutcome, line: number) {
  const key = String(line) as keyof MlbPitcherProjection['overProbabilities']
  return outcome === 'OVER' ? projection.overProbabilities[key] ?? null : projection.underProbabilities[key] ?? null
}

function projectionValueForMarket(projection: MlbPitcherProjection, marketKey: PitcherPropMarketKey) {
  if (marketKey === 'pitcher_outs_recorded') return projection.projectedOuts
  if (marketKey === 'pitcher_strikeouts') return projection.projectedStrikeouts
  if (marketKey === 'pitcher_hits_allowed') return projection.projectedHitsAllowed
  if (marketKey === 'pitcher_earned_runs') return projection.projectedEarnedRuns
  return null
}

function confidenceLevel(confidence: number) {
  if (confidence >= 80) return 'HIGH'
  if (confidence >= 60) return 'MODERATE'
  if (confidence > 0) return 'LOW'
  return 'INSUFFICIENT'
}

function starterStatus(value: unknown): PitcherStarterStatus {
  const raw = String(value ?? '')
  return raw === 'CONFIRMED' || raw === 'PROBABLE' || raw === 'EXPECTED' || raw === 'UNVERIFIED' ? raw : 'UNVERIFIED'
}

function dataSufficiency(value: unknown): PitcherDataSufficiency {
  const raw = String(value ?? '')
  return raw === 'FULL' || raw === 'STANDARD' || raw === 'LIMITED' || raw === 'INSUFFICIENT' ? raw : 'INSUFFICIENT'
}

function workloadClassification(value: unknown): PitcherWorkloadContext['workloadClassification'] {
  const raw = String(value ?? '')
  return raw === 'WORKHORSE' || raw === 'STANDARD' || raw === 'LIMITED' || raw === 'VOLATILE' || raw === 'INSUFFICIENT' ? raw : 'INSUFFICIENT'
}

async function storedPitcherProjectionFallback(options: { date?: string | null; limit?: number }) {
  let query = supabaseAdmin
    .from('mlb_pitcher_projections')
    .select('id,event_id,pitcher_id,provider_pitcher_id,starter_status,projected_outs,projected_innings,projected_pitch_count,projected_strikeouts,projected_hits_allowed,projected_earned_runs,outs_distribution,threshold_probabilities,confidence,quality_score,data_sufficiency,feature_snapshot,drivers,risks,warnings,model_version,generated_at,cutoff_at')
    .order('generated_at', { ascending: false })
    .limit(Math.min(Math.max(options.limit ?? 200, 1), 500))
  if (options.date) query = query.eq('projection_date', options.date)
  const { data, error } = await query
  if (error) throw new Error(`stored MLB pitcher projections read failed: ${error.message}`)
  const seen = new Set<string>()
  return ((data ?? []) as StoredPitcherProjectionRow[]).flatMap((row) => {
    const featureSnapshot = asRecord(row.feature_snapshot)
    const identity = asRecord(featureSnapshot.identity)
    const starterAssignment = asRecord(featureSnapshot.starterAssignment)
    const workload = asRecord(featureSnapshot.workload)
    const thresholds = asRecord(row.threshold_probabilities)
    const over = asRecord(thresholds.over)
    const under = asRecord(thresholds.under)
    const pitcherName = text(identity.pitcherName)
    if (!pitcherName || seen.has(row.id)) return []
    seen.add(row.id)
    const confidence = num(row.confidence) ?? 0
    return [{
      projectionId: row.id,
      eventId: row.event_id,
      pitcherId: row.pitcher_id,
      providerPitcherId: row.provider_pitcher_id,
      historicalPitcherId: text(identity.historicalPitcherId),
      pitcherName,
      team: text(identity.team),
      opponent: text(starterAssignment.opponent),
      homeAway: starterAssignment.homeAway === 'home' || starterAssignment.homeAway === 'away' ? starterAssignment.homeAway : null,
      handedness: text(identity.handedness),
      starterStatus: starterStatus(row.starter_status),
      starterSource: text(starterAssignment.starterSource) ?? 'stored_projection',
      starterConfirmedAt: text(starterAssignment.starterConfirmedAt),
      projectedOuts: num(row.projected_outs),
      projectedInnings: num(row.projected_innings),
      projectedPitchCount: num(row.projected_pitch_count),
      projectedStrikeouts: num(row.projected_strikeouts),
      projectedHitsAllowed: num(row.projected_hits_allowed),
      projectedEarnedRuns: num(row.projected_earned_runs),
      secondaryAvailability: {
        pitchCount: 'LIMITED',
        innings: 'LIMITED',
        strikeouts: 'LIMITED',
        hitsAllowed: 'LIMITED',
        earnedRuns: 'LIMITED',
      },
      outsDistribution: row.outs_distribution as MlbPitcherProjection['outsDistribution'],
      overProbabilities: {
        '14.5': num(over['14.5']),
        '15.5': num(over['15.5']),
        '16.5': num(over['16.5']),
        '17.5': num(over['17.5']),
        '18.5': num(over['18.5']),
      },
      underProbabilities: {
        '14.5': num(under['14.5']),
        '15.5': num(under['15.5']),
        '16.5': num(under['16.5']),
        '17.5': num(under['17.5']),
        '18.5': num(under['18.5']),
      },
      confidence,
      confidenceLevel: confidenceLevel(confidence),
      qualityScore: num(row.quality_score) ?? 0,
      dataSufficiency: dataSufficiency(row.data_sufficiency),
      recommendationStatus: 'MODEL_PROJECTION_ONLY',
      featureSnapshot: featureSnapshot as MlbPitcherProjection['featureSnapshot'],
      mainDrivers: arr(row.drivers),
      mainRisks: arr(row.risks),
      blockers: [],
      warnings: arr(row.warnings),
      expectedWorkloadClassification: workloadClassification(workload.workloadClassification),
      modelVersion: row.model_version,
      generatedAt: row.generated_at,
      eventStartTime: text(starterAssignment.eventStartTime),
      cutoffAt: row.cutoff_at,
    } satisfies MlbPitcherProjection]
  })
}

function metadataPlayerId(row: OddsRow) {
  const metadata = asRecord(row.metadata)
  return text(metadata.playerId) ?? text(metadata.player_id) ?? text(metadata.providerPlayerId) ?? text(metadata.provider_player_id) ?? text(metadata.PlayerID) ?? text(metadata.PlayerId)
}

function metadataBookmakerId(row: OddsRow) {
  const metadata = asRecord(row.metadata)
  return text(metadata.bookmakerId) ?? text(metadata.bookmaker_id) ?? text(metadata.BookmakerID) ?? text(metadata.SportsBookID)
}

function metadataMarketId(row: OddsRow) {
  const metadata = asRecord(row.metadata)
  return text(metadata.marketId) ?? text(metadata.market_id) ?? text(metadata.MarketID)
}

function metadataPitcherName(row: OddsRow) {
  const metadata = asRecord(row.metadata)
  return text(metadata.playerName) ?? text(metadata.player_name) ?? text(metadata.PlayerName) ?? text(metadata.Name)
}

function matchesProjection(row: OddsRow, projection: MlbPitcherProjection) {
  if (row.event_id !== projection.eventId) return false
  const rowPlayerId = metadataPlayerId(row)
  const rowName = metadataPitcherName(row)
  if (!rowPlayerId && !rowName) return false
  return rowPlayerId === projection.pitcherId ||
    rowPlayerId === projection.providerPitcherId ||
    rowName?.toLowerCase() === projection.pitcherName.toLowerCase()
}

function lineFrom(row: OddsRow, projection: MlbPitcherProjection): PitcherPropLine | null {
  const market = normalizeMarket(row.market)
  const outcome = normalizeOutcome(row.outcome)
  const line = num(row.line)
  if (!market || !outcome || line === null || playerPropSupportedLine(market, line) === null) return null
  const americanOdds = num(row.price)
  return {
    lineId: row.id,
    eventId: row.event_id,
    pitcherId: projection.pitcherId,
    providerPitcherId: projection.providerPitcherId,
    pitcherName: projection.pitcherName,
    sportsbook: row.sportsbook,
    bookmakerId: metadataBookmakerId(row),
    provider: row.provider,
    marketId: metadataMarketId(row),
    marketKey: market,
    outcome,
    line,
    americanOdds,
    decimalOdds: americanToDecimal(americanOdds),
    impliedProbability: americanToImpliedProbability(americanOdds),
    lastUpdate: row.snapshot_time,
    snapshotId: row.id,
  }
}

function classify(outcome: PitcherPropOutcome, difference: number | null, confidence: number): PitcherPropComparisonStatus {
  if (difference === null || confidence <= 0) return 'LOW_DATA'
  if (Math.abs(difference) <= MARKET_ALIGNED_THRESHOLD) return 'MARKET_ALIGNED'
  if (outcome === 'OVER') return difference > 0 ? 'MODEL_FAVORS_OVER' : 'MODEL_FAVORS_UNDER'
  return difference > 0 ? 'MODEL_FAVORS_UNDER' : 'MODEL_FAVORS_OVER'
}

function edgeFor(projection: MlbPitcherProjection, line: PitcherPropLine): PitcherPropEdge {
  const modelProbability = marketProbability(projection, line.outcome, line.line)
  const impliedProbability = line.impliedProbability
  const probabilityDifference = modelProbability === null || impliedProbability === null ? null : round(modelProbability - impliedProbability)
  return {
    outcome: line.outcome,
    line: line.line,
    modelProbability,
    impliedProbability,
    probabilityDifference,
    fairAmericanOdds: probabilityToFairAmerican(modelProbability),
    fairDecimalOdds: probabilityToFairDecimal(modelProbability),
    edgePoints: probabilityDifference === null ? null : round(probabilityDifference * 100, 2),
    status: classify(line.outcome, probabilityDifference, projection.confidence),
  }
}

function bestStatus(over: PitcherPropEdge | null, under: PitcherPropEdge | null, hasProjection: boolean): PitcherPropComparisonStatus {
  if (!hasProjection) return 'PROJECTION_ONLY'
  if (!over && !under) return 'NO_PROP_AVAILABLE'
  const candidates = [over, under].filter(Boolean) as PitcherPropEdge[]
  if (!candidates.length) return 'LOW_DATA'
  const strongest = [...candidates].sort((left, right) => Math.abs(right.probabilityDifference ?? 0) - Math.abs(left.probabilityDifference ?? 0))[0]
  return strongest.status
}

async function oddsRowsForEvents(eventIds: string[]) {
  if (!eventIds.length) return [] as OddsRow[]
  const { data, error } = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id,event_id,provider,sportsbook,market,outcome,price,line,snapshot_time,metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .in('event_id', eventIds)
    .like('market', 'player_props:%')
    .order('snapshot_time', { ascending: false })
    .limit(5000)
  if (error) throw new Error(`MLB player prop odds read failed: ${error.message}`)
  return (data ?? []) as OddsRow[]
}

async function allStoredPlayerPropRows() {
  const { data, error } = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id,event_id,provider,sportsbook,market,outcome,price,line,snapshot_time,metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .like('market', 'player_props:%')
    .order('snapshot_time', { ascending: false })
    .limit(5000)
  if (error) throw new Error(`MLB player prop odds inventory read failed: ${error.message}`)
  return (data ?? []) as OddsRow[]
}

function groupedByBookAndLine(rows: PitcherPropLine[]) {
  const map = new Map<string, PitcherPropLine[]>()
  for (const row of rows) {
    const key = `${row.sportsbook}|${row.line}`
    map.set(key, [...(map.get(key) ?? []), row])
  }
  return map
}

function duplicateStoredRowCount(rows: OddsRow[]) {
  const seen = new Set<string>()
  let duplicates = 0
  for (const row of rows) {
    if (seen.has(row.id)) duplicates += 1
    seen.add(row.id)
  }
  return duplicates
}

function compareProjection(projection: MlbPitcherProjection, rows: OddsRow[], marketKey: PitcherPropMarketKey): PitcherPropComparison[] {
  const market = playerPropMarketByKey(marketKey) ?? MLB_PLAYER_PROP_MARKETS[0]
  const normalized = rows
    .map((row) => lineFrom(row, projection))
    .filter((row): row is PitcherPropLine => row !== null && row.marketKey === marketKey)
  const matched = normalized.filter((row) => matchesProjection(rows.find((source) => source.id === row.snapshotId)!, projection))
  const byBookLine = groupedByBookAndLine(matched)
  if (!byBookLine.size) {
    return [{
      comparisonId: `mlb_player_prop_comparison:${hash([projection.projectionId, MARKET_KEY, 'no_prop'])}`,
      projectionId: projection.projectionId,
      eventId: projection.eventId,
      pitcherId: projection.pitcherId,
      providerPitcherId: projection.providerPitcherId,
      historicalPitcherId: projection.historicalPitcherId,
      pitcherName: projection.pitcherName,
      matchup: `${projection.team ?? 'Team'} vs ${projection.opponent ?? 'Opponent'}`,
      starterStatus: projection.starterStatus,
      marketKey,
      marketLabel: market.displayName,
      marketFamily: market.family,
      sportsbook: null,
      bookmakerId: null,
      line: null,
      overLine: null,
      underLine: null,
      overEdge: null,
      underEdge: null,
      bestStatus: projectionValueForMarket(projection, marketKey) === null ? 'PROJECTION_ONLY' : 'NO_PROP_AVAILABLE',
      projectionConfidence: projection.confidence,
      projectionQuality: projection.qualityScore,
      dataSufficiency: projection.dataSufficiency,
      marketFreshness: 'UNAVAILABLE',
      bookFreshness: 'UNAVAILABLE',
      historicalStartsUsed: projection.featureSnapshot.gameLogs.length,
      generatedAt: projection.generatedAt,
      cutoffAt: projection.cutoffAt,
      warnings: [`NO_CURRENT_${marketKey.toUpperCase()}_PROP_MARKET`],
      notes: ['Projection Only', 'No betting recommendation'],
      emptyStateReason: 'NO_CURRENT_SPORTSBOOK_LINE',
      recommendationStatus: 'MODEL_MARKET_COMPARISON_ONLY',
    }]
  }

  return Array.from(byBookLine.entries()).map(([key, lines]) => {
    const [sportsbook] = key.split('|')
    const overLine = lines.find((line) => line.outcome === 'OVER') ?? null
    const underLine = lines.find((line) => line.outcome === 'UNDER') ?? null
    const selectedLine = overLine ?? underLine
    const overEdge = overLine ? edgeFor(projection, overLine) : null
    const underEdge = underLine ? edgeFor(projection, underLine) : null
    return {
      comparisonId: `mlb_player_prop_comparison:${hash([projection.projectionId, sportsbook, selectedLine?.line, selectedLine?.lastUpdate])}`,
      projectionId: projection.projectionId,
      eventId: projection.eventId,
      pitcherId: projection.pitcherId,
      providerPitcherId: projection.providerPitcherId,
      historicalPitcherId: projection.historicalPitcherId,
      pitcherName: projection.pitcherName,
      matchup: `${projection.team ?? 'Team'} vs ${projection.opponent ?? 'Opponent'}`,
      starterStatus: projection.starterStatus,
      marketKey,
      marketLabel: market.displayName,
      marketFamily: market.family,
      sportsbook,
      bookmakerId: selectedLine?.bookmakerId ?? null,
      line: selectedLine?.line ?? null,
      overLine,
      underLine,
      overEdge,
      underEdge,
      bestStatus: bestStatus(overEdge, underEdge, projection.projectedOuts !== null),
      projectionConfidence: projection.confidence,
      projectionQuality: projection.qualityScore,
      dataSufficiency: projection.dataSufficiency,
      marketFreshness: selectedLine?.lastUpdate ?? 'UNAVAILABLE',
      bookFreshness: selectedLine?.lastUpdate ?? 'UNAVAILABLE',
      historicalStartsUsed: projection.featureSnapshot.gameLogs.length,
      generatedAt: projection.generatedAt,
      cutoffAt: projection.cutoffAt,
      warnings: lines.length > 2 ? ['DUPLICATED_SPORTSBOOK_LINE'] : [],
      notes: ['Projection Only', 'No betting recommendation'],
      recommendationStatus: 'MODEL_MARKET_COMPARISON_ONLY',
    }
  })
}

function healthFrom(comparisons: PitcherPropComparison[], oddsRows: OddsRow[], validation: { success: boolean; failedChecks: string[] }): PitcherPropHealth {
  const marketTimes = oddsRows.map((row) => row.snapshot_time).filter(Boolean).sort() as string[]
  const supportedRowsByMarket = MLB_PLAYER_PROP_MARKETS.reduce((acc, market) => {
    acc[market.key] = oddsRows.filter((row) => normalizeMarket(row.market) === market.key && playerPropSupportedLine(market.key, row.line) !== null).length
    return acc
  }, {} as Record<PitcherPropMarketKey, number>)
  return {
    success: validation.success,
    mode: 'mlb_player_prop_market_comparison_health_v1',
    generatedAt: nowIso(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    projectionsEvaluated: new Set(comparisons.map((row) => row.projectionId)).size,
    marketRowsEvaluated: oddsRows.length,
    comparisonsGenerated: comparisons.length,
    noPropAvailable: comparisons.filter((row) => row.bestStatus === 'NO_PROP_AVAILABLE').length,
    lineMismatchRows: oddsRows.filter((row) => {
      const market = normalizeMarket(row.market)
      return market && playerPropSupportedLine(market, row.line) === null
    }).length,
    duplicateSportsbookLines: comparisons.filter((row) => row.warnings.includes('DUPLICATED_SPORTSBOOK_LINE')).length,
    supportedRecordedOutsRows: supportedRowsByMarket.pitcher_outs_recorded,
    supportedRowsByMarket,
    sportsbooks: Array.from(new Set(oddsRows.map((row) => row.sportsbook))).sort(),
    freshness: {
      latestMarketUpdate: marketTimes.at(-1) ?? null,
      oldestMarketUpdate: marketTimes[0] ?? null,
    },
    validation,
  }
}

export function validatePlayerPropComparisonFixtures() {
  const overImplied = americanToImpliedProbability(-115)
  const plusImplied = americanToImpliedProbability(125)
  const fairAmerican = probabilityToFairAmerican(0.71)
  const fairDecimal = probabilityToFairDecimal(0.71)
  const failedChecks = [
    ['negative American odds implied probability', overImplied === 0.5349],
    ['positive American odds implied probability', plusImplied === 0.4444],
    ['fair American odds from probability', fairAmerican === -245],
    ['fair decimal odds from probability', fairDecimal === 1.4085],
    ['supported market catalog includes pitcher and batter markets', MLB_PLAYER_PROP_MARKETS.length === 12 && MLB_PLAYER_PROP_MARKETS.some((market) => market.key === 'batter_total_bases')],
    ['supported half-out lines only', (playerPropMarketByKey(MARKET_KEY)?.supportedLines ?? []).every((line) => Number.isInteger(line * 2) && !Number.isInteger(line))],
    ['line mismatch is blocked', normalizeMarket('player_props:pitcher_outs_recorded') === MARKET_KEY && playerPropSupportedLine(MARKET_KEY, 16) === null],
    ['opposite outcome normalization works', normalizeOutcome('Under') === 'UNDER' && normalizeOutcome('Over') === 'OVER'],
    ['canonical market aliases normalize', normalizeMarket('player_props:batter_rbi') === 'batter_rbi' && normalizeMarket('player_props:batter_runs') === 'batter_runs'],
    ['no zero odds probabilities', americanToImpliedProbability(0) === null && americanToDecimal(0) === null],
  ].filter(([, passed]) => !passed).map(([name]) => name as string)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_player_prop_market_comparison_validation_v1',
    checks: 10,
    passed: 10 - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getMlbPlayerPropComparisons(options: { date?: string | null; limit?: number; pitcherId?: string | null; market?: string | null } = {}) {
  const selectedMarket = playerPropMarketByKey(options.market) ?? MLB_PLAYER_PROP_MARKETS[0]
  const slate = await previewPitcherProjection({ date: options.date, limit: 200 }).catch(async (error) => ({
    generatedAt: nowIso(),
    selectedDate: options.date ?? new Date().toISOString().slice(0, 10),
    projections: await storedPitcherProjectionFallback({ date: options.date, limit: options.limit ?? 200 }),
    fallbackWarning: `PITCHER_PROJECTION_PREVIEW_FAILED_STORED_FALLBACK_USED: ${error instanceof Error ? error.message : String(error)}`,
  }))
  const projections = slate.projections.filter((projection) =>
    !options.pitcherId ||
    projection.pitcherId === options.pitcherId ||
    projection.providerPitcherId === options.pitcherId ||
    projection.projectionId === options.pitcherId
  )
  const oddsRows = await oddsRowsForEvents(Array.from(new Set(projections.map((projection) => projection.eventId))))
  const storedPropRows = await allStoredPlayerPropRows()
  const comparisons = projections.flatMap((projection) => compareProjection(projection, oddsRows, selectedMarket.key)).slice(0, Math.min(Math.max(options.limit ?? 200, 1), 500))
  const validation = validatePlayerPropComparisonRows(comparisons)
  const health = healthFrom(comparisons, storedPropRows, validation)
  const marketSummary = MLB_PLAYER_PROP_MARKETS.map((market) => {
    const rows = storedPropRows.filter((row) => normalizeMarket(row.market) === market.key)
    const comparableRows = oddsRows.filter((row) => normalizeMarket(row.market) === market.key)
    return {
      marketKey: market.key,
      displayName: market.displayName,
      family: market.family,
      providerMarketKeys: market.providerMarketKeys,
      storedRows: rows.length,
      comparableRowsForProjectionEvents: comparableRows.length,
      availableBookmakers: Array.from(new Set(rows.map((row) => row.sportsbook))).sort(),
      projectionKeys: market.projectionKeys,
      status: rows.length ? 'MARKET_LINE_AVAILABLE' : 'NO_PROP_AVAILABLE',
    }
  })
  const markets: PitcherPropMarket[] = MLB_PLAYER_PROP_MARKETS.map((market) => ({
    marketKey: market.key,
    displayName: market.displayName,
    shortLabel: market.shortLabel,
    family: market.family,
    providerMarketKeys: market.providerMarketKeys,
    supportedLines: [...market.supportedLines],
    storedRows: marketSummary.find((row) => row.marketKey === market.key)?.storedRows ?? 0,
    availableBookmakers: marketSummary.find((row) => row.marketKey === market.key)?.availableBookmakers ?? [],
    providerOwnership: 'Stored sports_odds_snapshots player_props rows; no direct provider calls from comparison service.',
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }))
  const availableBookmakers = Array.from(new Set(storedPropRows.map((row) => row.sportsbook))).sort()
  return {
    success: validation.success,
    mode: MODE,
    generatedAt: slate.generatedAt,
    selectedDate: slate.selectedDate,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    readOnly: true,
    recommendationStatus: 'MODEL_MARKET_COMPARISON_ONLY',
    noBettingRecommendations: true,
    selectedMarket: selectedMarket.key,
    supportedMarkets: markets,
    markets,
    marketSummary,
    availableBookmakers,
    summary: {
      projectionsEvaluated: projections.length,
      marketRowsEvaluated: oddsRows.length,
      comparisonsGenerated: comparisons.length,
      sportsbooks: health.sportsbooks.length,
      noPropAvailable: health.noPropAvailable,
      modelFavorsOver: comparisons.filter((row) => row.bestStatus === 'MODEL_FAVORS_OVER').length,
      modelFavorsUnder: comparisons.filter((row) => row.bestStatus === 'MODEL_FAVORS_UNDER').length,
      marketAligned: comparisons.filter((row) => row.bestStatus === 'MARKET_ALIGNED').length,
    },
    coverage: {
      supportedMarket: MARKET_KEY,
      selectedMarket: selectedMarket.key,
      supportedMarkets: markets.map((market) => market.marketKey),
      currentStoredRows: storedPropRows.length,
      sportsbooks: health.sportsbooks,
      freshness: health.freshness,
      comparableRowsForProjectionEvents: oddsRows.length,
      currentStoredRowsByMarket: health.supportedRowsByMarket,
      historicalDepth: storedPropRows.length ? 'STORED_CURRENT_OR_HISTORICAL_PLAYER_PROP_ROWS_FOUND' : 'NO_STORED_PLAYER_PROP_MARKET_ROWS',
      providerOwnership: 'SportsDataIO or future licensed odds provider writes normalized rows to sports_odds_snapshots before comparison.',
    },
    identityCoverage: {
      projectionsWithCanonicalPitcherId: projections.filter((projection) => Boolean(projection.pitcherId)).length,
      projectionsWithProviderPitcherId: projections.filter((projection) => Boolean(projection.providerPitcherId)).length,
      unresolvedStoredPropRows: storedPropRows.filter((row) => !metadataPlayerId(row) && !metadataPitcherName(row)).length,
      deterministicOnly: true,
    },
    storageCoverage: {
      table: 'sports_odds_snapshots',
      rowCount: storedPropRows.length,
      rowCountByMarket: health.supportedRowsByMarket,
      bookmakerCount: availableBookmakers.length,
      bookmakers: availableBookmakers,
      duplicateDeterministicKeys: duplicateStoredRowCount(storedPropRows),
    },
    health,
    validation,
    deterministicFixtures: validatePlayerPropComparisonFixtures(),
    comparisons,
    warnings: [
      'fallbackWarning' in slate ? slate.fallbackWarning : null,
      storedPropRows.length === 0 ? 'No current sportsbook player prop market is stored. Returning NO_PROP_AVAILABLE comparisons only.' : null,
      storedPropRows.length > 0 && oddsRows.length === 0 ? 'Stored player prop rows exist, but no same-event projection is available for comparison yet.' : null,
      'Projection Only',
      'No betting recommendation',
      'No Kelly, stake, official pick or portfolio output.',
    ].filter(Boolean),
  }
}

export async function getMlbPlayerPropHealth(options: { date?: string | null; market?: string | null } = {}) {
  return (await getMlbPlayerPropComparisons({ date: options.date, market: options.market, limit: 500 })).health
}

export async function getMlbPlayerPropComparisonForPitcher(pitcherId: string, options: { date?: string | null; market?: string | null } = {}) {
  const result = await getMlbPlayerPropComparisons({ ...options, pitcherId, limit: 200 })
  return { ...result, comparisons: result.comparisons }
}

export async function generateMlbPlayerPropComparison(options: { date?: string | null; limit?: number; dryRun?: boolean; market?: string | null } = {}) {
  const result = await getMlbPlayerPropComparisons({ date: options.date, limit: options.limit, market: options.market })
  return {
    ...result,
    dryRun: options.dryRun !== false,
    rowsPersisted: 0,
    persistence: {
      dryRun: true,
      rowsPersisted: 0,
      rowsSkipped: result.comparisons.length,
      table: null,
      warning: 'MLB Player Prop Market Comparison V1 is read-only and does not persist comparison rows.',
    },
  }
}

export function validatePlayerPropComparisonRows(comparisons: PitcherPropComparison[]) {
  const failedChecks: string[] = []
  const seenBookLines = new Set<string>()
  for (const comparison of comparisons) {
    if (comparison.recommendationStatus !== 'MODEL_MARKET_COMPARISON_ONLY') failedChecks.push(`${comparison.pitcherName} recommendation status leakage`)
    if (comparison.line !== null && playerPropSupportedLine(comparison.marketKey, comparison.line) === null) failedChecks.push(`${comparison.pitcherName} unsupported line`)
    if (comparison.overLine && comparison.underLine && comparison.overLine.line !== comparison.underLine.line) failedChecks.push(`${comparison.pitcherName} over/under line mismatch`)
    if (comparison.overEdge?.modelProbability === 0 || comparison.underEdge?.modelProbability === 0) failedChecks.push(`${comparison.pitcherName} unavailable probability rendered as zero`)
    if (comparison.sportsbook && comparison.line !== null) {
      const key = `${comparison.projectionId}|${comparison.sportsbook}|${comparison.line}`
      if (seenBookLines.has(key)) failedChecks.push(`${comparison.pitcherName} duplicated sportsbook line`)
      seenBookLines.add(key)
    }
  }
  return { success: failedChecks.length === 0, failedChecks }
}
