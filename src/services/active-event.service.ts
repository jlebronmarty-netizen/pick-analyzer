import 'server-only'

export const ACTIVE_EVENT_TIMEZONE = 'America/Puerto_Rico'

export type ActiveEventLike = {
  sport_key?: string | null
  sportKey?: string | null
  league_key?: string | null
  leagueKey?: string | null
  start_time?: string | null
  startTime?: string | null
  status?: string | null
  metadata?: Record<string, unknown> | null
}

export function normalizeEventStatus(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

export function isFinalEventStatus(value: string | null | undefined) {
  return ['final', 'completed', 'closed', 'complete'].includes(normalizeEventStatus(value))
}

export function isLiveEventStatus(value: string | null | undefined) {
  return ['live', 'in_progress', 'inprogress', 'started'].includes(normalizeEventStatus(value))
}

export function isPostponedEventStatus(value: string | null | undefined) {
  return ['postponed', 'suspended', 'delayed'].includes(normalizeEventStatus(value))
}

export function isCanceledEventStatus(value: string | null | undefined) {
  return ['cancelled', 'canceled'].includes(normalizeEventStatus(value))
}

export function isInactiveEventStatus(value: string | null | undefined) {
  return (
    isFinalEventStatus(value) ||
    isLiveEventStatus(value) ||
    isPostponedEventStatus(value) ||
    isCanceledEventStatus(value)
  )
}

export function puertoRicoUtcRange(localDate: string) {
  const start = new Date(`${localDate}T04:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return {
    localDate,
    timezone: ACTIVE_EVENT_TIMEZONE,
    utcStart: start.toISOString(),
    utcEndExclusive: end.toISOString(),
  }
}

export function puertoRicoLocalDateFromUtc(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  return new Date(parsed.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function isActiveBettingEvent(
  event: ActiveEventLike,
  {
    sportKey,
    leagueKey,
    now = new Date(),
  }: {
    sportKey: string
    leagueKey?: string | null
    now?: Date
  }
) {
  const eventSport = event.sport_key ?? event.sportKey
  const eventLeague = event.league_key ?? event.leagueKey
  const startTime = event.start_time ?? event.startTime
  const startMs = startTime ? new Date(startTime).getTime() : Number.NaN
  const metadata = event.metadata ?? {}

  if (eventSport !== sportKey) return false
  if (leagueKey && eventLeague && eventLeague !== leagueKey) return false
  if (!Number.isFinite(startMs) || startMs <= now.getTime()) return false
  if (isInactiveEventStatus(event.status)) return false
  if (metadata.historical_only === true || metadata.historicalOnly === true) return false
  if (metadata.recommendationsLocked === true || metadata.recommendations_locked === true) return false
  return true
}

export function activeEventBlockingReasons(
  event: ActiveEventLike,
  {
    sportKey,
    leagueKey,
    now = new Date(),
  }: {
    sportKey: string
    leagueKey?: string | null
    now?: Date
  }
) {
  const reasons: string[] = []
  const eventSport = event.sport_key ?? event.sportKey
  const eventLeague = event.league_key ?? event.leagueKey
  const startTime = event.start_time ?? event.startTime
  const startMs = startTime ? new Date(startTime).getTime() : Number.NaN
  const metadata = event.metadata ?? {}

  if (eventSport !== sportKey) reasons.push('SPORT_MISMATCH')
  if (leagueKey && eventLeague && eventLeague !== leagueKey) reasons.push('LEAGUE_MISMATCH')
  if (!Number.isFinite(startMs)) reasons.push('MISSING_START_TIME')
  else if (startMs <= now.getTime()) reasons.push('EVENT_STARTED')
  if (isFinalEventStatus(event.status)) reasons.push('EVENT_FINAL')
  if (isLiveEventStatus(event.status)) reasons.push('EVENT_IN_PROGRESS')
  if (isPostponedEventStatus(event.status)) reasons.push('EVENT_POSTPONED_OR_SUSPENDED')
  if (isCanceledEventStatus(event.status)) reasons.push('EVENT_CANCELED')
  if (metadata.historical_only === true || metadata.historicalOnly === true) reasons.push('HISTORICAL_ONLY')
  if (metadata.recommendationsLocked === true || metadata.recommendations_locked === true) reasons.push('RECOMMENDATIONS_LOCKED')
  return reasons
}
