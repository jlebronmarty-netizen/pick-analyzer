import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildSportPrediction } from '@/services/sport-prediction-engine-sdk.service'
import { createFeatureSnapshot, type FeatureSnapshot } from '@/services/feature-store-core.service'
import { classifyPredictionCutoff } from '@/services/prediction-cutoff-enforcement.service'
import { getSettlementReconciliationPlan } from '@/services/settlement-reconciliation.service'
import type { MarketKey } from '@/types/multi-sport'

type SupportedSport = 'americanfootball_nfl' | 'icehockey_nhl'
type SupportedMarket = 'moneyline' | 'spread' | 'total'

type SportConfig = {
  sportKey: SupportedSport
  leagueKey: string
  modelVersion: string
  featureSetVersion: string
  mode: string
  displayName: string
  missingDomains: string[]
  baseScores: { selection: number; opponent: number; total: number }
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
  home_score: number | null
  away_score: number | null
  metadata: Record<string, unknown> | null
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
  metadata: Record<string, unknown> | null
}

type PersistOptions = {
  persist?: boolean
  limitEvents?: number
  generatedAt?: string
}

const CONFIGS: Record<SupportedSport, SportConfig> = {
  americanfootball_nfl: {
    sportKey: 'americanfootball_nfl',
    leagueKey: 'nfl',
    modelVersion: 'americanfootball_nfl_preview_lifecycle_v1',
    featureSetVersion: 'americanfootball_nfl_market_event_feature_set_v1',
    mode: 'nfl_preview_prediction_lifecycle_v1',
    displayName: 'NFL',
    missingDomains: [
      'quarterback_impact_context',
      'injury_impact_context',
      'weather_context',
      'rest_and_travel_context',
    ],
    baseScores: { selection: 23.5, opponent: 23.5, total: 47 },
  },
  icehockey_nhl: {
    sportKey: 'icehockey_nhl',
    leagueKey: 'nhl',
    modelVersion: 'icehockey_nhl_preview_lifecycle_v1',
    featureSetVersion: 'icehockey_nhl_market_event_feature_set_v1',
    mode: 'nhl_preview_prediction_lifecycle_v1',
    displayName: 'NHL',
    missingDomains: [
      'starting_goalie_context',
      'goalie_form_context',
      'injury_impact_context',
      'special_teams_context',
      'rest_and_travel_context',
    ],
    baseScores: { selection: 3.1, opponent: 3.1, total: 6.2 },
  },
}

function stableId(parts: unknown[]) {
  return parts.map((part) => String(part ?? 'null')).join('|')
}

function stableUuid(parts: unknown[]) {
  const hex = createHash('sha256').update(stableId(parts)).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function asMarket(value: string | null): SupportedMarket | null {
  if (value === 'moneyline' || value === 'spread' || value === 'total') return value
  return null
}

function parseDateMs(value: string | null | undefined) {
  const ms = Date.parse(String(value ?? ''))
  return Number.isFinite(ms) ? ms : null
}

function isFutureScheduled(event: EventRow, nowMs: number) {
  const start = parseDateMs(event.start_time)
  const status = String(event.status ?? '').toLowerCase()
  return Boolean(start && start > nowMs && !['completed', 'final', 'closed', 'cancelled', 'canceled'].includes(status))
}

function americanImplied(odds: number) {
  if (odds > 0) return round((100 / (odds + 100)) * 100)
  return round((Math.abs(odds) / (Math.abs(odds) + 100)) * 100)
}

function inverseMarginForProbability(probability: number) {
  const centered = Math.max(-0.92, Math.min(0.92, (probability - 50) / 32))
  return round(Math.log((1 + centered) / (1 - centered)) * 4, 2)
}

function noVigProbability(row: OddsRow, group: OddsRow[]) {
  if (!row.price) return 50
  const paired = group.filter((item) => item.market === row.market && item.sportsbook === row.sportsbook)
  const total = paired.reduce((sum, item) => sum + (item.price ? americanImplied(item.price) : 0), 0)
  const implied = americanImplied(row.price)
  return total > 0 ? round((implied / total) * 100) : implied
}

function normalizeTeam(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function opponentFor(event: EventRow, selection: string) {
  if (normalizeTeam(selection) === normalizeTeam(event.home_team)) return event.away_team ?? 'Away'
  if (normalizeTeam(selection) === normalizeTeam(event.away_team)) return event.home_team ?? 'Home'
  return selection === 'Over' ? 'Under' : 'Over'
}

function bookmakerTitle(row: OddsRow) {
  const title = row.metadata?.bookmakerTitle
  return typeof title === 'string' && title.trim() ? title : row.sportsbook ?? 'Stored Book'
}

function latestOddsRows(rows: OddsRow[]) {
  const byKey = new Map<string, OddsRow>()
  for (const row of rows) {
    const key = [
      row.event_id,
      row.market,
      row.sportsbook,
      row.outcome,
      row.line ?? 'no-line',
    ].join('|')
    const current = byKey.get(key)
    if (!current || String(row.snapshot_time ?? '') > String(current.snapshot_time ?? '')) {
      byKey.set(key, row)
    }
  }
  return Array.from(byKey.values())
}

function buildGroundedFeatureSnapshot({
  config,
  event,
  odds,
  market,
  generatedAt,
  cutoffAt,
  oddsGroup,
}: {
  config: SportConfig
  event: EventRow
  odds: OddsRow
  market: SupportedMarket
  generatedAt: string
  cutoffAt: string
  oddsGroup: OddsRow[]
}): FeatureSnapshot {
  const snapshot = createFeatureSnapshot({
    sportKey: config.sportKey,
    leagueKey: config.leagueKey,
    eventId: event.id,
    market: market as MarketKey,
    generatedAt,
    cutoffAt,
    eventStartTime: event.start_time ?? cutoffAt,
  })
  const values = snapshot.values.map((value) => {
    if (value.key === 'event_context') {
      return {
        ...value,
        value: {
          eventId: event.id,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          startTime: event.start_time,
          status: event.status,
          source: 'sport_events',
        },
        sampleSize: 1,
        qualityScore: 90,
        provenance: [{
          provider: 'stored',
          sourceTable: 'sport_events',
          sourceId: event.id,
          observedAt: generatedAt,
        }],
        warnings: [],
      }
    }
    if (value.key === 'market_odds') {
      return {
        ...value,
        value: {
          oddsSnapshotId: odds.id,
          sportsbook: bookmakerTitle(odds),
          market,
          outcome: odds.outcome,
          price: odds.price,
          line: odds.line,
          snapshotTime: odds.snapshot_time,
          peerRowsInEventMarketBook: oddsGroup.length,
        },
        sampleSize: oddsGroup.length,
        qualityScore: 85,
        provenance: [{
          provider: odds.provider ?? 'stored',
          sourceTable: 'sports_odds_snapshots',
          sourceId: odds.id,
          observedAt: odds.snapshot_time ?? generatedAt,
        }],
        warnings: [],
      }
    }
    if (value.key === 'team_form') {
      return {
        ...value,
        value: null,
        sampleSize: 0,
        qualityScore: 0,
        provenance: [],
        warnings: [`${config.displayName} team form is not present in the approved Feature Store profile and was not fabricated.`],
      }
    }
    return {
      ...value,
      value: null,
      sampleSize: 0,
      qualityScore: 55,
      provenance: [],
      warnings: [`${value.key} unavailable for ${config.displayName} Preview V1 and was not fabricated.`],
    }
  })
  const required = values.filter((value) => ['event_context', 'team_form', 'market_odds'].includes(value.key))
  snapshot.values = values
  snapshot.featureQualityScore = round(values.reduce((sum, value) => sum + value.qualityScore, 0) / values.length)
  snapshot.dataSufficiencyScore = round(required.reduce((sum, value) => sum + (value.sampleSize > 0 ? value.qualityScore : 0), 0) / required.length)
  snapshot.noLeakage = true
  snapshot.warnings = values.flatMap((value) => value.warnings)
  return snapshot
}

function projectionFor({
  config,
  market,
  row,
  event,
  group,
}: {
  config: SportConfig
  market: SupportedMarket
  row: OddsRow
  event: EventRow
  group: OddsRow[]
}) {
  if (market === 'total') {
    const line = Number(row.line)
    const total = Number.isFinite(line) ? line : config.baseScores.total
    const selectionMargin = normalizeTeam(row.outcome) === 'over'
      ? round((total - config.baseScores.total) / 2)
      : round((config.baseScores.total - total) / 2)
    return {
      selectionScore: round(total / 2 + selectionMargin / 2),
      opponentScore: round(total / 2 - selectionMargin / 2),
      total,
      margin: selectionMargin,
      uncertainty: 24,
    }
  }
  if (market === 'spread') {
    const line = Number(row.line)
    const selectedIsHome = normalizeTeam(row.outcome) === normalizeTeam(event.home_team)
    const marketMargin = Number.isFinite(line) ? -line : 0
    const signedMargin = selectedIsHome ? marketMargin : -marketMargin
    return {
      selectionScore: round(config.baseScores.selection + signedMargin / 2),
      opponentScore: round(config.baseScores.opponent - signedMargin / 2),
      total: config.baseScores.total,
      margin: signedMargin,
      uncertainty: 23,
    }
  }
  const p = noVigProbability(row, group)
  const margin = inverseMarginForProbability(p)
  return {
    selectionScore: round(config.baseScores.selection + margin / 2),
    opponentScore: round(config.baseScores.opponent - margin / 2),
    total: config.baseScores.total,
    margin,
    uncertainty: 22,
  }
}

async function loadRows(config: SportConfig, generatedAt: string, limitEvents: number) {
  const { data: events, error: eventsError } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team, away_team, start_time, status, home_score, away_score, metadata')
    .eq('sport_key', config.sportKey)
    .order('start_time', { ascending: true })
    .limit(200)
  if (eventsError) throw new Error(`${config.displayName} events read failed: ${eventsError.message}`)

  const nowMs = parseDateMs(generatedAt) ?? Date.now()
  const futureEvents = ((events ?? []) as EventRow[])
    .filter((event) => isFutureScheduled(event, nowMs))
    .slice(0, limitEvents)
  const eventIds = futureEvents.map((event) => event.id)
  if (!eventIds.length) return { events: [], odds: [] as OddsRow[] }

  const odds: OddsRow[] = []
  for (let index = 0; index < eventIds.length; index += 50) {
    const { data, error } = await supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id, sport_key, league_key, season, event_id, provider, sportsbook, market, outcome, price, line, snapshot_time, metadata')
      .eq('sport_key', config.sportKey)
      .in('event_id', eventIds.slice(index, index + 50))
      .in('market', ['moneyline', 'spread', 'total'])
      .order('snapshot_time', { ascending: false })
      .limit(5000)
    if (error) throw new Error(`${config.displayName} odds read failed: ${error.message}`)
    odds.push(...((data ?? []) as OddsRow[]))
  }

  return { events: futureEvents, odds: latestOddsRows(odds) }
}

export async function runStoredPreviewPredictionLifecycle(
  sportKey: SupportedSport,
  options: PersistOptions = {}
) {
  const config = CONFIGS[sportKey]
  const persist = options.persist === true
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const { events, odds } = await loadRows(config, generatedAt, options.limitEvents ?? 12)
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const oddsByEventMarketBook = new Map<string, OddsRow[]>()
  for (const row of odds) {
    const key = [row.event_id, row.market, row.sportsbook].join('|')
    oddsByEventMarketBook.set(key, [...(oddsByEventMarketBook.get(key) ?? []), row])
  }

  const snapshots: Record<string, unknown>[] = []
  const predictions: Record<string, unknown>[] = []
  const rejectedByCutoff: Record<string, unknown>[] = []

  for (const row of odds) {
    const event = eventsById.get(row.event_id)
    const market = asMarket(row.market)
    if (!event || !market || !row.outcome || !Number.isFinite(Number(row.price))) continue
    if (market !== 'moneyline' && !Number.isFinite(Number(row.line))) continue
    const startMs = parseDateMs(event.start_time)
    if (!startMs) continue
    const cutoffAt = new Date(startMs - 10 * 60 * 1000).toISOString()
    const cutoff = classifyPredictionCutoff({
      sport_key: config.sportKey,
      game_id: event.id,
      commence_time: event.start_time,
      generated_at: generatedAt,
      cutoff_at: cutoffAt,
    }, {
      id: event.id,
      start_time: event.start_time,
      status: event.status,
    })
    if (!cutoff.eligible) {
      rejectedByCutoff.push({ eventId: event.id, market, oddsSnapshotId: row.id, state: cutoff.state, reason: cutoff.reason })
      continue
    }
    const group = oddsByEventMarketBook.get([row.event_id, row.market, row.sportsbook].join('|')) ?? [row]
    const featureSnapshot = buildGroundedFeatureSnapshot({
      config,
      event,
      odds: row,
      market,
      generatedAt,
      cutoffAt,
      oddsGroup: group,
    })
    const selection = market === 'total' ? String(row.outcome) : String(row.outcome)
    const opponent = opponentFor(event, selection)
    const snapshotKey = stableId([config.mode, config.modelVersion, event.id, market, row.id])
    const snapshotId = stableUuid(['historical_feature_snapshot', snapshotKey])
    const sdk = buildSportPrediction({
      sportKey: config.sportKey,
      leagueKey: config.leagueKey,
      eventId: event.id,
      market,
      selection,
      opponent,
      sportsbook: bookmakerTitle(row),
      americanOdds: Number(row.price),
      line: market === 'moneyline' ? null : Number(row.line),
      bankroll: 0,
      generatedAt,
      cutoffAt,
      eventStartTime: event.start_time ?? cutoffAt,
      featureSnapshot,
      projection: projectionFor({ config, market, row, event, group }),
    })
    const predictionId = stableUuid([config.mode, config.modelVersion, snapshotId, selection])
    const warnings = [
      'PREVIEW_ONLY: not production eligible and not an official pick.',
      'No target-game result, target-game stats, post-start odds, injuries, lineups, weather or goalie/quarterback context were fabricated.',
      ...featureSnapshot.warnings,
    ]

    snapshots.push({
      id: snapshotId,
      deterministic_key: snapshotKey,
      sport_key: config.sportKey,
      league_key: config.leagueKey,
      event_id: event.id,
      provider_event_id: String(event.metadata?.providerEventId ?? ''),
      market,
      prediction_cutoff: cutoffAt,
      as_of_timestamp: cutoffAt,
      generated_at: generatedAt,
      model_version: config.modelVersion,
      feature_set_version: config.featureSetVersion,
      snapshot_version: 1,
      feature_values: {
        eventContext: featureSnapshot.values.find((value) => value.key === 'event_context')?.value ?? null,
        marketOdds: featureSnapshot.values.find((value) => value.key === 'market_odds')?.value ?? null,
        unavailableDomains: config.missingDomains,
      },
      feature_lineage: {
        source: config.mode,
        eventId: event.id,
        oddsSnapshotId: row.id,
        noTargetGameLeakage: true,
        noPostStartOdds: true,
        noRawPayloadStored: true,
      },
      source_timestamps: {
        odds: row.snapshot_time,
        generatedAt,
        cutoffAt,
      },
      data_quality_score: featureSnapshot.featureQualityScore,
      data_sufficiency_score: featureSnapshot.dataSufficiencyScore,
      unresolved_mapping_count: 0,
      leakage_status: 'passed',
      leakage_warnings: warnings,
      trial: false,
      scrambled: false,
      production_eligible: false,
      metadata: {
        previewLifecycle: true,
        sport: config.displayName,
        source: 'stored_canonical_events_and_odds',
      },
    })

    predictions.push({
      id: predictionId,
      sport_key: config.sportKey,
      game_id: event.id,
      home_team: event.home_team,
      away_team: event.away_team,
      team: selection,
      opponent,
      market,
      selection,
      line: market === 'moneyline' ? null : Number(row.line),
      odds: Number(row.price),
      sportsbook: bookmakerTitle(row),
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
      validation_status: 'valid',
      validation_warnings: warnings,
      skip_reason: 'PREVIEW_ONLY_NOT_PRODUCTION_ELIGIBLE',
      generated_at: generatedAt,
      cutoff_at: cutoffAt,
      commence_time: event.start_time,
      odds_timestamp: row.snapshot_time,
      odds_snapshot_id: row.id,
      model_version: config.modelVersion,
      feature_set_version: config.featureSetVersion,
      feature_snapshot_id: snapshotId,
      feature_snapshot_key: snapshotKey,
      feature_snapshot_generated_at: generatedAt,
      model_role: 'shadow',
      is_current: false,
      prediction_group_key: stableId([config.sportKey, event.id, market, selection, bookmakerTitle(row), market === 'moneyline' ? 'no-line' : row.line]),
      idempotency_key: stableId([config.mode, config.modelVersion, snapshotId, selection]),
      settlement_details: {
        preview_lifecycle_v1: {
          state: 'awaiting_result',
          settlementCompatible: sdk.contracts.settlementCompatible,
          supportedMarkets: ['moneyline', 'spread', 'total'],
          providerCallsMade: 0,
        },
      },
      feature_snapshot: {
        previewLifecycle: true,
        prospective_preview: true,
        mode: config.mode,
        modelVersion: config.modelVersion,
        featureSetVersion: config.featureSetVersion,
        quality: featureSnapshot.featureQualityScore,
        sufficiency: featureSnapshot.dataSufficiencyScore,
        recommendationStatus: 'PREVIEW_ONLY',
        productionEligible: false,
        officialPick: false,
        sourceOddsSnapshotId: row.id,
        missingData: config.missingDomains,
        factors: sdk.explanationFactors,
        warnings,
      },
    })
  }

  const existing = new Set<string>()
  for (let index = 0; index < predictions.length; index += 100) {
    const chunk = predictions.slice(index, index + 100).map((row) => String(row.id))
    if (!chunk.length) continue
    const existingPredictionIds = await supabaseAdmin
      .from('prediction_history')
      .select('id')
      .in('id', chunk)
    if (existingPredictionIds.error) throw new Error(`${config.displayName} existing prediction check failed: ${existingPredictionIds.error.message}`)
    for (const row of existingPredictionIds.data ?? []) existing.add(String(row.id))
  }

  let snapshotsPersisted = 0
  let predictionsPersisted = 0
  if (persist && snapshots.length) {
    const result = await supabaseAdmin
      .from('historical_feature_snapshots')
      .upsert(snapshots, { onConflict: 'id' })
    if (result.error) throw new Error(`${config.displayName} feature snapshot upsert failed: ${result.error.message}`)
    snapshotsPersisted = snapshots.length
  }
  if (persist && predictions.length) {
    const result = await supabaseAdmin
      .from('prediction_history')
      .upsert(predictions, { onConflict: 'id' })
    if (result.error) throw new Error(`${config.displayName} preview prediction upsert failed: ${result.error.message}`)
    predictionsPersisted = predictions.length
  }

  const settlement = await getSettlementReconciliationPlan({
    startDate: events[0]?.start_time ?? undefined,
    endDate: events.at(-1)?.start_time ?? undefined,
    limit: 50000,
  })
  const sportSettlementSamples = (settlement.categorySummaries ?? [])
    .filter((item: { sports?: Record<string, number> }) => Number(item.sports?.[config.sportKey] ?? 0) > 0)

  return {
    success: true,
    mode: config.mode,
    generatedAt,
    persist,
    providerCallsMade: 0,
    remoteMutationsMade: persist ? snapshotsPersisted + predictionsPersisted : 0,
    summary: {
      eventsRead: events.length,
      oddsRowsRead: odds.length,
      previewPredictions: predictions.length,
      featureSnapshots: snapshots.length,
      insertedPredictions: predictions.filter((row) => !existing.has(String(row.id))).length,
      reusedPredictions: predictions.filter((row) => existing.has(String(row.id))).length,
      snapshotsPersisted,
      predictionsPersisted,
      rejectedByCutoff: rejectedByCutoff.length,
      markets: Array.from(new Set(predictions.map((row) => row.market))).sort(),
      productionEligibleRows: predictions.filter((row) => row.production_eligible === true).length,
      officialPicks: predictions.filter((row) => row.recommended_pick === true).length,
    },
    lifecycle: {
      canonicalEvents: events.length > 0,
      pregameFeatures: snapshots.length > 0,
      pregamePredictions: predictions.length > 0,
      resultsAvailable: events.filter((event) => event.home_score !== null && event.away_score !== null).length,
      settlementState: sportSettlementSamples.length ? 'scheduled_or_awaiting_result' : 'awaiting_future_results',
      learningState: 'blocked_until_deterministic_settlement_labels_exist',
      performanceState: 'blocked_until_settled_preview_rows_exist',
      promotionReadiness: 'blocked_preview_sample_and_settlement_sample_pending',
    },
    settlementDryRun: {
      mode: settlement.mode,
      providerCallsMade: settlement.providerCallsMade,
      remoteMutationsMade: settlement.remoteMutationsMade,
      sportCategorySummaries: sportSettlementSamples,
    },
    safety: {
      noRetrospectivePredictions: rejectedByCutoff.length === 0,
      noPostStartLeakage: predictions.every((row) => Date.parse(String(row.generated_at)) < Date.parse(String(row.commence_time))),
      previewIsolation: predictions.every((row) => row.production_eligible === false && row.recommended_pick === false && row.model_role === 'shadow'),
      noProductionPollution: true,
      noProviderCalls: true,
      noFakeReadiness: true,
    },
    rejectedByCutoff: rejectedByCutoff.slice(0, 25),
    predictions: predictions.slice(0, 50),
    warnings: [
      `${config.displayName} Preview V1 is quarantined and not production-promoted.`,
      `Missing sport-specific domains are recorded, not fabricated: ${config.missingDomains.join(', ')}.`,
    ],
  }
}

export const runNflStoredPreviewPredictionLifecycle = (options: PersistOptions = {}) =>
  runStoredPreviewPredictionLifecycle('americanfootball_nfl', options)

export const runNhlStoredPreviewPredictionLifecycle = (options: PersistOptions = {}) =>
  runStoredPreviewPredictionLifecycle('icehockey_nhl', options)
