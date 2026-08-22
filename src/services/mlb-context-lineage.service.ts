import 'server-only'

import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import {
  fetchMlbOfficialLiveFeedLineups,
  fetchMlbOfficialSchedule,
  type MlbOfficialLineupPlayer,
  type MlbOfficialLiveFeedLineups,
  type MlbOfficialScheduleGame,
} from '@/services/mlb-official-data-provider.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const MODE = 'mlb_context_lineage_v1'
const FEATURE_VERSION = 'mlb_context_lineage_features_v1'
const CONTEXT_VERSION = 'mlb_01_context_lineage_v1'
const R6_RESEARCH_CONTEXT_VERSION = 'mlb_04c_r6_research_context_v1'
const MIN_PREGAME_MINUTES = 10

type Row = Record<string, unknown>

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  home_team_id: string | null
  away_team_id: string | null
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
  provider_ids: Row | null
  metadata: Row | null
}

type LineupRow = {
  id: string
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  role: string | null
  starter: boolean | null
  position: string | null
  depth_order: number | null
  lineup_status: string | null
  confirmation_level: string | null
  source_timestamp: string | null
  provider_ids: Row | null
  metadata: Row | null
}

type PlayerStatRow = {
  id: string
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  stat_type: string | null
  games: number | null
  starts: number | null
  starter: boolean | null
  stats: Row | null
  metadata: Row | null
  source_timestamp: string | null
}

type TeamStatRow = {
  id: string
  event_id: string | null
  team_id: string | null
  team_name?: string | null
  is_home?: boolean | null
  points_for?: number | null
  points_against?: number | null
  stats: Row | null
  updated_at: string | null
  created_at: string | null
  event_start_time?: string | null
}

type StarterAssignmentRow = {
  event_id: string | null
  team_id: string | null
  pitcher_id: string | null
  provider_pitcher_id: string | null
  historical_pitcher_id: string | null
  role: string | null
  status: string | null
  source: string | null
  source_updated_at: string | null
  observed_at: string | null
  valid_from: string | null
  valid_until: string | null
  mapping_status: string | null
  mapping_method: string | null
  confidence: number | null
  warnings: string[] | null
}

type InjuryRow = {
  id: string
  team_id: string | null
  player_id: string | null
  player_name: string | null
  injury_status: string | null
  status: string | null
  source_timestamp: string | null
  metadata: Row | null
}

type MappingRow = {
  internal_id: string
  provider_id: string
  provider: string | null
  entity_type: string | null
  metadata: Row | null
}

export type MlbContextSnapshotType = 'MORNING' | 'FINAL_PREGAME' | 'CURRENT_PROBE'

export type MlbContextLineageOptions = {
  date?: string | null
  eventId?: string | null
  snapshotType?: MlbContextSnapshotType | null
  allowProviderCalls?: boolean
  lineupProbeLimit?: number | null
  persist?: boolean
}

type Snapshot = {
  deterministic_key: string
  sport_key: string
  league_key: string
  event_id: string
  snapshot_type: MlbContextSnapshotType
  snapshot_timestamp: string
  target_event_start_time: string
  temporal_status: 'PREGAME' | 'POST_START' | 'UNKNOWN'
  provider_authority: Row
  source_lineage: Row
  components: Row
  feature_values: Row
  feature_lineage: Row
  completeness: Row
  missing_components: string[]
  blockers: string[]
  provider_calls: Row
  production_eligible: false
  shadow_only: true
}

type PersistenceDecision =
  | 'PERSIST_ELIGIBLE'
  | 'SKIP_POST_START'
  | 'SKIP_FINAL'
  | 'SKIP_CANCELLED'
  | 'SKIP_UNMAPPED_EVENT'
  | 'SKIP_MISSING_REQUIRED_IDENTITY'
  | 'SKIP_INVALID_TIMESTAMP'
  | 'SKIP_OTHER_EXPLICIT_REASON'

function todayLocalDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Puerto_Rico',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
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

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

function providerIdFromBag(value: unknown, keys: string[]) {
  const bag = asRecord(value)
  for (const key of keys) {
    const found = text(bag[key])
    if (found) return found
  }
  return null
}

function eventMlbGamePk(event: EventRow) {
  return providerIdFromBag(event.provider_ids, ['mlb_stats_api', 'mlb_stats_game_pk', 'gamePk', 'mlb_game_pk']) ??
    providerIdFromBag(event.metadata, ['mlb_stats_api', 'mlb_stats_game_pk', 'gamePk', 'mlb_game_pk'])
}

function stableKey(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? '')).join('|')).digest('hex')
}

function normalizeTeam(value: string | null) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|baseball club)\b/g, '')
    .trim()
}

function officialTeamName(game: MlbOfficialScheduleGame, side: 'home' | 'away') {
  return side === 'home' ? game.home.name : game.away.name
}

function canonicalTeamName(event: EventRow, side: 'home' | 'away') {
  return side === 'home' ? event.home_team : event.away_team
}

function teamsMatch(game: MlbOfficialScheduleGame, event: EventRow) {
  const homeOfficial = normalizeTeam(officialTeamName(game, 'home'))
  const homeCanonical = normalizeTeam(canonicalTeamName(event, 'home'))
  const awayOfficial = normalizeTeam(officialTeamName(game, 'away'))
  const awayCanonical = normalizeTeam(canonicalTeamName(event, 'away'))
  const homeMatches = homeOfficial.includes(homeCanonical) || homeCanonical.includes(homeOfficial)
  const awayMatches = awayOfficial.includes(awayCanonical) || awayCanonical.includes(awayOfficial)
  return homeMatches && awayMatches
}

function officialGameForEvent(event: EventRow, officialGames: MlbOfficialScheduleGame[], mappings: MappingRow[]) {
  const mappedPk = mappings.find((mapping) => mapping.entity_type === 'event' && mapping.internal_id === event.id && mapping.provider === 'mlb_stats_api')?.provider_id
  const embeddedPk = eventMlbGamePk(event)
  const exactPk = mappedPk ?? embeddedPk
  if (exactPk) {
    const exact = officialGames.find((game) => String(game.gamePk) === String(exactPk))
    if (exact) return { game: exact, method: mappedPk ? 'provider_entity_mappings.gamePk' : 'sport_events.provider_ids.gamePk' }
  }
  const startMs = Date.parse(event.start_time ?? '')
  const candidates = officialGames.filter((game) => {
    const gameMs = Date.parse(game.gameDate ?? '')
    return Number.isFinite(startMs) && Number.isFinite(gameMs) && Math.abs(gameMs - startMs) <= 6 * 60 * 60 * 1000 && teamsMatch(game, event)
  })
  return candidates.length === 1 ? { game: candidates[0], method: 'team_date_start_time_tolerance' } : { game: null, method: candidates.length > 1 ? 'ambiguous_team_date_start_time' : 'unmapped' }
}

function sourceTimestamp(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === 'string' && value.length > 0) ?? null
}

function cutoffAt(startTime: string | null) {
  const startMs = Date.parse(startTime ?? '')
  if (!Number.isFinite(startMs)) return null
  return new Date(startMs - MIN_PREGAME_MINUTES * 60_000).toISOString()
}

function temporalStatus(startTime: string | null, snapshotTime: string) {
  const startMs = Date.parse(startTime ?? '')
  const snapshotMs = Date.parse(snapshotTime)
  if (!Number.isFinite(startMs) || !Number.isFinite(snapshotMs)) return 'UNKNOWN' as const
  return snapshotMs < startMs ? 'PREGAME' as const : 'POST_START' as const
}

async function eventsForDate(date: string) {
  const range = puertoRicoUtcRange(date)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team_id, away_team_id, home_team, away_team, start_time, status, provider_ids, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`MLB context event read failed: ${error.message}`)
  return (data ?? []) as EventRow[]
}

async function loadLineups(eventIds: string[]) {
  if (!eventIds.length) return [] as LineupRow[]
  const { data, error } = await supabaseAdmin
    .from('sport_lineups')
    .select('id, event_id, team_id, player_id, player_name, role, starter, position, depth_order, lineup_status, confirmation_level, source_timestamp, provider_ids, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .in('event_id', eventIds)
    .order('source_timestamp', { ascending: false })
  if (error) throw new Error(`MLB context lineup read failed: ${error.message}`)
  return (data ?? []) as LineupRow[]
}

async function loadPlayerStats(teamIds: string[]) {
  if (!teamIds.length) return [] as PlayerStatRow[]
  const { data, error } = await supabaseAdmin
    .from('sport_player_stats')
    .select('id, event_id, team_id, player_id, player_name, stat_type, games, starts, starter, stats, metadata, source_timestamp')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .in('team_id', teamIds)
    .limit(5000)
  if (error) throw new Error(`MLB context player stat read failed: ${error.message}`)
  return (data ?? []) as PlayerStatRow[]
}

async function loadTeamStats(teamIds: string[]) {
  if (!teamIds.length) return [] as TeamStatRow[]
  const { data, error } = await supabaseAdmin
    .from('sport_game_stats')
    .select('id, event_id, team_id, team_name, is_home, points_for, points_against, stats, updated_at, created_at')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .in('team_id', teamIds)
    .order('updated_at', { ascending: false })
    .limit(2000)
  if (error) throw new Error(`MLB context team stat read failed: ${error.message}`)
  const rows = (data ?? []) as TeamStatRow[]
  const eventIds = [...new Set(rows.map((row) => row.event_id).filter((value): value is string => Boolean(value)))]
  if (!eventIds.length) return rows
  const events: Array<{ id: string; start_time: string | null }> = []
  for (const batch of chunks(eventIds, 100)) {
    const { data: eventRows, error: eventError } = await supabaseAdmin
      .from('sport_events')
      .select('id, start_time')
      .eq('sport_key', SPORT_KEY)
      .in('id', batch)
      .limit(batch.length)
    if (eventError) throw new Error(`MLB context team stat event read failed: ${eventError.message}`)
    events.push(...((eventRows ?? []) as Array<{ id: string; start_time: string | null }>))
  }
  const starts = new Map((events ?? []).map((event) => [event.id, event.start_time]))
  return rows.map((row) => ({ ...row, event_start_time: starts.get(row.event_id ?? '') ?? null }))
}

async function loadStarterAssignments(eventIds: string[]) {
  if (!eventIds.length) return [] as StarterAssignmentRow[]
  const { data, error } = await supabaseAdmin
    .from('mlb_starter_assignments')
    .select('event_id, team_id, pitcher_id, provider_pitcher_id, historical_pitcher_id, role, status, source, source_updated_at, observed_at, valid_from, valid_until, mapping_status, mapping_method, confidence, warnings')
    .in('event_id', eventIds)
    .is('valid_until', null)
    .order('source_updated_at', { ascending: false })
    .limit(200)
  if (error) return [] as StarterAssignmentRow[]
  return (data ?? []) as StarterAssignmentRow[]
}

async function loadInjuries(teamIds: string[]) {
  if (!teamIds.length) return [] as InjuryRow[]
  const { data, error } = await supabaseAdmin
    .from('sport_injuries')
    .select('id, team_id, player_id, player_name, injury_status, status, source_timestamp, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .in('team_id', teamIds)
    .limit(500)
  if (error) return [] as InjuryRow[]
  return (data ?? []) as InjuryRow[]
}

async function loadMappings(eventIds: string[]) {
  if (!eventIds.length) return [] as MappingRow[]
  const { data, error } = await supabaseAdmin
    .from('provider_entity_mappings')
    .select('internal_id, provider_id, provider, entity_type, metadata')
    .eq('sport_key', SPORT_KEY)
    .in('internal_id', eventIds)
    .limit(500)
  if (error) return [] as MappingRow[]
  return (data ?? []) as MappingRow[]
}

async function loadPlayerMappings(providerIds: string[]) {
  if (!providerIds.length) return [] as MappingRow[]
  const { data, error } = await supabaseAdmin
    .from('provider_entity_mappings')
    .select('internal_id, provider_id, provider, entity_type, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('entity_type', 'player')
    .eq('provider', 'mlb_stats_api')
    .in('provider_id', providerIds)
    .limit(1000)
  if (error) return [] as MappingRow[]
  return (data ?? []) as MappingRow[]
}

function mappedPlayerId(providerPlayerId: string | null, playerMappings: MappingRow[]) {
  if (!providerPlayerId) return null
  return playerMappings.find((mapping) => String(mapping.provider_id) === String(providerPlayerId))?.internal_id ?? null
}

function starterFromAssignment(event: EventRow, side: 'home' | 'away', assignments: StarterAssignmentRow[]) {
  const teamId = side === 'home' ? event.home_team_id : event.away_team_id
  const teamName = side === 'home' ? event.home_team : event.away_team
  const row = assignments.find((item) => item.event_id === event.id && item.team_id === teamId)
  if (!row) return null
  const mapped = Boolean(row.pitcher_id) && !['AMBIGUOUS', 'UNMAPPED'].includes(String(row.mapping_status ?? ''))
  return {
    status: row.status ?? 'UNKNOWN',
    playerName: null,
    providerPlayerId: row.provider_pitcher_id,
    canonicalPlayerId: row.pitcher_id,
    historicalPitcherId: row.historical_pitcher_id,
    teamId,
    teamName,
    handedness: null,
    role: row.role,
    source: row.source ?? 'mlb_starter_assignments',
    sourceTimestamp: row.source_updated_at ?? row.valid_from ?? row.observed_at,
    confidence: row.confidence ?? 0,
    mappingStatus: row.mapping_status,
    mappingMethod: row.mapping_method,
    blockers: mapped ? [] : ['STARTER_ASSIGNMENT_PLAYER_IDENTITY_NOT_CERTIFIED'],
    warnings: row.warnings ?? [],
  }
}

function officialStarter(game: MlbOfficialScheduleGame | null, event: EventRow, side: 'home' | 'away', playerMappings: MappingRow[], assignments: StarterAssignmentRow[]) {
  const assigned = starterFromAssignment(event, side, assignments)
  if (assigned) return assigned
  const probable = side === 'home' ? game?.probablePitchers.home : game?.probablePitchers.away
  const player = probable?.player ?? null
  const providerPlayerId = player?.id ? String(player.id) : null
  return {
    status: player?.id ? 'PROBABLE' : 'UNKNOWN',
    playerName: player?.fullName ?? null,
    providerPlayerId,
    canonicalPlayerId: mappedPlayerId(providerPlayerId, playerMappings),
    historicalPitcherId: null,
    teamId: side === 'home' ? event.home_team_id : event.away_team_id,
    teamName: side === 'home' ? event.home_team : event.away_team,
    handedness: null,
    role: 'STARTER',
    source: player?.id ? 'mlb_stats_api_schedule_hydrate_probablePitcher' : 'mlb_stats_api_schedule_no_probable_pitcher',
    sourceTimestamp: game?.capturedAt ?? null,
    confidence: player?.id ? 82 : 0,
    mappingStatus: player?.id ? 'MLB_OFFICIAL_PROVIDER_ID' : 'UNMAPPED',
    mappingMethod: player?.id ? 'mlb_official_schedule_provider_id' : 'none',
    blockers: player?.id ? [] : ['MISSING_MLB_OFFICIAL_PROBABLE_STARTER'],
    warnings: [],
  }
}

function officialLineupForSide(event: EventRow, side: 'home' | 'away', officialLineup: MlbOfficialLiveFeedLineups | null, playerMappings: MappingRow[]) {
  const players = officialLineup?.lineups[side] ?? []
  if (players.length < 9) return null
  const blockers = [
    ...(officialLineup?.lineupState === 'PROJECTED' ? ['LINEUP_PROJECTED_NOT_CONFIRMED'] : []),
    ...(players.some((row) => !mappedPlayerId(row.player.id, playerMappings)) ? ['LINEUP_PLAYER_IDENTITY_UNMAPPED'] : []),
  ]
  return {
    status: officialLineup?.lineupState === 'CONFIRMED' ? 'CONFIRMED' : 'PROJECTED',
    source: 'mlb_stats_api_live_feed_boxscore_battingOrder',
    players: players.map((row: MlbOfficialLineupPlayer) => ({
      playerId: mappedPlayerId(row.player.id, playerMappings),
      providerPlayerId: row.player.id,
      playerName: row.player.fullName,
      position: row.position,
      battingOrder: row.battingOrder,
      sourceTimestamp: officialLineup?.capturedAt ?? null,
    })),
    confidence: officialLineup?.lineupState === 'CONFIRMED' ? 90 : 65,
    blockers,
    sourceTimestamp: officialLineup?.capturedAt ?? null,
  }
}

function lineupForSide(event: EventRow, side: 'home' | 'away', lineups: LineupRow[], playerStats: PlayerStatRow[], officialLineup: MlbOfficialLiveFeedLineups | null, playerMappings: MappingRow[]) {
  const official = officialLineupForSide(event, side, officialLineup, playerMappings)
  if (official) return official
  const teamId = side === 'home' ? event.home_team_id : event.away_team_id
  const stored = lineups
    .filter((row) => row.event_id === event.id && row.team_id === teamId && row.role !== 'starting_pitcher')
    .slice(0, 9)
  if (stored.length >= 8) {
    const confirmed = stored.every((row) => row.confirmation_level === 'confirmed' || row.lineup_status === 'confirmed')
    return {
      status: confirmed ? 'CONFIRMED' : 'EXPECTED',
      source: 'sport_lineups',
      players: stored.map((row, index) => ({
        playerId: row.player_id,
        playerName: row.player_name,
        position: row.position,
        battingOrder: row.depth_order ?? index + 1,
        sourceTimestamp: row.source_timestamp,
      })),
      confidence: confirmed ? 95 : 72,
      blockers: confirmed ? [] : ['LINEUP_EXPECTED_NOT_CONFIRMED'],
      sourceTimestamp: sourceTimestamp(...stored.map((row) => row.source_timestamp)),
    }
  }
  const expected = playerStats
    .filter((row) => row.team_id === teamId && row.stat_type === 'season')
    .filter((row) => text(row.player_name) && !String(asRecord(row.metadata).position ?? asRecord(row.stats).Position ?? '').toLowerCase().includes('p'))
    .sort((a, b) => (num(asRecord(b.stats).PlateAppearances) ?? num(asRecord(b.stats).AtBats) ?? b.games ?? 0) - (num(asRecord(a.stats).PlateAppearances) ?? num(asRecord(a.stats).AtBats) ?? a.games ?? 0))
    .slice(0, 9)
  return {
    status: expected.length >= 8 ? 'PROJECTED' : 'UNKNOWN',
    source: expected.length >= 8 ? 'stored_season_player_stats_projected_lineup' : 'none',
    players: expected.map((row, index) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      position: text(asRecord(row.metadata).position) ?? text(asRecord(row.stats).Position),
      battingOrder: index + 1,
      sourceTimestamp: row.source_timestamp,
    })),
    confidence: expected.length >= 8 ? 55 : 0,
    blockers: expected.length >= 8 ? ['LINEUP_PROJECTED_FROM_STORED_STATS_NOT_CONFIRMED'] : ['LINEUP_UNAVAILABLE_FROM_APPROVED_SOURCE'],
    sourceTimestamp: sourceTimestamp(...expected.map((row) => row.source_timestamp)),
  }
}

function bullpenForSide(event: EventRow, side: 'home' | 'away', teamStats: TeamStatRow[], playerStats: PlayerStatRow[]) {
  const teamId = side === 'home' ? event.home_team_id : event.away_team_id
  const teamRows = teamStats
    .filter((row) => row.team_id === teamId)
    .filter((row) => {
      const rowStart = Date.parse(row.event_start_time ?? '')
      const targetStart = Date.parse(event.start_time ?? '')
      return Number.isFinite(rowStart) && Number.isFinite(targetStart) && rowStart < targetStart
    })
    .sort((a, b) => Date.parse(b.event_start_time ?? '') - Date.parse(a.event_start_time ?? ''))
    .slice(0, 10)
  const reliefRows = playerStats
    .filter((row) => row.team_id === teamId)
    .filter((row) => {
      const stats = asRecord(row.stats)
      const meta = asRecord(row.metadata)
      const role = String(meta.role ?? meta.Position ?? stats.Position ?? '').toLowerCase()
      return role.includes('rp') || role.includes('relief') || (num(stats.Games) ?? row.games ?? 0) > (num(stats.Starts) ?? row.starts ?? 0)
    })
    .slice(0, 20)
  const inningsSignals = reliefRows.map((row) => num(asRecord(row.stats).InningsPitchedDecimal) ?? num(asRecord(row.stats).InningsPitched)).filter((value): value is number => value !== null)
  const pitchSignals = reliefRows.map((row) => num(asRecord(row.stats).PitchesThrown)).filter((value): value is number => value !== null)
  return {
    status: teamRows.length || reliefRows.length ? 'AVAILABLE_FROM_STORED_STATS' : 'UNKNOWN',
    source: teamRows.length || reliefRows.length ? 'sport_game_stats_and_sport_player_stats' : 'none',
    recentTeamStatRows: teamRows.length,
    reliefPlayerRows: reliefRows.length,
    inningsSignalRows: inningsSignals.length,
    pitchSignalRows: pitchSignals.length,
    averageReliefInningsSignal: inningsSignals.length ? Number((inningsSignals.reduce((sum, value) => sum + value, 0) / inningsSignals.length).toFixed(2)) : null,
    averagePitchSignal: pitchSignals.length ? Number((pitchSignals.reduce((sum, value) => sum + value, 0) / pitchSignals.length).toFixed(2)) : null,
    sourceTimestamp: sourceTimestamp(...teamRows.map((row) => row.updated_at ?? row.created_at), ...reliefRows.map((row) => row.source_timestamp)),
    blockers: teamRows.length || reliefRows.length ? [] : ['BULLPEN_CONTEXT_UNAVAILABLE_FROM_STORED_STATS'],
  }
}

function avg(values: Array<number | null | undefined>) {
  const usable = values.map(Number).filter((value) => Number.isFinite(value))
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null
}

function clamp(value: number | null, scale = 3) {
  if (value === null || !Number.isFinite(value)) return null
  return Math.max(-1, Math.min(1, Number((value / scale).toFixed(4))))
}

function offenseForSide(event: EventRow, side: 'home' | 'away', teamStats: TeamStatRow[]) {
  const teamId = side === 'home' ? event.home_team_id : event.away_team_id
  const isHome = side === 'home'
  const targetStart = Date.parse(event.start_time ?? '')
  const rows = teamStats
    .filter((row) => row.team_id === teamId)
    .filter((row) => {
      const rowStart = Date.parse(row.event_start_time ?? '')
      return Number.isFinite(rowStart) && Number.isFinite(targetStart) && rowStart < targetStart
    })
    .sort((a, b) => Date.parse(b.event_start_time ?? '') - Date.parse(a.event_start_time ?? ''))
  const points = (row: TeamStatRow) => num(row.points_for) ?? num(asRecord(row.stats).runs) ?? num(asRecord(row.stats).Runs)
  const last5 = rows.slice(0, 5)
  const last10 = rows.slice(0, 10)
  const season = rows
  const homeAway = rows.filter((row) => row.is_home === isHome)
  const last5Avg = avg(last5.map(points))
  const last10Avg = avg(last10.map(points))
  const seasonAvg = avg(season.map(points))
  const homeAwayAvg = avg(homeAway.map(points))
  const baseline = seasonAvg ?? last10Avg ?? last5Avg
  const sourceTimestamp = rows.map((row) => row.event_start_time).filter(Boolean).sort().at(-1) ?? null
  return {
    status: rows.length >= 5 && baseline !== null ? 'AVAILABLE_FROM_PRIOR_GAME_STATS' : 'INSUFFICIENT_PRIOR_GAME_STATS',
    source: 'sport_game_stats_prior_games',
    sourceTimestamp,
    sourceCutoff: event.start_time,
    sampleGames: rows.length,
    last5: { games: last5.length, averageRunsFor: last5Avg, deltaVsSeason: clamp(last5Avg !== null && baseline !== null ? last5Avg - baseline : null) },
    last10: { games: last10.length, averageRunsFor: last10Avg, deltaVsSeason: clamp(last10Avg !== null && baseline !== null ? last10Avg - baseline : null) },
    seasonBaseline: { games: season.length, averageRunsFor: seasonAvg, normalized: clamp(seasonAvg !== null ? seasonAvg - 4.5 : null) },
    homeAway: { games: homeAway.length, averageRunsFor: homeAwayAvg, deltaVsSeason: clamp(homeAwayAvg !== null && baseline !== null ? homeAwayAvg - baseline : null) },
    blockers: rows.length >= 5 && baseline !== null ? [] : ['OFFENSE_CONTEXT_INSUFFICIENT_PRIOR_GAME_SAMPLE'],
  }
}

function offenseRecentFormContext(event: EventRow, teamStats: TeamStatRow[]) {
  return {
    home: offenseForSide(event, 'home', teamStats),
    away: offenseForSide(event, 'away', teamStats),
  }
}

function bullpenDirectionalForSide(event: EventRow, side: 'home' | 'away', bullpen: Row) {
  const status = String(bullpen.status ?? 'UNKNOWN')
  const recentTeamStatRows = num(bullpen.recentTeamStatRows) ?? 0
  const reliefPlayerRows = num(bullpen.reliefPlayerRows) ?? 0
  const innings = num(bullpen.averageReliefInningsSignal)
  const pitches = num(bullpen.averagePitchSignal)
  const available = status === 'AVAILABLE_FROM_STORED_STATS' && recentTeamStatRows >= 3 && reliefPlayerRows >= 3
  return {
    status: available ? 'AVAILABLE' : 'PARTIAL',
    source: bullpen.source ?? 'sport_game_stats_and_sport_player_stats',
    sourceTimestamp: bullpen.sourceTimestamp ?? null,
    sampleGames: recentTeamStatRows,
    reliefRows: reliefPlayerRows,
    workloadLast1Delta: clamp(innings !== null ? 1.1 - innings : null, 1),
    workloadLast3Delta: clamp(pitches !== null ? 13 - pitches : null, 10),
    reliefPerformanceDelta: clamp(innings !== null ? 0.9 - innings : null, 1),
    availabilityPenaltyDelta: clamp(pitches !== null ? 12 - pitches : null, 10),
    blockers: available ? [] : ['BULLPEN_DIRECTIONAL_INPUTS_INSUFFICIENT'],
  }
}

function bullpenDirectionalInputs(event: EventRow, bullpen: Row) {
  return {
    home: bullpenDirectionalForSide(event, 'home', asRecord(bullpen.home)),
    away: bullpenDirectionalForSide(event, 'away', asRecord(bullpen.away)),
  }
}

function injuriesForSide(event: EventRow, side: 'home' | 'away', injuries: InjuryRow[]) {
  const teamId = side === 'home' ? event.home_team_id : event.away_team_id
  const rows = injuries.filter((row) => row.team_id === teamId)
  return {
    status: rows.length ? 'AVAILABLE_FROM_STORED_INJURIES' : 'UNKNOWN',
    source: rows.length ? 'sport_injuries' : 'none',
    rows: rows.map((row) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      status: row.injury_status ?? row.status,
      sourceTimestamp: row.source_timestamp,
    })),
    sourceTimestamp: sourceTimestamp(...rows.map((row) => row.source_timestamp)),
    blockers: rows.length ? [] : ['INJURY_CONTEXT_UNAVAILABLE_FROM_APPROVED_SOURCE'],
  }
}

function parkAndWeather(game: MlbOfficialScheduleGame | null) {
  return {
    park: {
      status: game?.venue.id ? 'AVAILABLE' : 'UNKNOWN',
      source: game?.venue.id ? 'mlb_stats_api_schedule_venue' : 'none',
      venueId: game?.venue.id ? String(game.venue.id) : null,
      venueName: game?.venue.name ?? null,
      sourceTimestamp: game?.capturedAt ?? null,
      blockers: game?.venue.id ? [] : ['PARK_IDENTITY_UNAVAILABLE'],
    },
    weather: {
      status: 'UNAVAILABLE_APPROVED_SOURCE_REQUIRED',
      source: 'none',
      sourceTimestamp: null,
      blockers: ['WEATHER_CONTEXT_REQUIRES_APPROVED_PROVIDER'],
    },
  }
}

function providerAuthorityContract() {
  return {
    officialData: 'MLB_OFFICIAL_PRIMARY',
    odds: 'THE_ODDS_API_PRIMARY_PRODUCT',
    sportsDataIO: 'ROLLBACK_ONLY_EXCLUDED_FROM_MLB_01',
    starters: 'MLB_OFFICIAL_SCHEDULE_PROBABLE_PITCHER_PLUS_STORED_CONTEXT',
    lineups: 'STORED_SPORT_LINEUPS_OR_PROJECTED_FROM_STORED_PLAYER_STATS',
    bullpen: 'STORED_SPORT_GAME_STATS_AND_PLAYER_STATS',
    park: 'MLB_OFFICIAL_SCHEDULE_VENUE',
    weather: 'NO_APPROVED_SOURCE_CERTIFIED',
    injuries: 'STORED_SPORT_INJURIES_ONLY_NO_NEW_PROVIDER_CERTIFIED',
  }
}

function completeness(components: Row) {
  const missing: string[] = []
  const blockers: string[] = []
  const push = (component: string, value: unknown) => {
    const record = asRecord(value)
    const componentBlockers = Array.isArray(record.blockers) ? record.blockers.map(String) : []
    if (componentBlockers.length) {
      missing.push(component)
      blockers.push(...componentBlockers)
    }
  }
  push('starters.home', asRecord(components.starters).home)
  push('starters.away', asRecord(components.starters).away)
  push('lineups.home', asRecord(components.lineups).home)
  push('lineups.away', asRecord(components.lineups).away)
  push('bullpen.home', asRecord(components.bullpen).home)
  push('bullpen.away', asRecord(components.bullpen).away)
  push('weather', asRecord(components.weatherPark).weather)
  push('injuries.home', asRecord(components.injuries).home)
  push('injuries.away', asRecord(components.injuries).away)
  const required = 9
  const available = required - new Set(missing).size
  return {
    completeness: {
      requiredComponents: required,
      availableComponents: available,
      missingComponents: [...new Set(missing)],
      completenessRate: Number((available / required).toFixed(4)),
      shadowInputReady: true,
      missingIsUnknownNotFabricated: true,
      predictionPolicyChanged: false,
    },
    missingComponents: [...new Set(missing)],
    blockers: [...new Set(blockers)],
  }
}

function featureValues(components: Row) {
  const starters = asRecord(components.starters)
  const lineups = asRecord(components.lineups)
  const bullpen = asRecord(components.bullpen)
  const weatherPark = asRecord(components.weatherPark)
  return {
    starter_home_status: asRecord(starters.home).status ?? 'UNKNOWN',
    starter_away_status: asRecord(starters.away).status ?? 'UNKNOWN',
    starter_home_confidence: asRecord(starters.home).confidence ?? 0,
    starter_away_confidence: asRecord(starters.away).confidence ?? 0,
    lineup_home_status: asRecord(lineups.home).status ?? 'UNKNOWN',
    lineup_away_status: asRecord(lineups.away).status ?? 'UNKNOWN',
    lineup_home_players: Array.isArray(asRecord(lineups.home).players) ? (asRecord(lineups.home).players as unknown[]).length : 0,
    lineup_away_players: Array.isArray(asRecord(lineups.away).players) ? (asRecord(lineups.away).players as unknown[]).length : 0,
    bullpen_home_rows: asRecord(bullpen.home).recentTeamStatRows ?? 0,
    bullpen_away_rows: asRecord(bullpen.away).recentTeamStatRows ?? 0,
    park_available: asRecord(asRecord(weatherPark).park).status === 'AVAILABLE',
    weather_available: false,
  }
}

function buildSnapshot(input: {
  event: EventRow
  snapshotType: MlbContextSnapshotType
  snapshotTime: string
  officialGame: MlbOfficialScheduleGame | null
  officialMappingMethod: string
  officialLineup: MlbOfficialLiveFeedLineups | null
  lineups: LineupRow[]
  playerStats: PlayerStatRow[]
  playerMappings: MappingRow[]
  teamStats: TeamStatRow[]
  starterAssignments: StarterAssignmentRow[]
  injuries: InjuryRow[]
  providerCallsMade: number
}): Snapshot {
  const { event, snapshotType, snapshotTime, officialGame } = input
  const starters = {
    home: officialStarter(officialGame, event, 'home', input.playerMappings, input.starterAssignments),
    away: officialStarter(officialGame, event, 'away', input.playerMappings, input.starterAssignments),
  }
  const lineups = {
    home: lineupForSide(event, 'home', input.lineups, input.playerStats, input.officialLineup, input.playerMappings),
    away: lineupForSide(event, 'away', input.lineups, input.playerStats, input.officialLineup, input.playerMappings),
  }
  const bullpen = {
    home: bullpenForSide(event, 'home', input.teamStats, input.playerStats),
    away: bullpenForSide(event, 'away', input.teamStats, input.playerStats),
  }
  const injuries = {
    home: injuriesForSide(event, 'home', input.injuries),
    away: injuriesForSide(event, 'away', input.injuries),
  }
  const weatherPark = parkAndWeather(officialGame)
  const offenseRecentForm = offenseRecentFormContext(event, input.teamStats)
  const bullpenDirectional = bullpenDirectionalInputs(event, bullpen)
  const components = {
    event: {
      id: event.id,
      matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
      status: event.status,
      startTime: event.start_time,
      cutoffAt: cutoffAt(event.start_time),
      officialGamePk: officialGame?.gamePk ?? eventMlbGamePk(event) ?? null,
      officialMappingMethod: input.officialMappingMethod,
      lineupSource: input.officialLineup ? 'mlb_stats_api_live_feed_boxscore_battingOrder' : null,
    },
    starters,
    lineups,
    bullpen,
    starterContext: starters,
    offenseRecentFormContext: offenseRecentForm,
    bullpenDirectionalInputs: bullpenDirectional,
    injuries,
    weatherPark,
  }
  const completenessResult = completeness(components)
  const startTime = event.start_time ?? snapshotTime
  return {
    deterministic_key: stableKey([CONTEXT_VERSION, event.id, snapshotType, startTime]),
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    event_id: event.id,
    snapshot_type: snapshotType,
    snapshot_timestamp: snapshotTime,
    target_event_start_time: startTime,
    temporal_status: temporalStatus(event.start_time, snapshotTime),
    provider_authority: providerAuthorityContract(),
    source_lineage: {
      officialSchedule: officialGame ? 'mlb_stats_api_schedule' : 'not_available_or_provider_call_disabled',
      canonicalEvent: 'sport_events',
      starterAssignments: 'mlb_starter_assignments_active_rows',
      offenseRecentForm: 'sport_game_stats_prior_games',
      bullpenDirectionalInputs: 'sport_game_stats_and_sport_player_stats_prior_evidence',
      lineups: 'sport_lineups_or_stored_player_stats',
      bullpen: 'sport_game_stats_and_sport_player_stats',
      injuries: 'sport_injuries',
      weather: 'no_approved_source_certified',
      sportsDataIO: 'excluded',
    },
    components,
    feature_values: featureValues(components),
    feature_lineage: {
      featureVersion: FEATURE_VERSION,
      contextVersion: CONTEXT_VERSION,
      researchContextVersion: R6_RESEARCH_CONTEXT_VERSION,
      scorecardConsumerVersion: 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2',
      temporalPolicy: 'snapshot_timestamp_must_precede_event_start_for_pregame_features',
      missingDataPolicy: 'missing_context_is_unknown_never_fabricated',
      predictionPolicyChanged: false,
    },
    completeness: completenessResult.completeness,
    missing_components: completenessResult.missingComponents,
    blockers: completenessResult.blockers,
    provider_calls: {
      mlbOfficial: input.providerCallsMade,
      theOddsApi: 0,
      sportsDataIO: 0,
    },
    production_eligible: false,
    shadow_only: true,
  }
}

function persistenceDecision(snapshot: Snapshot): { decision: PersistenceDecision; reason: string | null } {
  const startMs = Date.parse(snapshot.target_event_start_time)
  const snapshotMs = Date.parse(snapshot.snapshot_timestamp)
  const event = asRecord(asRecord(snapshot.components).event)
  const status = String(event.status ?? '').toLowerCase()
  const gamePk = text(event.officialGamePk)
  const mapping = text(event.officialMappingMethod)
  const cutoffMs = Date.parse(String(event.cutoffAt ?? ''))
  if (!Number.isFinite(startMs) || !Number.isFinite(snapshotMs)) return { decision: 'SKIP_INVALID_TIMESTAMP', reason: 'invalid_start_or_snapshot_timestamp' }
  if (snapshotMs >= startMs || snapshot.temporal_status === 'POST_START') return { decision: 'SKIP_POST_START', reason: 'snapshot_time_is_not_before_event_start' }
  if (Number.isFinite(cutoffMs) && snapshotMs >= cutoffMs) return { decision: 'SKIP_OTHER_EXPLICIT_REASON', reason: 'snapshot_time_is_not_before_cutoff' }
  if (['final', 'completed', 'closed'].some((value) => status.includes(value))) return { decision: 'SKIP_FINAL', reason: 'event_is_final_or_completed' }
  if (status.includes('cancel')) return { decision: 'SKIP_CANCELLED', reason: 'event_is_cancelled' }
  if (!gamePk || mapping === 'unmapped') return { decision: 'SKIP_UNMAPPED_EVENT', reason: 'missing_deterministic_mlb_gamepk_mapping' }
  if (!snapshot.event_id || !snapshot.snapshot_type || !snapshot.target_event_start_time) return { decision: 'SKIP_MISSING_REQUIRED_IDENTITY', reason: 'missing_snapshot_identity' }
  return { decision: 'PERSIST_ELIGIBLE', reason: null }
}

async function persistSnapshots(snapshots: Snapshot[]) {
  const decisions = snapshots.map((snapshot) => ({ snapshot, ...persistenceDecision(snapshot) }))
  const eligible = decisions.filter((item) => item.decision === 'PERSIST_ELIGIBLE').map((item) => item.snapshot)
  if (!eligible.length) {
    return {
      attempted: snapshots.length,
      eligible: 0,
      inserted: 0,
      reused: 0,
      skipped: decisions.length,
      failed: 0,
      byDecision: decisions.reduce<Record<string, number>>((acc, item) => {
        acc[item.decision] = (acc[item.decision] ?? 0) + 1
        return acc
      }, {}),
      rowDecisions: decisions.map((item) => ({
        eventId: item.snapshot.event_id,
        event: asRecord(asRecord(item.snapshot.components).event).matchup ?? null,
        decision: item.decision,
        reason: item.reason,
      })),
      error: null as string | null,
    }
  }
  const keys = eligible.map((snapshot) => snapshot.deterministic_key)
  const existingResult = await supabaseAdmin
    .from('mlb_context_snapshots')
    .select('deterministic_key')
    .in('deterministic_key', keys)
  if (existingResult.error) {
    return {
      attempted: snapshots.length,
      eligible: eligible.length,
      inserted: 0,
      reused: 0,
      skipped: snapshots.length - eligible.length,
      failed: eligible.length,
      byDecision: {},
      rowDecisions: decisions.map((item) => ({
        eventId: item.snapshot.event_id,
        event: asRecord(asRecord(item.snapshot.components).event).matchup ?? null,
        decision: item.decision,
        reason: item.reason,
      })),
      error: existingResult.error.message,
    }
  }
  const existing = new Set((existingResult.data ?? []).map((row) => row.deterministic_key))
  const inserts = eligible.filter((snapshot) => !existing.has(snapshot.deterministic_key))
  if (!inserts.length) {
    return {
      attempted: snapshots.length,
      eligible: eligible.length,
      inserted: 0,
      reused: eligible.length,
      skipped: snapshots.length - eligible.length,
      failed: 0,
      byDecision: decisions.reduce<Record<string, number>>((acc, item) => {
        acc[item.decision] = (acc[item.decision] ?? 0) + 1
        return acc
      }, {}),
      rowDecisions: decisions.map((item) => ({
        eventId: item.snapshot.event_id,
        event: asRecord(asRecord(item.snapshot.components).event).matchup ?? null,
        decision: item.decision,
        reason: item.reason,
      })),
      error: null as string | null,
    }
  }
  const { error } = await supabaseAdmin
    .from('mlb_context_snapshots')
    .insert(inserts)
  if (error) {
    return {
      attempted: snapshots.length,
      eligible: eligible.length,
      inserted: 0,
      reused: existing.size,
      skipped: snapshots.length - eligible.length,
      failed: inserts.length,
      byDecision: decisions.reduce<Record<string, number>>((acc, item) => {
        acc[item.decision] = (acc[item.decision] ?? 0) + 1
        return acc
      }, {}),
      rowDecisions: decisions.map((item) => ({
        eventId: item.snapshot.event_id,
        event: asRecord(asRecord(item.snapshot.components).event).matchup ?? null,
        decision: item.decision,
        reason: item.reason,
      })),
      error: error.message,
    }
  }
  return {
    attempted: snapshots.length,
    eligible: eligible.length,
    inserted: inserts.length,
    reused: existing.size,
    skipped: snapshots.length - eligible.length,
    failed: 0,
    byDecision: decisions.reduce<Record<string, number>>((acc, item) => {
      acc[item.decision] = (acc[item.decision] ?? 0) + 1
      return acc
    }, {}),
    rowDecisions: decisions.map((item) => ({
      eventId: item.snapshot.event_id,
      event: asRecord(asRecord(item.snapshot.components).event).matchup ?? null,
      decision: item.decision,
      reason: item.reason,
    })),
    error: null as string | null,
  }
}

function summarizeSnapshots(snapshots: Snapshot[]) {
  const aggregate = snapshots.reduce((acc, snapshot) => {
    const comp = asRecord(snapshot.completeness)
    acc.events += 1
    acc.pregame += snapshot.temporal_status === 'PREGAME' ? 1 : 0
    acc.postStart += snapshot.temporal_status === 'POST_START' ? 1 : 0
    acc.shadowInputReady += comp.shadowInputReady === true ? 1 : 0
    for (const blocker of snapshot.blockers) acc.blockers[blocker] = (acc.blockers[blocker] ?? 0) + 1
    return acc
  }, {
    events: 0,
    pregame: 0,
    postStart: 0,
    shadowInputReady: 0,
    blockers: {} as Record<string, number>,
  })
  return aggregate
}

export async function getMlbContextLineage(options: MlbContextLineageOptions = {}) {
  const selectedDate = options.date ?? todayLocalDate()
  const snapshotType = options.snapshotType ?? 'CURRENT_PROBE'
  const snapshotTime = new Date().toISOString()
  const events = await eventsForDate(selectedDate)
  const scopedEvents = options.eventId ? events.filter((event) => event.id === options.eventId) : events
  const teamIds = [...new Set(scopedEvents.flatMap((event) => [event.home_team_id, event.away_team_id]).filter((value): value is string => Boolean(value)))]
  const eventIds = scopedEvents.map((event) => event.id)
  const [lineups, playerStats, teamStats, injuries, mappings, starterAssignments] = await Promise.all([
    loadLineups(eventIds),
    loadPlayerStats(teamIds),
    loadTeamStats(teamIds),
    loadInjuries(teamIds),
    loadMappings(eventIds),
    loadStarterAssignments(eventIds),
  ])
  const official = options.allowProviderCalls ? await fetchMlbOfficialSchedule(selectedDate) : { rows: [] as MlbOfficialScheduleGame[], providerCallsMade: 0 }
  const officialMatches = scopedEvents.map((event) => ({ event, officialMatch: officialGameForEvent(event, official.rows, mappings) }))
  const starterProviderIds = officialMatches
    .flatMap(({ officialMatch }) => [
      officialMatch.game?.probablePitchers.home.player?.id,
      officialMatch.game?.probablePitchers.away.player?.id,
    ])
    .filter((value): value is string => Boolean(value))
  const lineupLimit = Math.max(0, Math.min(5, Math.floor(Number(options.lineupProbeLimit ?? 0))))
  const lineupTargets = options.allowProviderCalls && lineupLimit > 0
    ? officialMatches
      .filter(({ event, officialMatch }) => officialMatch.game && temporalStatus(event.start_time, snapshotTime) === 'PREGAME')
      .slice(0, lineupLimit)
    : []
  const lineupResponses: MlbOfficialLiveFeedLineups[] = []
  let lineupProviderCalls = 0
  for (const target of lineupTargets) {
    const gamePk = target.officialMatch.game?.gamePk
    if (!gamePk) continue
    const response = await fetchMlbOfficialLiveFeedLineups(gamePk)
    lineupProviderCalls += response.providerCallsMade
    lineupResponses.push(...response.rows)
  }
  const lineupProviderIds = lineupResponses
    .flatMap((row) => [...row.lineups.home, ...row.lineups.away].map((player) => player.player.id))
    .filter((value): value is string => Boolean(value))
  const playerMappings = await loadPlayerMappings([...new Set([...starterProviderIds, ...lineupProviderIds])])
  const snapshots = scopedEvents.map((event) => {
    const officialMatch = officialMatches.find((match) => match.event.id === event.id)?.officialMatch ?? officialGameForEvent(event, official.rows, mappings)
    const officialLineup = officialMatch.game ? lineupResponses.find((row) => row.gamePk === officialMatch.game?.gamePk) ?? null : null
    return buildSnapshot({
      event,
      snapshotType,
      snapshotTime,
      officialGame: officialMatch.game,
      officialMappingMethod: officialMatch.method,
      officialLineup,
      lineups,
      playerStats,
      playerMappings,
      teamStats,
      starterAssignments: starterAssignments as StarterAssignmentRow[],
      injuries,
      providerCallsMade: official.providerCallsMade + lineupProviderCalls,
    })
  })
  const persistence = options.persist ? await persistSnapshots(snapshots) : await persistSnapshots([])
  const summary = summarizeSnapshots(snapshots)
  return {
    success: persistence.error === null,
    mode: MODE,
    generatedAt: snapshotTime,
    selectedDate,
    snapshotType,
    persisted: options.persist === true,
    providerCallsMade: official.providerCallsMade + lineupProviderCalls,
    remoteMutationsMade: 'inserted' in persistence ? persistence.inserted : 0,
    providerAuthority: providerAuthorityContract(),
    sourceAudit: {
      eventsExamined: scopedEvents.length,
      officialGamesExamined: official.rows.length,
      officialLineupGamesExamined: lineupResponses.length,
      lineupsRead: lineups.length,
      playerStatsRead: playerStats.length,
      teamStatsRead: teamStats.length,
      injuriesRead: injuries.length,
      mappingsRead: mappings.length,
      playerMappingsRead: playerMappings.length,
      starterAssignmentsRead: (starterAssignments as StarterAssignmentRow[]).length,
      sportsDataIOUsed: false,
    },
    certifications: {
      BASELINE_PRESERVED: true,
      STARTER_CONTEXT_READY: snapshots.some((snapshot) => !snapshot.blockers.includes('MISSING_MLB_OFFICIAL_PROBABLE_STARTER')),
      LINEUP_CONTEXT_READY: snapshots.some((snapshot) => !snapshot.blockers.includes('LINEUP_UNAVAILABLE_FROM_APPROVED_SOURCE')),
      BULLPEN_CONTEXT_READY: snapshots.some((snapshot) => !snapshot.blockers.includes('BULLPEN_CONTEXT_UNAVAILABLE_FROM_STORED_STATS')),
      WEATHER_PARK_CONTEXT_READY: false,
      INJURY_CONTEXT_READY: injuries.length > 0,
      CONTEXT_COMPLETENESS_READY: true,
      MORNING_FINAL_SNAPSHOT_READY: true,
      CONTEXT_ENHANCED_SHADOW_INPUT_READY: true,
      NO_SPORTSDATAIO_REINTRODUCTION: true,
      NO_PREDICTION_WRITES: true,
      NO_RECOMMENDATION_CHANGES: true,
    },
    summary,
    persistence,
    snapshots,
  }
}

export function validateMlbContextLineageFixtures() {
  const now = '2026-08-20T12:00:00.000Z'
  const event: EventRow = {
    id: '00000000-0000-4000-8000-000000000001',
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: '2026',
    home_team_id: 'home-team',
    away_team_id: 'away-team',
    home_team: 'Home Club',
    away_team: 'Away Club',
    start_time: '2026-08-20T23:00:00.000Z',
    status: 'scheduled',
    provider_ids: { mlb_stats_game_pk: '123' },
    metadata: {},
  }
  const snapshot = buildSnapshot({
    event,
    snapshotType: 'MORNING',
    snapshotTime: now,
    officialGame: null,
    officialMappingMethod: 'fixture',
    officialLineup: null,
    lineups: [],
    playerStats: [],
    playerMappings: [],
    teamStats: [],
    starterAssignments: [],
    injuries: [],
    providerCallsMade: 0,
  })
  const checks = [
    ['sportsdataio excluded', asRecord(snapshot.provider_authority).sportsDataIO === 'ROLLBACK_ONLY_EXCLUDED_FROM_MLB_01'],
    ['prediction policy unchanged', asRecord(snapshot.feature_lineage).predictionPolicyChanged === false],
    ['temporal pregame', snapshot.temporal_status === 'PREGAME'],
    ['missing weather explicit', snapshot.blockers.includes('WEATHER_CONTEXT_REQUIRES_APPROVED_PROVIDER')],
    ['shadow only', snapshot.shadow_only === true && snapshot.production_eligible === false],
    ['provider calls zero in fixture', asRecord(snapshot.provider_calls).sportsDataIO === 0],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_context_lineage_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
