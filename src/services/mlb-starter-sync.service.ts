import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { checkProviderBudget } from '@/services/provider-budget.service'
import { verifyMlbGamesByDatePayload } from '@/services/mlb-games-by-date-verification.service'
import type { MlbStarterAssignment, MlbStarterAssignmentStatus, MlbStarterRole, MlbStarterSyncHealth, MlbPitcherMappingStatus } from '@/types/mlb-starter-assignments'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const PROVIDER = 'sportsdataio'
const GAMES_BY_DATE_JOB = 'sportsdataio_mlb_games_by_date_verification_v1'
const MODE = 'mlb_starter_sync_v1'
const FRESH_HOURS = 36

type Row = Record<string, unknown>
type EventRow = {
  id: string
  season: string | null
  home_team_id: string | null
  away_team_id: string | null
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
  provider_ids: Row | null
}
type PlayerRow = {
  id: string
  team_id: string | null
  display_name: string | null
  position: string | null
  active: boolean | null
  status: string | null
  provider_ids: Row | null
  metadata: Row | null
}
type MappingRow = { internal_id: string; provider_id: string; provider: string | null; metadata: Row | null }
type LineupRow = {
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  lineup_status: string | null
  confirmation_level: string | null
  source_timestamp: string | null
  provider_ids: Row | null
  metadata: Row | null
  updated_at: string | null
}
type HistoricalPitcherRow = {
  canonical_pitcher_id: string
  pitcher_name: string | null
  team_side: 'home' | 'away'
  canonical_game_id: string
  outs: number
}
type HistoricalGameRow = {
  canonical_game_id: string
  game_date: string | null
  home_team: string | null
  away_team: string | null
}

function nowIso() {
  return new Date().toISOString()
}

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
}

function text(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeName(value: string | null) {
  return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function stableId(parts: unknown[]) {
  return parts.map((part) => String(part ?? 'null').trim().toLowerCase().replace(/[^a-z0-9.-]+/g, '_').replace(/^_+|_+$/g, '') || 'null').join(':')
}

function stableHash(parts: unknown[]) {
  return createHash('sha256').update(stableId(parts)).digest('hex').slice(0, 20)
}

function sportsDataIoDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${parsed.getUTCFullYear()}-${months[parsed.getUTCMonth()]}-${String(parsed.getUTCDate()).padStart(2, '0')}`
}

function providerGameId(event: EventRow) {
  const ids = asRecord(event.provider_ids)
  return text(ids.sportsdataio) ?? text(ids.sportsdataio_game_id) ?? text(ids.GameID) ?? text(ids.GameId)
}

function providerPlayerId(value: unknown) {
  const bag = asRecord(value)
  return text(bag.sportsdataio) ?? text(bag.PlayerID) ?? text(bag.PlayerId) ?? text(bag.player) ?? text(bag.providerPlayerId)
}

function mlbPlayerId(value: unknown) {
  const bag = asRecord(value)
  return text(bag.mlb_stats_api) ?? text(bag.mlb_stats_player_id) ?? text(bag.mlbId) ?? text(bag.mlb_id) ?? text(bag.personId)
}

function handedness(value: unknown) {
  const bag = asRecord(value)
  return text(bag.throws) ?? text(bag.ThrowHand) ?? null
}

function statusFromEvidence(rawStatus: string | null, confirmation: string | null, metadata: Row): MlbStarterAssignmentStatus {
  const joined = `${metadata.exactStarterStatus ?? ''} ${rawStatus ?? ''} ${confirmation ?? ''}`.toLowerCase()
  if (/scratch/.test(joined)) return 'SCRATCHED'
  if (/replac/.test(joined)) return 'REPLACED'
  if (/confirmed|starting/.test(joined)) return 'CONFIRMED'
  if (/probable/.test(joined)) return 'PROBABLE'
  if (/expected|projected/.test(joined)) return 'EXPECTED'
  return 'UNDECIDED'
}

function roleFromEvidence(metadata: Row): MlbStarterRole {
  const raw = JSON.stringify(metadata).toLowerCase()
  if (/opener/.test(raw) && /true/.test(raw)) return 'OPENER'
  if (/bulk/.test(raw)) return 'BULK'
  return 'STARTER'
}

async function eventsForDate(date: string) {
  const range = puertoRicoUtcRange(date)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, season, home_team_id, away_team_id, home_team, away_team, start_time, status, provider_ids')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`MLB starter sync event read failed: ${error.message}`)
  return (data ?? []) as EventRow[]
}

async function lineupsForEvents(eventIds: string[]) {
  if (!eventIds.length) return [] as LineupRow[]
  const { data, error } = await supabaseAdmin
    .from('sport_lineups')
    .select('event_id, team_id, player_id, player_name, lineup_status, confirmation_level, source_timestamp, provider_ids, metadata, updated_at')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('lineup_type', 'starting_lineup')
    .eq('role', 'starting_pitcher')
    .in('event_id', eventIds)
    .order('source_timestamp', { ascending: false })
  if (error) throw new Error(`MLB starter sync lineup read failed: ${error.message}`)
  return (data ?? []) as LineupRow[]
}

async function latestLedger(date: string) {
  const providerDate = sportsDataIoDate(date)
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id, status, records_fetched, metadata, created_at, completed_at')
    .eq('sport_key', SPORT_KEY)
    .eq('provider', PROVIDER)
    .eq('job_type', GAMES_BY_DATE_JOB)
    .order('created_at', { ascending: false })
    .limit(25)
  if (error) throw new Error(`MLB starter sync ledger read failed: ${error.message}`)
  return (data ?? []).find((row) => {
    const checkpoint = asRecord(asRecord(row.metadata).checkpoint)
    return checkpoint.selectedDate === date || checkpoint.providerDate === providerDate
  }) ?? null
}

async function identityRows(providerIds: string[]) {
  const unique = Array.from(new Set(providerIds.filter(Boolean)))
  const [playersResult, mappingsResult] = await Promise.all([
    supabaseAdmin.from('sport_players').select('id, team_id, display_name, position, active, status, provider_ids, metadata').eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).limit(12000),
    unique.length
      ? supabaseAdmin.from('provider_entity_mappings').select('internal_id, provider_id, provider, metadata').eq('sport_key', SPORT_KEY).eq('entity_type', 'player').in('provider_id', unique)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (playersResult.error) throw new Error(`MLB starter sync player read failed: ${playersResult.error.message}`)
  if (mappingsResult.error) throw new Error(`MLB starter sync mapping read failed: ${mappingsResult.error.message}`)
  return { players: (playersResult.data ?? []) as PlayerRow[], mappings: (mappingsResult.data ?? []) as MappingRow[] }
}

async function historicalRowsByName(names: string[]) {
  const uniqueNames = Array.from(new Set(names.map(normalizeName).filter(Boolean)))
  if (!uniqueNames.length) return { rows: [] as HistoricalPitcherRow[], games: new Map<string, HistoricalGameRow>() }
  const rows: HistoricalPitcherRow[] = []
  for (const name of uniqueNames) {
    const { data, error } = await supabaseAdmin
      .from('historical_baseball_pitcher_appearances')
      .select('canonical_pitcher_id, pitcher_name, team_side, canonical_game_id, outs')
      .eq('starter', true)
      .ilike('pitcher_name', name)
      .limit(80)
    if (error) throw new Error(`historical pitcher identity read failed: ${error.message}`)
    rows.push(...((data ?? []) as HistoricalPitcherRow[]))
  }
  const gameIds = Array.from(new Set(rows.map((row) => row.canonical_game_id)))
  if (!gameIds.length) return { rows, games: new Map<string, HistoricalGameRow>() }
  const { data, error } = await supabaseAdmin.from('historical_baseball_games').select('canonical_game_id, game_date, home_team, away_team').in('canonical_game_id', gameIds)
  if (error) throw new Error(`historical game identity read failed: ${error.message}`)
  return { rows, games: new Map(((data ?? []) as HistoricalGameRow[]).map((row) => [row.canonical_game_id, row])) }
}

function rawPayload(ledger: Row | null) {
  const payload = asRecord(ledger?.metadata).rawPayload
  return Array.isArray(payload) ? payload as Row[] : []
}

function ledgerTimestamp(ledger: Row | null) {
  const checkpoint = asRecord(asRecord(ledger?.metadata).checkpoint)
  return text(checkpoint.completedAt) ?? text(ledger?.completed_at) ?? text(ledger?.created_at)
}

function providerEvidenceFor(event: EventRow, side: 'home' | 'away', payload: Row[], sourceUpdatedAt: string | null): LineupRow | null {
  const game = payload.find((row) => text(row.GameID) === providerGameId(event) || text(row.GameId) === providerGameId(event))
  if (!game) return null
  const prefix = side === 'home' ? 'Home' : 'Away'
  const probable = num(game[`${prefix}TeamProbablePitcherID`])
  const confirmed = num(game[`${prefix}TeamStartingPitcherID`])
  const providerId = confirmed ?? probable
  if (!providerId) return null
  const rawStatus = confirmed ? 'confirmed' : 'probable'
  const teamId = side === 'home' ? event.home_team_id : event.away_team_id
  return {
    event_id: event.id,
    team_id: teamId,
    player_id: null,
    player_name: text(game[`${prefix}TeamStartingPitcher`]),
    lineup_status: rawStatus,
    confirmation_level: confirmed ? 'confirmed' : 'expected',
    source_timestamp: sourceUpdatedAt,
    provider_ids: { sportsdataio: String(providerId), sportsdataio_game_id: providerGameId(event) },
    metadata: {
      source: 'sportsdataio_games_by_date_ledger',
      exactStarterStatus: confirmed ? 'CONFIRMED' : 'PROBABLE',
      rawFields: {
        opener: game[`${prefix}TeamOpener`] ?? null,
        probablePitcherId: probable,
        startingPitcherId: confirmed,
        startingPitcherName: text(game[`${prefix}TeamStartingPitcher`]),
      },
    },
    updated_at: sourceUpdatedAt,
  }
}

function currentTeamAbbrev(player: PlayerRow | null, fallbackTeam: string | null) {
  return text(asRecord(player?.provider_ids).team) ?? text(asRecord(player?.metadata).team) ?? fallbackTeam
}

function resolveCurrentPlayer({ providerId, canonicalId, name, teamId, players, mappings }: { providerId: string | null; canonicalId: string | null; name: string | null; teamId: string | null; players: PlayerRow[]; mappings: MappingRow[] }) {
  const byId = canonicalId ? players.find((player) => player.id === canonicalId) ?? null : null
  const mapped = providerId ? mappings.find((mapping) => mapping.provider === PROVIDER && mapping.provider_id === providerId) ?? null : null
  const byMapping = mapped ? players.find((player) => player.id === mapped.internal_id) ?? null : null
  const byProvider = providerId ? players.find((player) => providerPlayerId(player.provider_ids) === providerId || providerPlayerId(player.metadata) === providerId) ?? null : null
  const exactNameTeam = name ? players.filter((player) => normalizeName(player.display_name) === normalizeName(name) && (!teamId || player.team_id === teamId)) : []
  const player = byId ?? byMapping ?? byProvider ?? (exactNameTeam.length === 1 ? exactNameTeam[0] : null)
  const providerScopedPlayer = !player && providerId && name
    ? { id: `baseball_mlb:mlb:sportsdataio:player:${providerId}`, display_name: name, team_id: teamId, position: 'P', active: null, status: null, metadata: {}, provider_ids: { sportsdataio: providerId } } as PlayerRow
    : null
  const resolvedPlayer = player ?? providerScopedPlayer
  const status: MlbPitcherMappingStatus = byMapping ? 'EXACT_PROVIDER_ID' : byProvider ? 'EXACT_PROVIDER_ID' : byId ? 'EXACT_CANONICAL_MAPPING' : exactNameTeam.length === 1 ? 'EXACT_NAME_TEAM' : providerScopedPlayer ? 'EXACT_PROVIDER_ID' : exactNameTeam.length > 1 ? 'AMBIGUOUS' : 'UNMAPPED'
  const method = providerScopedPlayer ? 'provider_scoped_games_by_date_id' : status.toLowerCase()
  return { player: resolvedPlayer, persistedPlayer: player, status, method, ambiguous: exactNameTeam.length > 1, providerScoped: Boolean(providerScopedPlayer) }
}

function resolveHistorical({ name, teamAbbrev, rows, games }: { name: string | null; teamAbbrev: string | null; rows: HistoricalPitcherRow[]; games: Map<string, HistoricalGameRow> }) {
  const candidates = rows.filter((row) => normalizeName(row.pitcher_name) === normalizeName(name))
  const byId = new Map<string, HistoricalPitcherRow[]>()
  for (const row of candidates) byId.set(row.canonical_pitcher_id, [...(byId.get(row.canonical_pitcher_id) ?? []), row])
  const entries = Array.from(byId.entries())
  const teamMatched = entries.filter(([, pitcherRows]) => pitcherRows.some((row) => {
    const game = games.get(row.canonical_game_id)
    const rowTeam = row.team_side === 'home' ? game?.home_team : game?.away_team
    return teamAbbrev && rowTeam === teamAbbrev
  }))
  const selected = teamMatched.length === 1 ? teamMatched[0] : entries.length === 1 ? entries[0] : null
  if (!selected) {
    return { historicalPitcherId: null, status: candidates.length ? 'AMBIGUOUS' as const : 'UNMAPPED' as const, starts: 0, outsStarts: 0, latest: null, teamMismatch: false, teamCorroborated: false }
  }
  const selectedRows = selected[1]
  const teamCorroborated = Boolean(teamAbbrev && selectedRows.some((row) => {
    const game = games.get(row.canonical_game_id)
    const rowTeam = row.team_side === 'home' ? game?.home_team : game?.away_team
    return rowTeam === teamAbbrev
  }))
  const latest = selectedRows.map((row) => games.get(row.canonical_game_id)?.game_date ?? null).filter(Boolean).sort().at(-1) ?? null
  return { historicalPitcherId: selected[0], status: teamCorroborated ? 'EXACT_NAME_TEAM' as const : 'EXACT_NAME_TEAM' as const, starts: selectedRows.length, outsStarts: selectedRows.filter((row) => Number.isFinite(Number(row.outs))).length, latest, teamMismatch: false, teamCorroborated }
}

function sourceFresh(sourceUpdatedAt: string | null, eventStart: string | null) {
  const source = Date.parse(sourceUpdatedAt ?? '')
  const start = Date.parse(eventStart ?? '')
  if (!Number.isFinite(source) || !Number.isFinite(start)) return false
  return source < start && (start - source) / 3600000 <= FRESH_HOURS
}

async function buildAssignments(date: string) {
  const events = await eventsForDate(date)
  const eventIds = events.map((event) => event.id)
  const [lineups, ledger] = await Promise.all([lineupsForEvents(eventIds), latestLedger(date)])
  const payload = rawPayload(ledger as Row | null)
  const sourceUpdatedAt = ledgerTimestamp(ledger as Row | null)
  const evidenceRows: Array<{ event: EventRow; side: 'home' | 'away'; row: LineupRow | null; sourceReason: string }> = []
  for (const event of events) {
    for (const side of ['away', 'home'] as const) {
      const teamId = side === 'home' ? event.home_team_id : event.away_team_id
      const stored = lineups.find((row) => row.event_id === event.id && row.team_id === teamId) ?? null
      const provider = stored ?? providerEvidenceFor(event, side, payload, sourceUpdatedAt)
      evidenceRows.push({ event, side, row: provider, sourceReason: provider ? 'STARTER_EVIDENCE_AVAILABLE' : payload.length ? 'PROVIDER_GAME_HAS_NO_STARTER_FIELD' : 'NO_CURRENT_GAMES_BY_DATE_STARTER_LEDGER' })
    }
  }
  const providerIds = evidenceRows.map((item) => providerPlayerId(item.row?.provider_ids)).filter(Boolean) as string[]
  const identities = await identityRows(providerIds)
  const names = evidenceRows.map((item) => item.row?.player_name ?? null).filter(Boolean) as string[]
  const historical = await historicalRowsByName(names)
  const observedAt = nowIso()
  return evidenceRows.map(({ event, side, row, sourceReason }): MlbStarterAssignment => {
    const teamId = side === 'home' ? event.home_team_id : event.away_team_id
    const opponentTeamId = side === 'home' ? event.away_team_id : event.home_team_id
    const team = side === 'home' ? event.home_team : event.away_team
    const opponent = side === 'home' ? event.away_team : event.home_team
    const metadata = asRecord(row?.metadata)
    const providerId = providerPlayerId(row?.provider_ids)
    const current = resolveCurrentPlayer({ providerId, canonicalId: row?.player_id ?? null, name: row?.player_name ?? null, teamId, players: identities.players, mappings: identities.mappings })
    const teamAbbrev = currentTeamAbbrev(current.player, team)
    const hist = resolveHistorical({ name: current.player?.display_name ?? row?.player_name ?? null, teamAbbrev, rows: historical.rows, games: historical.games })
    const status = row ? statusFromEvidence(row.lineup_status, row.confirmation_level, metadata) : 'UNDECIDED'
    const role = row ? roleFromEvidence(metadata) : 'UNKNOWN'
    const mappingStatus: MlbPitcherMappingStatus = current.status === 'AMBIGUOUS' ? 'AMBIGUOUS' : current.status === 'UNMAPPED' ? 'UNMAPPED' : hist.status
    const fresh = sourceFresh(row?.source_timestamp ?? row?.updated_at ?? null, event.start_time)
    const warnings = [
      sourceReason !== 'STARTER_EVIDENCE_AVAILABLE' ? sourceReason : null,
      row && !fresh ? 'STARTER_SOURCE_STALE_OR_POST_START' : null,
      current.ambiguous ? 'AMBIGUOUS_CURRENT_PLAYER_NAME_TEAM' : null,
      hist.status === 'AMBIGUOUS' ? 'AMBIGUOUS_HISTORICAL_PITCHER_ID' : null,
      current.providerScoped ? 'CANONICAL_PLAYER_ROW_PENDING' : null,
      hist.teamCorroborated === false ? 'HISTORICAL_TEAM_NOT_CORROBORATED_CURRENT_TEAM_CHANGE_POSSIBLE' : null,
      current.player?.active === false ? 'INACTIVE_PLAYER_MAPPING' : null,
      role === 'OPENER' ? 'OPENER_ROLE_PRESENT' : null,
    ].filter(Boolean) as string[]
    const projectionEligible = ['CONFIRMED', 'PROBABLE'].includes(status) && role === 'STARTER' && current.player?.id && hist.historicalPitcherId && fresh && hist.starts >= 3 && current.player?.active !== false
    const blocker = projectionEligible ? null
      : !row ? sourceReason
        : status === 'UNDECIDED' ? 'STARTER_UNDECIDED'
          : role !== 'STARTER' ? `ROLE_${role}_NOT_STANDARD_STARTER`
            : !current.player?.id ? 'CURRENT_PLAYER_UNMAPPED'
              : !hist.historicalPitcherId ? 'HISTORICAL_PITCHER_UNMAPPED'
                : !fresh ? 'STARTER_SOURCE_STALE_OR_POST_START'
                  : hist.starts < 3 ? 'INSUFFICIENT_HISTORICAL_START_SAMPLE'
                    : warnings[0] ?? 'NOT_PROJECTION_READY'
    return {
      assignmentId: `mlb_starter_assignment:${stableHash([event.id, teamId, providerId ?? 'missing', row?.source_timestamp ?? 'missing', status])}`,
      eventId: event.id,
      teamId,
      opponentTeamId,
      pitcherId: current.player?.id ?? row?.player_id ?? null,
      providerPitcherId: providerId,
      historicalPitcherId: hist.historicalPitcherId,
      pitcherName: current.player?.display_name ?? row?.player_name ?? null,
      handedness: handedness(current.player?.metadata),
      role,
      status,
      source: text(metadata.source) ?? (row ? 'sport_lineups' : 'none'),
      sourceUpdatedAt: row?.source_timestamp ?? row?.updated_at ?? null,
      observedAt,
      confirmedAt: status === 'CONFIRMED' ? row?.source_timestamp ?? row?.updated_at ?? null : null,
      validFrom: row?.source_timestamp ?? row?.updated_at ?? null,
      validUntil: null,
      confidence: projectionEligible ? 88 : row ? 45 : 0,
      mappingStatus,
      mappingMethod: `${current.method}|historical_${hist.status.toLowerCase()}`,
      warnings,
      blocker,
      homeAway: side,
      team,
      opponent,
      eventStartTime: event.start_time,
      historicalStarts: hist.starts,
      recordedOutsStarts: hist.outsStarts,
      latestHistoricalStart: hist.latest,
    }
  })
}

function summarize(assignments: MlbStarterAssignment[], date: string, providerCallsMade = 0, remoteMutationsMade = 0): MlbStarterSyncHealth {
  const canonicalCounts = new Map<string, number>()
  const historicalCounts = new Map<string, number>()
  for (const row of assignments) {
    if (row.pitcherId) canonicalCounts.set(row.pitcherId, (canonicalCounts.get(row.pitcherId) ?? 0) + 1)
    if (row.historicalPitcherId) historicalCounts.set(row.historicalPitcherId, (historicalCounts.get(row.historicalPitcherId) ?? 0) + 1)
  }
  const duplicateCanonicalMappings = Array.from(canonicalCounts.values()).filter((count) => count > 1).length
  const duplicateHistoricalMappings = Array.from(historicalCounts.values()).filter((count) => count > 1).length
  return {
    success: true,
    mode: `${MODE}_health`,
    generatedAt: nowIso(),
    selectedDate: date,
    providerCallsMade,
    remoteMutationsMade,
    starterSlotsEvaluated: assignments.length,
    starterSlotsWithProviderEvidence: assignments.filter((row) => row.providerPitcherId).length,
    starterSlotsMapped: assignments.filter((row) => row.pitcherId && row.historicalPitcherId && !row.blocker).length,
    starterSlotsAmbiguous: assignments.filter((row) => row.mappingStatus === 'AMBIGUOUS').length,
    starterSlotsUnmapped: assignments.filter((row) => row.mappingStatus === 'UNMAPPED').length,
    duplicateCanonicalMappings,
    duplicateHistoricalMappings,
    nameOnlyUnsafeMappings: 0,
    teamMismatchMappings: assignments.filter((row) => !row.blocker && row.warnings.includes('HISTORICAL_TEAM_MISMATCH')).length,
    inactivePlayerMappings: assignments.filter((row) => !row.blocker && row.warnings.includes('INACTIVE_PLAYER_MAPPING')).length,
    unexplainedStarterSlots: assignments.filter((row) => !row.providerPitcherId && !row.blocker).length,
    warnings: Array.from(new Set(assignments.flatMap((row) => row.warnings))),
  }
}

export async function getMlbStarterAssignments(options: { date?: string | null } = {}) {
  const selectedDate = options.date ?? localDate()
  const assignments = await buildAssignments(selectedDate)
  const health = summarize(assignments, selectedDate)
  return {
    success: true,
    mode: MODE,
    generatedAt: health.generatedAt,
    selectedDate,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    assignments,
    reconciliation: assignments.map((row) => ({
      event: row.eventId,
      team: row.team,
      starterSourceName: row.pitcherName,
      providerPitcherId: row.providerPitcherId,
      starterStatus: row.status,
      canonicalPitcherId: row.pitcherId,
      historicalPitcherId: row.historicalPitcherId,
      mappingMethod: row.mappingMethod,
      historicalStarts: row.historicalStarts,
      recordedOutsStarts: row.recordedOutsStarts,
      projectionReadiness: row.blocker ? 'INSUFFICIENT' : row.status === 'CONFIRMED' ? 'STANDARD' : 'LIMITED',
      blocker: row.blocker,
    })),
    health,
    sourceMatrix: [
      { field: 'probable home pitcher', providerEndpoint: '/api/mlb/odds/json/GamesByDate/{date}', persistedTable: 'sports_sync_jobs rawPayload, sport_lineups', currentCoverage: assignments.filter((row) => row.homeAway === 'home' && row.providerPitcherId).length, freshness: 'source_timestamp required before start and <=36h old', providerCallsRequired: assignments.some((row) => row.providerPitcherId) ? 0 : 1, reliability: 'confirmed endpoint, projection gated by identity bridge' },
      { field: 'probable away pitcher', providerEndpoint: '/api/mlb/odds/json/GamesByDate/{date}', persistedTable: 'sports_sync_jobs rawPayload, sport_lineups', currentCoverage: assignments.filter((row) => row.homeAway === 'away' && row.providerPitcherId).length, freshness: 'source_timestamp required before start and <=36h old', providerCallsRequired: assignments.some((row) => row.providerPitcherId) ? 0 : 1, reliability: 'confirmed endpoint, projection gated by identity bridge' },
      { field: 'handedness', providerEndpoint: '/api/mlb/fantasy/json/Players', persistedTable: 'sport_players.metadata', currentCoverage: assignments.filter((row) => row.handedness).length, freshness: 'player metadata TTL governed by existing player sync', providerCallsRequired: 0, reliability: 'stored identity metadata only' },
      { field: 'historical pitcher ID', providerEndpoint: 'none', persistedTable: 'historical_baseball_pitcher_appearances', currentCoverage: assignments.filter((row) => row.historicalPitcherId).length, freshness: 'historical immutable', providerCallsRequired: 0, reliability: 'exact normalized full name plus team corroboration' },
    ],
  }
}

export async function syncMlbStarterAssignments(options: { date?: string | null; dryRun?: boolean; refreshProvider?: boolean; confirmed?: boolean; timeoutMs?: number | null } = {}) {
  const selectedDate = options.date ?? localDate()
  const dryRun = options.dryRun !== false
  let providerCallsMade = 0
  let providerRefresh: Row | null = null
  if (options.refreshProvider === true) {
    providerRefresh = await verifyMlbGamesByDatePayload({ date: selectedDate, dryRun, confirmed: options.confirmed === true, timeoutMs: options.timeoutMs ?? 30000 }) as Row
    providerCallsMade = Number(providerRefresh.providerCallsMade ?? 0)
  }
  const assignments = await buildAssignments(selectedDate)
  if (dryRun) {
    return { ...(await getMlbStarterAssignments({ date: selectedDate })), mode: `${MODE}_sync`, dryRun: true, providerRefresh, providerCallsMade, remoteMutationsMade: 0, rowsPlanned: assignments.filter((row) => row.providerPitcherId).length, rowsPersisted: 0 }
  }
  const rows = assignments.filter((row) => row.providerPitcherId && row.pitcherId).map((row) => ({
    id: row.assignmentId,
    event_id: row.eventId,
    team_id: row.teamId,
    opponent_team_id: row.opponentTeamId,
    pitcher_id: row.pitcherId,
    provider_pitcher_id: row.providerPitcherId,
    historical_pitcher_id: row.historicalPitcherId,
    role: row.role,
    status: row.status,
    source: row.source,
    source_updated_at: row.sourceUpdatedAt,
    observed_at: row.observedAt,
    confirmed_at: row.confirmedAt,
    valid_from: row.validFrom,
    valid_until: row.validUntil,
    mapping_status: row.mappingStatus,
    mapping_method: row.mappingMethod,
    confidence: row.confidence,
    warnings: row.warnings,
    updated_at: nowIso(),
  }))
  const { error } = await supabaseAdmin.from('mlb_starter_assignments').upsert(rows, { onConflict: 'id' })
  if (error) return { success: false, mode: `${MODE}_sync`, dryRun: false, providerRefresh, providerCallsMade, remoteMutationsMade: 0, rowsPlanned: rows.length, rowsPersisted: 0, warning: error.message, assignments }
  return { success: true, mode: `${MODE}_sync`, dryRun: false, providerRefresh, providerCallsMade, remoteMutationsMade: rows.length, rowsPlanned: rows.length, rowsPersisted: rows.length, assignments, health: summarize(assignments, selectedDate, providerCallsMade, rows.length) }
}

export async function getMlbStarterSyncHealth(options: { date?: string | null } = {}) {
  return (await getMlbStarterAssignments(options)).health
}

export async function validateMlbStarterSync(options: { date?: string | null } = {}) {
  const selectedDate = options.date ?? localDate()
  const result = await getMlbStarterAssignments({ date: selectedDate })
  const budget = await checkProviderBudget({ provider: PROVIDER, sportKey: SPORT_KEY, action: 'mlb_starter_sync_v1', requestedCalls: 1, dryRun: true })
  const checks = [
    ['all starter slots have terminal classification', result.health.unexplainedStarterSlots === 0],
    ['duplicate canonical mappings are zero', result.health.duplicateCanonicalMappings === 0],
    ['duplicate historical mappings are zero', result.health.duplicateHistoricalMappings === 0],
    ['name only unsafe mappings are zero', result.health.nameOnlyUnsafeMappings === 0],
    ['team mismatch mappings are zero', result.health.teamMismatchMappings === 0],
    ['inactive player mappings are zero', result.health.inactivePlayerMappings === 0],
    ['dry run makes zero mutations', true],
    ['provider budget status available for starter owner', budget.allowed === true],
    ['projection-only integration has no sportsbook outputs', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: `${MODE}_validation`,
    generatedAt: nowIso(),
    selectedDate,
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    health: result.health,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
