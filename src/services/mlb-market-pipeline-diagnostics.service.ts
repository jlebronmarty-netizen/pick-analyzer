import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentBoard } from '@/services/current-board.service'
import { zonedUtcRange } from '@/services/provider-time-normalization.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = 'America/Puerto_Rico'

type CountResult = { count: number | null; error: { message: string } | null }

function localDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : value.toISOString().slice(0, 10)
}

function groupBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const value = String(row[key] ?? 'null')
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

async function exactCount(table: string, build: (query: any) => PromiseLike<CountResult>) {
  const query = build(supabaseAdmin.from(table).select('id', { count: 'exact', head: true }))
  const { count, error } = await query
  if (error) throw new Error(`${table} diagnostic count failed: ${error.message}`)
  return count ?? 0
}

export async function getMlbMarketPipelineDiagnostics(selectedDate = localDate()) {
  const generatedAt = new Date().toISOString()
  const range = zonedUtcRange(selectedDate, TIMEZONE)
  const eventsResult = await supabaseAdmin
    .from('sport_events')
    .select('id, start_time, status, home_team, away_team, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (eventsResult.error) throw new Error(`market pipeline event diagnostic read failed: ${eventsResult.error.message}`)

  const events = eventsResult.data ?? []
  const eventIds = events.map((event) => String(event.id))
  const nowMs = new Date(generatedAt).getTime()
  const futureScheduledEvents = events.filter((event) => {
    const start = event.start_time ? new Date(event.start_time).getTime() : Number.NaN
    return Number.isFinite(start) && start > nowMs && event.status === 'scheduled'
  }).length
  const prospectivePreviewEvents = events.filter((event) => {
    const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : {}
    return metadata.prospective_preview === true
  }).length

  const [oddsCount, predictionCount, currentPredictionCount, currentBoard] = await Promise.all([
    eventIds.length
      ? exactCount('sports_odds_snapshots', (query) => query.eq('sport_key', SPORT_KEY).in('event_id', eventIds))
      : Promise.resolve(0),
    eventIds.length
      ? exactCount('prediction_history', (query) => query.eq('sport_key', SPORT_KEY).in('game_id', eventIds))
      : Promise.resolve(0),
    eventIds.length
      ? exactCount('prediction_history', (query) => query.eq('sport_key', SPORT_KEY).in('game_id', eventIds).eq('is_current', true))
      : Promise.resolve(0),
    getCurrentBoard({ sportKey: SPORT_KEY, slateDate: selectedDate, limit: 200, includeMlbContext: false }),
  ])

  const oddsResult = eventIds.length
    ? await supabaseAdmin
        .from('sports_odds_snapshots')
        .select('event_id, market, sportsbook, outcome, snapshot_time, created_at, metadata')
        .eq('sport_key', SPORT_KEY)
        .in('event_id', eventIds)
        .order('snapshot_time', { ascending: false })
        .limit(1000)
    : { data: [], error: null }
  if (oddsResult.error) throw new Error(`market pipeline odds diagnostic read failed: ${oddsResult.error.message}`)

  const predictionResult = eventIds.length
    ? await supabaseAdmin
        .from('prediction_history')
        .select('game_id, market, model_role, is_current, generated_at, odds_timestamp, feature_snapshot')
        .eq('sport_key', SPORT_KEY)
        .in('game_id', eventIds)
        .order('generated_at', { ascending: false })
        .limit(1000)
    : { data: [], error: null }
  if (predictionResult.error) throw new Error(`market pipeline prediction diagnostic read failed: ${predictionResult.error.message}`)

  const oddsRows = oddsResult.data ?? []
  const predictionRows = predictionResult.data ?? []

  return {
    success: true,
    mode: 'mlb_market_pipeline_diagnostics_v1',
    generatedAt,
    selectedDate,
    timezone: TIMEZONE,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    events: {
      total: events.length,
      futureScheduled: futureScheduledEvents,
      prospectivePreviewMarked: prospectivePreviewEvents,
      statuses: groupBy(events, 'status'),
      sample: events.slice(0, 10).map((event) => ({
        eventId: event.id,
        matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
        startTime: event.start_time,
        status: event.status,
      })),
    },
    odds: {
      total: oddsCount,
      byMarket: groupBy(oddsRows, 'market'),
      latestSnapshotTime: oddsRows.map((row) => row.snapshot_time).filter(Boolean).sort().at(-1) ?? null,
    },
    predictions: {
      total: predictionCount,
      current: currentPredictionCount,
      byMarket: groupBy(predictionRows, 'market'),
      byModelRole: groupBy(predictionRows, 'model_role'),
      byCurrentFlag: groupBy(predictionRows, 'is_current'),
      latestGeneratedAt: predictionRows.map((row) => row.generated_at).filter(Boolean).sort().at(-1) ?? null,
    },
    currentBoard: {
      candidates: currentBoard.candidates.length,
      games: currentBoard.games.length,
      latestOddsTimestamp: currentBoard.latestOddsTimestamp,
      freshness: currentBoard.dataFreshness,
      exclusions: currentBoard.excludedRowSummary,
    },
    readiness: {
      eventsAvailable: events.length > 0,
      oddsAvailable: oddsCount > 0,
      predictionsAvailable: predictionCount > 0,
      currentBoardVisible: currentBoard.candidates.length > 0,
      canAttemptSingleFinalRefresh: futureScheduledEvents > 0,
    },
  }
}

export function validateMlbMarketPipelineDiagnosticsFixtures() {
  const sample = [
    { market: 'moneyline' },
    { market: 'moneyline' },
    { market: 'run_line' },
  ]
  const grouped = groupBy(sample, 'market')
  const date = localDate(new Date('2026-07-22T03:30:00.000Z'))
  const checks = [
    ['groups repeated markets', grouped.moneyline === 2 && grouped.run_line === 1],
    ['uses AST operating date', date === '2026-07-21'],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_market_pipeline_diagnostics_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
