import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCertifiedOddsApiEventMappings, ODDS_API_PROVIDER, ODDS_API_SPORT_KEY } from '@/services/the-odds-api-event-crosswalk.service'

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'
const ODDS_API_MARKET = 'pitcher_outs'
const CONFIRM_LIVE = 'ODDS_API_PLAYER_IDENTITY'
const MAX_CALLS = 3

export type OddsApiPitcherIdentityClassification =
  | 'EXACT_MATCH'
  | 'DETERMINISTIC_MATCH'
  | 'NORMALIZED_MATCH'
  | 'AMBIGUOUS'
  | 'UNKNOWN_PLAYER'
  | 'TEAM_CONFLICT'
  | 'EVENT_CONFLICT'
  | 'STARTER_CONFLICT'

type Options = {
  dryRun?: boolean | null
  live?: boolean | null
  persist?: boolean | null
  confirm?: string | null
  maxCalls?: number | null
}

type CertifiedEventMapping = {
  provider_id: string | null
  internal_id: string | null
  season: string | null
  metadata: Record<string, unknown> | null
}

type EventRow = {
  id: string
  home_team_id: string | null
  away_team_id: string | null
  start_time: string | null
}

type PlayerRow = {
  id: string
  team_id: string | null
  team_name: string | null
  display_name: string | null
  position: string | null
  status: string | null
  active: boolean | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type ExistingMapping = {
  internal_id: string
  provider_id: string
  metadata: Record<string, unknown> | null
}

type ProviderOutcome = {
  name?: string
  description?: string
  point?: number
}

type ProviderPayload = {
  id?: string
  bookmakers?: Array<{
    key?: string
    markets?: Array<{
      key?: string
      outcomes?: ProviderOutcome[]
    }>
  }>
}

type ProviderPitcher = {
  providerEventId: string
  internalEventId: string
  providerName: string
  providerPlayerId: string
  lines: number[]
  sportsbookCount: number
}

export function normalizeOddsApiPitcherName(value: unknown) {
  const suffixes = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.'’`]/g, '')
    .replace(/-/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part && !suffixes.has(part.toLowerCase()) && part.length > 1)
    .join(' ')
}

export function oddsApiProviderPlayerId(providerName: unknown) {
  const normalized = normalizeOddsApiPitcherName(providerName).toLowerCase().replace(/\s+/g, '-')
  return normalized ? `name:${normalized}` : null
}

function nowIso() {
  return new Date().toISOString()
}

function apiKey() {
  return process.env.ODDS_API_KEY?.trim() ?? process.env.THE_ODDS_API_KEY?.trim() ?? ''
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function pitcherPosition(value: unknown) {
  return ['P', 'SP', 'RP'].includes(String(value ?? '').toUpperCase())
}

async function eligibleMappings(maximum: number) {
  const rows = await getCertifiedOddsApiEventMappings() as CertifiedEventMapping[]
  const now = Date.now()
  return rows
    .filter((row) => row.provider_id && row.internal_id)
    .filter((row) => {
      const raw = text(row.metadata?.internalStartTime)
      const time = raw ? Date.parse(raw) : NaN
      return Number.isFinite(time) && time > now
    })
    .sort((a, b) => Date.parse(String(a.metadata?.internalStartTime)) - Date.parse(String(b.metadata?.internalStartTime)))
    .slice(0, Math.min(Math.max(maximum, 1), MAX_CALLS))
}

async function fetchPitcherOuts(providerEventId: string) {
  const key = apiKey()
  if (!key) return { payload: null as ProviderPayload | null, error: 'ODDS_API_KEY_NOT_PRESENT', call: null }
  const url = new URL(`${ODDS_API_BASE_URL}/sports/${ODDS_API_SPORT_KEY}/events/${providerEventId}/odds`)
  url.searchParams.set('apiKey', key)
  url.searchParams.set('regions', 'us')
  url.searchParams.set('markets', ODDS_API_MARKET)
  url.searchParams.set('oddsFormat', 'american')
  const response = await fetch(url.toString(), { cache: 'no-store' })
  const payload = await response.json().catch(() => null)
  return {
    payload: response.ok ? payload as ProviderPayload : null,
    error: response.ok ? null : 'ODDS_API_PITCHER_OUTS_READ_FAILED',
    call: {
      httpStatus: response.status,
      ok: response.ok,
      requestsRemaining: Number(response.headers.get('x-requests-remaining') ?? NaN),
      requestsLast: Number(response.headers.get('x-requests-last') ?? NaN),
    },
  }
}

function extractProviderPitchers(payloads: Array<{ payload: ProviderPayload; internalEventId: string; providerEventId: string }>) {
  const map = new Map<string, ProviderPitcher>()
  for (const item of payloads) {
    for (const bookmaker of item.payload.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        if (market.key !== ODDS_API_MARKET) continue
        for (const outcome of market.outcomes ?? []) {
          const providerName = text(outcome.description)
          const providerPlayerId = oddsApiProviderPlayerId(providerName)
          if (!providerName || !providerPlayerId) continue
          const key = `${item.internalEventId}|${providerPlayerId}`
          const current = map.get(key) ?? {
            providerEventId: item.providerEventId,
            internalEventId: item.internalEventId,
            providerName,
            providerPlayerId,
            lines: [],
            sportsbookCount: 0,
          }
          const line = num(outcome.point)
          if (line !== null && !current.lines.includes(line)) current.lines.push(line)
          current.sportsbookCount += bookmaker.key ? 1 : 0
          map.set(key, current)
        }
      }
    }
  }
  return Array.from(map.values()).map((row) => ({ ...row, lines: row.lines.sort((a, b) => a - b) }))
}

async function readContext(internalEventIds: string[]) {
  const [eventsResult, mappingsResult] = await Promise.all([
    supabaseAdmin.from('sport_events').select('id,home_team_id,away_team_id,start_time').in('id', internalEventIds),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('internal_id,provider_id,metadata')
      .eq('sport_key', ODDS_API_SPORT_KEY)
      .eq('entity_type', 'player')
      .eq('provider', ODDS_API_PROVIDER)
      .limit(1000),
  ])
  if (eventsResult.error) throw new Error(`event context read failed: ${eventsResult.error.message}`)
  if (mappingsResult.error) throw new Error(`existing Odds API player mappings read failed: ${mappingsResult.error.message}`)
  const players: PlayerRow[] = []
  const pageSize = 1000
  for (let offset = 0; offset < 25000; offset += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('sport_players')
      .select('id,team_id,team_name,display_name,position,status,active,provider_ids,metadata')
      .eq('sport_key', ODDS_API_SPORT_KEY)
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`player context read failed: ${error.message}`)
    const batch = (data ?? []) as PlayerRow[]
    players.push(...batch.filter((row) => pitcherPosition(row.position)))
    if (batch.length < pageSize) break
  }
  return {
    events: (eventsResult.data ?? []) as EventRow[],
    players,
    mappings: (mappingsResult.data ?? []) as ExistingMapping[],
  }
}

function classifyPitcher(provider: ProviderPitcher, event: EventRow | undefined, players: PlayerRow[], existingMappings: ExistingMapping[]) {
  if (!event) return { classification: 'EVENT_CONFLICT' as const, candidates: [] as PlayerRow[], match: null as PlayerRow | null, reason: 'certified event mapping target missing' }
  const existing = existingMappings.find((row) => row.provider_id === provider.providerPlayerId)
  if (existing) {
    const mapped = players.find((row) => row.id === existing.internal_id) ?? null
    if (!mapped) return { classification: 'UNKNOWN_PLAYER' as const, candidates: [] as PlayerRow[], match: null, reason: 'existing mapping points to missing player' }
    if (mapped.team_id !== event.home_team_id && mapped.team_id !== event.away_team_id) return { classification: 'TEAM_CONFLICT' as const, candidates: [mapped], match: null, reason: 'existing mapping player is not on event teams' }
    return { classification: 'EXACT_MATCH' as const, candidates: [mapped], match: mapped, reason: 'existing provider_entity_mappings player row' }
  }
  const providerNorm = normalizeOddsApiPitcherName(provider.providerName)
  const nameCandidates = players.filter((row) => normalizeOddsApiPitcherName(row.display_name) === providerNorm)
  if (!nameCandidates.length) return { classification: 'UNKNOWN_PLAYER' as const, candidates: [], match: null, reason: 'no canonical pitcher row with normalized provider name' }
  const eventTeamCandidates = nameCandidates.filter((row) => row.team_id === event.home_team_id || row.team_id === event.away_team_id)
  if (!eventTeamCandidates.length) return { classification: 'TEAM_CONFLICT' as const, candidates: nameCandidates, match: null, reason: 'normalized name exists, but not on mapped event teams' }
  if (eventTeamCandidates.length > 1) return { classification: 'AMBIGUOUS' as const, candidates: eventTeamCandidates, match: null, reason: 'multiple same-name pitchers on event teams' }
  const match = eventTeamCandidates[0]
  const exactName = String(match.display_name ?? '') === provider.providerName
  return {
    classification: exactName ? 'DETERMINISTIC_MATCH' as const : 'NORMALIZED_MATCH' as const,
    candidates: eventTeamCandidates,
    match,
    reason: exactName ? 'unique exact full-name pitcher on mapped event team' : 'unique normalized full-name pitcher on mapped event team',
  }
}

async function persistMappings(rows: ReturnType<typeof buildResult>[], generatedAt: string) {
  const persistable = rows.filter((row) => row.persistable && row.canonicalPlayerId)
  if (!persistable.length) return { rowsPersisted: 0, error: null as string | null }
  const payload = persistable.map((row) => ({
    sport_key: ODDS_API_SPORT_KEY,
    entity_type: 'player',
    internal_id: row.canonicalPlayerId,
    provider: ODDS_API_PROVIDER,
    provider_id: row.providerPlayerId,
    season: '',
    metadata: {
      sourceVersion: 'the_odds_api_pitcher_identity_bridge_v1',
      providerPlayerId: row.providerPlayerId,
      providerPlayerIdType: 'provider_description_name_key',
      providerName: row.providerName,
      canonicalName: row.canonicalName,
      canonicalPlayerId: row.canonicalPlayerId,
      providerEventId: row.providerEventId,
      eventId: row.internalEventId,
      team: row.team,
      matchMethod: row.matchMethod,
      confidence: row.confidence,
      validatedAt: generatedAt,
    },
    updated_at: generatedAt,
  }))
  const { error } = await supabaseAdmin.from('provider_entity_mappings').upsert(payload, { onConflict: 'sport_key,entity_type,provider,provider_id,season' })
  return { rowsPersisted: error ? 0 : payload.length, error: error?.message ?? null }
}

function buildResult(provider: ProviderPitcher, classified: ReturnType<typeof classifyPitcher>) {
  const match = classified.match
  const exact = classified.classification === 'EXACT_MATCH'
  const deterministic = classified.classification === 'DETERMINISTIC_MATCH'
  return {
    provider: ODDS_API_PROVIDER,
    providerEventId: provider.providerEventId,
    internalEventId: provider.internalEventId,
    providerName: provider.providerName,
    providerPlayerId: provider.providerPlayerId,
    canonicalPlayerId: match?.id ?? null,
    canonicalName: match?.display_name ?? null,
    team: match?.team_name ?? null,
    classification: classified.classification as OddsApiPitcherIdentityClassification,
    matchMethod: exact ? 'existing_provider_mapping' : deterministic ? 'event_team_full_name' : classified.classification === 'NORMALIZED_MATCH' ? 'event_team_normalized_name' : null,
    confidence: exact ? 100 : deterministic ? 98 : classified.classification === 'NORMALIZED_MATCH' ? 92 : 0,
    candidateCount: classified.candidates.length,
    reason: classified.reason,
    lines: provider.lines,
    sportsbookCount: provider.sportsbookCount,
    persistable: exact || deterministic,
  }
}

export async function runTheOddsApiPitcherIdentityBridge(options: Options = {}) {
  const live = options.live === true && options.dryRun !== true
  const persist = options.persist === true
  const maxCalls = Math.min(Math.max(Number(options.maxCalls ?? 1), 0), MAX_CALLS)
  const generatedAt = nowIso()
  if (live && options.confirm !== CONFIRM_LIVE) {
    return {
      success: false,
      mode: 'the_odds_api_pitcher_identity_bridge_v1',
      status: 'BLOCKED_CONFIRMATION_REQUIRED',
      generatedAt,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      rowsPersisted: 0,
      warnings: ['Live validation requires confirm=ODDS_API_PLAYER_IDENTITY.'],
    }
  }
  const mappings = await eligibleMappings(maxCalls || 1)
  if (!live) {
    return {
      success: true,
      mode: 'the_odds_api_pitcher_identity_bridge_v1',
      status: 'DRY_RUN',
      generatedAt,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      rowsPersisted: 0,
      certifiedEventMappingsAvailable: mappings.length,
      plannedProviderCalls: Math.min(mappings.length, maxCalls || 1),
      rootCause: [
        'The Odds API pitcher_outs outcomes expose pitcher names in outcome.description and do not expose stable player IDs in the observed payload.',
        'Existing prop sync previously required event-scoped projection identity; certified future event mappings currently have no active starter assignments or stored pitcher projections.',
        'The bridge must therefore require normalized full name plus mapped event team membership against canonical sport_players before persisting provider_entity_mappings.',
      ],
      plannedPlayerMappings: [],
      warnings: ['Dry-run does not call The Odds API, so provider pitcher names are unavailable until live validation.'],
    }
  }

  const calls = []
  const payloads = []
  const errors: string[] = []
  for (const mapping of mappings.slice(0, maxCalls)) {
    const fetched = await fetchPitcherOuts(String(mapping.provider_id))
    if (fetched.call) calls.push(fetched.call)
    if (fetched.error) errors.push(fetched.error)
    if (fetched.payload) payloads.push({ payload: fetched.payload, providerEventId: String(mapping.provider_id), internalEventId: String(mapping.internal_id) })
  }
  const providerPitchers = extractProviderPitchers(payloads)
  const context = await readContext(Array.from(new Set(providerPitchers.map((row) => row.internalEventId))))
  const results = providerPitchers.map((pitcher) => {
    const event = context.events.find((row) => row.id === pitcher.internalEventId)
    return buildResult(pitcher, classifyPitcher(pitcher, event, context.players, context.mappings))
  })
  const persistence = persist ? await persistMappings(results, generatedAt) : { rowsPersisted: 0, error: null as string | null }
  const counts = (classification: OddsApiPitcherIdentityClassification) => results.filter((row) => row.classification === classification).length
  return {
    success: !persistence.error && errors.length === 0,
    mode: 'the_odds_api_pitcher_identity_bridge_v1',
    status: persistence.error ? 'PERSIST_FAILED' : persist ? 'PERSISTED' : 'LIVE_VALIDATION_COMPLETE',
    generatedAt,
    providerCallsMade: calls.length,
    remoteMutationsMade: persistence.rowsPersisted,
    rowsPersisted: persistence.rowsPersisted,
    quota: {
      requestsRemainingAfter: calls.at(-1)?.requestsRemaining ?? null,
      requestsUsedObserved: calls.reduce((sum, call) => sum + (Number.isFinite(call.requestsLast) ? Number(call.requestsLast) : 1), 0),
      requestsLast: calls.at(-1)?.requestsLast ?? null,
    },
    providerPitchersEvaluated: providerPitchers.length,
    exactMatches: counts('EXACT_MATCH'),
    deterministicMatches: counts('DETERMINISTIC_MATCH'),
    normalizedMatches: counts('NORMALIZED_MATCH'),
    ambiguousPlayers: counts('AMBIGUOUS'),
    unknownPlayers: counts('UNKNOWN_PLAYER'),
    teamConflicts: counts('TEAM_CONFLICT'),
    eventConflicts: counts('EVENT_CONFLICT'),
    starterConflicts: counts('STARTER_CONFLICT'),
    mappings: results,
    blockers: [...errors, persistence.error].filter(Boolean) as string[],
    warnings: [
      'No historical odds were called.',
      'No scheduled ingestion was enabled.',
      'Provider player IDs are unavailable in observed The Odds API pitcher_outs payloads; provider_id is a deterministic provider-name key and is persisted only after event-team canonical identity certification.',
    ],
  }
}

export function validateTheOddsApiPitcherIdentityBridgeFixtures() {
  const duplicatePlayers = [
    { id: 'p1', display_name: 'Jose Garcia', team_id: 'home', team_name: 'AAA', position: 'SP', status: 'Active', active: true, provider_ids: {}, metadata: {} },
    { id: 'p2', display_name: 'Jose Garcia', team_id: 'away', team_name: 'BBB', position: 'SP', status: 'Active', active: true, provider_ids: {}, metadata: {} },
  ] as PlayerRow[]
  const event = { id: 'event', home_team_id: 'home', away_team_id: 'away', start_time: nowIso() }
  const exactProvider = { providerEventId: 'e', internalEventId: 'event', providerName: 'Will Warren', providerPlayerId: oddsApiProviderPlayerId('Will Warren')!, lines: [14.5], sportsbookCount: 1 }
  const checks = [
    ['accent removal normalizes Sanchez', normalizeOddsApiPitcherName('Cristopher S\u00e1nchez Jr.') === 'CRISTOPHER SANCHEZ'],
    ['punctuation and initials normalize', normalizeOddsApiPitcherName('A.J. Puk') === 'AJ PUK'],
    ['provider name key is deterministic', oddsApiProviderPlayerId('Will Warren') === 'name:will-warren'],
    ['duplicate names on event teams are ambiguous', classifyPitcher({ ...exactProvider, providerName: 'Jose Garcia', providerPlayerId: oddsApiProviderPlayerId('Jose Garcia')! }, event, duplicatePlayers, []).classification === 'AMBIGUOUS'],
    ['team conflict is rejected', classifyPitcher(exactProvider, event, [{ ...duplicatePlayers[0], display_name: 'Will Warren', team_id: 'other' }], []).classification === 'TEAM_CONFLICT'],
    ['unknown player is rejected', classifyPitcher(exactProvider, event, [], []).classification === 'UNKNOWN_PLAYER'],
    ['deterministic event-team full name passes', classifyPitcher(exactProvider, event, [{ ...duplicatePlayers[0], display_name: 'Will Warren', team_id: 'home' }], []).classification === 'DETERMINISTIC_MATCH'],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'the_odds_api_pitcher_identity_bridge_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
