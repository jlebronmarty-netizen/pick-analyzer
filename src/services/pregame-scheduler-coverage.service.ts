import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { classifyPredictionCutoff } from '@/services/prediction-cutoff-enforcement.service'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = 'America/Puerto_Rico'

type EventRow = {
  id: string
  sport_key: string | null
  league_key: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  home_score?: number | null
  away_score?: number | null
}

type PredictionRow = {
  id: string
  game_id: string | null
  generated_at: string | null
  created_at?: string | null
  cutoff_at?: string | null
  commence_time?: string | null
  market?: string | null
  team?: string | null
  selection?: string | null
  line?: number | null
  model_version?: string | null
  idempotency_key?: string | null
  is_current?: boolean | null
  result?: string | null
  status?: string | null
  settlement_details?: Record<string, unknown> | null
  production_eligible?: boolean | null
  recommended_pick?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
}

type OddsRow = {
  event_id: string | null
  snapshot_time: string | null
  created_at?: string | null
}

type LifecycleRow = {
  action: string | null
  status: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string | null
  provider_calls_made?: number | null
  metadata?: Record<string, unknown> | null
  blocking_reason?: string | null
}

type SyncJobRow = {
  job_type: string | null
  status: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string | null
  records_fetched?: number | null
  records_updated?: number | null
  records_inserted?: number | null
  error_count?: number | null
  metadata?: Record<string, unknown> | null
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function lower(value: unknown) {
  return String(value ?? '').toLowerCase()
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function localDateOffset(days: number, now = new Date()) {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() + days)
  return localDateInTimeZone(date.toISOString(), TIMEZONE) ?? date.toISOString().slice(0, 10)
}

function isFinal(event: EventRow) {
  return ['final', 'completed', 'closed', 'complete'].includes(lower(event.status)) ||
    (event.home_score !== null && event.home_score !== undefined && event.away_score !== null && event.away_score !== undefined)
}

function ms(value: string | null | undefined) {
  const parsed = Date.parse(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function minutesBetween(start: string | null | undefined, end: string | null | undefined) {
  const startMs = ms(start)
  const endMs = ms(end)
  if (startMs === null || endMs === null) return null
  return round((endMs - startMs) / 60000)
}

function avg(values: Array<number | null>) {
  const usable = values.filter((value): value is number => Number.isFinite(value))
  return usable.length ? round(usable.reduce((sum, value) => sum + value, 0) / usable.length) : null
}

function nextUtcForMinuteSet(minutes: number[], now = new Date()) {
  const base = new Date(now)
  base.setUTCSeconds(0, 0)
  for (let hourOffset = 0; hourOffset <= 24; hourOffset += 1) {
    for (const minute of minutes) {
      const candidate = new Date(base)
      candidate.setUTCHours(base.getUTCHours() + hourOffset, minute, 0, 0)
      if (candidate.getTime() > now.getTime()) return candidate.toISOString()
    }
  }
  return null
}

function nextDailyUtc(hour: number, minute: number, now = new Date()) {
  const candidate = new Date(now)
  candidate.setUTCHours(hour, minute, 0, 0)
  if (candidate.getTime() <= now.getTime()) candidate.setUTCDate(candidate.getUTCDate() + 1)
  return candidate.toISOString()
}

function schedulerDefinitions(now = new Date()) {
  return [
    {
      scheduler: 'Vercel Operating Day Cron',
      route: '/api/cron/operating-day',
      frequency: 'daily',
      cron: '0 12 * * *',
      timezone: 'UTC; operating-day service resolves America/Puerto_Rico',
      operatingDay: 'America/Puerto_Rico MLB operating date',
      nextExecution: nextDailyUtc(12, 0, now),
      retryPolicy: 'Delegates to adaptive refresh; provider budget guard, refresh-window guard, and provider action lock prevent unsafe duplicate work.',
      active: true,
    },
    {
      scheduler: 'GitHub Production Operating Day Runtime',
      route: '/api/cron/operating-day?dryRun=false',
      frequency: 'four times per hour',
      cron: '7,22,37,52 * * * *',
      timezone: 'UTC',
      operatingDay: 'America/Puerto_Rico MLB operating date',
      nextExecution: nextUtcForMinuteSet([7, 22, 37, 52], now),
      retryPolicy: 'GitHub retry is visible as a failed workflow; endpoint uses action lock, provider budget guard and idempotent operating-day writes.',
      active: true,
    },
    {
      scheduler: 'GitHub Production Operating Day Heartbeat',
      route: '/api/cron/operating-day?dryRun=false',
      frequency: 'twice per hour',
      cron: '14,44 * * * *',
      timezone: 'UTC',
      operatingDay: 'America/Puerto_Rico MLB operating date',
      nextExecution: nextUtcForMinuteSet([14, 44], now),
      retryPolicy: 'Heartbeat calls the same protected endpoint and shares the same concurrency group; it is a fallback caller, not a second engine.',
      active: true,
    },
    {
      scheduler: 'Manual Legacy Cron Routes',
      route: '/api/cron/daily-sync, /api/cron/master-sync, /api/cron/capture-predictions',
      frequency: 'manual only',
      cron: null,
      timezone: 'route-specific',
      operatingDay: 'manual operator scope',
      nextExecution: null,
      retryPolicy: 'No unattended retry; retained as manual fallback only.',
      active: false,
    },
  ]
}

function lifecycleDuration(row: LifecycleRow | SyncJobRow) {
  return minutesBetween(row.started_at ?? row.created_at, row.completed_at)
}

function groupCount<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const groups = new Map<string, number>()
  for (const row of rows) {
    const key = getKey(row) || 'UNKNOWN'
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return Object.fromEntries(Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)))
}

function duplicateGroups(rows: PredictionRow[]) {
  const byIdempotency = new Map<string, number>()
  const byIdentity = new Map<string, number>()
  for (const row of rows) {
    if (row.idempotency_key) byIdempotency.set(row.idempotency_key, (byIdempotency.get(row.idempotency_key) ?? 0) + 1)
    const identity = [
      row.game_id,
      row.market,
      row.team ?? row.selection,
      row.line ?? '',
      row.model_version ?? '',
      row.is_current === false ? 'superseded' : 'current',
    ].join('|')
    byIdentity.set(identity, (byIdentity.get(identity) ?? 0) + 1)
  }
  return {
    duplicateIdempotencyKeys: Array.from(byIdempotency.values()).filter((count) => count > 1).length,
    duplicateCurrentPredictionIdentities: Array.from(byIdentity.entries()).filter(([key, count]) => !key.includes('|superseded') && count > 1).length,
  }
}

function rejectionReason(input: {
  event: EventRow
  odds: OddsRow[]
  predictions: PredictionRow[]
  validPregame: number
  excluded: number
  now: Date
}) {
  if (input.validPregame > 0) return 'VALID_PREGAME'
  if (input.excluded > 0) {
    const states = input.predictions.map((row) => classifyPredictionCutoff(row, input.event).state)
    if (states.includes('POST_FINAL')) return 'GAME_ALREADY_FINAL'
    if (states.includes('POST_START')) return 'GAME_ALREADY_STARTED'
    if (states.includes('INVALID_CUTOFF')) return 'INVALID_CUTOFF'
    return 'SCHEDULER_WINDOW_MISSED'
  }
  if (!input.odds.length) return 'NO_ODDS'
  const startMs = ms(input.event.start_time)
  if (startMs !== null && startMs <= input.now.getTime()) return 'SCHEDULER_WINDOW_MISSED'
  if (isFinal(input.event)) return 'GAME_ALREADY_FINAL'
  return 'PREDICTION_NOT_DUE'
}

async function loadCoverageRows(date: string) {
  const range = zonedUtcRange(date, TIMEZONE)
  const { data: eventsData, error: eventError } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team, home_score, away_score')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
  if (eventError) throw new Error(`pregame scheduler event read failed: ${eventError.message}`)

  const events = (eventsData ?? []) as EventRow[]
  const eventIds = events.map((event) => event.id)
  if (!eventIds.length) return { events, odds: [] as OddsRow[], predictions: [] as PredictionRow[] }

  const { data: oddsData, error: oddsError } = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('event_id, snapshot_time, created_at')
    .in('event_id', eventIds)
    .limit(5000)
  if (oddsError) throw new Error(`pregame scheduler odds read failed: ${oddsError.message}`)

  const { data: predictionData, error: predictionError } = await supabaseAdmin
    .from('prediction_history')
    .select('id, game_id, generated_at, created_at, cutoff_at, commence_time, market, team, selection, line, model_version, idempotency_key, is_current, result, status, settlement_details, production_eligible, recommended_pick, trial, scrambled')
    .in('game_id', eventIds)
    .limit(5000)
  if (predictionError) throw new Error(`pregame scheduler prediction read failed: ${predictionError.message}`)

  return {
    events,
    odds: (oddsData ?? []) as OddsRow[],
    predictions: (predictionData ?? []) as PredictionRow[],
  }
}

async function loadSchedulerEvidence() {
  const [lifecycle, jobs] = await Promise.all([
    supabaseAdmin
      .from('operating_day_lifecycle_events')
      .select('action, status, started_at, completed_at, created_at, provider_calls_made, metadata, blocking_reason')
      .order('created_at', { ascending: false })
      .limit(250),
    supabaseAdmin
      .from('sports_sync_jobs')
      .select('job_type, status, started_at, completed_at, created_at, records_fetched, records_updated, records_inserted, error_count, metadata')
      .eq('sport_key', SPORT_KEY)
      .order('created_at', { ascending: false })
      .limit(250),
  ])
  if (lifecycle.error) throw new Error(`pregame scheduler lifecycle read failed: ${lifecycle.error.message}`)
  if (jobs.error) throw new Error(`pregame scheduler sync-job read failed: ${jobs.error.message}`)
  return {
    lifecycleRows: (lifecycle.data ?? []) as LifecycleRow[],
    syncJobs: (jobs.data ?? []) as SyncJobRow[],
  }
}

export async function getPregameSchedulerCoverage({ now = new Date() }: { now?: Date } = {}) {
  const today = localDateOffset(0, now)
  const yesterday = localDateOffset(-1, now)
  const [todayRows, yesterdayRows, schedulerEvidence] = await Promise.all([
    loadCoverageRows(today),
    loadCoverageRows(yesterday),
    loadSchedulerEvidence(),
  ])

  const buildDay = (label: 'Today' | 'Yesterday', date: string, rows: Awaited<ReturnType<typeof loadCoverageRows>>) => {
    const oddsByEvent = new Map<string, OddsRow[]>()
    for (const row of rows.odds) {
      if (!row.event_id) continue
      oddsByEvent.set(row.event_id, [...(oddsByEvent.get(row.event_id) ?? []), row])
    }
    const predictionsByEvent = new Map<string, PredictionRow[]>()
    for (const row of rows.predictions) {
      if (!row.game_id) continue
      predictionsByEvent.set(row.game_id, [...(predictionsByEvent.get(row.game_id) ?? []), row])
    }
    const games = rows.events.map((event) => {
      const predictions = predictionsByEvent.get(event.id) ?? []
      const odds = oddsByEvent.get(event.id) ?? []
      const classifications = predictions.map((row) => classifyPredictionCutoff(row, event))
      const validPregame = classifications.filter((item) => item.eligible).length
      const excluded = classifications.length - validPregame
      const firstPredictionAt = predictions.map((row) => row.generated_at ?? row.created_at ?? null).filter(Boolean).sort()[0] ?? null
      const cutoffTimestamp = classifications.find((item) => item.cutoffTimestamp)?.cutoffTimestamp ?? event.start_time ?? null
      const firstOddsAt = odds.map((row) => row.snapshot_time ?? row.created_at ?? null).filter(Boolean).sort()[0] ?? null
      const latestOddsAt = odds.map((row) => row.snapshot_time ?? row.created_at ?? null).filter(Boolean).sort().at(-1) ?? null
      const marginBeforeCutoffMinutes = minutesBetween(firstPredictionAt, cutoffTimestamp)
      return {
        eventId: event.id,
        matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
        startTime: event.start_time,
        status: event.status,
        detected: true,
        oddsCaptured: odds.length > 0,
        oddsSnapshots: odds.length,
        firstOddsAt,
        latestOddsAt,
        predictionGenerated: predictions.length > 0,
        predictionPersisted: predictions.length > 0,
        predictionsPersisted: predictions.length,
        validPregamePredictions: validPregame,
        rejectedPredictions: excluded,
        cutoffStates: groupCount(classifications, (item) => item.state),
        predictionTimestamp: firstPredictionAt,
        cutoffTimestamp,
        marginBeforeCutoffMinutes,
        state: validPregame > 0 ? 'VALID_PREGAME' : 'REJECTED',
        rejectionReason: rejectionReason({ event, odds, predictions, validPregame, excluded, now }),
        settled: predictions.some((row) => ['win', 'loss', 'push'].includes(lower(row.result ?? row.status))),
        learned: predictions.some((row) => Boolean(asObject(row.settlement_details).learning_evidence_v1)),
      }
    })
    const eligibleGames = games.filter((game) => !['postponed', 'cancelled', 'canceled', 'suspended'].includes(lower(game.status)))
    const predicted = eligibleGames.filter((game) => game.predictionGenerated).length
    const validPregameGames = eligibleGames.filter((game) => game.validPregamePredictions > 0).length
    const skipped = eligibleGames.filter((game) => game.validPregamePredictions === 0)
    const margins = games.map((game) => game.marginBeforeCutoffMinutes)
    return {
      label,
      date,
      timezone: TIMEZONE,
      gamesScheduled: rows.events.length,
      eligibleGames: eligibleGames.length,
      predicted,
      pending: skipped.filter((game) => game.rejectionReason === 'PREDICTION_NOT_DUE').length,
      skipped: skipped.length,
      validPregameGames,
      coveragePct: eligibleGames.length ? round((validPregameGames / eligibleGames.length) * 100) : null,
      predictionRows: rows.predictions.length,
      validPregamePredictionRows: games.reduce((sum, game) => sum + game.validPregamePredictions, 0),
      rejectedPredictionRows: games.reduce((sum, game) => sum + game.rejectedPredictions, 0),
      averageLeadTimeBeforeCutoffMinutes: avg(margins),
      minimumLeadTimeBeforeCutoffMinutes: margins.filter((value): value is number => Number.isFinite(value)).sort((a, b) => a - b)[0] ?? null,
      missedWindows: games.filter((game) => game.rejectionReason === 'SCHEDULER_WINDOW_MISSED' || game.rejectionReason === 'GAME_ALREADY_STARTED' || game.rejectionReason === 'GAME_ALREADY_FINAL').length,
      rejectionReasons: groupCount(games, (game) => game.rejectionReason),
      games,
      idempotency: duplicateGroups(rows.predictions),
    }
  }

  const lifecycleRows = schedulerEvidence.lifecycleRows
  const syncJobs = schedulerEvidence.syncJobs
  const completedLifecycle = lifecycleRows.filter((row) => row.completed_at)
  const completedJobs = syncJobs.filter((row) => row.completed_at)
  const definitions = schedulerDefinitions(now)
  const averageExecutionDurationMinutes = avg([
    ...completedLifecycle.map(lifecycleDuration),
    ...completedJobs.map(lifecycleDuration),
  ])
  const latestFailure = [...lifecycleRows, ...syncJobs].find((row) => lower(row.status).includes('fail') || Number((row as SyncJobRow).error_count ?? 0) > 0)

  const todayCoverage = buildDay('Today', today, todayRows)
  const yesterdayCoverage = buildDay('Yesterday', yesterday, yesterdayRows)

  return {
    success: true,
    mode: 'pregame_scheduler_coverage_v1',
    generatedAt: now.toISOString(),
    readOnly: true,
    timezone: TIMEZONE,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    schedulerTiming: definitions.map((definition) => ({
      ...definition,
      averageExecutionDurationMinutes,
      latestObservedRunAt: lifecycleRows[0]?.created_at ?? syncJobs[0]?.created_at ?? null,
      latestObservedStatus: lifecycleRows[0]?.status ?? syncJobs[0]?.status ?? null,
      latestFailureReason: (latestFailure as LifecycleRow | undefined)?.blocking_reason ?? (latestFailure as SyncJobRow | undefined)?.metadata?.lastError ?? null,
    })),
    recommendedLifecycleWindows: [
      { label: '24h', supported: true, implementation: 'external scheduler calls same adaptive endpoint; action may prepare next slate when due' },
      { label: '12h', supported: true, implementation: 'external scheduler calls same adaptive endpoint; action selected by adaptive freshness window' },
      { label: '6h', supported: true, implementation: 'external scheduler calls same adaptive endpoint; odds freshness determines due work' },
      { label: '3h', supported: true, implementation: 'external scheduler calls same adaptive endpoint; pregame window tightens freshness policy' },
      { label: '60m', supported: true, implementation: 'adaptive refresh marks odds stale sooner near start' },
      { label: '15m', supported: true, implementation: 'heartbeat/runtime cadence reaches the lock window through the same protected route' },
      { label: 'Lock', supported: true, implementation: 'prediction cutoff classifier rejects post-cutoff persistence and read models exclude contaminated rows' },
    ],
    today: todayCoverage,
    yesterday: yesterdayCoverage,
    summary: {
      gamesToday: todayCoverage.gamesScheduled,
      predictedToday: todayCoverage.predicted,
      pendingToday: todayCoverage.pending,
      skippedToday: todayCoverage.skipped,
      coverageTodayPct: todayCoverage.coveragePct,
      averageLeadTimeBeforeCutoffMinutes: todayCoverage.averageLeadTimeBeforeCutoffMinutes,
      missedWindowsToday: todayCoverage.missedWindows,
      retryValidation: 'Retries call the same protected operating-day route and reuse provider budget, action lock and persistence idempotency keys.',
      idempotencyValidation: todayCoverage.idempotency.duplicateCurrentPredictionIdentities === 0 && todayCoverage.idempotency.duplicateIdempotencyKeys === 0
        ? 'PASS'
        : 'REVIEW_DUPLICATES',
    },
    operations: {
      schedulerStatus: lifecycleRows[0]?.status ?? syncJobs[0]?.status ?? 'NO_EVIDENCE',
      nextExecution: definitions.find((item) => item.active)?.nextExecution ?? null,
      coverage: todayCoverage.coveragePct,
      predictionLeadTimeMinutes: todayCoverage.averageLeadTimeBeforeCutoffMinutes,
      missedWindows: todayCoverage.missedWindows,
      retryCount: lifecycleRows.filter((row) => ['FAILED_RETRYABLE', 'MISSED_REFRESH', 'BUDGET_BLOCKED', 'BLOCKED'].includes(String(row.status))).length,
    },
    guardrails: {
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      predictionProbabilitiesModified: false,
      officialPickPolicyModified: false,
      learningWeightsModified: false,
      historicalFeatureStoreModified: false,
      historicalReplayStarted: false,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
