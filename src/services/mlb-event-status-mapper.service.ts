import 'server-only'

export const SPORT_EVENT_ALLOWED_STATUSES = ['scheduled', 'live', 'completed', 'postponed', 'cancelled'] as const

export type SportEventCanonicalStatus = typeof SPORT_EVENT_ALLOWED_STATUSES[number]

export type MlbStatsStatusInput = {
  abstractGameState?: string | null
  detailedState?: string | null
  codedGameState?: string | null
  statusCode?: string | null
}

export type MlbStatsStatusMapping = {
  ok: boolean
  status: SportEventCanonicalStatus | null
  lifecycle:
    | 'SCHEDULED'
    | 'LIVE'
    | 'FINAL'
    | 'POSTPONED'
    | 'CANCELLED'
    | 'DELAYED'
    | 'SUSPENDED'
    | 'STATUS_UNCONFIRMED'
    | 'UNKNOWN'
  rawStatus: {
    abstractGameState: string | null
    detailedState: string | null
    codedGameState: string | null
    statusCode: string | null
  }
  reason: string
}

export type SportEventStatusWriteTrace = {
  provider: string
  functionName: string
  file: string
  line: number | null
  eventId: string | null
  providerEventId: string | number | null
  rawProviderStatus: unknown
  mappedStatus: unknown
  attemptedDbStatus: unknown
  attemptedAllowed: boolean
  finalDbStatus: SportEventCanonicalStatus | null
  allowed: boolean
  reason: string | null
}

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ')
}

export function isSportEventCanonicalStatus(value: unknown): value is SportEventCanonicalStatus {
  return SPORT_EVENT_ALLOWED_STATUSES.includes(value as SportEventCanonicalStatus)
}

export function mapSportEventStatusToDbStatus(value: unknown): SportEventCanonicalStatus | null {
  const status = normalize(typeof value === 'string' ? value : value === null || value === undefined ? null : String(value))
  if (isSportEventCanonicalStatus(status)) return status
  if (['final', 'complete', 'closed', 'finished', 'game over', 'game complete', 'f'].includes(status)) return 'completed'
  if (['in progress', 'inprogress', 'started', 'i'].includes(status)) return 'live'
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled'
  if (['postponed', 'delayed', 'suspended'].includes(status)) return 'postponed'
  if (['scheduled', 'pregame', 'pre game', 'pre-game', 'warmup', 'pending', 'planned', 'preview', 'p', 's', ''].includes(status)) return 'scheduled'
  return null
}

export function traceSportEventStatusWrite(input: {
  provider: string
  functionName: string
  file: string
  line?: number | null
  eventId?: string | null
  providerEventId?: string | number | null
  rawProviderStatus?: unknown
  mappedStatus?: unknown
  dbStatus: unknown
}): SportEventStatusWriteTrace {
  const attemptedAllowed = isSportEventCanonicalStatus(normalize(typeof input.dbStatus === 'string' ? input.dbStatus : String(input.dbStatus ?? '')))
  const finalDbStatus = mapSportEventStatusToDbStatus(input.dbStatus)
  const trace: SportEventStatusWriteTrace = {
    provider: input.provider,
    functionName: input.functionName,
    file: input.file,
    line: input.line ?? null,
    eventId: input.eventId ?? null,
    providerEventId: input.providerEventId ?? null,
    rawProviderStatus: input.rawProviderStatus ?? null,
    mappedStatus: input.mappedStatus ?? null,
    attemptedDbStatus: input.dbStatus,
    attemptedAllowed,
    finalDbStatus,
    allowed: finalDbStatus !== null,
    reason: finalDbStatus ? null : `Invalid sport_events.status "${String(input.dbStatus)}".`,
  }
  if (process.env.SPORT_EVENT_STATUS_DEBUG === 'true') {
    console.info('[sport_events.status.write]', JSON.stringify(trace))
  }
  return trace
}

export function assertSportEventStatusWrite(input: Parameters<typeof traceSportEventStatusWrite>[0]): SportEventCanonicalStatus {
  const trace = traceSportEventStatusWrite(input)
  if (!trace.allowed || !trace.finalDbStatus) {
    throw new Error(trace.reason ?? 'Invalid sport_events.status write.')
  }
  return trace.finalDbStatus
}

export function mapMlbStatsStatusToSportEventStatus(input: MlbStatsStatusInput | null | undefined): MlbStatsStatusMapping {
  const rawStatus = {
    abstractGameState: input?.abstractGameState ?? null,
    detailedState: input?.detailedState ?? null,
    codedGameState: input?.codedGameState ?? null,
    statusCode: input?.statusCode ?? null,
  }
  const detailed = normalize(rawStatus.detailedState)
  const abstract = normalize(rawStatus.abstractGameState)
  const coded = normalize(rawStatus.codedGameState ?? rawStatus.statusCode)
  const joined = [detailed, abstract, coded].filter(Boolean).join(' ')

  if (!joined) {
    return { ok: true, status: 'scheduled', lifecycle: 'STATUS_UNCONFIRMED', rawStatus, reason: 'Provider returned no status text; event remains visible as scheduled with unconfirmed lifecycle evidence.' }
  }
  if (joined.includes('postpon')) {
    return { ok: true, status: 'postponed', lifecycle: 'POSTPONED', rawStatus, reason: 'MLB Stats API status maps to postponed.' }
  }
  if (joined.includes('cancel') || joined.includes('cancelled')) {
    return { ok: true, status: 'cancelled', lifecycle: 'CANCELLED', rawStatus, reason: 'MLB Stats API status maps to cancelled.' }
  }
  if (joined.includes('suspend')) {
    return { ok: true, status: 'postponed', lifecycle: 'SUSPENDED', rawStatus, reason: 'Suspended MLB game is stored as postponed because sport_events has no suspended DB status; raw provider status is preserved in metadata.' }
  }
  if (joined.includes('delay') || joined.includes('rain delay')) {
    return { ok: true, status: 'postponed', lifecycle: 'DELAYED', rawStatus, reason: 'Delayed MLB game is stored as postponed because sport_events has no delayed DB status; raw provider status is preserved in metadata.' }
  }
  if (abstract === 'final' || detailed.includes('final') || detailed.includes('game over') || detailed.includes('completed') || coded === 'f') {
    return { ok: true, status: 'completed', lifecycle: 'FINAL', rawStatus, reason: 'MLB Stats API final status maps to completed.' }
  }
  if (abstract === 'live' || detailed.includes('in progress') || detailed.includes('manager challenge') || detailed.includes('review') || coded === 'i') {
    return { ok: true, status: 'live', lifecycle: 'LIVE', rawStatus, reason: 'MLB Stats API live status maps to live.' }
  }
  if (detailed.includes('warmup') || abstract === 'preview' || detailed.includes('scheduled') || detailed.includes('pre game') || detailed.includes('pre-game') || coded === 'p' || coded === 's') {
    return { ok: true, status: 'scheduled', lifecycle: 'SCHEDULED', rawStatus, reason: 'MLB Stats API pregame status maps to scheduled.' }
  }
  if (joined.includes('unknown') || joined.includes('tbd') || joined.includes('unconfirmed')) {
    return { ok: true, status: 'scheduled', lifecycle: 'STATUS_UNCONFIRMED', rawStatus, reason: 'Unknown provider status remains visible as scheduled with unconfirmed lifecycle evidence.' }
  }

  return { ok: false, status: null, lifecycle: 'UNKNOWN', rawStatus, reason: `Unsupported MLB Stats API status "${joined}" cannot be persisted to sport_events.status.` }
}

export function mapMlbStatsGameToSportEventStatus(game: { status?: MlbStatsStatusInput | null } | null | undefined) {
  return mapMlbStatsStatusToSportEventStatus(game?.status)
}

export function validateSportEventStatusWriteTracingFixtures() {
  const traces = [
    traceSportEventStatusWrite({
      provider: 'MLB Stats API',
      functionName: 'refreshMlbGameStatuses',
      file: 'src/services/operating-day.service.ts',
      line: 636,
      eventId: 'fixture-event',
      providerEventId: 1,
      rawProviderStatus: 'Final',
      mappedStatus: 'completed',
      dbStatus: 'final',
    }),
    traceSportEventStatusWrite({
      provider: 'MLB Stats API',
      functionName: 'refreshMlbGameStatuses',
      file: 'src/services/operating-day.service.ts',
      line: 636,
      eventId: 'fixture-event',
      providerEventId: 1,
      rawProviderStatus: 'Final',
      mappedStatus: 'completed',
      dbStatus: 'completed',
    }),
    traceSportEventStatusWrite({
      provider: 'MLB Stats API',
      functionName: 'syncRecentResults',
      file: 'src/services/results-sync.service.ts',
      line: 630,
      eventId: 'fixture-event',
      providerEventId: 1,
      rawProviderStatus: 'In Progress',
      mappedStatus: 'live',
      dbStatus: 'in_progress',
    }),
  ]
  const checks = [
    ['legacy final write is traced as invalid before canonical conversion', traces[0].attemptedAllowed === false && traces[0].finalDbStatus === 'completed'],
    ['canonical completed write is allowed', traces[1].allowed && traces[1].finalDbStatus === 'completed'],
    ['legacy in_progress write is invalid before canonical conversion', traces[2].attemptedAllowed === false && traces[2].finalDbStatus === 'live'],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'sport_event_status_write_tracing_fixtures_v1',
    allowedValues: SPORT_EVENT_ALLOWED_STATUSES,
    traces,
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
