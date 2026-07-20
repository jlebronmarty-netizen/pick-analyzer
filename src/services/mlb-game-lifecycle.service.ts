import 'server-only'

import { normalizeStoredSportsDataIoMlbStart } from '@/services/provider-time-normalization.service'

export type MlbGameLifecycle =
  | 'SCHEDULED'
  | 'PREGAME'
  | 'STARTING_SOON'
  | 'LIVE'
  | 'STATUS_UNCONFIRMED'
  | 'DELAYED'
  | 'SUSPENDED'
  | 'POSTPONED'
  | 'CANCELED'
  | 'FINAL'
  | 'UNKNOWN'

export type MlbAnalysisEligibility =
  | 'READY'
  | 'DATA_AGING'
  | 'STALE'
  | 'LOCKED'
  | 'UNSUPPORTED'
  | 'INSUFFICIENT_DATA'
  | 'SETTLED'
  | 'SETTLEMENT_PENDING'
  | 'STATUS_UNCONFIRMED'

export const MLB_TIME_BASED_LIVE_INFERENCE_MAX_MINUTES = 20
export const MLB_STARTING_SOON_MINUTES = 45

export type MlbLifecycleInput = {
  sport_key?: string | null
  sportKey?: string | null
  league_key?: string | null
  leagueKey?: string | null
  start_time?: string | null
  startTime?: string | null
  status?: string | null
  updated_at?: string | null
  provider_ids?: Record<string, unknown> | null
  providerIds?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

function normalizedStatus(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ')
}

function statusFresh(updatedAt: string | null | undefined, now: Date) {
  if (!updatedAt) return false
  const parsed = new Date(updatedAt)
  if (!Number.isFinite(parsed.getTime())) return false
  return now.getTime() - parsed.getTime() <= 12 * 60 * 60 * 1000
}

function statusToLifecycle(status: string | null | undefined): MlbGameLifecycle | null {
  const raw = normalizedStatus(status)
  if (!raw) return null
  if (['final', 'completed', 'complete', 'closed', 'f'].includes(raw)) return 'FINAL'
  if (['live', 'in progress', 'inprogress', 'started'].includes(raw)) return 'LIVE'
  if (raw.includes('delay')) return 'DELAYED'
  if (raw.includes('suspend')) return 'SUSPENDED'
  if (raw.includes('postpone')) return 'POSTPONED'
  if (raw.includes('cancel')) return 'CANCELED'
  if (['scheduled', 'created', 'open', 'pregame'].includes(raw)) return 'PREGAME'
  return null
}

export function resolveMlbGameLifecycle(event: MlbLifecycleInput, now = new Date()) {
  const start = normalizeStoredSportsDataIoMlbStart({
    startTime: event.start_time ?? event.startTime,
    metadata: event.metadata,
    providerIds: event.provider_ids ?? event.providerIds,
  })
  const startMs = start.canonicalUtc ? Date.parse(start.canonicalUtc) : Number.NaN
  const official = statusToLifecycle(event.status)
  const specialOfficial = Boolean(official && ['FINAL', 'POSTPONED', 'CANCELED', 'SUSPENDED', 'DELAYED'].includes(official))
  const freshOfficial = Boolean(
    official &&
      (
        specialOfficial ||
        statusFresh(event.updated_at, now)
      )
  )

  if (freshOfficial && official) {
    return {
      lifecycle: official === 'SCHEDULED' ? 'PREGAME' as const : official,
      source: 'fresh_official_provider_status',
      statusFresh: true,
      canonicalStartTime: start.canonicalUtc,
      storedStartTime: start.storedUtc,
      providerTimezone: start.providerTimezone,
      displayTime: start.displayTime,
      displayTimezone: start.displayTimezone,
      interpretationMode: start.interpretationMode,
      temporalConfidence: start.temporalConfidence,
      legacyRepairApplied: start.legacyRepairApplied,
      warnings: start.warnings,
      reason: `Provider status ${event.status ?? 'unknown'} is authoritative.`,
    }
  }

  if (!Number.isFinite(startMs)) {
    return {
      lifecycle: 'UNKNOWN' as const,
      source: 'invalid_or_missing_start_time',
      statusFresh: false,
      canonicalStartTime: start.canonicalUtc,
      storedStartTime: start.storedUtc,
      providerTimezone: start.providerTimezone,
      displayTime: start.displayTime,
      displayTimezone: start.displayTimezone,
      interpretationMode: start.interpretationMode,
      temporalConfidence: start.temporalConfidence,
      legacyRepairApplied: start.legacyRepairApplied,
      warnings: start.warnings,
      reason: 'Game start time is missing or invalid.',
    }
  }

  const minutesUntilStart = Math.round((startMs - now.getTime()) / 60000)
  if (minutesUntilStart > MLB_STARTING_SOON_MINUTES) {
    return {
      lifecycle: 'PREGAME' as const,
      source: 'conservative_time_based',
      statusFresh: false,
      canonicalStartTime: start.canonicalUtc,
      storedStartTime: start.storedUtc,
      providerTimezone: start.providerTimezone,
      displayTime: start.displayTime,
      displayTimezone: start.displayTimezone,
      interpretationMode: start.interpretationMode,
      temporalConfidence: start.temporalConfidence,
      legacyRepairApplied: start.legacyRepairApplied,
      warnings: start.warnings,
      reason: 'Game has not reached the starting-soon window.',
    }
  }
  if (minutesUntilStart > 0) {
    return {
      lifecycle: 'STARTING_SOON' as const,
      source: 'conservative_time_based',
      statusFresh: false,
      canonicalStartTime: start.canonicalUtc,
      storedStartTime: start.storedUtc,
      providerTimezone: start.providerTimezone,
      displayTime: start.displayTime,
      displayTimezone: start.displayTimezone,
      interpretationMode: start.interpretationMode,
      temporalConfidence: start.temporalConfidence,
      legacyRepairApplied: start.legacyRepairApplied,
      warnings: start.warnings,
      reason: 'Game is within the starting-soon window.',
    }
  }
  if (minutesUntilStart >= -MLB_TIME_BASED_LIVE_INFERENCE_MAX_MINUTES) {
    return {
      lifecycle: 'STATUS_UNCONFIRMED' as const,
      source: 'time_based_status_unconfirmed',
      statusFresh: false,
      canonicalStartTime: start.canonicalUtc,
      storedStartTime: start.storedUtc,
      providerTimezone: start.providerTimezone,
      displayTime: start.displayTime,
      displayTimezone: start.displayTimezone,
      interpretationMode: start.interpretationMode,
      temporalConfidence: start.temporalConfidence,
      legacyRepairApplied: start.legacyRepairApplied,
      warnings: start.warnings,
      reason: `Game start time passed, but provider status is not fresh; time-only live inference is capped at ${MLB_TIME_BASED_LIVE_INFERENCE_MAX_MINUTES} minutes.`,
    }
  }
  return {
    lifecycle: 'STATUS_UNCONFIRMED' as const,
    source: 'stale_status_after_start',
    statusFresh: false,
    canonicalStartTime: start.canonicalUtc,
    storedStartTime: start.storedUtc,
    providerTimezone: start.providerTimezone,
    displayTime: start.displayTime,
    displayTimezone: start.displayTimezone,
    interpretationMode: start.interpretationMode,
    temporalConfidence: start.temporalConfidence,
    legacyRepairApplied: start.legacyRepairApplied,
    warnings: start.warnings,
    reason: 'Game start time has passed, but final/live state is not inferred from elapsed time.',
  }
}

export function eligibilityFromLifecycle({
  lifecycle,
  hasOdds,
  hasPrediction,
  stale,
}: {
  lifecycle: MlbGameLifecycle
  hasOdds?: boolean
  hasPrediction?: boolean
  stale?: boolean
}): MlbAnalysisEligibility {
  if (['LIVE', 'DELAYED', 'SUSPENDED', 'POSTPONED', 'CANCELED'].includes(lifecycle)) return 'LOCKED'
  if (lifecycle === 'FINAL') return 'SETTLEMENT_PENDING'
  if (lifecycle === 'UNKNOWN' || lifecycle === 'STATUS_UNCONFIRMED') return 'STATUS_UNCONFIRMED'
  if (stale) return 'STALE'
  if (!hasOdds || !hasPrediction) return 'INSUFFICIENT_DATA'
  return lifecycle === 'PREGAME' || lifecycle === 'STARTING_SOON' ? 'READY' : 'UNSUPPORTED'
}

export function isMlbPregameEligible(event: MlbLifecycleInput, now = new Date()) {
  const state = resolveMlbGameLifecycle(event, now)
  return state.lifecycle === 'PREGAME' || state.lifecycle === 'STARTING_SOON'
}

export function validateMlbLifecycleFixtures() {
  const base = {
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    start_time: '2026-07-19T12:15:00.000Z',
    metadata: { provider: 'sportsdataio', provider_variant: 'sportsdataio_discovery_lab', providerDateTimeRaw: '2026-07-19T12:15:00', rawFieldNames: ['DateTime'] },
  }
  const now = new Date('2026-07-19T15:00:00.000Z')
  const checks = [
    ['legacy time repair prevents premature live', resolveMlbGameLifecycle({ ...base, status: 'Scheduled' }, now).lifecycle === 'PREGAME'],
    ['stale scheduled after first pitch is unconfirmed', resolveMlbGameLifecycle({ ...base, status: 'Scheduled' }, new Date('2026-07-19T16:30:00.000Z')).lifecycle === 'STATUS_UNCONFIRMED'],
    ['future stale scheduled is time-based pregame', resolveMlbGameLifecycle({ ...base, status: 'Scheduled' }, new Date('2026-07-19T15:00:00.000Z')).source === 'conservative_time_based'],
    ['starting soon is separate from live', resolveMlbGameLifecycle({ ...base, status: null }, new Date('2026-07-19T15:45:00.000Z')).lifecycle === 'STARTING_SOON'],
    ['post-start stale status is unconfirmed', resolveMlbGameLifecycle({ ...base, status: null }, new Date('2026-07-19T16:30:00.000Z')).lifecycle === 'STATUS_UNCONFIRMED'],
    ['official live can be live', resolveMlbGameLifecycle({ ...base, status: 'InProgress', updated_at: '2026-07-19T16:16:00.000Z' }, new Date('2026-07-19T16:17:00.000Z')).lifecycle === 'LIVE'],
    ['delayed locks', eligibilityFromLifecycle({ lifecycle: 'DELAYED', hasOdds: true, hasPrediction: true }) === 'LOCKED'],
    ['postponed locks', eligibilityFromLifecycle({ lifecycle: 'POSTPONED', hasOdds: true, hasPrediction: true }) === 'LOCKED'],
    ['suspended locks', eligibilityFromLifecycle({ lifecycle: 'SUSPENDED', hasOdds: true, hasPrediction: true }) === 'LOCKED'],
    ['final awaits settlement', eligibilityFromLifecycle({ lifecycle: 'FINAL', hasOdds: true, hasPrediction: true }) === 'SETTLEMENT_PENDING'],
    ['ready requires pregame inputs', eligibilityFromLifecycle({ lifecycle: 'PREGAME', hasOdds: true, hasPrediction: true }) === 'READY'],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_game_lifecycle_fixtures_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    maxTimeBasedLiveInferenceMinutes: MLB_TIME_BASED_LIVE_INFERENCE_MAX_MINUTES,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
