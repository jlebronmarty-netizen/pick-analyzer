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

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ')
}

export function isSportEventCanonicalStatus(value: unknown): value is SportEventCanonicalStatus {
  return SPORT_EVENT_ALLOWED_STATUSES.includes(value as SportEventCanonicalStatus)
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
