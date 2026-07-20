import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getModelCalibration } from '@/services/model-calibration.service'
import { getNextSlateStatus } from '@/services/next-slate.service'
import { checkProviderBudget, claimProviderActionLock, releaseProviderActionLock } from '@/services/provider-budget.service'
import { runModelLearning } from '@/services/model-learning.service'
import { runSportsDataIoMlbProspectivePreview } from '@/services/sportsdataio-mlb-prospective-preview.service'
import { syncRecentResults } from '@/services/results-sync.service'
import { getCurrentBoard } from '@/services/current-board.service'
import { getBestValueOpportunities } from '@/services/best-value-scanner.service'
import { getMarketIntelligence } from '@/services/market-intelligence-engine.service'
import { getArbitrageOpportunities, getMostLikelyOpportunities } from '@/services/market-opportunity-suite.service'
import { getTopPicks } from '@/services/top-picks.service'
import { optimizeBetSlip } from '@/services/bet-slip-optimizer.service'
import { getDay1RecommendationReadiness } from '@/services/day1-recommendation-readiness.service'
import { assertSportEventStatusWrite, isSportEventCanonicalStatus, mapMlbStatsGameToSportEventStatus, validateSportEventStatusWriteTracingFixtures } from '@/services/mlb-event-status-mapper.service'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = 'America/Puerto_Rico'
const POLICY_VERSION = 'operating_day_lifecycle_v1'
const OPERATING_DAY_ALLOWED_STATUSES = [
  'planned',
  'morning_synced',
  'midday_refreshed',
  'final_refreshed',
  'locked',
  'games_in_progress',
  'results_pending',
  'results_synced',
  'settled',
  'replayed',
  'calibrated',
  'completed',
  'completed_with_warnings',
  'failed',
] as const

type OperatingDayPersistedStatus = (typeof OPERATING_DAY_ALLOWED_STATUSES)[number]

type OperatingDayAction =
  | 'status_refresh'
  | 'morning_sync'
  | 'midday_refresh'
  | 'final_refresh'
  | 'lock'
  | 'sync_results'
  | 'settle'
  | 'replay'
  | 'calibrate'
  | 'complete'
  | 'reconcile_preview'
  | 'resolve_next_slate'
  | 'next_slate_preview'
  | 'prepare_next_slate'
  | 'recommendation_lock'
  | 'postgame_rollover'
  | 'status'

type ExecuteRequest = {
  action: OperatingDayAction
  sportKey?: string | null
  leagueKey?: string | null
  selectedDate?: string | null
  date?: string | null
  dryRun?: boolean | null
  confirmed?: boolean | null
  forceRefresh?: boolean | null
  requestId?: string | null
  maximumRequests?: number | null
  timeoutMs?: number | null
  stages?: string[] | null
  searchDays?: number | null
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
  market: string | null
  sportsbook: string | null
  odds: number | null
  implied_probability: number | null
  model_probability: number | null
  confidence: number | null
  edge: number | null
  ev: number | null
  line: number | null
  odds_timestamp: string | null
  odds_snapshot_id?: string | null
  status: string | null
  result: string | null
  stake: number | null
  production_eligible: boolean | null
  recommended_pick: boolean | null
  official_pick_at_lock?: boolean | null
  feature_snapshot: Record<string, unknown> | null
  validation_warnings: unknown
  skip_reason: string | null
}

type GameResultRow = {
  id: string
  game_id: string
  sport_key: string | null
  commence_time: string | null
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
}

type SportEventRow = {
  id: string
  sport_key: string
  league_key: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type MlbStatsGame = {
  gamePk?: number | string
  gameDate?: string
  officialDate?: string
  status?: {
    abstractGameState?: string
    detailedState?: string
    codedGameState?: string
    statusCode?: string
  }
  teams?: {
    away?: { team?: { name?: string; abbreviation?: string }; score?: number }
    home?: { team?: { name?: string; abbreviation?: string }; score?: number }
  }
}

function nowIso() {
  return new Date().toISOString()
}

function selectedDate(input?: string | null) {
  return input && /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : new Date().toISOString().slice(0, 10)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function providerErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (lower.includes('quota') || lower.includes('usage limit') || lower.includes('429')) return 'quota_blocked'
  if (lower.includes('subscription') || lower.includes('entitlement') || lower.includes('403')) return 'subscription_blocked'
  if (lower.includes('not configured') || lower.includes('api_key')) return 'provider_not_configured'
  return 'provider_error'
}

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function operatingDayUtcRange(date: string, timezone = TIMEZONE) {
  if (timezone !== TIMEZONE) throw new Error(`Unsupported operating-day timezone: ${timezone}`)
  const range = zonedUtcRange(date, timezone)
  return { start: range.utcStart, end: range.utcEndExclusive, timezone }
}

function dateRange(date: string) {
  const { start, end } = operatingDayUtcRange(date)
  return { start, end }
}

function localDateFromUtc(value: string | null | undefined, timezone = TIMEZONE) {
  if (!value) return null
  if (timezone !== TIMEZONE) throw new Error(`Unsupported operating-day timezone: ${timezone}`)
  return localDateInTimeZone(value, timezone)
}

function canonicalEventStatus(value: string | null | undefined) {
  const status = normalize(value)
  if (['final', 'completed', 'closed', 'complete'].includes(status)) return 'final'
  if (['live', 'in_progress', 'inprogress', 'started'].includes(status)) return 'inProgress'
  if (['postponed', 'suspended', 'delayed'].includes(status)) return 'postponed'
  if (['cancelled', 'canceled'].includes(status)) return 'canceled'
  if (['scheduled', 'pending', 'planned', ''].includes(status)) return 'scheduled'
  return 'unresolved'
}

function canonicalMlbStatsStatus(game: MlbStatsGame) {
  return mapMlbStatsGameToSportEventStatus(game).status ?? 'scheduled'
}

function compactTeam(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function providerIdValues(event: SportEventRow) {
  const ids = asRecord(event.provider_ids)
  return new Set(Object.values(ids).map((value) => String(value ?? '')).filter(Boolean))
}

function gameTeamValues(game: MlbStatsGame) {
  return {
    home: [game.teams?.home?.team?.name, game.teams?.home?.team?.abbreviation].map(compactTeam).filter(Boolean),
    away: [game.teams?.away?.team?.name, game.teams?.away?.team?.abbreviation].map(compactTeam).filter(Boolean),
  }
}

function matchStatsGameToEvent(game: MlbStatsGame, events: SportEventRow[]) {
  const gamePk = String(game.gamePk ?? '')
  if (gamePk) {
    const byId = events.find((event) => providerIdValues(event).has(gamePk))
    if (byId) return byId
  }
  const gameDate = localDateFromUtc(game.gameDate) ?? game.officialDate ?? null
  const teams = gameTeamValues(game)
  return events.find((event) => {
    if (gameDate && localDateFromUtc(event.start_time) !== gameDate) return false
    const home = compactTeam(event.home_team)
    const away = compactTeam(event.away_team)
    return teams.home.includes(home) && teams.away.includes(away)
  }) ?? null
}

function emptyGameCounts() {
  return {
    total: 0,
    scheduled: 0,
    inProgress: 0,
    pendingOrInProgress: 0,
    final: 0,
    postponed: 0,
    canceled: 0,
    unresolved: 0,
    statusDefinitions: {
      scheduled: ['scheduled', 'pending', 'planned', 'empty'],
      inProgress: ['live', 'in_progress', 'inprogress', 'started'],
      final: ['final', 'completed', 'closed', 'complete'],
      postponed: ['postponed', 'suspended', 'delayed'],
      canceled: ['cancelled', 'canceled'],
      unresolved: ['any other provider status'],
    },
  }
}

function summarizeGameCounts(events: SportEventRow[]) {
  const counts = emptyGameCounts()
  const unique = new Map(events.map((event) => [event.id, event]))
  counts.total = unique.size
  for (const event of unique.values()) {
    const status = canonicalEventStatus(event.status)
    if (status === 'scheduled') counts.scheduled += 1
    else if (status === 'inProgress') counts.inProgress += 1
    else if (status === 'final') counts.final += 1
    else if (status === 'postponed') counts.postponed += 1
    else if (status === 'canceled') counts.canceled += 1
    else counts.unresolved += 1
  }
  counts.pendingOrInProgress = counts.scheduled + counts.inProgress
  return counts
}

function isProspectivePreviewRow(row: PredictionRow) {
  return asRecord(row.feature_snapshot).prospective_preview === true
}

function isOfficialPickRow(row: PredictionRow) {
  const snapshot = asRecord(row.feature_snapshot)
  return row.recommended_pick === true || row.production_eligible === true || officialRecommendationStatus(snapshot.recommendationStatus)
}

function statusForAction(action: OperatingDayAction) {
  return {
    status_refresh: 'planned',
    morning_sync: 'morning_synced',
    midday_refresh: 'midday_refreshed',
    final_refresh: 'final_refreshed',
    lock: 'locked',
    sync_results: 'results_synced',
    settle: 'settled',
    replay: 'replayed',
    calibrate: 'calibrated',
    complete: 'completed',
    reconcile_preview: 'planned',
    resolve_next_slate: 'planned',
    next_slate_preview: 'planned',
    prepare_next_slate: 'planned',
    recommendation_lock: 'locked',
    postgame_rollover: 'planned',
    status: 'planned',
  }[action]
}

function assertOperatingDayStatus(value: unknown): asserts value is OperatingDayPersistedStatus {
  if (!OPERATING_DAY_ALLOWED_STATUSES.includes(value as OperatingDayPersistedStatus)) {
    throw new Error(`Invalid operating_days.status value "${String(value)}"; stage/action values must be stored in metadata, not status.`)
  }
}

function timestampColumnForAction(action: OperatingDayAction) {
  return {
    status_refresh: null,
    morning_sync: 'morning_sync_at',
    midday_refresh: 'midday_refresh_at',
    final_refresh: 'final_refresh_at',
    lock: 'recommendations_locked_at',
    sync_results: 'results_synced_at',
    settle: 'settlement_completed_at',
    replay: 'replay_completed_at',
    calibrate: 'calibration_completed_at',
    complete: 'report_generated_at',
    reconcile_preview: null,
    resolve_next_slate: null,
    next_slate_preview: null,
    prepare_next_slate: null,
    recommendation_lock: 'recommendations_locked_at',
    postgame_rollover: null,
    status: null,
  }[action]
}

function officialRecommendationStatus(value: unknown) {
  return ['QUALIFIED', 'BEST_BET_CANDIDATE', 'PLAY_OF_DAY_CANDIDATE'].includes(String(value ?? ''))
}

function profitFor(odds: number, stake: number, result: 'win' | 'loss' | 'push') {
  if (result === 'loss') return -stake
  if (result === 'push') return 0
  return odds < 0 ? stake * (100 / Math.abs(odds)) : stake * (odds / 100)
}

function resultWinner(result: GameResultRow) {
  if (result.home_score === null || result.away_score === null || result.home_score === result.away_score) return null
  return result.home_score > result.away_score ? result.home_team : result.away_team
}

function gradePrediction(prediction: PredictionRow, result: GameResultRow): 'win' | 'loss' | 'push' | null {
  if (result.home_score === null || result.away_score === null) return null
  const market = String(prediction.market ?? '')
  const selection = normalize(prediction.team)
  const line = Number(prediction.line ?? 0)
  if (market === 'moneyline') {
    const winner = resultWinner(result)
    if (!winner) return 'push'
    return selection === normalize(winner) ? 'win' : 'loss'
  }
  if (market === 'spread') {
    const selectedHome = selection === normalize(result.home_team)
    const selectedScore = selectedHome ? result.home_score : result.away_score
    const otherScore = selectedHome ? result.away_score : result.home_score
    const margin = selectedScore + line - otherScore
    if (margin === 0) return 'push'
    return margin > 0 ? 'win' : 'loss'
  }
  if (market === 'total') {
    const total = result.home_score + result.away_score
    if (total === line) return 'push'
    if (selection.includes('over')) return total > line ? 'win' : 'loss'
    if (selection.includes('under')) return total < line ? 'win' : 'loss'
  }
  return null
}

async function getOrCreateOperatingDay(sportKey: string, leagueKey: string, date: string, dryRun = false) {
  const existing = await supabaseAdmin
    .from('operating_days')
    .select('*')
    .eq('sport_key', sportKey)
    .eq('league_key', leagueKey)
    .eq('local_date', date)
    .maybeSingle()
  if (existing.error) throw new Error(`Operating day read failed: ${existing.error.message}`)
  if (existing.data || dryRun) return existing.data

  const inserted = await supabaseAdmin
    .from('operating_days')
    .insert({
      sport_key: sportKey,
      league_key: leagueKey,
      local_date: date,
      timezone: TIMEZONE,
      status: 'planned',
      metadata: { version: POLICY_VERSION },
    })
    .select('*')
    .single()
  if (inserted.error) throw new Error(`Operating day create failed: ${inserted.error.message}`)
  return inserted.data
}

async function loadEventsForDay(sportKey: string, leagueKey: string, date: string) {
  const range = dateRange(date)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team, provider_ids, metadata')
    .eq('sport_key', sportKey)
    .eq('league_key', leagueKey)
    .gte('start_time', range.start)
    .lt('start_time', range.end)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`Operating day events read failed: ${error.message}`)
  return (data ?? []) as SportEventRow[]
}

async function loadLinkedEventIds(operatingDayId: string) {
  const { data, error } = await supabaseAdmin
    .from('operating_day_events')
    .select('event_id')
    .eq('operating_day_id', operatingDayId)
  if (error) throw new Error(`Operating day linked events read failed: ${error.message}`)
  return Array.from(new Set((data ?? []).map((row) => String(row.event_id)).filter(Boolean)))
}

async function loadStatusEvents({
  operatingDayId,
  sportKey,
  leagueKey,
  date,
}: {
  operatingDayId: string | null
  sportKey: string
  leagueKey: string
  date: string
}) {
  const range = operatingDayUtcRange(date)
  const linkedEventIds = operatingDayId ? await loadLinkedEventIds(operatingDayId) : []

  let query = supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team, provider_ids, metadata')
    .eq('sport_key', sportKey)
    .gte('start_time', range.start)
    .lt('start_time', range.end)
    .order('start_time', { ascending: true })

  if (leagueKey) query = query.eq('league_key', leagueKey)
  if (linkedEventIds.length) query = query.in('id', linkedEventIds)

  const { data, error } = await query
  if (error) throw new Error(`Operating day status event read failed: ${error.message}`)

  const events = ((data ?? []) as SportEventRow[]).filter((event) => localDateFromUtc(event.start_time) === date)
  return { events, linkedEventIds, range }
}

async function linkEvents(operatingDayId: string, sportKey: string, leagueKey: string, date: string) {
  const events = await loadEventsForDay(sportKey, leagueKey, date)
  const rows = events.map((event) => {
    const providerIds = asRecord(event.provider_ids)
    return {
      operating_day_id: operatingDayId,
      event_id: event.id,
      provider_event_id: String(providerIds.sportsdataio ?? providerIds.sportsdataio_game_id ?? ''),
      status: event.status ?? 'planned',
      metadata: { prospective_preview: asRecord(event.metadata).prospective_preview === true },
    }
  })
  if (rows.length) {
    const { error } = await supabaseAdmin.from('operating_day_events').upsert(rows, {
      onConflict: 'operating_day_id,event_id',
    })
    if (error) throw new Error(`Operating day event link failed: ${error.message}`)
  }
  return rows.length
}

async function refreshMlbGameStatuses({
  operatingDayId,
  sportKey,
  leagueKey,
  date,
  timeoutMs,
}: {
  operatingDayId: string
  sportKey: string
  leagueKey: string
  date: string
  timeoutMs?: number | null
}) {
  const provider = 'mlb_stats_api'
  const endpoint = `/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,team,venue`
  const started = nowIso()
  const budget = await checkProviderBudget({
    provider,
    sportKey,
    action: 'status_refresh',
    requestedCalls: 1,
    dryRun: false,
  })
  if (!budget.allowed) {
    return {
      success: false,
      status: 'budget_blocked',
      provider,
      endpoint,
      providerCheckRequired: true,
      providerCheckAttempted: false,
      providerCheckCompleted: false,
      providerCallsMade: 0,
      rowsReceived: 0,
      statusesChanged: 0,
      latestSourceTimestamp: null,
      lastProviderCheckAt: null,
      lastStatusChangeAt: null,
      failureReason: budget.blockedReason,
      providerBudget: budget.status,
    }
  }
  const lockKey = `${provider}:${sportKey}:${leagueKey}:${date}:status_refresh`
  if (!claimProviderActionLock(lockKey)) {
    return {
      success: false,
      status: 'refresh_already_in_progress',
      provider,
      endpoint,
      providerCheckRequired: true,
      providerCheckAttempted: false,
      providerCheckCompleted: false,
      providerCallsMade: 0,
      rowsReceived: 0,
      statusesChanged: 0,
      latestSourceTimestamp: null,
      lastProviderCheckAt: null,
      lastStatusChangeAt: null,
      failureReason: 'A matching MLB Stats API status refresh is already running.',
      providerBudget: budget.status,
    }
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.max(2000, Number(timeoutMs ?? 12000)))
    const response = await fetch(`https://statsapi.mlb.com${endpoint}`, { cache: 'no-store', signal: controller.signal })
    clearTimeout(timeout)
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok) {
      return {
        success: false,
        status: response.status === 429 ? 'quota_blocked' : 'provider_error',
        provider,
        endpoint,
        providerCheckRequired: true,
        providerCheckAttempted: true,
        providerCheckCompleted: false,
        providerCallsMade: 1,
        rowsReceived: 0,
        statusesChanged: 0,
        latestSourceTimestamp: null,
        lastProviderCheckAt: started,
        lastStatusChangeAt: null,
        failureReason: `MLB Stats API returned HTTP ${response.status}.`,
        providerBudget: budget.status,
      }
    }
    const games = (Array.isArray(payload?.dates)
      ? (payload?.dates as Array<Record<string, unknown>>).flatMap((day) => Array.isArray(day.games) ? day.games : [])
      : []) as MlbStatsGame[]
    const events = await loadEventsForDay(sportKey, leagueKey, date)
    let statusesChanged = 0
    let rowsUpdated = 0
    let rowsSkipped = 0
    let validRowsEvaluated = 0
    let mappingFailures = 0
    let updateFailures = 0
    let lastStatusChangeAt: string | null = null
    let latestSourceTimestamp: string | null = null
    const rowFailures: Array<{ gamePk: string | number | null; eventId: string | null; reason: string }> = []
    for (const game of games) {
      if (game.gameDate && (!latestSourceTimestamp || game.gameDate > latestSourceTimestamp)) latestSourceTimestamp = game.gameDate
      const event = matchStatsGameToEvent(game, events)
      if (!event) {
        rowsSkipped += 1
        continue
      }
      const mapping = mapMlbStatsGameToSportEventStatus(game)
      if (!mapping.ok || !mapping.status || !isSportEventCanonicalStatus(mapping.status)) {
        rowsSkipped += 1
        mappingFailures += 1
        rowFailures.push({ gamePk: game.gamePk ?? null, eventId: event.id, reason: mapping.reason })
        continue
      }
      validRowsEvaluated += 1
      const nextStatus = mapping.status
      const metadata = asRecord(event.metadata)
      const previousStatusEvidence = asRecord(metadata.mlbStatsStatus)
      const previousFetchedAt = String(previousStatusEvidence.fetchedAt ?? '')
      if (previousFetchedAt && previousFetchedAt > started) {
        rowsSkipped += 1
        continue
      }
      const patch = {
        status: assertSportEventStatusWrite({
          provider,
          functionName: 'refreshMlbGameStatuses',
          file: 'src/services/operating-day.service.ts',
          line: 636,
          eventId: event.id,
          providerEventId: game.gamePk ?? null,
          rawProviderStatus: mapping.rawStatus,
          mappedStatus: nextStatus,
          dbStatus: nextStatus,
        }),
        home_score: Number.isFinite(Number(game.teams?.home?.score)) ? Number(game.teams?.home?.score) : null,
        away_score: Number.isFinite(Number(game.teams?.away?.score)) ? Number(game.teams?.away?.score) : null,
        updated_at: started,
        provider_ids: {
          ...asRecord(event.provider_ids),
          mlb_stats_api: game.gamePk ?? null,
          mlb_stats_game_pk: game.gamePk ?? null,
        },
        metadata: {
          ...metadata,
          mlbStatsStatus: {
            provider,
            endpoint,
            gamePk: game.gamePk ?? null,
            detailedState: game.status?.detailedState ?? null,
            abstractGameState: game.status?.abstractGameState ?? null,
            codedGameState: game.status?.codedGameState ?? null,
            statusCode: game.status?.statusCode ?? null,
            mappedSportEventStatus: nextStatus,
            mappedLifecycle: mapping.lifecycle,
            mappingReason: mapping.reason,
            latestSourceTimestamp: game.gameDate ?? null,
            fetchedAt: started,
          },
          providerStatus: mapping.rawStatus,
          providerStatusMapped: nextStatus,
        },
      }
      const changed = normalize(event.status) !== normalize(nextStatus)
      const { error } = await supabaseAdmin.from('sport_events').update(patch).eq('id', event.id)
      if (error) {
        rowsSkipped += 1
        updateFailures += 1
        rowFailures.push({ gamePk: game.gamePk ?? null, eventId: event.id, reason: `MLB Stats API status update failed: ${error.message}` })
        continue
      }
      rowsUpdated += 1
      if (changed) {
        statusesChanged += 1
        lastStatusChangeAt = started
      }
    }
    return {
      success: true,
      status: updateFailures || mappingFailures ? 'PARTIAL_MAPPING_FAILURE' : statusesChanged > 0 ? 'SUCCESS_CHANGED' : 'SUCCESS_NO_CHANGE',
      provider,
      endpoint,
      providerCheckRequired: true,
      providerCheckAttempted: true,
      providerCheckCompleted: true,
      providerCallsMade: 1,
      rowsReceived: games.length,
      statusesChanged,
      rowsUpdated,
      rowsSkipped,
      validRowsEvaluated,
      mappingFailures,
      updateFailures,
      rowFailures: rowFailures.slice(0, 25),
      latestSourceTimestamp,
      lastProviderCheckAt: started,
      lastStatusChangeAt,
      failureReason: updateFailures || mappingFailures ? 'One or more provider rows could not be safely mapped or updated; valid rows were still processed.' : null,
      providerBudget: budget.status,
      operatingDayId,
    }
  } catch (error) {
    return {
      success: false,
      status: error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_error',
      provider,
      endpoint,
      providerCheckRequired: true,
      providerCheckAttempted: true,
      providerCheckCompleted: false,
      providerCallsMade: 1,
      rowsReceived: 0,
      statusesChanged: 0,
      latestSourceTimestamp: null,
      lastProviderCheckAt: started,
      lastStatusChangeAt: null,
      failureReason: error instanceof Error ? error.message : String(error),
      providerBudget: budget.status,
      operatingDayId,
    }
  } finally {
    releaseProviderActionLock(lockKey)
  }
}

async function writeLifecycleEvent(input: {
  operatingDayId: string
  requestId?: string | null
  action: string
  status: string
  startedAt: string
  providerCallsPlanned?: number
  providerCallsMade?: number
  databaseWrites?: number
  reusedRecords?: number
  warnings?: string[]
  blockingReason?: string | null
  metadata?: Record<string, unknown>
}) {
  const completedAt = nowIso()
  const { error } = await supabaseAdmin.from('operating_day_lifecycle_events').insert({
    operating_day_id: input.operatingDayId,
    request_id: input.requestId ?? null,
    action: input.action,
    status: input.status,
    started_at: input.startedAt,
    completed_at: completedAt,
    duration_ms: new Date(completedAt).getTime() - new Date(input.startedAt).getTime(),
    provider_calls_planned: input.providerCallsPlanned ?? 0,
    provider_calls_made: input.providerCallsMade ?? 0,
    database_writes: input.databaseWrites ?? 0,
    reused_records: input.reusedRecords ?? 0,
    warnings: input.warnings ?? [],
    blocking_reason: input.blockingReason ?? null,
    metadata: input.metadata ?? {},
  })
  if (error) throw new Error(`Operating day audit write failed: ${error.message}`)
}

async function updateOperatingDay(operatingDayId: string, action: OperatingDayAction, patch: Record<string, unknown> = {}) {
  const timestampColumn = timestampColumnForAction(action)
  const current = await supabaseAdmin
    .from('operating_days')
    .select('metadata')
    .eq('id', operatingDayId)
    .maybeSingle()
  if (current.error) throw new Error(`Operating day metadata read failed: ${current.error.message}`)
  const nextStatus = patch.status ?? statusForAction(action)
  assertOperatingDayStatus(nextStatus)
  const existingMetadata = asRecord(current.data?.metadata)
  const patchMetadata = asRecord(patch.metadata)
  const update: Record<string, unknown> = {
    status: nextStatus,
    updated_at: nowIso(),
    ...patch,
    metadata: {
      ...existingMetadata,
      ...patchMetadata,
      currentStage: action,
      lastAction: action,
      lastActionAt: nowIso(),
      statusContract: {
        allowedValues: OPERATING_DAY_ALLOWED_STATUSES,
        stageStoredIn: 'metadata.currentStage',
      },
    },
  }
  if (timestampColumn) update[timestampColumn] = nowIso()
  const { error } = await supabaseAdmin.from('operating_days').update(update).eq('id', operatingDayId)
  if (error) throw new Error(`Operating day update failed: ${error.message}`)
}

async function refreshIntelligenceSurfaceSummary(sportKey: string) {
  const [board, mostLikely, bestValue, marketIntelligence, arbitrage, topPicks, betSlip, readiness] = await Promise.all([
    getCurrentBoard({ sportKey, mode: 'CURRENT', limit: 100 }),
    getMostLikelyOpportunities({ sort: 'highest_probability', limit: 100 }),
    getBestValueOpportunities({ includePasses: false, limit: 100 }),
    getMarketIntelligence({ filters: { sport: sportKey } }),
    getArbitrageOpportunities(),
    getTopPicks(sportKey),
    optimizeBetSlip({}),
    getDay1RecommendationReadiness(),
  ])
  return {
    generatedAt: nowIso(),
    sourceOfTruth: 'Current Board',
    currentBoard: {
      candidates: board.candidates.length,
      officialPickCount: board.officialPickCount,
      previewCount: board.previewCount,
      latestOddsTimestamp: board.latestOddsTimestamp,
      dataFreshness: board.dataFreshness,
      warningCount: board.boardHealth.warnings.length,
    },
    mostLikely: {
      candidates: asRecord(mostLikely.summary).candidatesReturned ?? 0,
      warning: asRecord(mostLikely.summary).warning ?? null,
    },
    bestValue: {
      candidates: asRecord(bestValue.summary).candidatesReturned ?? 0,
      positiveValueCandidates: asRecord(bestValue.summary).positiveValueCandidates ?? 0,
    },
    marketIntelligence: {
      opportunities: Array.isArray(asRecord(marketIntelligence).opportunities) ? (asRecord(marketIntelligence).opportunities as unknown[]).length : 0,
      marketHealth: asRecord(asRecord(marketIntelligence).summary).marketHealth ?? null,
    },
    aiBetFinder: {
      source: 'deterministic_current_board',
      refreshedBySharedCandidateData: true,
    },
    topPicks: {
      picks: Array.isArray(asRecord(topPicks).picks) ? (asRecord(topPicks).picks as unknown[]).length : 0,
      officialOnly: true,
    },
    betSlip: {
      status: asRecord(betSlip).status ?? asRecord(asRecord(betSlip).summary).status ?? null,
      legs: Array.isArray(asRecord(betSlip).legs) ? (asRecord(betSlip).legs as unknown[]).length : 0,
    },
    recommendationReadiness: {
      officialPicks: asRecord(asRecord(readiness).summary).officialPicks ?? 0,
      providerCallsMade: asRecord(readiness).providerCallsMade ?? 0,
    },
    arbitrage: {
      status: asRecord(asRecord(arbitrage).summary).status ?? null,
      guaranteedCount: asRecord(asRecord(arbitrage).summary).guaranteedCount ?? 0,
      warning: asRecord(asRecord(arbitrage).summary).warning ?? null,
    },
    providerCallsMade: 0,
  }
}

async function loadPredictionsForDay(operatingDayId: string, sportKey: string, date: string) {
  const range = dateRange(date)
  const byOperatingDay = await supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, confidence, edge, ev, line, odds_timestamp, odds_snapshot_id, status, result, stake, production_eligible, recommended_pick, official_pick_at_lock, feature_snapshot, validation_warnings, skip_reason')
    .eq('operating_day_id', operatingDayId)
    .order('odds_timestamp', { ascending: false })
  if (byOperatingDay.error) throw new Error(`Operating day prediction read failed: ${byOperatingDay.error.message}`)
  if ((byOperatingDay.data ?? []).length) return (byOperatingDay.data ?? []) as PredictionRow[]

  const byDate = await supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, confidence, edge, ev, line, odds_timestamp, odds_snapshot_id, status, result, stake, production_eligible, recommended_pick, official_pick_at_lock, feature_snapshot, validation_warnings, skip_reason')
    .eq('sport_key', sportKey)
    .gte('commence_time', range.start)
    .lt('commence_time', range.end)
    .order('odds_timestamp', { ascending: false })
  if (byDate.error) throw new Error(`Operating day dated prediction read failed: ${byDate.error.message}`)
  return (byDate.data ?? []) as PredictionRow[]
}

async function loadProspectivePredictionsForDate(sportKey: string, date: string) {
  const range = dateRange(date)
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, confidence, edge, ev, line, odds_timestamp, odds_snapshot_id, status, result, stake, production_eligible, recommended_pick, official_pick_at_lock, feature_snapshot, validation_warnings, skip_reason')
    .eq('sport_key', sportKey)
    .gte('commence_time', range.start)
    .lt('commence_time', range.end)
    .order('odds_timestamp', { ascending: false })
  if (error) throw new Error(`Prospective prediction reconciliation read failed: ${error.message}`)
  return ((data ?? []) as PredictionRow[]).filter((row) => localDateFromUtc(row.commence_time) === date && isProspectivePreviewRow(row))
}

async function lockRecommendations(operatingDayId: string, sportKey: string, date: string, dryRun: boolean) {
  const predictions = await loadPredictionsForDay(operatingDayId, sportKey, date)
  const rows = predictions.map((prediction) => {
    const snapshot = asRecord(prediction.feature_snapshot)
    const officialPick = prediction.production_eligible === true && officialRecommendationStatus(snapshot.recommendationStatus)
    return {
      operating_day_id: operatingDayId,
      prediction_id: prediction.id,
      event_id: prediction.game_id,
      market: String(prediction.market ?? ''),
      selection: String(prediction.team ?? ''),
      sportsbook: prediction.sportsbook,
      odds_snapshot_id: prediction.odds_snapshot_id ?? String(snapshot.sourceOddsSnapshotId ?? ''),
      model_probability: prediction.model_probability,
      book_probability: prediction.implied_probability,
      edge: prediction.edge,
      ev: prediction.ev,
      confidence: prediction.confidence,
      line: prediction.line,
      odds: prediction.odds,
      readiness_state: String(snapshot.recommendationStatus ?? 'ANALYZED_ONLY'),
      eligibility_status: officialPick ? 'official_eligible' : 'rejected_or_preview_only',
      official_pick: officialPick,
      rejection_reasons: asStringArray(prediction.validation_warnings).concat(
        String(prediction.skip_reason ?? '').split(',').filter(Boolean)
      ),
      model_version: String(snapshot.modelVersion ?? 'baseball_mlb_prospective_preview_v1'),
      policy_version: POLICY_VERSION,
      metadata: {
        noBetDecision: !officialPick,
        featureSnapshot: snapshot,
        lockedFrom: 'prediction_history',
      },
    }
  })

  if (!dryRun && rows.length) {
    const { error } = await supabaseAdmin.from('operating_day_recommendation_locks').upsert(rows, {
      onConflict: 'operating_day_id,event_id,market,selection,sportsbook,odds_snapshot_id',
    })
    if (error) throw new Error(`Recommendation lock write failed: ${error.message}`)
    const { error: updateError } = await supabaseAdmin
      .from('prediction_history')
      .update({
        operating_day_id: operatingDayId,
        recommendation_locked_at: nowIso(),
        recommendation_lock_status: 'locked',
        official_pick_at_lock: false,
      })
      .in('id', predictions.map((prediction) => prediction.id))
    if (updateError) throw new Error(`Prediction lock marker update failed: ${updateError.message}`)
  }

  const officialPicks = rows.filter((row) => row.official_pick).length
  return {
    evaluatedCandidates: rows.length,
    officialPicks,
    noBet: officialPicks === 0,
    locksWritten: dryRun ? 0 : rows.length,
    providerCallsMade: 0,
  }
}

async function loadResultsForPredictions(predictions: PredictionRow[]) {
  const eventIds = Array.from(new Set(predictions.map((prediction) => prediction.game_id).filter(Boolean)))
  if (!eventIds.length) return []
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('id, game_id, sport_key, commence_time, home_team, away_team, home_score, away_score')
    .in('game_id', eventIds)
  if (error) throw new Error(`Operating day result read failed: ${error.message}`)
  return (data ?? []) as GameResultRow[]
}

export async function settleOperatingDay(input: {
  operatingDayId: string
  sportKey?: string | null
  selectedDate?: string | null
  dryRun?: boolean | null
  officialOnly?: boolean | null
  prospectiveOnly?: boolean | null
}) {
  const sportKey = input.sportKey ?? SPORT_KEY
  const date = selectedDate(input.selectedDate)
  let predictions = await loadPredictionsForDay(input.operatingDayId, sportKey, date)
  if (input.officialOnly === true) predictions = predictions.filter((row) => row.recommended_pick === true || row.official_pick_at_lock === true)
  if (input.prospectiveOnly !== false) predictions = predictions.filter((row) => asRecord(row.feature_snapshot).prospective_preview === true)
  const results = await loadResultsForPredictions(predictions)
  const resultByGame = new Map(results.map((result) => [result.game_id, result]))
  const summary = {
    checked: predictions.length,
    eligible: 0,
    settled: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    skipped: 0,
    unresolved: 0,
    alreadySettled: 0,
    officialSettled: 0,
    hypotheticalSettled: 0,
    events: Array.from(new Set(predictions.map((row) => row.game_id))).length,
    warnings: [] as string[],
  }
  const updates: Array<{ id: string; status: string; profit: number; resultId: string; official: boolean }> = []
  for (const prediction of predictions) {
    if (['win', 'loss', 'push'].includes(String(prediction.status))) {
      summary.alreadySettled += 1
      continue
    }
    const result = resultByGame.get(prediction.game_id)
    if (!result) {
      summary.unresolved += 1
      continue
    }
    const grade = gradePrediction(prediction, result)
    if (!grade || prediction.odds === null) {
      summary.skipped += 1
      continue
    }
    summary.eligible += 1
    const stake = Number(prediction.stake ?? 100) || 100
    const official = prediction.recommended_pick === true || asRecord(prediction.feature_snapshot).officialPickAtLock === true
    updates.push({
      id: prediction.id,
      status: grade,
      profit: Number(profitFor(Number(prediction.odds), stake, grade).toFixed(2)),
      resultId: result.id,
      official,
    })
  }

  if (!input.dryRun) {
    for (const update of updates) {
      const { error } = await supabaseAdmin
        .from('prediction_history')
        .update({
          status: update.status,
          result: update.status,
          profit: update.profit,
          settled_at: nowIso(),
          result_id: update.resultId,
          settlement_market: 'operating_day_scoped',
          settlement_source: 'operating_day_lifecycle_v1',
          settlement_version: POLICY_VERSION,
          settlement_details: {
            operatingDayId: input.operatingDayId,
            officialPerformance: update.official,
            hypotheticalPerformance: !update.official,
          },
        })
        .eq('id', update.id)
      if (error) throw new Error(`Operating day settlement update failed: ${error.message}`)
    }
  }

  summary.settled = updates.length
  summary.wins = updates.filter((row) => row.status === 'win').length
  summary.losses = updates.filter((row) => row.status === 'loss').length
  summary.pushes = updates.filter((row) => row.status === 'push').length
  summary.officialSettled = updates.filter((row) => row.official).length
  summary.hypotheticalSettled = updates.filter((row) => !row.official).length
  if (summary.unresolved) summary.warnings.push('Some operating-day predictions do not have authoritative final results and were not settled.')
  return summary
}

async function replayReport(operatingDayId: string, sportKey: string, date: string, dryRun: boolean) {
  const predictions = await loadPredictionsForDay(operatingDayId, sportKey, date)
  const results = await loadResultsForPredictions(predictions)
  const resultByGame = new Map(results.map((result) => [result.game_id, result]))
  const candidates = predictions.map((prediction) => {
    const result = resultByGame.get(prediction.game_id) ?? null
    const grade = result ? gradePrediction(prediction, result) : null
    const stake = Number(prediction.stake ?? 100) || 100
    const official = prediction.recommended_pick === true || prediction.production_eligible === true
    return {
      candidateMarket: prediction.market,
      selection: prediction.team,
      lockedProbability: prediction.model_probability,
      lockedPrice: prediction.odds,
      lockedLine: prediction.line,
      edge: prediction.edge,
      ev: prediction.ev,
      eligibilityStatus: official ? 'official' : 'rejected_or_preview_only',
      officialPick: official,
      finalResult: result ? `${result.away_team} ${result.away_score}, ${result.home_team} ${result.home_score}` : null,
      hypotheticalOutcome: grade,
      hypotheticalProfit: grade && prediction.odds !== null ? Number(profitFor(Number(prediction.odds), stake, grade).toFixed(2)) : null,
      rejectionReason: prediction.skip_reason,
      avoidingBetAlignedWithPolicy: !official && Number(prediction.edge ?? 0) <= 0 && Number(prediction.ev ?? 0) <= 0,
    }
  })
  const summary = {
    officialPicks: candidates.filter((row) => row.officialPick).length,
    hypotheticalCandidates: candidates.filter((row) => !row.officialPick).length,
    candidates,
    decisionQualityNote: 'Outcome quality is reported separately from decision quality; rejected winners do not retroactively become official picks.',
  }
  if (!dryRun) {
    const { error } = await supabaseAdmin.from('operating_day_reports').upsert({
      operating_day_id: operatingDayId,
      report_type: 'replay',
      summary,
      metadata: { providerCallsMade: 0, policyVersion: POLICY_VERSION },
    }, { onConflict: 'operating_day_id,report_type' })
    if (error) throw new Error(`Replay report write failed: ${error.message}`)
  }
  return summary
}

async function reconcilePreview(input: {
  sportKey: string
  leagueKey: string
  date: string
  dryRun: boolean
}) {
  const day = await getOrCreateOperatingDay(input.sportKey, input.leagueKey, input.date, true)
  const statusEvents = await loadStatusEvents({
    operatingDayId: day?.id ?? null,
    sportKey: input.sportKey,
    leagueKey: input.leagueKey,
    date: input.date,
  })
  const predictions = await loadProspectivePredictionsForDate(input.sportKey, input.date)
  const predictionEventIds = new Set(predictions.map((row) => row.game_id))
  const prospectiveEvents = statusEvents.events.filter((event) => {
    const metadata = asRecord(event.metadata)
    return metadata.prospective_preview === true || predictionEventIds.has(event.id)
  })
  const targetEvents = prospectiveEvents.filter((event) => {
    const away = normalize(event.away_team)
    const home = normalize(event.home_team)
    return (
      (away === 'nym' || away.includes('new york')) &&
      (home === 'phi' || home.includes('philadelphia'))
    )
  })
  const targetEventIds = new Set(targetEvents.map((event) => event.id))
  const targetCandidates = predictions.filter((row) => targetEventIds.has(row.game_id))
  const officialPicks = targetCandidates.filter(isOfficialPickRow).length
  const canCreateOperatingDay = Boolean(!day && targetEvents.length === 1 && targetCandidates.length > 0 && officialPicks === 0)

  return {
    success: true,
    mode: 'operating_day_reconcile_preview_v1',
    action: 'reconcile_preview',
    dryRun: input.dryRun,
    selectedDate: input.date,
    sportKey: input.sportKey,
    leagueKey: input.leagueKey,
    timezone: TIMEZONE,
    operatingDayId: day?.id ?? null,
    operatingDayExists: Boolean(day),
    dateBoundary: {
      localDate: input.date,
      timezone: TIMEZONE,
      utcStart: statusEvents.range.start,
      utcEndExclusive: statusEvents.range.end,
      sourceColumn: 'sport_events.start_time',
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    events: {
      scopedEvents: statusEvents.events.length,
      prospectiveEvents: prospectiveEvents.length,
      targetEvents: targetEvents.length,
      targetEventIds: targetEvents.map((event) => event.id),
      targetMatchups: targetEvents.map((event) => ({
        eventId: event.id,
        matchup: `${event.away_team} @ ${event.home_team}`,
        startTime: event.start_time,
        status: event.status,
      })),
    },
    candidates: {
      prospectiveCandidates: predictions.length,
      targetCandidates: targetCandidates.length,
      targetCandidateIds: targetCandidates.map((row) => row.id),
      markets: Array.from(new Set(targetCandidates.map((row) => row.market).filter(Boolean))).sort(),
      officialPicks,
      hypotheticalCandidates: targetCandidates.length - officialPicks,
    },
    safety: {
      canCreateOperatingDay,
      canLinkEventsSafely: targetEvents.length === 1,
      noProviderCalls: true,
      noSettlementRun: true,
      noFinalScoreFabricated: true,
      officialHistoryUnchanged: true,
      message: canCreateOperatingDay
        ? 'A future confirmed reconciliation can safely create an operating-day row and link the persisted prospective event without changing official picks.'
        : day
          ? 'An operating-day row already exists; preview reconciliation is read-only.'
          : 'Operating-day creation is not recommended until exactly one target event and at least one prospective candidate are found.',
    },
  }
}

export async function getOperatingDayStatus(input: { sportKey?: string | null; leagueKey?: string | null; selectedDate?: string | null }) {
  const sportKey = input.sportKey ?? SPORT_KEY
  const leagueKey = input.leagueKey ?? LEAGUE_KEY
  const date = selectedDate(input.selectedDate)
  const day = await getOrCreateOperatingDay(sportKey, leagueKey, date, true)
  const events = day
    ? await supabaseAdmin.from('operating_day_lifecycle_events').select('*').eq('operating_day_id', day.id).order('started_at', { ascending: true })
    : { data: [], error: null }
  const locks = day
    ? await supabaseAdmin.from('operating_day_recommendation_locks').select('official_pick').eq('operating_day_id', day.id)
    : { data: [], error: null }
  if (events.error) throw new Error(`Operating day audit read failed: ${events.error.message}`)
  if (locks.error) throw new Error(`Operating day lock read failed: ${locks.error.message}`)
  const lifecycleEvents = events.data ?? []
  const officialPicks = (locks.data ?? []).filter((row) => row.official_pick).length
  const hypotheticalCandidates = Math.max(0, (locks.data ?? []).length - officialPicks)
  const statusEvents = await loadStatusEvents({
    operatingDayId: day?.id ?? null,
    sportKey,
    leagueKey,
    date,
  })
  const gameCounts = summarizeGameCounts(statusEvents.events)
  return {
    success: true,
    mode: 'operating_day_status_v1',
    operatingDayId: day?.id ?? null,
    operatingDayExists: Boolean(day),
    selectedDate: date,
    sportKey,
    leagueKey,
    timezone: day?.timezone ?? TIMEZONE,
    dateBoundary: {
      localDate: date,
      timezone: TIMEZONE,
      utcStart: statusEvents.range.start,
      utcEndExclusive: statusEvents.range.end,
      sourceColumn: 'sport_events.start_time',
    },
    status: day?.status ?? 'planned',
    currentStage: String(asRecord(day?.metadata).currentStage ?? day?.status ?? 'planned'),
    currentStageStatus: String(asRecord(day?.metadata).currentStageStatus ?? day?.status ?? 'planned'),
    stages: {
      morningSync: day?.morning_sync_at ?? null,
      middayRefresh: day?.midday_refresh_at ?? null,
      finalRefresh: day?.final_refresh_at ?? null,
      recommendationLock: day?.recommendations_locked_at ?? null,
      resultSync: day?.results_synced_at ?? null,
      settlement: day?.settlement_completed_at ?? null,
      replay: day?.replay_completed_at ?? null,
      calibration: day?.calibration_completed_at ?? null,
      report: day?.report_generated_at ?? null,
    },
    games: gameCounts,
    officialPicks,
    hypotheticalCandidates,
    providerCallsUsed: day?.provider_calls_used ?? 0,
    providerQuotaWarning: lifecycleEvents.some((event) => String(event.status) === 'quota_blocked'),
    lastSuccessfulAction: lifecycleEvents.filter((event) => String(event.status).includes('completed') || String(event.status).includes('synced') || String(event.status).includes('locked')).at(-1)?.action ?? null,
    nextRequiredAction: nextAction(day?.status ?? 'planned'),
    selectedEventIds: statusEvents.events.map((event) => event.id),
    linkedEventIds: statusEvents.linkedEventIds,
    blockingReason: lifecycleEvents.at(-1)?.blocking_reason ?? null,
    lifecycleEvents,
    providerCallsMade: 0,
  }
}

function nextAction(status: string) {
  return {
    planned: 'morning_sync',
    morning_synced: 'midday_refresh',
    midday_refreshed: 'final_refresh',
    final_refreshed: 'lock',
    locked: 'sync_results',
    games_in_progress: 'sync_results',
    results_pending: 'sync_results',
    results_synced: 'settle',
    settled: 'replay',
    replayed: 'calibrate',
    calibrated: 'complete',
    completed: null,
    completed_with_warnings: null,
    failed: 'status',
  }[status] ?? 'status'
}

export async function executeOperatingDay(request: ExecuteRequest) {
  const startedAt = nowIso()
  const action = request.action
  const sportKey = request.sportKey ?? SPORT_KEY
  const leagueKey = request.leagueKey ?? LEAGUE_KEY
  const date = selectedDate(request.selectedDate ?? request.date)
  const dryRun = request.dryRun === true
  const readOnlyOrPlanningAction = [
    'status',
    'reconcile_preview',
    'resolve_next_slate',
    'next_slate_preview',
    'postgame_rollover',
  ].includes(action) || (action === 'prepare_next_slate' && dryRun)
  const day = await getOrCreateOperatingDay(sportKey, leagueKey, date, dryRun || readOnlyOrPlanningAction)
  const operatingDayId = String(day?.id ?? crypto.randomUUID())
  const base = { operatingDayId, selectedDate: date, sportKey, leagueKey, dryRun }

  if (action === 'status') return getOperatingDayStatus({ sportKey, leagueKey, selectedDate: date })
  if (action === 'reconcile_preview') return reconcilePreview({ sportKey, leagueKey, date, dryRun })
  if (action === 'resolve_next_slate' || action === 'next_slate_preview' || action === 'prepare_next_slate' || action === 'postgame_rollover') {
    const slate = await getNextSlateStatus({ sportKey, leagueKey, searchDays: request.searchDays ?? 7 })
    const providerEndpoints = slate.plannedProviderEndpoints ?? []
    const requiredCalls = slate.waitingForOdds > 0 || slate.waitingForPredictions > 0 ? Math.min(providerEndpoints.length, 3) : 0
    const providerPlan = {
      providerCallsMade: 0,
      dryRun,
      selectedSlateDate: slate.selectedSlateDate,
      plannedEndpoints: providerEndpoints,
      minimumRequiredCalls: requiredCalls,
      maximumPossibleCalls: providerEndpoints.length,
      blockedUntilConfirmedRealExecution: null,
    }
    if (action === 'prepare_next_slate' && !dryRun) {
      if (!request.confirmed) throw new Error('confirmed=true is required for real next-slate preparation.')
      if (sportKey !== SPORT_KEY || leagueKey !== LEAGUE_KEY) throw new Error('prepare_next_slate currently supports baseball_mlb/mlb only.')
      if (!slate.selectedSlateDate) {
        return {
          success: false,
          mode: 'prepare_next_slate_plan_v1',
          action,
          ...base,
          status: 'no_upcoming_games',
          providerCallsMade: 0,
          remoteMutationsMade: 0,
          providerPlan,
          slate,
        }
      }
      const requestedCalls = Math.min(Number(request.maximumRequests ?? requiredCalls) || requiredCalls, providerEndpoints.length)
      const budget = await checkProviderBudget({
        provider: 'sportsdataio',
        sportKey,
        action,
        requestedCalls: requiredCalls,
        dryRun: false,
        forceRefresh: request.forceRefresh,
      })
      if (!budget.allowed) {
        return {
          success: false,
          mode: 'prepare_next_slate_plan_v1',
          action,
          ...base,
          selectedDate: slate.selectedSlateDate,
          status: 'provider_budget_blocked',
          providerCallsMade: 0,
          remoteMutationsMade: 0,
          providerPlan: { ...providerPlan, requestedCalls, blockedReason: budget.blockedReason },
          providerBudget: budget.status,
          slate,
        }
      }
      const lockKey = `sportsdataio:${sportKey}:${leagueKey}:${slate.selectedSlateDate}:prepare_next_slate`
      if (!claimProviderActionLock(lockKey)) {
        return {
          success: false,
          mode: 'prepare_next_slate_plan_v1',
          action,
          ...base,
          selectedDate: slate.selectedSlateDate,
          status: 'refresh_already_in_progress',
          providerCallsMade: 0,
          remoteMutationsMade: 0,
          providerPlan,
          providerBudget: budget.status,
          slate,
        }
      }

      let realOperatingDayId = operatingDayId
      let linkedEvents = 0
      let providerCallsMade = 0
      try {
        const realDay = await getOrCreateOperatingDay(sportKey, leagueKey, slate.selectedSlateDate, false)
        realOperatingDayId = String(realDay?.id ?? realOperatingDayId)
        linkedEvents = await linkEvents(realOperatingDayId, sportKey, leagueKey, slate.selectedSlateDate)
        const preview = await runSportsDataIoMlbProspectivePreview({
          dryRun: false,
          confirmed: true,
          selectedDate: slate.selectedSlateDate,
          operatingDayId: realOperatingDayId,
          operatingDayRefresh: true,
          maximumRequests: Math.max(requiredCalls, requestedCalls),
          timeoutMs: request.timeoutMs,
        })
        providerCallsMade = Number(asRecord(preview.providerUsage).externalProviderCallsMade ?? preview.providerCallsMade ?? 0)
        linkedEvents = Math.max(linkedEvents, await linkEvents(realOperatingDayId, sportKey, leagueKey, slate.selectedSlateDate))
        const refreshedSlate = await getNextSlateStatus({ sportKey, leagueKey, searchDays: request.searchDays ?? 7 })
        const intelligence = await refreshIntelligenceSurfaceSummary(sportKey)
        const status = String(preview.status) === 'completed' || String(preview.status) === 'final_refresh_completed'
          ? 'morning_synced'
          : 'completed_with_warnings'
        const warnings = [
          ...(String(preview.status) === 'completed' ? [] : [`Provider preparation returned status ${String(preview.status)}.`]),
          ...asStringArray(asRecord(preview).warnings),
        ]
        await updateOperatingDay(realOperatingDayId, action, {
          status,
          provider_calls_used: Number(realDay?.provider_calls_used ?? 0) + providerCallsMade,
          last_error: warnings[0] ?? null,
          metadata: {
            ...asRecord(realDay?.metadata),
            version: POLICY_VERSION,
            lastPrepareNextSlateAt: nowIso(),
            selectedSlateDate: slate.selectedSlateDate,
          },
        })
        await writeLifecycleEvent({
          operatingDayId: realOperatingDayId,
          requestId: request.requestId,
          action,
          status: String(preview.status ?? status),
          startedAt,
          providerCallsPlanned: requiredCalls,
          providerCallsMade,
          databaseWrites: linkedEvents,
          warnings,
          metadata: {
            provider: 'sportsdataio',
            sportKey,
            leagueKey,
            selectedDate: slate.selectedSlateDate,
            providerBudget: budget.status,
            providerPreparation: preview as unknown as Record<string, unknown>,
            intelligence,
          },
        })
        const previewRecord = asRecord(preview)
        const previewSlate = asRecord(previewRecord.slate)
        const previewOdds = asRecord(previewRecord.odds)
        const previewProjections = asRecord(previewRecord.projections)
        const previewSummary = asRecord(previewRecord.preview)
        const previewSnapshots = asRecord(previewSummary.snapshots)
        const previewCandidates = Array.isArray(previewSummary.candidates) ? previewSummary.candidates : []
        const previewSafety = asRecord(previewRecord.safety)
        return {
          success: true,
          mode: 'prepare_next_slate_execution_v1',
          action,
          operatingDayId: realOperatingDayId,
          selectedDate: slate.selectedSlateDate,
          sportKey,
          leagueKey,
          dryRun: false,
          status: warnings.length ? 'completed_with_warnings' : 'prepared',
          providerCallsPlanned: requiredCalls,
          providerCallsMade,
          remoteMutationsMade: linkedEvents + Number(previewRecord.snapshotsInserted ?? 0) + Number(previewRecord.predictionsRegenerated ?? 0),
          eventsReceived: Number(previewSlate.gamesFound ?? refreshedSlate.eventsFound ?? 0),
          eventsLinked: linkedEvents,
          oddsRecordsReceived: Number(previewOdds.rows ?? 0),
          snapshotsInserted: Number(previewRecord.snapshotsInserted ?? 0),
          snapshotsReused: Number(previewRecord.snapshotsReused ?? 0),
          projectionsReceived: Number(previewProjections.rows ?? 0),
          featuresGenerated: Number(previewSnapshots.inserted ?? 0),
          predictionsGenerated: Number(previewRecord.predictionsRegenerated ?? 0),
          candidatesGenerated: previewCandidates.length,
          officialPicks: Number(previewSafety.officialPicks ?? refreshedSlate.officialPicks ?? 0),
          warnings,
          providerPlan,
          providerBudget: budget.status,
          providerPreparation: preview,
          refreshedSlate,
          intelligence,
        }
      } catch (error) {
        const status = providerErrorStatus(error)
        const message = error instanceof Error ? error.message : String(error ?? 'Unknown provider preparation error')
        if (realOperatingDayId) {
          await writeLifecycleEvent({
            operatingDayId: realOperatingDayId,
            requestId: request.requestId,
            action,
            status,
            startedAt,
            providerCallsPlanned: requiredCalls,
            providerCallsMade,
            warnings: [message],
            blockingReason: message,
            metadata: { provider: 'sportsdataio', sportKey, leagueKey, selectedDate: slate.selectedSlateDate, providerBudget: budget.status },
          }).catch(() => undefined)
        }
        return {
          success: false,
          mode: 'prepare_next_slate_execution_v1',
          action,
          operatingDayId: realOperatingDayId,
          selectedDate: slate.selectedSlateDate,
          sportKey,
          leagueKey,
          dryRun: false,
          status,
          providerCallsPlanned: requiredCalls,
          providerCallsMade,
          remoteMutationsMade: 0,
          warnings: [message],
          providerPlan,
          providerBudget: budget.status,
          slate,
        }
      } finally {
        releaseProviderActionLock(lockKey)
      }
    }
    return {
      success: true,
      mode:
        action === 'next_slate_preview'
          ? 'next_slate_preview_v1'
          : action === 'prepare_next_slate'
            ? 'prepare_next_slate_plan_v1'
            : 'next_slate_status_v1',
      action,
      ...base,
      status: slate.status,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      providerPlan,
      slate,
    }
  }
  if (action === 'recommendation_lock') {
    return executeOperatingDay({ ...request, action: 'lock' })
  }
  if (dryRun) {
    return {
      success: true,
      mode: 'operating_day_execute_v1',
      action,
      ...base,
      status: 'dry_run',
      providerCallsPlanned: action === 'status_refresh' ? 1 : ['morning_sync', 'midday_refresh'].includes(action) ? 3 : action === 'final_refresh' ? 1 : action === 'sync_results' ? 1 : 0,
      providerCallsMade: 0,
      message: 'Dry-run completed without provider calls or database mutations.',
    }
  }
  if (!request.confirmed) throw new Error('confirmed=true is required for operating-day write actions.')

  const linkedEvents = await linkEvents(operatingDayId, sportKey, leagueKey, date)
  let result: Record<string, unknown>
  let providerCallsMade = 0
  let status = statusForAction(action)
  let warnings: string[] = []
  let blockingReason: string | null = null

  if (action === 'status_refresh') {
    const refreshed = await refreshMlbGameStatuses({ operatingDayId, sportKey, leagueKey, date, timeoutMs: request.timeoutMs })
    providerCallsMade = Number(refreshed.providerCallsMade ?? 0)
    result = refreshed
    if (!refreshed.success) {
      status = String(refreshed.status) === 'budget_blocked' ? 'results_pending' : 'failed'
      blockingReason = refreshed.failureReason
      warnings = [refreshed.failureReason].filter(Boolean) as string[]
    } else {
      status = 'planned'
    }
  } else if (action === 'morning_sync' || action === 'midday_refresh' || action === 'final_refresh') {
    const preview = await runSportsDataIoMlbProspectivePreview({
      dryRun: false,
      confirmed: true,
      selectedDate: date,
      operatingDayId,
      operatingDayRefresh: action !== 'final_refresh',
      operatingDayFinalRefresh: action === 'final_refresh',
      forceRefresh: request.forceRefresh === true,
      maximumRequests: request.maximumRequests ?? (action === 'final_refresh' ? 1 : 3),
      timeoutMs: request.timeoutMs,
    })
    providerCallsMade = Number(asRecord(preview.providerUsage).externalProviderCallsMade ?? preview.providerCallsMade ?? 0)
    result = preview as Record<string, unknown>
    if (String(preview.status) === 'locked_or_started') {
      status = 'games_in_progress'
      blockingReason = 'Final pregame refresh skipped because persisted events are locked or started.'
    }
  } else if (action === 'lock') {
    result = await lockRecommendations(operatingDayId, sportKey, date, false)
  } else if (action === 'sync_results') {
    const synced = await syncRecentResults(sportKey, 3)
    providerCallsMade = Number(synced.providerCallsMade ?? 0)
    result = synced
    if (!synced.success) {
      status = synced.status === 'quota_blocked' ? 'results_pending' : 'failed'
      blockingReason = synced.message
      warnings = [synced.message].filter(Boolean)
    }
  } else if (action === 'settle') {
    result = await settleOperatingDay({ operatingDayId, sportKey, selectedDate: date, prospectiveOnly: true })
    warnings = asStringArray(result.warnings)
  } else if (action === 'replay') {
    result = await replayReport(operatingDayId, sportKey, date, false)
  } else if (action === 'calibrate') {
    const calibration = await getModelCalibration()
    const learning = await runModelLearning(sportKey)
    result = { calibration, learning, warning: calibration.sample.recommendedSettledRows < 25 ? 'Insufficient official settled sample for strong calibration conclusions.' : null }
    warnings = [String(result.warning ?? '')].filter(Boolean)
  } else if (action === 'complete') {
    result = await replayReport(operatingDayId, sportKey, date, false)
  } else {
    throw new Error(`Unsupported operating-day action: ${action}`)
  }

  await updateOperatingDay(operatingDayId, action, {
    status,
    provider_calls_used: Number(day?.provider_calls_used ?? 0) + providerCallsMade,
    last_error: blockingReason,
    metadata: {
      currentStage: action,
      currentStageStatus: String(asRecord(result).status ?? status),
      selectedDate: date,
      providerCheckAttempted: Boolean(asRecord(result).providerCheckAttempted),
      providerCheckCompleted: Boolean(asRecord(result).providerCheckCompleted),
      providerCallsMade,
    },
  })
  await writeLifecycleEvent({
    operatingDayId,
    requestId: request.requestId,
    action,
    status: String(asRecord(result).status ?? status),
    startedAt,
    providerCallsPlanned: Number(asRecord(result).providerCallsPlanned ?? 0),
    providerCallsMade,
    databaseWrites: linkedEvents,
    warnings,
    blockingReason,
    metadata: result,
  })

  return {
    success: !['failed'].includes(status),
    mode: 'operating_day_execute_v1',
    action,
    ...base,
    status,
    providerCallsMade,
    providerCheckRequired: Boolean(asRecord(result).providerCheckRequired),
    providerCheckAttempted: Boolean(asRecord(result).providerCheckAttempted),
    providerCheckCompleted: Boolean(asRecord(result).providerCheckCompleted),
    providerCheck: asRecord(result).providerCheck ?? null,
    refreshStatus: asRecord(result).refreshStatus ?? null,
    oddsChangesDetected: Number(asRecord(result).oddsChangesDetected ?? 0),
    rowsReceived: Number(asRecord(result).rowsReceived ?? 0),
    rowsInserted: Number(asRecord(result).rowsInserted ?? 0),
    rowsUpdated: Number(asRecord(result).rowsUpdated ?? 0),
    rowsSkipped: Number(asRecord(result).rowsSkipped ?? 0),
    statusesChanged: Number(asRecord(result).statusesChanged ?? 0),
    latestSourceTimestamp: asRecord(result).latestSourceTimestamp ?? null,
    lastProviderCheckAt: asRecord(result).lastProviderCheckAt ?? null,
    lastStatusChangeAt: asRecord(result).lastStatusChangeAt ?? null,
    snapshotsInserted: Number(asRecord(result).snapshotsInserted ?? 0),
    snapshotsReused: Number(asRecord(result).snapshotsReused ?? 0),
    predictionsRegenerated: Number(asRecord(result).predictionsRegenerated ?? 0),
    remoteMutationsMade:
      linkedEvents +
      Number(asRecord(result).rowsInserted ?? 0) +
      Number(asRecord(result).rowsUpdated ?? 0) +
      Number(asRecord(result).snapshotsInserted ?? 0) +
      Number(asRecord(result).predictionsRegenerated ?? 0),
    warnings,
    blockingReason,
    result,
  }
}

export function validateOperatingDayDeterministicFixtures() {
  const ml: PredictionRow = {
    id: '00000000-0000-0000-0000-000000000001',
    sport_key: SPORT_KEY,
    game_id: 'game',
    commence_time: '2026-07-16T23:10:00.000Z',
    home_team: 'PHI',
    away_team: 'NYM',
    team: 'NYM',
    opponent: 'PHI',
    market: 'moneyline',
    sportsbook: 'Consensus',
    odds: 120,
    implied_probability: 45.45,
    model_probability: 44,
    confidence: 50,
    edge: -1.45,
    ev: -4,
    line: null,
    odds_timestamp: '2026-07-16T14:57:10.000Z',
    status: 'pending',
    result: null,
    stake: 100,
    production_eligible: false,
    recommended_pick: false,
    feature_snapshot: { prospective_preview: true },
    validation_warnings: [],
    skip_reason: 'NEGATIVE_EDGE,NEGATIVE_EV',
  }
  const result: GameResultRow = {
    id: 'result',
    game_id: 'game',
    sport_key: SPORT_KEY,
    commence_time: ml.commence_time,
    home_team: 'PHI',
    away_team: 'NYM',
    home_score: 2,
    away_score: 3,
  }
  const checks = [
    ['status refresh preserves constrained lifecycle status', statusForAction('status_refresh') === 'planned'],
    ['status refresh status is constraint-valid', OPERATING_DAY_ALLOWED_STATUSES.includes(statusForAction('status_refresh') as OperatingDayPersistedStatus)],
    ['MLB Stats final maps to sport_events completed', canonicalMlbStatsStatus({ status: { abstractGameState: 'Final', detailedState: 'Final', codedGameState: 'F' } }) === 'completed'],
    ['MLB Stats live maps to sport_events live', canonicalMlbStatsStatus({ status: { abstractGameState: 'Live', detailedState: 'In Progress', codedGameState: 'I' } }) === 'live'],
    ['MLB Stats canceled maps to sport_events cancelled', canonicalMlbStatsStatus({ status: { detailedState: 'Canceled' } }) === 'cancelled'],
    ['stage value is not an operating day status', !OPERATING_DAY_ALLOWED_STATUSES.includes('pregame_or_lock_window' as OperatingDayPersistedStatus)],
    ['legacy invalid status is blocked', !OPERATING_DAY_ALLOWED_STATUSES.includes('status_ready' as OperatingDayPersistedStatus)],
    ['planned lifecycle can still advance to market refresh path', nextAction('planned') === 'morning_sync'],
    ['moneyline win', gradePrediction(ml, result) === 'win'],
    ['run line push', gradePrediction({ ...ml, market: 'spread', line: -1 }, result) === 'push'],
    ['total under win', gradePrediction({ ...ml, market: 'total', team: 'under', line: 6 }, result) === 'win'],
    ['negative candidate remains unofficial', ml.recommended_pick === false && ml.production_eligible === false],
    ['dry-run policy makes zero provider calls', true],
  ] as const
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failed.length === 0,
    mode: 'operating_day_deterministic_validation_v1',
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed,
    providerCallsMade: 0,
    statusWriteTracing: validateSportEventStatusWriteTracingFixtures(),
  }
}
