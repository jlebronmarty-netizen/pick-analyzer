import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoLocalDateFromUtc, puertoRicoUtcRange } from '@/services/active-event.service'
import { getAdaptiveRefreshStatus } from '@/services/adaptive-refresh-orchestrator.service'
import { getCurrentBoard } from '@/services/current-board.service'
import { evaluateFreshness, validateMlbFreshnessPolicyFixtures } from '@/services/mlb-freshness-policy.service'
import {
  MLB_DISPLAY_TIMEZONE,
  MLB_PROVIDER_TIMEZONE,
  formatInTimeZone,
  normalizeStoredSportsDataIoMlbStart,
  validateProviderTimeNormalizationFixtures,
} from '@/services/provider-time-normalization.service'
import { eligibilityFromLifecycle, resolveMlbGameLifecycle, validateMlbLifecycleFixtures } from '@/services/mlb-game-lifecycle.service'
import { getUniversalProjectionEngine } from '@/services/universal-projection-engine.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  updated_at: string | null
  metadata: Record<string, unknown> | null
  provider_ids?: Record<string, unknown> | null
}

function countBy<T extends string>(values: T[]) {
  return values.reduce((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1
    return accumulator
  }, {} as Record<T, number>)
}

async function loadEvents(date: string) {
  const range = puertoRicoUtcRange(date)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team, updated_at, metadata, provider_ids')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`MLB temporal health event read failed: ${error.message}`)
  return (data ?? []) as EventRow[]
}

async function loadPredictionTimes(eventIds: string[]) {
  if (!eventIds.length) return { latestPrediction: null, latestRecommendation: null }
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('game_id, generated_at, odds_timestamp, recommendation_locked_at, created_at')
    .eq('sport_key', SPORT_KEY)
    .in('game_id', eventIds)
    .order('generated_at', { ascending: false })
    .limit(1000)
  if (error) return { latestPrediction: null, latestRecommendation: null }
  const rows = data ?? []
  return {
    latestPrediction: rows.map((row) => row.generated_at ?? row.created_at).filter(Boolean).sort().at(-1) ?? null,
    latestRecommendation: rows.map((row) => row.recommendation_locked_at ?? row.generated_at).filter(Boolean).sort().at(-1) ?? null,
  }
}

async function projectionTemporalIntegrity(date: string, now: Date) {
  const result = await getUniversalProjectionEngine({ sportKey: SPORT_KEY, date, dryRun: true })
  const projections = Array.isArray(result.projections) ? result.projections : []
  const invalid = projections.filter((projection) => {
    const generated = Date.parse(String(projection.generatedAt ?? ''))
    const eventId = String(projection.eventId ?? '')
    return !eventId || !Number.isFinite(generated) || generated > now.getTime()
  })
  return {
    status: invalid.length ? 'PARTIAL' : projections.length ? 'PASS' : 'INSUFFICIENT_DATA',
    projectionsChecked: projections.length,
    invalidProjectionCount: invalid.length,
    providerCallsMade: result.providerCallsMade,
    remoteMutationsMade: result.remoteMutationsMade ?? 0,
    warnings: result.warnings ?? [],
  }
}

export async function getMlbTemporalHealth({ date, now = new Date() }: { date?: string | null; now?: Date } = {}) {
  const selectedDate = date ?? puertoRicoLocalDateFromUtc(now.toISOString()) ?? now.toISOString().slice(0, 10)
  const [events, board, adaptive] = await Promise.all([
    loadEvents(selectedDate),
    getCurrentBoard({ sportKey: SPORT_KEY, mode: 'CURRENT', limit: 200 }).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    getAdaptiveRefreshStatus({ now }).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
  ])
  const eventIds = events.map((event) => event.id)
  const predictionTimes = await loadPredictionTimes(eventIds)
  const projectionIntegrity = await projectionTemporalIntegrity(selectedDate, now)

  const games = events.map((event) => {
    const temporal = normalizeStoredSportsDataIoMlbStart({ startTime: event.start_time, metadata: event.metadata, providerIds: event.provider_ids })
    const lifecycle = resolveMlbGameLifecycle(event, now)
    const eligibility = eligibilityFromLifecycle({
      lifecycle: lifecycle.lifecycle,
      hasOdds: false,
      hasPrediction: false,
    })
    const prematureLiveRisk =
      String(event.status ?? '').toLowerCase().includes('live') &&
      Boolean(lifecycle.canonicalStartTime && Date.parse(lifecycle.canonicalStartTime) > now.getTime())
    const metadata = event.metadata ?? {}
    return {
      eventId: event.id,
      matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
      rawProviderTime: typeof metadata.providerDateTimeRaw === 'string' ? metadata.providerDateTimeRaw : event.start_time,
      storedStartTime: event.start_time,
      normalizedUtc: lifecycle.canonicalStartTime,
      displayTime: lifecycle.displayTime ?? formatInTimeZone(lifecycle.canonicalStartTime, MLB_DISPLAY_TIMEZONE),
      providerTimezone: lifecycle.providerTimezone ?? MLB_PROVIDER_TIMEZONE,
      legacyRepairApplied: temporal.legacyRepairApplied,
      lifecycle: lifecycle.lifecycle,
      eligibility,
      statusSource: lifecycle.source,
      statusReason: lifecycle.reason,
      statusFresh: lifecycle.statusFresh,
      prematureLiveRisk,
      warnings: lifecycle.warnings,
    }
  })

  const scheduleTimestamp = events.map((event) => event.updated_at ?? event.start_time).filter(Boolean).sort().at(-1) ?? null
  const boardResult = 'error' in board ? null : board
  const adaptiveResult = 'error' in adaptive ? null : adaptive
  const freshness = [
    evaluateFreshness({ dataClass: 'schedule', sourceTimestamp: scheduleTimestamp, now }),
    evaluateFreshness({ dataClass: 'market_prices', sourceTimestamp: boardResult?.latestOddsTimestamp ?? null, now }),
    evaluateFreshness({ dataClass: 'predictions', sourceTimestamp: predictionTimes.latestPrediction, now }),
    evaluateFreshness({ dataClass: 'recommendations', sourceTimestamp: predictionTimes.latestRecommendation, now }),
    evaluateFreshness({ dataClass: 'projections', sourceTimestamp: projectionIntegrity.projectionsChecked ? now.toISOString() : null, now }),
    evaluateFreshness({ dataClass: 'confirmed_lineups', sourceTimestamp: null, now }),
    evaluateFreshness({ dataClass: 'current_board', sourceTimestamp: boardResult?.latestOddsTimestamp ?? null, now }),
    evaluateFreshness({ dataClass: 'official_picks', sourceTimestamp: predictionTimes.latestRecommendation, now }),
    evaluateFreshness({ dataClass: 'adaptive_refresh', sourceTimestamp: adaptiveResult?.generatedAt ?? null, now }),
    evaluateFreshness({ dataClass: 'operations_status', sourceTimestamp: adaptiveResult?.generatedAt ?? null, now }),
  ]

  return {
    success: true,
    mode: 'mlb_temporal_truth_health_v1',
    generatedAt: now.toISOString(),
    selectedDate,
    timezoneContract: {
      sportsDataIoMlbDateTime: 'EASTERN_LOCAL_TIME',
      sportsDataIoMlbDateTimeZone: MLB_PROVIDER_TIMEZONE,
      persistedInstants: 'UTC_INSTANT',
      apiTimestamps: 'ISO-8601 explicit Z or numeric offset',
      uiDisplayTimezone: MLB_DISPLAY_TIMEZONE,
      serverTimezoneMeaning: 'ignored',
    },
    totalGames: games.length,
    correctlyNormalized: games.filter((game) => game.normalizedUtc && !game.warnings.some((warning) => warning.includes('could not'))).length,
    ambiguousTimestamps: games.filter((game) => !game.normalizedUtc).length,
    invalidTimestamps: games.filter((game) => !game.normalizedUtc).length,
    legacyRepairCount: games.filter((game) => game.legacyRepairApplied).length,
    prematureLiveCount: games.filter((game) => game.prematureLiveRisk).length,
    staleStatusCount: games.filter((game) => !game.statusFresh && ['STATUS_UNCONFIRMED', 'UNKNOWN'].includes(game.lifecycle)).length,
    lifecycleDistribution: countBy(games.map((game) => game.lifecycle)),
    eligibilityDistribution: countBy(games.map((game) => game.eligibility)),
    providerTimezoneDistribution: countBy(games.map((game) => game.providerTimezone ?? 'UNKNOWN')),
    freshnessDistribution: countBy(freshness.map((item) => item.status)),
    freshness,
    adaptiveExecutionMode: {
      status: 'PLANNED_NOT_EXECUTED',
      explanation: 'Adaptive Refresh status plans through the existing operating-day scheduler and does not call providers from this diagnostic.',
      providerCallsMadeByDiagnostic: 0,
    },
    projectionTemporalIntegrity: projectionIntegrity,
    games,
    validation: {
      timeNormalization: validateProviderTimeNormalizationFixtures(),
      lifecycle: validateMlbLifecycleFixtures(),
      freshness: validateMlbFreshnessPolicyFixtures(),
    },
    guardrails: {
      providerCallsMade: projectionIntegrity.providerCallsMade,
      remoteMutationsMade: projectionIntegrity.remoteMutationsMade,
      predictionMutationsMade: 0,
      officialThresholdsChanged: false,
      championRowsMutated: false,
      v7Promoted: false,
      providerAcquisitionPolicyChanged: false,
    },
    warnings: [
      'Detailed provider schedule verification requires an approved provider call or independent manual comparison.',
      'Legacy read-time repair does not rewrite historical rows.',
      'Time-only lifecycle inference never marks games FINAL, CANCELED or POSTPONED.',
      'Time-only post-start status remains STATUS_UNCONFIRMED without fresh provider status.',
      'error' in board ? board.error : null,
      'error' in adaptive ? adaptive.error : null,
    ].filter(Boolean),
    providerCallsMade: projectionIntegrity.providerCallsMade,
    remoteMutationsMade: projectionIntegrity.remoteMutationsMade,
  }
}
