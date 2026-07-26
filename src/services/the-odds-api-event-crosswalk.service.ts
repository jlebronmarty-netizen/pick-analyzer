import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const ODDS_API_PROVIDER = 'the-odds-api'
export const ODDS_API_SPORT_KEY = 'baseball_mlb'
export const ODDS_API_LEAGUE_KEY = 'mlb'
const BASE_URL = 'https://api.the-odds-api.com/v4'
const CONFIRM_LIVE = 'ODDS_API_EVENT_CROSSWALK'
const CONFIRM_PERSIST = 'ODDS_API_EVENT_CROSSWALK_PERSIST'
const MAX_CALLS = 5
const DEFAULT_TOLERANCE_SECONDS = 15 * 60

export type OddsApiCrosswalkClassification =
  | 'EXACT_MATCH'
  | 'DETERMINISTIC_MATCH'
  | 'PROBABLE_MATCH_REVIEW_REQUIRED'
  | 'AMBIGUOUS'
  | 'NO_INTERNAL_EVENT'
  | 'NO_PROVIDER_EVENT'
  | 'STALE_INTERNAL_EVENT'
  | 'POSTPONED_OR_RESCHEDULED'
  | 'INVALID_TEAM_IDENTITY'

type CrosswalkOptions = {
  dryRun?: boolean | null
  live?: boolean | null
  persist?: boolean | null
  confirm?: string | null
  maxCalls?: number | null
  toleranceSeconds?: number | null
}

type ProviderEvent = {
  id: string
  sport_key?: string
  commence_time: string
  home_team: string
  away_team: string
}

type InternalEvent = {
  id: string
  sport_key: string | null
  league_key: string | null
  season: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type MappingRow = {
  internal_id: string
  provider_id: string
  provider: string | null
  entity_type: string | null
  sport_key: string | null
  season: string | null
  metadata: Record<string, unknown> | null
}

export type CertifiedOddsApiEventMapping = {
  provider: typeof ODDS_API_PROVIDER
  providerEventId: string
  internalEventId: string
  sport: typeof ODDS_API_SPORT_KEY
  providerHomeTeam: string
  providerAwayTeam: string
  canonicalHomeTeam: string
  canonicalAwayTeam: string
  providerCommenceTime: string
  internalStartTime: string
  timeDifferenceSeconds: number
  matchMethod: 'provider_mapping' | 'provider_ids' | 'team_time'
  matchConfidence: 'EXACT' | 'DETERMINISTIC'
  validationStatus: 'CERTIFIED'
  createdAt: string
}

const MLB_TEAM_ALIASES: Record<string, string> = {
  arizona: 'ARI',
  arizonadiamondbacks: 'ARI',
  ari: 'ARI',
  atlanta: 'ATL',
  atlantabraves: 'ATL',
  atl: 'ATL',
  baltimore: 'BAL',
  baltimoreorioles: 'BAL',
  bal: 'BAL',
  boston: 'BOS',
  bostonredsox: 'BOS',
  bos: 'BOS',
  chicago_white_sox: 'CHW',
  chicagowhitesox: 'CHW',
  whitesox: 'CHW',
  cws: 'CHW',
  chw: 'CHW',
  chicago_cubs: 'CHC',
  chicagocubs: 'CHC',
  cubs: 'CHC',
  chc: 'CHC',
  cincinnati: 'CIN',
  cincinnatireds: 'CIN',
  cin: 'CIN',
  cleveland: 'CLE',
  clevelandguardians: 'CLE',
  cle: 'CLE',
  colorado: 'COL',
  coloradorockies: 'COL',
  col: 'COL',
  detroit: 'DET',
  detroittigers: 'DET',
  det: 'DET',
  houston: 'HOU',
  houstonastros: 'HOU',
  hou: 'HOU',
  kansascity: 'KC',
  kansascityroyals: 'KC',
  kc: 'KC',
  kcr: 'KC',
  losangelesangels: 'LAA',
  laangels: 'LAA',
  angels: 'LAA',
  laa: 'LAA',
  losangelesdodgers: 'LAD',
  ladodgers: 'LAD',
  dodgers: 'LAD',
  lad: 'LAD',
  miami: 'MIA',
  miamimarlins: 'MIA',
  mia: 'MIA',
  milwaukee: 'MIL',
  milwaukeebrewers: 'MIL',
  mil: 'MIL',
  minnesota: 'MIN',
  minnesotatwins: 'MIN',
  min: 'MIN',
  newyorkmets: 'NYM',
  nymets: 'NYM',
  mets: 'NYM',
  nym: 'NYM',
  newyorkyankees: 'NYY',
  nyyankees: 'NYY',
  yankees: 'NYY',
  nyy: 'NYY',
  athletics: 'ATH',
  oaklandathletics: 'ATH',
  oaklandas: 'ATH',
  ath: 'ATH',
  oak: 'ATH',
  philadelphia: 'PHI',
  philadelphiaphillies: 'PHI',
  phi: 'PHI',
  pittsburgh: 'PIT',
  pittsburghpirates: 'PIT',
  pit: 'PIT',
  sandiego: 'SD',
  sandiegopadres: 'SD',
  sd: 'SD',
  sdp: 'SD',
  sanfrancisco: 'SF',
  sanfranciscogiants: 'SF',
  sf: 'SF',
  sfg: 'SF',
  seattle: 'SEA',
  seattlemariners: 'SEA',
  sea: 'SEA',
  stlouis: 'STL',
  stlouiscardinals: 'STL',
  stl: 'STL',
  tampabay: 'TB',
  tampabayrays: 'TB',
  tb: 'TB',
  tbr: 'TB',
  texas: 'TEX',
  texasrangers: 'TEX',
  tex: 'TEX',
  toronto: 'TOR',
  torontobluejays: 'TOR',
  tor: 'TOR',
  washington: 'WSH',
  washingtonnationals: 'WSH',
  wsh: 'WSH',
  was: 'WSH',
}

function nowIso() {
  return new Date().toISOString()
}

function apiKey() {
  return process.env.ODDS_API_KEY?.trim() ?? process.env.THE_ODDS_API_KEY?.trim() ?? ''
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 20)
}

function normalizeToken(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '')
}

export function canonicalMlbTeam(value: unknown) {
  const compact = normalizeToken(value)
  if (!compact) return null
  if (MLB_TEAM_ALIASES[compact]) return MLB_TEAM_ALIASES[compact]
  const spaced = String(value ?? '').toLowerCase().trim().replace(/\s+/g, '_')
  return MLB_TEAM_ALIASES[spaced] ?? null
}

function secondsBetween(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return null
  const a = new Date(left).getTime()
  const b = new Date(right).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round((a - b) / 1000)
}

function seasonFrom(value: string | null | undefined) {
  return value ? String(new Date(value).getUTCFullYear()) : String(new Date().getUTCFullYear())
}

async function fetchProviderEvents(maxCalls: number) {
  const key = apiKey()
  if (!key) {
    return { events: [] as ProviderEvent[], calls: [], blocker: 'ODDS_API_KEY_NOT_PRESENT' as string | null }
  }
  const url = new URL(`${BASE_URL}/sports/${ODDS_API_SPORT_KEY}/events`)
  url.searchParams.set('apiKey', key)
  const response = await fetch(url.toString(), { cache: 'no-store' })
  const payload = await response.json().catch(() => null)
  const call = {
    label: 'events',
    httpStatus: response.status,
    ok: response.ok,
    requestsRemaining: Number(response.headers.get('x-requests-remaining') ?? NaN),
    requestsUsed: Number(response.headers.get('x-requests-used') ?? NaN),
    requestsLast: Number(response.headers.get('x-requests-last') ?? NaN),
  }
  return {
    events: response.ok && Array.isArray(payload) ? payload as ProviderEvent[] : [],
    calls: [call].slice(0, maxCalls),
    blocker: response.ok ? null : 'ODDS_API_EVENTS_READ_FAILED',
  }
}

async function readInternalEvents(providerEvents: ProviderEvent[]) {
  const dates = providerEvents.map((event) => new Date(event.commence_time)).filter((date) => Number.isFinite(date.getTime())).sort((a, b) => a.getTime() - b.getTime())
  const start = dates[0] ? new Date(dates[0].getTime() - 3 * 36e5).toISOString() : new Date(Date.now() - 36e5).toISOString()
  const end = dates.at(-1) ? new Date(dates.at(-1)!.getTime() + 3 * 36e5).toISOString() : new Date(Date.now() + 14 * 864e5).toISOString()
  const [eventsResult, mappingsResult] = await Promise.all([
    supabaseAdmin
      .from('sport_events')
      .select('id, sport_key, league_key, season, start_time, status, home_team, away_team, provider_ids, metadata')
      .eq('sport_key', ODDS_API_SPORT_KEY)
      .gte('start_time', start)
      .lte('start_time', end)
      .order('start_time')
      .limit(500),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('internal_id, provider_id, provider, entity_type, sport_key, season, metadata')
      .eq('sport_key', ODDS_API_SPORT_KEY)
      .eq('provider', ODDS_API_PROVIDER)
      .eq('entity_type', 'event')
      .limit(1000),
  ])
  return {
    events: (eventsResult.data ?? []) as InternalEvent[],
    mappings: (mappingsResult.data ?? []) as MappingRow[],
    warnings: [eventsResult.error?.message, mappingsResult.error?.message].filter(Boolean) as string[],
  }
}

function providerIdsMatch(event: InternalEvent, providerEventId: string) {
  const ids = event.provider_ids ?? {}
  return Object.values(ids).map(String).includes(providerEventId)
}

function classifyProviderEvent(providerEvent: ProviderEvent, internalEvents: InternalEvent[], mappings: MappingRow[], toleranceSeconds: number) {
  const providerHome = canonicalMlbTeam(providerEvent.home_team)
  const providerAway = canonicalMlbTeam(providerEvent.away_team)
  if (!providerHome || !providerAway) {
    return { classification: 'INVALID_TEAM_IDENTITY' as OddsApiCrosswalkClassification, match: null, candidates: [] as InternalEvent[], reason: 'provider_team_unresolved' }
  }
  const existing = mappings.find((mapping) => mapping.provider_id === providerEvent.id)
  if (existing) {
    const event = internalEvents.find((row) => row.id === existing.internal_id)
    if (event) return { classification: 'EXACT_MATCH' as OddsApiCrosswalkClassification, match: event, candidates: [event], method: 'provider_mapping' as const }
  }
  const providerIdCandidates = internalEvents.filter((event) => providerIdsMatch(event, providerEvent.id))
  if (providerIdCandidates.length === 1) return { classification: 'EXACT_MATCH' as OddsApiCrosswalkClassification, match: providerIdCandidates[0], candidates: providerIdCandidates, method: 'provider_ids' as const }
  if (providerIdCandidates.length > 1) return { classification: 'AMBIGUOUS' as OddsApiCrosswalkClassification, match: null, candidates: providerIdCandidates, reason: 'provider_id_collision' }

  const teamCandidates = internalEvents.filter((event) => canonicalMlbTeam(event.home_team) === providerHome && canonicalMlbTeam(event.away_team) === providerAway)
  const timeCandidates = teamCandidates.filter((event) => {
    const diff = secondsBetween(providerEvent.commence_time, event.start_time)
    return diff !== null && Math.abs(diff) <= toleranceSeconds
  })
  if (timeCandidates.length === 1) return { classification: 'DETERMINISTIC_MATCH' as OddsApiCrosswalkClassification, match: timeCandidates[0], candidates: timeCandidates, method: 'team_time' as const }
  if (timeCandidates.length > 1) return { classification: 'AMBIGUOUS' as OddsApiCrosswalkClassification, match: null, candidates: timeCandidates, reason: 'multiple_team_time_candidates' }
  if (teamCandidates.length) return { classification: 'POSTPONED_OR_RESCHEDULED' as OddsApiCrosswalkClassification, match: null, candidates: teamCandidates, reason: 'team_match_time_outside_tolerance' }
  return { classification: 'NO_INTERNAL_EVENT' as OddsApiCrosswalkClassification, match: null, candidates: [] as InternalEvent[], reason: 'no_team_match' }
}

function toCrosswalk(providerEvent: ProviderEvent, match: InternalEvent, method: 'provider_mapping' | 'provider_ids' | 'team_time', createdAt: string): CertifiedOddsApiEventMapping {
  return {
    provider: ODDS_API_PROVIDER,
    providerEventId: providerEvent.id,
    internalEventId: match.id,
    sport: ODDS_API_SPORT_KEY,
    providerHomeTeam: providerEvent.home_team,
    providerAwayTeam: providerEvent.away_team,
    canonicalHomeTeam: canonicalMlbTeam(providerEvent.home_team) ?? String(match.home_team ?? ''),
    canonicalAwayTeam: canonicalMlbTeam(providerEvent.away_team) ?? String(match.away_team ?? ''),
    providerCommenceTime: new Date(providerEvent.commence_time).toISOString(),
    internalStartTime: new Date(match.start_time ?? providerEvent.commence_time).toISOString(),
    timeDifferenceSeconds: secondsBetween(providerEvent.commence_time, match.start_time) ?? 0,
    matchMethod: method,
    matchConfidence: method === 'team_time' ? 'DETERMINISTIC' : 'EXACT',
    validationStatus: 'CERTIFIED',
    createdAt,
  }
}

async function persistMappings(mappings: CertifiedOddsApiEventMapping[]) {
  const now = nowIso()
  const rows = mappings.map((mapping) => {
    const season = seasonFrom(mapping.internalStartTime)
    return {
      sport_key: ODDS_API_SPORT_KEY,
      entity_type: 'event',
      internal_id: mapping.internalEventId,
      provider: ODDS_API_PROVIDER,
      provider_id: mapping.providerEventId,
      season,
      metadata: {
        sourceVersion: 'the_odds_api_event_crosswalk_v1',
        ...mapping,
        updatedAt: now,
      },
      updated_at: now,
    }
  })
  if (!rows.length) return { rowsPersisted: 0, error: null as string | null }
  const { error } = await supabaseAdmin.from('provider_entity_mappings').upsert(rows, { onConflict: 'sport_key,entity_type,provider,provider_id,season' })
  return { rowsPersisted: error ? 0 : rows.length, error: error?.message ?? null }
}

export async function getCertifiedOddsApiEventMappings() {
  const { data, error } = await supabaseAdmin
    .from('provider_entity_mappings')
    .select('internal_id, provider_id, provider, entity_type, sport_key, season, metadata')
    .eq('sport_key', ODDS_API_SPORT_KEY)
    .eq('provider', ODDS_API_PROVIDER)
    .eq('entity_type', 'event')
    .limit(1000)
  if (error) throw new Error(`The Odds API event mappings read failed: ${error.message}`)
  return (data ?? []) as MappingRow[]
}

export async function runTheOddsApiEventCrosswalk(options: CrosswalkOptions = {}) {
  const live = options.live === true && options.dryRun !== true
  const persist = options.persist === true
  const maxCalls = Math.min(Math.max(Number(options.maxCalls ?? 1), 0), MAX_CALLS)
  const toleranceSeconds = Math.min(Math.max(Number(options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS), 60), 90 * 60)
  const generatedAt = nowIso()
  if (live && options.confirm !== CONFIRM_LIVE && !(persist && options.confirm === CONFIRM_PERSIST)) {
    return {
      success: false,
      status: 'BLOCKED_CONFIRMATION_REQUIRED',
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      rowsPersisted: 0,
      warnings: ['Live crosswalk requires confirm=ODDS_API_EVENT_CROSSWALK. Persist requires confirm=ODDS_API_EVENT_CROSSWALK_PERSIST.'],
    }
  }

  const provider = live ? await fetchProviderEvents(maxCalls) : { events: [] as ProviderEvent[], calls: [], blocker: null as string | null }
  const internal = await readInternalEvents(provider.events)
  const results = provider.events.map((event) => {
    const classified = classifyProviderEvent(event, internal.events, internal.mappings, toleranceSeconds)
    const certified = classified.match && classified.method
      ? toCrosswalk(event, classified.match, classified.method, generatedAt)
      : null
    return {
      provider: ODDS_API_PROVIDER,
      providerEventId: event.id,
      internalEventId: certified?.internalEventId ?? null,
      sport: ODDS_API_SPORT_KEY,
      providerHomeTeam: event.home_team,
      providerAwayTeam: event.away_team,
      canonicalHomeTeam: canonicalMlbTeam(event.home_team),
      canonicalAwayTeam: canonicalMlbTeam(event.away_team),
      providerCommenceTime: event.commence_time,
      internalStartTime: certified?.internalStartTime ?? null,
      timeDifferenceSeconds: certified?.timeDifferenceSeconds ?? null,
      matchMethod: certified?.matchMethod ?? null,
      matchConfidence: certified?.matchConfidence ?? null,
      validationStatus: classified.classification,
      candidateCount: classified.candidates.length,
      reason: classified.reason ?? null,
      mapping: certified,
    }
  })
  const persistable = results.map((row) => row.mapping).filter((row): row is CertifiedOddsApiEventMapping => Boolean(row))
  const duplicateInternal = persistable.length !== new Set(persistable.map((row) => row.internalEventId)).size
  const duplicateProvider = persistable.length !== new Set(persistable.map((row) => row.providerEventId)).size
  const canPersist = persist && live && options.confirm === CONFIRM_PERSIST && !duplicateInternal && !duplicateProvider && persistable.length > 0
  const persistence = canPersist ? await persistMappings(persistable) : { rowsPersisted: 0, error: null as string | null }
  return {
    success: live ? Boolean(provider.calls[0]?.ok) && !persistence.error : true,
    status: !live ? 'DRY_RUN' : persistence.error ? 'PERSIST_FAILED' : duplicateInternal || duplicateProvider ? 'BLOCKED_DUPLICATE_MAPPING' : canPersist ? 'PERSISTED' : 'LIVE_AUDIT_COMPLETE',
    mode: 'the_odds_api_event_crosswalk_v1',
    generatedAt,
    provider: ODDS_API_PROVIDER,
    providerCallsMade: provider.calls.length,
    remoteMutationsMade: persistence.rowsPersisted,
    rowsPersisted: persistence.rowsPersisted,
    quota: {
      requestsRemainingBefore: provider.calls[0]?.requestsRemaining ?? null,
      requestsRemainingAfter: provider.calls.at(-1)?.requestsRemaining ?? null,
      requestsUsedObserved: provider.calls.length ? (provider.calls[0]?.requestsLast ?? provider.calls.length) : 0,
      requestsLast: provider.calls.at(-1)?.requestsLast ?? null,
    },
    rootCause: {
      internalTeamFormat: 'SportsDataIO-backed sport_events store MLB teams as abbreviations such as TB, CLE and NYM.',
      providerTeamFormat: 'The Odds API returns full team names such as Tampa Bay Rays and Cleveland Guardians.',
      existingProviderMappings: internal.mappings.length,
      priorZeroMatchCause: 'The previous audit compared normalized literal team strings and provider IDs without a canonical MLB alias bridge; no The Odds API event mappings existed.',
      timeNormalization: `UTC comparison with +/- ${toleranceSeconds} seconds tolerance.`,
    },
    providerEventsEvaluated: provider.events.length,
    internalEventsEvaluated: internal.events.length,
    exactMatches: results.filter((row) => row.validationStatus === 'EXACT_MATCH').length,
    deterministicMatches: results.filter((row) => row.validationStatus === 'DETERMINISTIC_MATCH').length,
    probableMatches: results.filter((row) => row.validationStatus === 'PROBABLE_MATCH_REVIEW_REQUIRED').length,
    ambiguousMatches: results.filter((row) => row.validationStatus === 'AMBIGUOUS').length,
    unmatchedProviderEvents: results.filter((row) => row.validationStatus === 'NO_INTERNAL_EVENT' || row.validationStatus === 'POSTPONED_OR_RESCHEDULED' || row.validationStatus === 'INVALID_TEAM_IDENTITY').length,
    duplicateInternalMappings: duplicateInternal,
    duplicateProviderMappings: duplicateProvider,
    matches: results.map(({ mapping, ...row }) => row),
    persistableMappings: persistable,
    blockers: [provider.blocker, persistence.error, duplicateInternal ? 'DUPLICATE_INTERNAL_EVENT_MAPPING' : null, duplicateProvider ? 'DUPLICATE_PROVIDER_EVENT_MAPPING' : null].filter(Boolean) as string[],
    warnings: internal.warnings,
  }
}

export function validateTheOddsApiEventCrosswalkFixtures() {
  const providerEvent: ProviderEvent = { id: 'odds-1', commence_time: '2026-07-26T17:35:00.000Z', home_team: 'Tampa Bay Rays', away_team: 'Cleveland Guardians' }
  const exactEvent: InternalEvent = { id: 'internal-1', sport_key: ODDS_API_SPORT_KEY, league_key: ODDS_API_LEAGUE_KEY, season: '2026', start_time: '2026-07-26T17:35:00.000Z', status: 'scheduled', home_team: 'TB', away_team: 'CLE', provider_ids: {}, metadata: {} }
  const ambiguous = classifyProviderEvent(providerEvent, [exactEvent, { ...exactEvent, id: 'internal-2' }], [], DEFAULT_TOLERANCE_SECONDS)
  const deterministic = classifyProviderEvent(providerEvent, [exactEvent], [], DEFAULT_TOLERANCE_SECONDS)
  const checks = [
    ['full provider team resolves to canonical abbreviation', canonicalMlbTeam('Tampa Bay Rays') === 'TB' && canonicalMlbTeam('Cleveland Guardians') === 'CLE'],
    ['UTC time comparison is exact', secondsBetween(providerEvent.commence_time, exactEvent.start_time) === 0],
    ['deterministic team time match passes', deterministic.classification === 'DETERMINISTIC_MATCH'],
    ['doubleheader ambiguity is blocked', ambiguous.classification === 'AMBIGUOUS'],
    ['no provider calls in fixture validation', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'the_odds_api_event_crosswalk_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
