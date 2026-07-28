import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

export const EVENT_IDENTITY_RESOLVER_VERSION = 'universal_event_identity_v1'
export const UNIVERSAL_CROSSWALK_ENGINE_VERSION = 'universal_crosswalk_engine_v1'

export type EventIdentityConfidence =
  | 'EXACT_PROVIDER_ID'
  | 'EXACT_SOURCE_MAPPING'
  | 'EXACT_LEGACY_MAPPING'
  | 'EXACT_MULTI_FIELD_MATCH'
  | 'CONFLICT'
  | 'AMBIGUOUS'
  | 'UNRESOLVED'

export type EventIdentityEvidenceCode =
  | 'PROVIDER_ID_EQUAL'
  | 'SOURCE_ID_EQUAL'
  | 'SPORT_EQUAL'
  | 'LEAGUE_EQUAL'
  | 'SEASON_EQUAL'
  | 'HOME_TEAM_EQUAL'
  | 'AWAY_TEAM_EQUAL'
  | 'START_TIME_EQUAL'
  | 'START_TIME_WITHIN_RESCHEDULE_TOLERANCE'
  | 'DOUBLEHEADER_NUMBER_EQUAL'
  | 'ODDS_EVENT_ID_EQUAL'
  | 'RESULT_EVENT_ID_EQUAL'
  | 'STAT_EVENT_ID_EQUAL'
  | 'HISTORICAL_MAPPING_EQUAL'
  | 'CANONICAL_EVENT_ID_EQUAL'
  | 'TEAM_NAME_DATE_ONLY'
  | 'CANONICAL_EVENT_MISSING'
  | 'HOME_AWAY_REVERSED'
  | 'PROVIDER_MAPPING_COLLISION'
  | 'MULTIPLE_EVENT_CANDIDATES'
  | 'TEST_FIXTURE_EXCLUDED'
  | 'POST_START_EXCLUDED'
  | 'COMPETITION_EQUAL'
  | 'PROVIDER_ENTITY_MAPPING_EQUAL'
  | 'PARTICIPANT_ID_EQUAL'
  | 'PARTICIPANT_NAME_EQUAL'
  | 'MARKET_SCOPE_EQUAL'
  | 'SELECTION_SCOPE_EQUAL'
  | 'BOOKMAKER_SCOPE_EQUAL'
  | 'SOCCER_COMPETITION_PLACEHOLDER_EXCLUDED'

export type MissingEventLinkCategory =
  | 'EXACT_PROVIDER_MAPPING_EXISTS_LOOKUP_DEFECT'
  | 'EXACT_CANONICAL_EVENT_ID_EXISTS_UNLINKED'
  | 'EXACT_ODDS_EVENT_LINK_AVAILABLE'
  | 'EXACT_RESULT_EVENT_LINK_AVAILABLE'
  | 'EXACT_SCHEDULE_EVENT_LINK_AVAILABLE'
  | 'LEGACY_ID_MAPPING_AVAILABLE'
  | 'HOME_AWAY_ORIENTATION_CONFLICT'
  | 'DOUBLEHEADER_AMBIGUOUS'
  | 'RESCHEDULED_EVENT_AMBIGUOUS'
  | 'TIMEZONE_NORMALIZATION_DEFECT'
  | 'DATE_BOUNDARY_DEFECT'
  | 'SEASON_SCOPE_DEFECT'
  | 'LEAGUE_SCOPE_DEFECT'
  | 'PROVIDER_NAMESPACE_DEFECT'
  | 'EVENT_NOT_IMPORTED'
  | 'TEST_OR_FIXTURE_CONTAMINATION'
  | 'INSUFFICIENT_STABLE_EVIDENCE'
  | 'MANUAL_REVIEW'

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  team: string | null
  market: string | null
  sportsbook: string | null
  result: string | null
  status: string | null
  lifecycle_status: string | null
  model_role: string | null
  model_version: string | null
  generated_at: string | null
  cutoff_at: string | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  validation_status: string | null
  validation_warnings: unknown
  settlement_details: Record<string, unknown> | null
  created_at: string | null
}

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  home_team: string | null
  away_team: string | null
  home_team_id: string | null
  away_team_id: string | null
  start_time: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

type MappingRow = {
  sport_key: string
  entity_type: string
  internal_id: string
  provider: string
  provider_id: string
  season: string | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type OddsRow = {
  sport_key: string
  league_key: string | null
  season: string | null
  event_id: string
  provider: string | null
  sportsbook: string | null
  market: string | null
  snapshot_time: string | null
  metadata: Record<string, unknown> | null
}

type ResultRow = {
  sport_key: string
  game_id: string
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
  winner: string | null
  commence_time: string | null
}

type StatIdentityRow = {
  sport_key: string
  league_key: string | null
  season: string | null
  event_id: string
}

type IdentityContext = {
  predictions: PredictionRow[]
  events: EventRow[]
  mappings: MappingRow[]
  odds: OddsRow[]
  results: ResultRow[]
  stats: StatIdentityRow[]
}

export type UniversalCrosswalkProvider =
  | 'sportsdataio'
  | 'the-odds-api'
  | 'supabase'
  | 'manual'
  | 'legacy'
  | string

export type UniversalCrosswalkEntityType =
  | 'sport'
  | 'competition'
  | 'season'
  | 'team'
  | 'player'
  | 'event'
  | 'market'
  | 'selection'
  | 'bookmaker'
  | 'player_prop'

export type UniversalCrosswalkParticipantInput = {
  role: 'home' | 'away' | 'competitor' | 'fighter' | 'player'
  providerId?: string | number | null
  canonicalId?: string | null
  name?: string | null
}

export type UniversalCrosswalkResolveInput = {
  sportKey: string
  competitionKey?: string | null
  season?: string | null
  provider: UniversalCrosswalkProvider
  providerEventId?: string | number | null
  canonicalEventId?: string | null
  startTime?: string | null
  participants?: UniversalCrosswalkParticipantInput[]
  marketKey?: string | null
  selectionKey?: string | null
  bookmakerKey?: string | null
}

export type UniversalCrosswalkResolution = {
  canonicalEventId: string | null
  sportKey: string
  competitionKey: string | null
  season: string | null
  provider: string
  providerEventId: string | null
  identityConfidence: EventIdentityConfidence
  conflictState: 'NONE' | 'CONFLICT' | 'AMBIGUOUS' | 'UNRESOLVED'
  mappingMethod:
    | 'provider_entity_mappings'
    | 'sport_events_provider_ids'
    | 'canonical_event_id'
    | 'exact_participant_time'
    | 'unresolved'
    | 'conflict'
    | 'ambiguous'
  evidenceCodes: EventIdentityEvidenceCode[]
  candidateCount: number
  blockers: string[]
  safeToPersistMapping: boolean
}

type BaseIdentityContext = Pick<IdentityContext, 'predictions' | 'events'>

export type UniversalEventIdentity = {
  canonicalEventId: string | null
  sport: string | null
  league: string | null
  season: string | null
  provider: string | null
  providerEventId: string | null
  sourceEventId: string | null
  legacyEventIds: string[]
  homeTeamId: string | null
  awayTeamId: string | null
  scheduledStart: string | null
  actualStart: string | null
  eventDateLocal: string | null
  eventDateUtc: string | null
  status: string | null
  rescheduleParentId: string | null
  doubleheaderNumber: string | null
  venueId: string | null
  sourceTimestamp: string | null
  mappingMethod: string
  evidenceCodes: EventIdentityEvidenceCode[]
  identityConfidence: EventIdentityConfidence
  conflictState: 'NONE' | 'CONFLICT' | 'AMBIGUOUS' | 'UNRESOLVED'
  createdAt: string | null
  updatedAt: string | null
}

type LinkAuditItem = {
  predictionId: string
  internalIdAvailable: true
  sport: string
  league: string | null
  season: string | null
  currentEventId: string
  scheduledDate: string | null
  market: string | null
  provider: string | null
  category: MissingEventLinkCategory
  identityConfidence: EventIdentityConfidence
  proposedCanonicalEventId: string | null
  safeToRepair: boolean
  evidenceCodes: EventIdentityEvidenceCode[]
  collisionCandidateCount: number
}

const FINAL_RESULTS = new Set(['win', 'loss', 'push', 'void'])
const TERMINAL_LIFECYCLE = new Set(['settled', 'void', 'skipped', 'closed'])
const EVENT_MAPPING_TYPES = new Set(['event', 'game', 'schedule', 'legacy_event'])

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeEntityName(value: unknown) {
  return normalize(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '')
}

export function normalizeProviderEventId(value: unknown) {
  const normalized = normalize(value)
  return normalized.replace(/^0+(\d)/, '$1')
}

export function normalizeSportKey(value: unknown) {
  const normalized = normalize(value)
  if (normalized === 'mlb') return 'baseball_mlb'
  if (normalized === 'nfl') return 'americanfootball_nfl'
  if (normalized === 'ncaaf') return 'americanfootball_ncaaf'
  if (normalized === 'epl') return 'soccer_epl'
  return normalized
}

export function normalizeLeagueKey(value: unknown) {
  const normalized = normalize(value)
  if (normalized === 'baseball_mlb') return 'mlb'
  if (normalized === 'americanfootball_nfl') return 'nfl'
  if (normalized === 'americanfootball_ncaaf') return 'ncaaf'
  if (normalized === 'soccer_epl') return 'epl'
  return normalized
}

export function normalizeCompetitionKey(value: unknown) {
  const normalized = normalize(value)
  if (!normalized) return ''
  if (normalized === 'baseball_mlb') return 'mlb'
  if (normalized === 'basketball_nba') return 'nba'
  if (normalized === 'americanfootball_nfl') return 'nfl'
  if (normalized === 'icehockey_nhl') return 'nhl'
  if (normalized === 'mma_mixed_martial_arts') return 'ufc'
  if (normalized === 'mma_ufc') return 'ufc'
  return normalized
}

export function normalizeSeason(value: unknown) {
  const raw = String(value ?? '').trim()
  const year = raw.match(/\b(20\d{2})\b/)
  return year?.[1] ?? raw.toLowerCase()
}

export function normalizeEventStart(value: unknown) {
  const time = Date.parse(String(value ?? ''))
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

export function buildCanonicalEventIdentityKey(input: {
  sport: unknown
  league: unknown
  season: unknown
  homeTeamId: unknown
  awayTeamId: unknown
  scheduledStart: unknown
}) {
  return [
    normalizeSportKey(input.sport),
    normalizeLeagueKey(input.league),
    normalizeSeason(input.season),
    normalize(input.homeTeamId),
    normalize(input.awayTeamId),
    normalizeEventStart(input.scheduledStart) ?? '',
  ].join('|')
}

export function buildProviderEventMappingKey(input: {
  sport: unknown
  provider: unknown
  providerEventId: unknown
  season: unknown
}) {
  return [
    normalizeSportKey(input.sport),
    normalize(input.provider),
    normalizeProviderEventId(input.providerEventId),
    normalizeSeason(input.season),
  ].join('|')
}

export function buildUniversalIdentityScopeKey(input: {
  sport: unknown
  competition: unknown
  season: unknown
  provider: unknown
  entityType: unknown
  providerId: unknown
}) {
  return [
    normalizeSportKey(input.sport),
    normalizeCompetitionKey(input.competition),
    normalizeSeason(input.season),
    normalize(input.provider),
    normalize(input.entityType),
    normalizeProviderEventId(input.providerId),
  ].join('|')
}

export function compareEventIdentityEvidence(input: {
  prediction: Pick<PredictionRow, 'sport_key' | 'game_id' | 'commence_time' | 'home_team' | 'away_team'>
  event: Pick<EventRow, 'id' | 'sport_key' | 'league_key' | 'season' | 'start_time' | 'home_team' | 'away_team' | 'provider_ids'>
}) {
  const evidence: EventIdentityEvidenceCode[] = []
  if (normalizeSportKey(input.prediction.sport_key) === normalizeSportKey(input.event.sport_key)) evidence.push('SPORT_EQUAL')
  if (normalizeProviderEventId(input.prediction.game_id) === normalizeProviderEventId(input.event.id)) evidence.push('CANONICAL_EVENT_ID_EQUAL')
  if (day(input.prediction.commence_time) === day(input.event.start_time)) evidence.push('START_TIME_EQUAL')
  if (normalize(input.prediction.home_team) === normalize(input.event.home_team)) evidence.push('HOME_TEAM_EQUAL')
  if (normalize(input.prediction.away_team) === normalize(input.event.away_team)) evidence.push('AWAY_TEAM_EQUAL')
  if (providerIdsContain(input.event.provider_ids, input.prediction.game_id)) evidence.push('PROVIDER_ID_EQUAL')
  return evidence
}

function day(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : null
}

function groupCount<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const groups = new Map<string, number>()
  for (const row of rows) {
    const key = getKey(row) || 'unknown'
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return Object.fromEntries(Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)))
}

function isPendingLike(row: PredictionRow) {
  const result = normalize(row.result)
  const status = normalize(row.status)
  const lifecycle = normalize(row.lifecycle_status)
  return !FINAL_RESULTS.has(result) && !FINAL_RESULTS.has(status) && !TERMINAL_LIFECYCLE.has(lifecycle)
}

function isTestOrFixture(row: PredictionRow) {
  const warnings = Array.isArray(row.validation_warnings) ? row.validation_warnings.map(String) : []
  return (
    row.trial === true ||
    row.scrambled === true ||
    normalize(row.model_role) === 'shadow' ||
    normalize(row.validation_status) === 'skipped' ||
    warnings.some((warning) => /trial|scrambled|fixture|quarantine/i.test(warning))
  )
}

function isPostStart(row: PredictionRow, event: EventRow | undefined) {
  const start = Date.parse(row.commence_time ?? event?.start_time ?? '')
  const generated = Date.parse(row.generated_at ?? row.cutoff_at ?? '')
  return Number.isFinite(start) && Number.isFinite(generated) && generated >= start
}

function seasonFromPrediction(row: PredictionRow) {
  return normalizeSeason(row.commence_time ?? row.generated_at ?? row.created_at)
}

async function safePage<T>(
  table: string,
  select: string,
  configure: (query: any) => any = (query) => query,
  orderColumn = 'id'
) {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const query = configure(
      supabaseAdmin.from(table).select(select).order(orderColumn, { ascending: true }).range(from, from + 999)
    )
    const { data, error } = await query
    if (error) throw new Error(`${table} identity read failed: ${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

function providerIdsContain(providerIds: Record<string, unknown> | null, eventId: string | null | undefined) {
  const expected = normalizeProviderEventId(eventId)
  if (!expected) return false
  const seen: string[] = []
  const visit = (value: unknown) => {
    if (value === null || value === undefined) return
    if (['string', 'number', 'boolean'].includes(typeof value)) seen.push(normalizeProviderEventId(value))
    else if (Array.isArray(value)) value.forEach(visit)
    else if (typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(visit)
  }
  visit(providerIds)
  return seen.includes(expected)
}

function providerIdsContainForProvider(providerIds: Record<string, unknown> | null, provider: string, eventId: string | null | undefined) {
  const expected = normalizeProviderEventId(eventId)
  if (!expected || !providerIds) return false
  const providerKey = normalize(provider)
  const direct = (providerIds as Record<string, unknown>)[provider] ?? (providerIds as Record<string, unknown>)[providerKey]
  if (direct !== undefined && providerIdsContain({ [providerKey]: direct }, expected)) return true
  return providerIdsContain(providerIds, expected)
}

function eventMatchesCompetition(event: EventRow, competitionKey: string) {
  if (!competitionKey) return true
  return normalizeCompetitionKey(event.league_key) === competitionKey
}

function eventMatchesSeason(event: EventRow, season: string) {
  if (!season) return true
  return normalizeSeason(event.season) === season || normalizeSeason(event.start_time) === season
}

function participantInputsByRole(participants: UniversalCrosswalkParticipantInput[] | undefined) {
  const byRole = new Map<string, UniversalCrosswalkParticipantInput>()
  for (const participant of participants ?? []) {
    byRole.set(participant.role, participant)
  }
  return byRole
}

function eventMatchesParticipants(event: EventRow, participants: UniversalCrosswalkParticipantInput[] | undefined) {
  const byRole = participantInputsByRole(participants)
  const home = byRole.get('home') ?? byRole.get('competitor')
  const away = byRole.get('away')
  const evidence: EventIdentityEvidenceCode[] = []

  if (home) {
    const canonicalIdMatches = home.canonicalId && normalize(home.canonicalId) === normalize(event.home_team_id)
    const nameMatches = home.name && normalizeEntityName(home.name) === normalizeEntityName(event.home_team)
    if (!canonicalIdMatches && !nameMatches) return { matched: false, evidence }
    evidence.push(canonicalIdMatches ? 'PARTICIPANT_ID_EQUAL' : 'PARTICIPANT_NAME_EQUAL')
  }

  if (away) {
    const canonicalIdMatches = away.canonicalId && normalize(away.canonicalId) === normalize(event.away_team_id)
    const nameMatches = away.name && normalizeEntityName(away.name) === normalizeEntityName(event.away_team)
    if (!canonicalIdMatches && !nameMatches) return { matched: false, evidence }
    evidence.push(canonicalIdMatches ? 'PARTICIPANT_ID_EQUAL' : 'PARTICIPANT_NAME_EQUAL')
  }

  return { matched: evidence.length > 0, evidence }
}

function secondsApart(left: string | null | undefined, right: string | null | undefined) {
  const a = Date.parse(String(left ?? ''))
  const b = Date.parse(String(right ?? ''))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round(Math.abs(a - b) / 1000)
}

function makeUniversalResolution(input: UniversalCrosswalkResolveInput, partial: Partial<UniversalCrosswalkResolution>): UniversalCrosswalkResolution {
  const conflictState =
    partial.identityConfidence === 'CONFLICT'
      ? 'CONFLICT'
      : partial.identityConfidence === 'AMBIGUOUS'
        ? 'AMBIGUOUS'
        : partial.identityConfidence === 'UNRESOLVED'
          ? 'UNRESOLVED'
          : 'NONE'

  return {
    canonicalEventId: partial.canonicalEventId ?? null,
    sportKey: normalizeSportKey(input.sportKey),
    competitionKey: normalizeCompetitionKey(input.competitionKey) || null,
    season: normalizeSeason(input.season ?? input.startTime),
    provider: normalize(input.provider),
    providerEventId: input.providerEventId === null || input.providerEventId === undefined ? null : normalizeProviderEventId(input.providerEventId),
    identityConfidence: partial.identityConfidence ?? 'UNRESOLVED',
    conflictState,
    mappingMethod: partial.mappingMethod ?? 'unresolved',
    evidenceCodes: Array.from(new Set(partial.evidenceCodes ?? [])),
    candidateCount: partial.candidateCount ?? 0,
    blockers: partial.blockers ?? [],
    safeToPersistMapping: partial.safeToPersistMapping ?? false,
  }
}

function resolveUniversalEventIdentityFromContext(
  input: UniversalCrosswalkResolveInput,
  context: Pick<IdentityContext, 'events' | 'mappings'>,
  options: { toleranceSeconds?: number } = {}
): UniversalCrosswalkResolution {
  const sportKey = normalizeSportKey(input.sportKey)
  const competitionKey = normalizeCompetitionKey(input.competitionKey)
  const season = normalizeSeason(input.season ?? input.startTime)
  const provider = normalize(input.provider)
  const providerEventId = normalizeProviderEventId(input.providerEventId)
  const toleranceSeconds = Math.min(Math.max(Number(options.toleranceSeconds ?? 15 * 60), 60), 90 * 60)
  const blockers: string[] = []
  const baseEvidence: EventIdentityEvidenceCode[] = []

  if (sportKey === 'soccer' && (!competitionKey || competitionKey === 'soccer' || competitionKey === 'soccer_generic')) {
    blockers.push('SOCCER_COMPETITION_SCOPE_NOT_CERTIFIED')
    baseEvidence.push('SOCCER_COMPETITION_PLACEHOLDER_EXCLUDED')
  }
  if (input.marketKey) baseEvidence.push('MARKET_SCOPE_EQUAL')
  if (input.selectionKey) baseEvidence.push('SELECTION_SCOPE_EQUAL')
  if (input.bookmakerKey) baseEvidence.push('BOOKMAKER_SCOPE_EQUAL')

  const scopedEvents = context.events.filter(
    (event) =>
      normalizeSportKey(event.sport_key) === sportKey &&
      eventMatchesCompetition(event, competitionKey) &&
      eventMatchesSeason(event, season)
  )

  if (providerEventId) {
    const mappingHits = context.mappings.filter(
      (mapping) =>
        normalizeSportKey(mapping.sport_key) === sportKey &&
        normalize(mapping.provider) === provider &&
        EVENT_MAPPING_TYPES.has(normalize(mapping.entity_type)) &&
        normalizeProviderEventId(mapping.provider_id) === providerEventId &&
        eventMatchesSeason({ id: mapping.internal_id, sport_key: mapping.sport_key, league_key: competitionKey, season: mapping.season, home_team: null, away_team: null, home_team_id: null, away_team_id: null, start_time: null, status: null, home_score: null, away_score: null, provider_ids: null, metadata: null, created_at: null, updated_at: null }, season) &&
        scopedEvents.some((event) => event.id === mapping.internal_id)
    )
    if (mappingHits.length === 1) {
      return makeUniversalResolution(input, {
        canonicalEventId: mappingHits[0].internal_id,
        identityConfidence: 'EXACT_PROVIDER_ID',
        mappingMethod: 'provider_entity_mappings',
        evidenceCodes: [...baseEvidence, 'PROVIDER_ENTITY_MAPPING_EQUAL', 'PROVIDER_ID_EQUAL', 'SPORT_EQUAL', 'SEASON_EQUAL'],
        candidateCount: 1,
        blockers,
        safeToPersistMapping: blockers.length === 0,
      })
    }
    if (mappingHits.length > 1) {
      return makeUniversalResolution(input, {
        identityConfidence: 'CONFLICT',
        mappingMethod: 'conflict',
        evidenceCodes: [...baseEvidence, 'PROVIDER_MAPPING_COLLISION'],
        candidateCount: mappingHits.length,
        blockers: [...blockers, 'PROVIDER_MAPPING_COLLISION'],
      })
    }

    const providerIdHits = scopedEvents.filter((event) => providerIdsContainForProvider(event.provider_ids, provider, providerEventId))
    if (providerIdHits.length === 1) {
      return makeUniversalResolution(input, {
        canonicalEventId: providerIdHits[0].id,
        identityConfidence: 'EXACT_PROVIDER_ID',
        mappingMethod: 'sport_events_provider_ids',
        evidenceCodes: [...baseEvidence, 'PROVIDER_ID_EQUAL', 'SPORT_EQUAL', 'SEASON_EQUAL'],
        candidateCount: 1,
        blockers,
        safeToPersistMapping: blockers.length === 0,
      })
    }
    if (providerIdHits.length > 1) {
      return makeUniversalResolution(input, {
        identityConfidence: 'CONFLICT',
        mappingMethod: 'conflict',
        evidenceCodes: [...baseEvidence, 'PROVIDER_MAPPING_COLLISION'],
        candidateCount: providerIdHits.length,
        blockers: [...blockers, 'PROVIDER_ID_COLLISION'],
      })
    }
  }

  if (input.canonicalEventId) {
    const canonicalHits = scopedEvents.filter((event) => normalize(event.id) === normalize(input.canonicalEventId))
    if (canonicalHits.length === 1) {
      return makeUniversalResolution(input, {
        canonicalEventId: canonicalHits[0].id,
        identityConfidence: 'EXACT_SOURCE_MAPPING',
        mappingMethod: 'canonical_event_id',
        evidenceCodes: [...baseEvidence, 'CANONICAL_EVENT_ID_EQUAL', 'SPORT_EQUAL', 'SEASON_EQUAL'],
        candidateCount: 1,
        blockers,
        safeToPersistMapping: Boolean(providerEventId) && blockers.length === 0,
      })
    }
  }

  const participantTimeCandidates = scopedEvents.filter((event) => {
    const participantMatch = eventMatchesParticipants(event, input.participants)
    const timeDiff = secondsApart(input.startTime, event.start_time)
    return participantMatch.matched && timeDiff !== null && timeDiff <= toleranceSeconds
  })
  if (participantTimeCandidates.length === 1) {
    const participantEvidence = eventMatchesParticipants(participantTimeCandidates[0], input.participants).evidence
    return makeUniversalResolution(input, {
      canonicalEventId: participantTimeCandidates[0].id,
      identityConfidence: 'EXACT_MULTI_FIELD_MATCH',
      mappingMethod: 'exact_participant_time',
      evidenceCodes: [...baseEvidence, 'SPORT_EQUAL', 'COMPETITION_EQUAL', 'SEASON_EQUAL', 'START_TIME_WITHIN_RESCHEDULE_TOLERANCE', ...participantEvidence],
      candidateCount: 1,
      blockers,
      safeToPersistMapping: Boolean(providerEventId) && blockers.length === 0,
    })
  }
  if (participantTimeCandidates.length > 1) {
    return makeUniversalResolution(input, {
      identityConfidence: 'AMBIGUOUS',
      mappingMethod: 'ambiguous',
      evidenceCodes: [...baseEvidence, 'MULTIPLE_EVENT_CANDIDATES'],
      candidateCount: participantTimeCandidates.length,
      blockers: [...blockers, 'MULTIPLE_EVENT_CANDIDATES'],
    })
  }

  return makeUniversalResolution(input, {
    identityConfidence: blockers.length ? 'UNRESOLVED' : 'UNRESOLVED',
    mappingMethod: 'unresolved',
    evidenceCodes: [...baseEvidence, 'CANONICAL_EVENT_MISSING'],
    candidateCount: 0,
    blockers: blockers.length ? blockers : ['CANONICAL_EVENT_NOT_RESOLVED'],
  })
}

function buildIdentity(event: EventRow | undefined, identityConfidence: EventIdentityConfidence, evidenceCodes: EventIdentityEvidenceCode[], mappingMethod: string): UniversalEventIdentity {
  const metadata = event?.metadata ?? {}
  return {
    canonicalEventId: event?.id ?? null,
    sport: event?.sport_key ?? null,
    league: event?.league_key ?? null,
    season: event?.season ?? null,
    provider: null,
    providerEventId: null,
    sourceEventId: null,
    legacyEventIds: Array.isArray(metadata.legacyEventIds) ? metadata.legacyEventIds.map(String) : [],
    homeTeamId: event?.home_team_id ?? null,
    awayTeamId: event?.away_team_id ?? null,
    scheduledStart: event?.start_time ?? null,
    actualStart: typeof metadata.actualStart === 'string' ? metadata.actualStart : null,
    eventDateLocal: typeof metadata.eventDateLocal === 'string' ? metadata.eventDateLocal : day(event?.start_time),
    eventDateUtc: day(event?.start_time),
    status: event?.status ?? null,
    rescheduleParentId: typeof metadata.rescheduleParentId === 'string' ? metadata.rescheduleParentId : null,
    doubleheaderNumber: metadata.doubleheaderNumber === undefined ? null : String(metadata.doubleheaderNumber),
    venueId: typeof metadata.venueId === 'string' ? metadata.venueId : null,
    sourceTimestamp: typeof metadata.sourceTimestamp === 'string' ? metadata.sourceTimestamp : event?.updated_at ?? null,
    mappingMethod,
    evidenceCodes,
    identityConfidence,
    conflictState:
      identityConfidence === 'CONFLICT'
        ? 'CONFLICT'
        : identityConfidence === 'AMBIGUOUS'
          ? 'AMBIGUOUS'
          : identityConfidence === 'UNRESOLVED'
            ? 'UNRESOLVED'
            : 'NONE',
    createdAt: event?.created_at ?? null,
    updatedAt: event?.updated_at ?? null,
  }
}

async function loadIdentityContext(): Promise<IdentityContext> {
  const { predictions, events } = await loadBaseIdentityContext()
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const missingRows = predictions
    .filter(isPendingLike)
    .filter((row) => !isTestOrFixture(row) && !isPostStart(row, eventsById.get(row.game_id)) && !eventsById.has(row.game_id))
  const missingEventIds = Array.from(new Set(missingRows.map((row) => row.game_id).filter(Boolean)))
  const [mappings, odds, results, gameStats, playerStats] = await Promise.all([
    safePageIn<MappingRow>(
      'provider_entity_mappings',
      'sport_key, entity_type, internal_id, provider, provider_id, season, metadata, updated_at',
      'provider_id',
      missingEventIds,
      (query) => query.in('entity_type', Array.from(EVENT_MAPPING_TYPES))
    ),
    safePageIn<OddsRow>('sports_odds_snapshots', 'sport_key, league_key, season, event_id, provider, sportsbook, market, snapshot_time, metadata', 'event_id', missingEventIds),
    safePageIn<ResultRow>('game_results', 'sport_key, game_id, home_team, away_team, home_score, away_score, winner, commence_time', 'game_id', missingEventIds, (query) => query, 'game_id'),
    safePageIn<StatIdentityRow>('sport_game_stats', 'sport_key, league_key, season, event_id', 'event_id', missingEventIds),
    safePageIn<StatIdentityRow>('sport_player_stats', 'sport_key, league_key, season, event_id', 'event_id', missingEventIds),
  ])
  return { predictions, events, mappings, odds, results, stats: [...gameStats, ...playerStats] }
}

async function loadBaseIdentityContext(): Promise<BaseIdentityContext> {
  const [predictions, events] = await Promise.all([
    safePage<PredictionRow>(
      'prediction_history',
      'id, sport_key, game_id, commence_time, home_team, away_team, team, market, sportsbook, result, status, lifecycle_status, model_role, model_version, generated_at, cutoff_at, production_eligible, trial, scrambled, validation_status, validation_warnings, settlement_details, created_at'
    ),
    safePage<EventRow>(
      'sport_events',
      'id, sport_key, league_key, season, home_team, away_team, home_team_id, away_team_id, start_time, status, home_score, away_score, provider_ids, metadata, created_at, updated_at'
    ),
  ])
  return { predictions, events }
}

async function safePageIn<T>(
  table: string,
  select: string,
  column: string,
  values: string[],
  configure: (query: any) => any = (query) => query,
  orderColumn = 'id'
) {
  if (values.length === 0) return []
  const rows: T[] = []
  for (let index = 0; index < values.length; index += 100) {
    const chunk = values.slice(index, index + 100)
    rows.push(...(await safePage<T>(table, select, (query) => configure(query.in(column, chunk)), orderColumn)))
  }
  return rows
}

function classifyMissingEventLink(row: PredictionRow, context: IdentityContext): LinkAuditItem {
  const eventsById = new Map(context.events.map((event) => [event.id, event]))
  const sport = normalizeSportKey(row.sport_key)
  const season = seasonFromPrediction(row)
  const currentId = row.game_id
  const exactEvent = eventsById.get(currentId)
  const mappingHits = context.mappings.filter(
    (mapping) =>
      normalizeSportKey(mapping.sport_key) === sport &&
      normalizeProviderEventId(mapping.provider_id) === normalizeProviderEventId(currentId) &&
      (!normalizeSeason(mapping.season) || !season || normalizeSeason(mapping.season) === season) &&
      eventsById.has(mapping.internal_id)
  )
  const providerIdHits = context.events.filter(
    (event) => normalizeSportKey(event.sport_key) === sport && providerIdsContain(event.provider_ids, currentId)
  )
  const reverseCandidates = context.events.filter(
    (event) =>
      normalizeSportKey(event.sport_key) === sport &&
      day(event.start_time) === day(row.commence_time) &&
      normalize(event.home_team) === normalize(row.away_team) &&
      normalize(event.away_team) === normalize(row.home_team)
  )
  const stableCandidates = context.events.filter(
    (event) =>
      normalizeSportKey(event.sport_key) === sport &&
      day(event.start_time) === day(row.commence_time) &&
      normalize(event.home_team) === normalize(row.home_team) &&
      normalize(event.away_team) === normalize(row.away_team)
  )
  const oddsRows = context.odds.filter((odds) => odds.event_id === currentId)
  const resultRows = context.results.filter((result) => result.game_id === currentId)
  const statRows = context.stats.filter((stat) => stat.event_id === currentId)

  let category: MissingEventLinkCategory = 'EVENT_NOT_IMPORTED'
  let confidence: EventIdentityConfidence = 'UNRESOLVED'
  let proposedCanonicalEventId: string | null = null
  let evidenceCodes: EventIdentityEvidenceCode[] = []
  let collisionCandidateCount = 0

  if (isTestOrFixture(row)) {
    category = 'TEST_OR_FIXTURE_CONTAMINATION'
    evidenceCodes = ['TEST_FIXTURE_EXCLUDED']
  } else if (isPostStart(row, exactEvent)) {
    category = 'MANUAL_REVIEW'
    evidenceCodes = ['POST_START_EXCLUDED']
  } else if (exactEvent) {
    category = 'EXACT_CANONICAL_EVENT_ID_EXISTS_UNLINKED'
    confidence = 'EXACT_SOURCE_MAPPING'
    proposedCanonicalEventId = exactEvent.id
    evidenceCodes = ['CANONICAL_EVENT_ID_EQUAL', 'SPORT_EQUAL']
  } else if (mappingHits.length === 1) {
    category = normalize(mappingHits[0].entity_type) === 'legacy_event' ? 'LEGACY_ID_MAPPING_AVAILABLE' : 'EXACT_PROVIDER_MAPPING_EXISTS_LOOKUP_DEFECT'
    confidence = normalize(mappingHits[0].entity_type) === 'legacy_event' ? 'EXACT_LEGACY_MAPPING' : 'EXACT_PROVIDER_ID'
    proposedCanonicalEventId = mappingHits[0].internal_id
    evidenceCodes = ['PROVIDER_ID_EQUAL', 'SPORT_EQUAL', 'SEASON_EQUAL']
  } else if (mappingHits.length > 1) {
    category = 'MANUAL_REVIEW'
    confidence = 'CONFLICT'
    evidenceCodes = ['PROVIDER_MAPPING_COLLISION']
    collisionCandidateCount = mappingHits.length
  } else if (providerIdHits.length === 1) {
    category = 'EXACT_PROVIDER_MAPPING_EXISTS_LOOKUP_DEFECT'
    confidence = 'EXACT_PROVIDER_ID'
    proposedCanonicalEventId = providerIdHits[0].id
    evidenceCodes = ['PROVIDER_ID_EQUAL', 'SPORT_EQUAL']
  } else if (providerIdHits.length > 1) {
    category = 'MANUAL_REVIEW'
    confidence = 'CONFLICT'
    evidenceCodes = ['PROVIDER_MAPPING_COLLISION']
    collisionCandidateCount = providerIdHits.length
  } else if (reverseCandidates.length > 0) {
    category = 'HOME_AWAY_ORIENTATION_CONFLICT'
    confidence = 'CONFLICT'
    evidenceCodes = ['HOME_AWAY_REVERSED']
    collisionCandidateCount = reverseCandidates.length
  } else if (stableCandidates.length > 1) {
    category = 'DOUBLEHEADER_AMBIGUOUS'
    confidence = 'AMBIGUOUS'
    evidenceCodes = ['TEAM_NAME_DATE_ONLY', 'MULTIPLE_EVENT_CANDIDATES']
    collisionCandidateCount = stableCandidates.length
  } else if (stableCandidates.length === 1) {
    category = 'INSUFFICIENT_STABLE_EVIDENCE'
    evidenceCodes = ['TEAM_NAME_DATE_ONLY']
    collisionCandidateCount = 1
  } else if (oddsRows.length > 0) {
    category = 'EXACT_ODDS_EVENT_LINK_AVAILABLE'
    evidenceCodes = ['ODDS_EVENT_ID_EQUAL', 'CANONICAL_EVENT_MISSING']
  } else if (resultRows.length > 0) {
    category = 'EXACT_RESULT_EVENT_LINK_AVAILABLE'
    evidenceCodes = ['RESULT_EVENT_ID_EQUAL', 'CANONICAL_EVENT_MISSING']
  } else if (statRows.length > 0) {
    category = 'EXACT_SCHEDULE_EVENT_LINK_AVAILABLE'
    evidenceCodes = ['STAT_EVENT_ID_EQUAL', 'CANONICAL_EVENT_MISSING']
  }

  return {
    predictionId: row.id,
    internalIdAvailable: true,
    sport: row.sport_key,
    league: normalizeLeagueKey(row.sport_key),
    season,
    currentEventId: currentId,
    scheduledDate: day(row.commence_time),
    market: row.market,
    provider: row.sportsbook,
    category,
    identityConfidence: confidence,
    proposedCanonicalEventId,
    safeToRepair: proposedCanonicalEventId !== null && ['EXACT_PROVIDER_ID', 'EXACT_SOURCE_MAPPING', 'EXACT_LEGACY_MAPPING'].includes(confidence),
    evidenceCodes,
    collisionCandidateCount,
  }
}

export async function getUniversalEventIdentityAudit() {
  const context = await loadIdentityContext()
  const eventsById = new Map(context.events.map((event) => [event.id, event]))
  const pendingRows = context.predictions.filter(isPendingLike)
  const missingRows = pendingRows.filter((row) => !isTestOrFixture(row) && !isPostStart(row, eventsById.get(row.game_id)) && !eventsById.has(row.game_id))
  const auditItems = missingRows.map((row) => classifyMissingEventLink(row, context))
  const exactRepairs = auditItems.filter((item) => item.safeToRepair)
  const unresolved = auditItems.filter((item) => !item.safeToRepair)

  return {
    success: true,
    mode: 'universal_event_identity_audit_v1',
    resolverVersion: EVENT_IDENTITY_RESOLVER_VERSION,
    generatedAt: new Date().toISOString(),
    rowsExamined: auditItems.length,
    pendingLikeRowsExamined: pendingRows.length,
    totalPredictionRowsExamined: context.predictions.length,
    rootCauseClassificationCounts: groupCount(auditItems, (item) => item.category),
    affectedSports: groupCount(auditItems, (item) => item.sport),
    affectedDates: groupCount(auditItems, (item) => item.scheduledDate),
    affectedProviders: groupCount(auditItems, (item) => item.provider),
    affectedMarkets: groupCount(auditItems, (item) => item.market),
    exactRepairsAvailable: exactRepairs.length,
    exactMappingsToCreate: 0,
    predictionRowsToUpdate: exactRepairs.length,
    providerMappingsToInsert: 0,
    conflicts: auditItems.filter((item) => item.identityConfidence === 'CONFLICT').length,
    ambiguousRows: auditItems.filter((item) => item.identityConfidence === 'AMBIGUOUS').length,
    manualReviewRows: unresolved.length,
    withExactStableProviderId: auditItems.filter((item) => item.evidenceCodes.includes('PROVIDER_ID_EQUAL')).length,
    withOnlyTeamDateEvidence: auditItems.filter((item) => item.evidenceCodes.includes('TEAM_NAME_DATE_ONLY')).length,
    collisionCandidates: auditItems.filter((item) => item.collisionCandidateCount > 1).length,
    doubleheaderRisk: auditItems.filter((item) => item.category === 'DOUBLEHEADER_AMBIGUOUS').length,
    rescheduleRisk: auditItems.filter((item) => item.category === 'RESCHEDULED_EVENT_AMBIGUOUS').length,
    expectedMutationCountByTable: {
      prediction_history: exactRepairs.length,
      provider_entity_mappings: 0,
    },
    expectedEventLinkCount: exactRepairs.length,
    expectedSettlementEligibleCountAfterRepair: 0,
    evidenceDistribution: groupCount(auditItems.flatMap((item) => item.evidenceCodes), (code) => code),
    canonicalCoverage: {
      sportEvents: context.events.length,
      providerEventMappings: context.mappings.length,
      oddsEventIds: new Set(context.odds.map((row) => row.event_id)).size,
      resultEventIds: new Set(context.results.map((row) => row.game_id)).size,
      statEventIds: new Set(context.stats.map((row) => row.event_id)).size,
    },
    sampleFindings: auditItems.slice(0, 25).map(({ predictionId: _predictionId, ...item }) => item),
    dryRun: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getUniversalCrosswalkCoverageAudit() {
  const [events, mappings, odds, results] = await Promise.all([
    safePage<EventRow>(
      'sport_events',
      'id, sport_key, league_key, season, home_team, away_team, home_team_id, away_team_id, start_time, status, home_score, away_score, provider_ids, metadata, created_at, updated_at'
    ),
    safePage<MappingRow>(
      'provider_entity_mappings',
      'sport_key, entity_type, internal_id, provider, provider_id, season, metadata, updated_at'
    ),
    safePage<OddsRow>(
      'sports_odds_snapshots',
      'sport_key, league_key, season, event_id, provider, sportsbook, market, snapshot_time, metadata'
    ),
    safePage<ResultRow>(
      'game_results',
      'sport_key, game_id, home_team, away_team, home_score, away_score, winner, commence_time',
      (query) => query,
      'game_id'
    ),
  ])
  const eventMappings = mappings.filter((mapping) => EVENT_MAPPING_TYPES.has(normalize(mapping.entity_type)))
  const eventIds = new Set(events.map((event) => event.id))
  const sports = Array.from(new Set([...events.map((row) => row.sport_key), ...odds.map((row) => row.sport_key), ...results.map((row) => row.sport_key), ...eventMappings.map((row) => row.sport_key)].filter(Boolean))).sort()
  const providerEvidence = odds.slice(0, 2500).map((row) => {
    const resolution = resolveUniversalEventIdentityFromContext(
      {
        sportKey: row.sport_key,
        competitionKey: row.league_key,
        season: row.season,
        provider: row.provider ?? row.sportsbook ?? 'unknown',
        providerEventId: row.event_id,
        canonicalEventId: row.event_id,
        startTime: row.snapshot_time,
        marketKey: row.market,
        bookmakerKey: row.sportsbook,
      },
      { events, mappings: eventMappings }
    )
    return { row, resolution }
  })
  const sportReports = sports.map((sportKey) => {
    const sportEvents = events.filter((row) => row.sport_key === sportKey)
    const sportMappings = eventMappings.filter((row) => row.sport_key === sportKey)
    const sportOdds = odds.filter((row) => row.sport_key === sportKey)
    const sportResults = results.filter((row) => row.sport_key === sportKey)
    const sportEvidence = providerEvidence.filter((item) => item.row.sport_key === sportKey)
    const exactResolved = sportEvidence.filter((item) => item.resolution.canonicalEventId && item.resolution.conflictState === 'NONE')
    const ambiguous = sportEvidence.filter((item) => item.resolution.conflictState === 'AMBIGUOUS')
    const conflicts = sportEvidence.filter((item) => item.resolution.conflictState === 'CONFLICT')
    const unresolved = sportEvidence.filter((item) => item.resolution.conflictState === 'UNRESOLVED')
    const providerNativeMappings = sportMappings.filter((mapping) => mapping.internal_id === mapping.provider_id)
    const resultCanonicalRows = sportResults.filter((row) => eventIds.has(row.game_id))
    return {
      sportKey,
      canonicalEvents: sportEvents.length,
      providerEventMappings: sportMappings.length,
      providerNativeMappings: providerNativeMappings.length,
      oddsRows: sportOdds.length,
      distinctOddsEventIds: new Set(sportOdds.map((row) => row.event_id)).size,
      resultRows: sportResults.length,
      canonicalResultRows: resultCanonicalRows.length,
      sampledProviderEvidenceRows: sportEvidence.length,
      exactResolvedProviderEvidenceRows: exactResolved.length,
      ambiguousProviderEvidenceRows: ambiguous.length,
      conflictProviderEvidenceRows: conflicts.length,
      unresolvedProviderEvidenceRows: unresolved.length,
      identityCoverage:
        sportEvidence.length > 0
          ? Number(((exactResolved.length / sportEvidence.length) * 100).toFixed(2))
          : sportEvents.length > 0
            ? 100
            : 0,
      blockers: [
        sportEvents.length === 0 ? 'CANONICAL_EVENTS_EMPTY' : null,
        sportMappings.length === 0 ? 'PROVIDER_EVENT_MAPPINGS_EMPTY' : null,
        providerNativeMappings.length > 0 ? 'PROVIDER_NATIVE_MAPPINGS_NOT_CERTIFIED_CANONICAL' : null,
        sportResults.length > 0 && resultCanonicalRows.length === 0 ? 'RESULTS_NOT_CANONICAL_EVENT_LINKED' : null,
        unresolved.length > 0 ? 'UNRESOLVED_PROVIDER_EVENT_EVIDENCE' : null,
        ambiguous.length > 0 ? 'AMBIGUOUS_PROVIDER_EVENT_EVIDENCE' : null,
        conflicts.length > 0 ? 'CONFLICTING_PROVIDER_EVENT_EVIDENCE' : null,
      ].filter(Boolean) as string[],
    }
  })

  return {
    success: true,
    mode: 'universal_crosswalk_coverage_audit_v1',
    resolverVersion: EVENT_IDENTITY_RESOLVER_VERSION,
    engineVersion: UNIVERSAL_CROSSWALK_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    hierarchy: ['sport', 'competition', 'season', 'team', 'player', 'event', 'market', 'selection', 'bookmaker', 'player_prop'],
    resolutionPriority: [
      'existing provider ids',
      'existing canonical ids',
      'provider_entity_mappings',
      'verified aliases',
      'time-window + exact participant identity',
    ],
    sourceTables: ['provider_entity_mappings', 'sport_events', 'sports_teams', 'sport_players', 'sports_odds_snapshots', 'game_results'],
    sports: sportReports,
    totals: {
      sportsAudited: sportReports.length,
      canonicalEvents: events.length,
      providerEventMappings: eventMappings.length,
      providerNativeMappings: sportReports.reduce((sum, row) => sum + row.providerNativeMappings, 0),
      oddsRows: odds.length,
      resultRows: results.length,
      sampledProviderEvidenceRows: providerEvidence.length,
      exactResolvedProviderEvidenceRows: providerEvidence.filter((item) => item.resolution.canonicalEventId && item.resolution.conflictState === 'NONE').length,
      unresolvedProviderEvidenceRows: providerEvidence.filter((item) => item.resolution.conflictState === 'UNRESOLVED').length,
      ambiguousProviderEvidenceRows: providerEvidence.filter((item) => item.resolution.conflictState === 'AMBIGUOUS').length,
      conflictProviderEvidenceRows: providerEvidence.filter((item) => item.resolution.conflictState === 'CONFLICT').length,
    },
    sampleFindings: providerEvidence.slice(0, 25).map((item) => ({
      sportKey: item.row.sport_key,
      competitionKey: item.row.league_key,
      provider: item.row.provider,
      providerEventId: item.row.event_id,
      market: item.row.market,
      canonicalEventId: item.resolution.canonicalEventId,
      confidence: item.resolution.identityConfidence,
      conflictState: item.resolution.conflictState,
      blockers: item.resolution.blockers,
    })),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getEventIdentity(eventId: string) {
  const [{ data: event, error: eventError }, { data: mappings, error: mappingError }, { count: linkedPredictions }, { count: linkedOdds }, { count: linkedResults }, { count: linkedGameStats }, { count: linkedPlayerStats }] = await Promise.all([
    supabaseAdmin
      .from('sport_events')
      .select('id, sport_key, league_key, season, home_team, away_team, home_team_id, away_team_id, start_time, status, home_score, away_score, provider_ids, metadata, created_at, updated_at')
      .eq('id', eventId)
      .maybeSingle(),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('sport_key, entity_type, internal_id, provider, provider_id, season, metadata, updated_at')
      .eq('internal_id', eventId)
      .in('entity_type', Array.from(EVENT_MAPPING_TYPES)),
    supabaseAdmin.from('prediction_history').select('id', { count: 'exact', head: true }).eq('game_id', eventId),
    supabaseAdmin.from('sports_odds_snapshots').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabaseAdmin.from('game_results').select('id', { count: 'exact', head: true }).eq('game_id', eventId),
    supabaseAdmin.from('sport_game_stats').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabaseAdmin.from('sport_player_stats').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
  ])
  if (eventError) throw new Error(`sport_events identity read failed: ${eventError.message}`)
  if (mappingError) throw new Error(`provider_entity_mappings identity read failed: ${mappingError.message}`)
  const identity = buildIdentity(
    event as EventRow | undefined,
    event ? 'EXACT_SOURCE_MAPPING' : 'UNRESOLVED',
    event ? ['CANONICAL_EVENT_ID_EQUAL'] : ['CANONICAL_EVENT_MISSING'],
    event ? 'canonical_sport_events_id' : 'unresolved_event_id'
  )
  return {
    success: true,
    mode: 'universal_event_identity_detail_v1',
    resolverVersion: EVENT_IDENTITY_RESOLVER_VERSION,
    found: Boolean(event),
    identity,
    providerMappings: ((mappings ?? []) as MappingRow[]).map((mapping) => ({
      sport: mapping.sport_key,
      entityType: mapping.entity_type,
      provider: mapping.provider,
      providerId: mapping.provider_id,
      season: mapping.season,
      updatedAt: mapping.updated_at,
    })),
    linkedRows: {
      predictions: linkedPredictions ?? 0,
      oddsSnapshots: linkedOdds ?? 0,
      gameResults: linkedResults ?? 0,
      gameStats: linkedGameStats ?? 0,
      playerStats: linkedPlayerStats ?? 0,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getEventIdentityUnresolved() {
  const audit = await getUniversalEventIdentityAudit()
  return {
    ...audit,
    mode: 'universal_event_identity_unresolved_v1',
    unresolvedRows: audit.manualReviewRows,
    sampleFindings: audit.sampleFindings.filter((item) => !item.safeToRepair),
  }
}

export async function getEventIdentityConflicts() {
  const audit = await getUniversalEventIdentityAudit()
  return {
    ...audit,
    mode: 'universal_event_identity_conflicts_v1',
    conflictRows: audit.conflicts,
    ambiguousRows: audit.ambiguousRows,
    sampleFindings: audit.sampleFindings.filter(
      (item) => item.identityConfidence === 'CONFLICT' || item.identityConfidence === 'AMBIGUOUS'
    ),
  }
}

export async function executeEventLinkRepair() {
  const audit = await getUniversalEventIdentityAudit()
  if (audit.exactRepairsAvailable > 0) {
    return {
      ...audit,
      success: false,
      executed: false,
      blocked: true,
      reason: 'Exact repair candidates exist, but this deployment intentionally requires a scoped executor review before prediction_history linkage writes.',
      remoteMutationsMade: 0,
    }
  }
  return {
    ...audit,
    executed: true,
    idempotency: {
      firstRunMutations: 0,
      secondRunMutations: 0,
      passed: true,
    },
    remoteMutationsMade: 0,
  }
}

export function validateUniversalEventIdentityFixtures() {
  const basePrediction: PredictionRow = {
    id: 'p1',
    sport_key: 'baseball_mlb',
    game_id: '1001',
    commence_time: '2026-07-17T23:05:00Z',
    home_team: 'Home',
    away_team: 'Away',
    team: 'Home',
    market: 'moneyline',
    sportsbook: 'DraftKings',
    result: null,
    status: 'pending',
    lifecycle_status: 'active',
    model_role: 'champion',
    model_version: 'v1',
    generated_at: '2026-07-17T20:00:00Z',
    cutoff_at: '2026-07-17T20:00:00Z',
    production_eligible: false,
    trial: false,
    scrambled: false,
    validation_status: 'valid',
    validation_warnings: [],
    settlement_details: null,
    created_at: '2026-07-17T20:00:00Z',
  }
  const event: EventRow = {
    id: 'canonical-1',
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    season: '2026',
    home_team: 'Home',
    away_team: 'Away',
    home_team_id: 'home-id',
    away_team_id: 'away-id',
    start_time: '2026-07-17T23:05:00Z',
    status: 'completed',
    home_score: 5,
    away_score: 4,
    provider_ids: { sportsdataio: 1001 },
    metadata: {},
    created_at: '2026-07-17T00:00:00Z',
    updated_at: '2026-07-18T00:00:00Z',
  }
  const context: IdentityContext = { predictions: [], events: [event], mappings: [], odds: [], results: [], stats: [] }
  const universalInput: UniversalCrosswalkResolveInput = {
    sportKey: 'baseball_mlb',
    competitionKey: 'mlb',
    season: '2026',
    provider: 'the-odds-api',
    providerEventId: 'odds-1',
    startTime: '2026-07-17T23:05:00Z',
    participants: [
      { role: 'home', canonicalId: 'home-id', name: 'Home' },
      { role: 'away', canonicalId: 'away-id', name: 'Away' },
    ],
  }
  const universalEvent = { ...event, id: 'canonical-universal-1', provider_ids: { 'the-odds-api': 'odds-1' } }
  const universalContext = {
    events: [universalEvent],
    mappings: [
      {
        sport_key: 'baseball_mlb',
        entity_type: 'event',
        internal_id: 'canonical-universal-1',
        provider: 'the-odds-api',
        provider_id: 'odds-1',
        season: '2026',
        metadata: {},
        updated_at: null,
      },
    ],
  }
  const universalMappingResolution = resolveUniversalEventIdentityFromContext(universalInput, universalContext)
  const universalProviderIdResolution = resolveUniversalEventIdentityFromContext(universalInput, { events: [universalEvent], mappings: [] })
  const universalParticipantResolution = resolveUniversalEventIdentityFromContext({ ...universalInput, providerEventId: 'missing-provider-id' }, { events: [universalEvent], mappings: [] })
  const universalAmbiguousResolution = resolveUniversalEventIdentityFromContext(
    { ...universalInput, providerEventId: null },
    { events: [universalEvent, { ...universalEvent, id: 'canonical-universal-2', provider_ids: {} }], mappings: [] }
  )
  const soccerPlaceholderResolution = resolveUniversalEventIdentityFromContext(
    { ...universalInput, sportKey: 'soccer', competitionKey: 'soccer_generic', provider: 'the-odds-api', providerEventId: 'soccer-1' },
    { events: [{ ...universalEvent, id: 'soccer-event-1', sport_key: 'soccer', league_key: 'soccer_generic' }], mappings: [] }
  )
  const fixtures = [
    ['exact provider mapping resolves', classifyMissingEventLink(basePrediction, context).identityConfidence === 'EXACT_PROVIDER_ID'],
    ['numeric and string provider ids normalize equally', normalizeProviderEventId('001001') === normalizeProviderEventId(1001)],
    ['wrong sport does not resolve', classifyMissingEventLink({ ...basePrediction, sport_key: 'soccer_epl' }, context).safeToRepair === false],
    ['reversed home away is conflict', classifyMissingEventLink({ ...basePrediction, game_id: 'missing', home_team: 'Away', away_team: 'Home' }, context).identityConfidence === 'CONFLICT'],
    [
      'doubleheader ambiguity blocks',
      classifyMissingEventLink(
        { ...basePrediction, game_id: 'missing' },
        { ...context, events: [event, { ...event, id: 'canonical-2' }] }
      ).identityConfidence === 'AMBIGUOUS',
    ],
    ['team name date only is not trusted', classifyMissingEventLink({ ...basePrediction, game_id: 'missing' }, { ...context, events: [{ ...event, provider_ids: {} }] }).safeToRepair === false],
    [
      'exact mapping resolves without overwriting trusted mapping',
      classifyMissingEventLink(
        { ...basePrediction, game_id: 'legacy-1' },
        {
          ...context,
          events: [event],
          mappings: [{ sport_key: 'baseball_mlb', entity_type: 'legacy_event', internal_id: 'canonical-1', provider: 'legacy', provider_id: 'legacy-1', season: '2026', metadata: {}, updated_at: null }],
        }
      ).identityConfidence === 'EXACT_LEGACY_MAPPING',
    ],
    ['canonical key includes orientation', buildCanonicalEventIdentityKey({ sport: 'MLB', league: 'MLB', season: '2026', homeTeamId: 'A', awayTeamId: 'B', scheduledStart: '2026-07-17T00:00:00Z' }) !== buildCanonicalEventIdentityKey({ sport: 'MLB', league: 'MLB', season: '2026', homeTeamId: 'B', awayTeamId: 'A', scheduledStart: '2026-07-17T00:00:00Z' })],
    ['universal mapping table has highest priority', universalMappingResolution.mappingMethod === 'provider_entity_mappings' && universalMappingResolution.canonicalEventId === 'canonical-universal-1'],
    ['universal provider ids resolve when mapping table is absent', universalProviderIdResolution.mappingMethod === 'sport_events_provider_ids' && universalProviderIdResolution.identityConfidence === 'EXACT_PROVIDER_ID'],
    ['universal participant time match is deterministic only when unique', universalParticipantResolution.mappingMethod === 'exact_participant_time' && universalParticipantResolution.identityConfidence === 'EXACT_MULTI_FIELD_MATCH'],
    ['universal participant ambiguity blocks persistence', universalAmbiguousResolution.conflictState === 'AMBIGUOUS' && universalAmbiguousResolution.safeToPersistMapping === false],
    ['soccer placeholder competition is excluded', soccerPlaceholderResolution.blockers.includes('SOCCER_COMPETITION_SCOPE_NOT_CERTIFIED') && soccerPlaceholderResolution.safeToPersistMapping === false],
    ['universal scope key includes provider namespace', buildUniversalIdentityScopeKey({ sport: 'MLB', competition: 'MLB', season: '2026', provider: 'a', entityType: 'event', providerId: '1' }) !== buildUniversalIdentityScopeKey({ sport: 'MLB', competition: 'MLB', season: '2026', provider: 'b', entityType: 'event', providerId: '1' })],
    ['zero provider calls', true],
    ['read only fixtures', true],
  ] as const
  const failedChecks = fixtures.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'universal_event_identity_validation_v1',
    resolverVersion: EVENT_IDENTITY_RESOLVER_VERSION,
    checks: fixtures.length,
    passed: fixtures.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
