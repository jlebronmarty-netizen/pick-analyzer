import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { getMlbStarterIntelligence } from '@/services/mlb-starter-intelligence.service'
import type { MlbStarterIntelligenceSide } from '@/services/mlb-starter-intelligence.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const MIN_EXPECTED_LINEUP_CONFIDENCE = 55

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
  metadata: Row | null
}

type PlayerStatRow = {
  id: string
  stat_type: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  games: number | null
  starts: number | null
  starter: boolean | null
  provider_ids: Row | null
  stats: Row | null
  metadata: Row | null
  source_timestamp: string | null
}

type PlayerRow = {
  id: string
  team_id: string | null
  team_name: string | null
  display_name: string | null
  position: string | null
  active: boolean | null
  provider_ids: Row | null
  metadata: Row | null
}

export type MlbLineupPlayerContext = {
  eventId: string
  teamId: string | null
  teamName: string | null
  side: 'home' | 'away'
  playerId: string | null
  providerPlayerId: string | null
  playerName: string
  position: string | null
  battingOrder: number | null
  status: 'CONFIRMED' | 'EXPECTED' | 'UNKNOWN'
  confidence: number
  source: string
  sourceTimestamp: string | null
  blockerReasons: string[]
}

export type MlbStarterContext = {
  eventId: string
  teamId: string | null
  teamName: string | null
  side: 'home' | 'away'
  playerId: string | null
  providerPlayerId: string | null
  playerName: string | null
  status: 'CONFIRMED' | 'PROBABLE' | 'EXPECTED' | 'QUESTIONABLE' | 'LATE_SCRATCH' | 'SCRATCHED' | 'UNAVAILABLE'
  confidence: number
  source: string
  sourceTimestamp: string | null
  blockerReasons: string[]
}

export type MlbGameLineupContext = {
  eventId: string
  matchup: string
  scheduledTime: string | null
  homeTeam: string | null
  awayTeam: string | null
  starters: {
    home: MlbStarterContext
    away: MlbStarterContext
  }
  lineups: {
    home: MlbLineupPlayerContext[]
    away: MlbLineupPlayerContext[]
  }
  coverage: {
    confirmedStarters: number
    probableStarters: number
    expectedStarters: number
    unavailableStarters: number
    confirmedLineups: number
    expectedLineups: number
    eligiblePitchers: number
    eligibleBatters: number
  }
}

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

function providerIdFromBag(value: unknown) {
  const bag = asRecord(value)
  return text(bag.player) ?? text(bag.sportsdataio_player_id) ?? text(bag.PlayerID) ?? text(bag.PlayerId) ?? text(bag.playerId) ?? text(bag.player_id) ?? text(bag.providerPlayerId) ?? text(bag.sportsdataio)
}

function playerProviderId(row: { provider_ids?: Row | null; metadata?: Row | null; stats?: Row | null }) {
  return providerIdFromBag(row.provider_ids) ?? providerIdFromBag(row.metadata) ?? providerIdFromBag(row.stats)
}

function statNumber(row: { stats?: Row | null; metadata?: Row | null }, keys: string[]) {
  const bag = { ...asRecord(row.stats), ...asRecord(row.metadata) }
  for (const key of keys) {
    const parsed = num(bag[key])
    if (parsed !== null) return parsed
  }
  return null
}

function isPitcher(row: PlayerStatRow | PlayerRow) {
  const bag = { ...asRecord(row.metadata), ...('stats' in row ? asRecord(row.stats) : {}) }
  const position = String(('position' in row ? row.position : null) ?? bag.Position ?? bag.position ?? '').toLowerCase()
  const pitchingWorkload = ['InningsPitchedDecimal', 'TotalOutsPitched', 'PitchesThrown', 'PitchingStrikeouts'].some((key) => Number(bag[key] ?? 0) > 0)
  return position === 'p' || position === 'sp' || position === 'rp' || pitchingWorkload
}

async function eventsForDate(date: string) {
  const range = puertoRicoUtcRange(date)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team_id, away_team_id, home_team, away_team, start_time, status')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`MLB lineup context event read failed: ${error.message}`)
  return (data ?? []) as EventRow[]
}

async function loadStoredLineups(eventIds: string[]) {
  if (!eventIds.length) return [] as LineupRow[]
  const { data, error } = await supabaseAdmin
    .from('sport_lineups')
    .select('id, event_id, team_id, player_id, player_name, role, starter, position, depth_order, lineup_status, confirmation_level, source_timestamp, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('lineup_type', 'starting_lineup')
    .in('event_id', eventIds)
    .order('source_timestamp', { ascending: false })
  if (error) return [] as LineupRow[]
  return (data ?? []) as LineupRow[]
}

async function loadPlayerStats() {
  const { data, error } = await supabaseAdmin
    .from('sport_player_stats')
    .select('id, stat_type, team_id, player_id, player_name, games, starts, starter, provider_ids, stats, metadata, source_timestamp')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('stat_type', 'season')
    .order('updated_at', { ascending: false })
    .limit(3000)
  if (error) return [] as PlayerStatRow[]
  return (data ?? []) as PlayerStatRow[]
}

async function loadPlayers() {
  const { data, error } = await supabaseAdmin
    .from('sport_players')
    .select('id, team_id, team_name, display_name, position, active, provider_ids, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .limit(8000)
  if (error) return [] as PlayerRow[]
  return (data ?? []) as PlayerRow[]
}

function confidenceForExpectedBatter(row: PlayerStatRow) {
  const games = row.games ?? statNumber(row, ['Games', 'GamesPlayed']) ?? 0
  const starts = row.starts ?? statNumber(row, ['Started', 'Starts']) ?? 0
  const plateAppearances = statNumber(row, ['PlateAppearances', 'PA']) ?? statNumber(row, ['AtBats', 'AB']) ?? 0
  const metricCount = ['Hits', 'HomeRuns', 'Runs', 'RunsBattedIn', 'RBI', 'Walks', 'TotalBases'].filter((key) => statNumber(row, [key]) !== null).length
  return Math.round(Math.min(82, Math.max(0, 42 + Math.min(18, games / 4) + Math.min(14, plateAppearances / 45) + metricCount * 2 + Math.min(8, starts / 10))))
}

function batterSortValue(row: PlayerStatRow) {
  return (statNumber(row, ['PlateAppearances', 'PA']) ?? 0) * 3 +
    (row.starts ?? statNumber(row, ['Starts']) ?? 0) * 2 +
    (row.games ?? statNumber(row, ['Games', 'GamesPlayed']) ?? 0)
}

function confirmedLineupPlayers(event: EventRow, side: 'home' | 'away', storedRows: LineupRow[]) {
  const teamId = side === 'home' ? event.home_team_id : event.away_team_id
  const teamName = side === 'home' ? event.home_team : event.away_team
  return storedRows
    .filter((row) => row.event_id === event.id && row.team_id === teamId && row.role !== 'starting_pitcher')
    .map((row, index): MlbLineupPlayerContext => ({
      eventId: event.id,
      teamId,
      teamName,
      side,
      playerId: row.player_id,
      providerPlayerId: providerIdFromBag(row.metadata),
      playerName: row.player_name ?? 'Lineup Player',
      position: row.position,
      battingOrder: row.depth_order ?? index + 1,
      status: row.confirmation_level === 'confirmed' || row.lineup_status === 'confirmed' ? 'CONFIRMED' : 'EXPECTED',
      confidence: row.confirmation_level === 'confirmed' || row.lineup_status === 'confirmed' ? 96 : 72,
      source: 'sport_lineups',
      sourceTimestamp: row.source_timestamp,
      blockerReasons: [],
    }))
}

function expectedLineupPlayers(event: EventRow, side: 'home' | 'away', playerStats: PlayerStatRow[], players: PlayerRow[]) {
  const teamId = side === 'home' ? event.home_team_id : event.away_team_id
  const teamName = side === 'home' ? event.home_team : event.away_team
  return playerStats
    .filter((row) => row.team_id === teamId)
    .filter((row) => !isPitcher(row))
    .filter((row) => Boolean(row.player_id || playerProviderId(row)))
    .map((row) => {
      const mapped = players.find((player) => player.id === row.player_id || playerProviderId(player) === playerProviderId(row))
      return { row, mapped, confidence: confidenceForExpectedBatter(row) }
    })
    .filter((item) => item.mapped?.active !== false)
    .filter((item) => item.confidence >= MIN_EXPECTED_LINEUP_CONFIDENCE)
    .sort((left, right) => batterSortValue(right.row) - batterSortValue(left.row))
    .slice(0, 9)
    .map(({ row, mapped, confidence }, index): MlbLineupPlayerContext => {
      const providerPlayerId = playerProviderId(row) ?? (mapped ? playerProviderId(mapped) : null)
      return {
        eventId: event.id,
        teamId,
        teamName,
        side,
        playerId: row.player_id ?? mapped?.id ?? null,
        providerPlayerId,
        playerName: mapped?.display_name ?? row.player_name ?? 'Expected Batter',
        position: mapped?.position ?? text(asRecord(row.metadata).Position),
        battingOrder: index + 1,
        status: 'EXPECTED',
        confidence,
        source: 'stored_season_player_stats_expected_lineup',
        sourceTimestamp: row.source_timestamp,
        blockerReasons: ['LINEUP_EXPECTED_NOT_CONFIRMED'],
      }
    })
}

function starterFromIntelligence(event: EventRow, side: 'home' | 'away', starterIntelligence: Row) {
  const games = Array.isArray(starterIntelligence.games) ? (starterIntelligence.games as Array<{ eventId?: string; starters?: { home?: MlbStarterIntelligenceSide; away?: MlbStarterIntelligenceSide } }>) : []
  const game = games.find((item) => item.eventId === event.id)
  const starter = game?.starters?.[side]
  if (!starter) return null
  return {
    eventId: event.id,
    teamId: starter.teamId,
    teamName: starter.teamName,
    side,
    playerId: starter.canonicalPlayerId,
    providerPlayerId: starter.providerPlayerId,
    playerName: starter.playerName,
    status: starter.status === 'SCRATCHED' ? 'LATE_SCRATCH' : starter.status,
    confidence: starter.confidence,
    source: starter.source,
    sourceTimestamp: starter.sourceTimestamp,
    blockerReasons: starter.blockers,
  } as MlbStarterContext
}

function starterFromStored(event: EventRow, side: 'home' | 'away', storedRows: LineupRow[]) {
  const teamId = side === 'home' ? event.home_team_id : event.away_team_id
  const teamName = side === 'home' ? event.home_team : event.away_team
  const row = storedRows.find((item) => item.event_id === event.id && item.team_id === teamId && item.role === 'starting_pitcher')
  if (!row) return null
  const status = row.confirmation_level === 'confirmed' || row.lineup_status === 'CONFIRMED' ? 'CONFIRMED' : row.confirmation_level === 'probable' || row.lineup_status === 'PROBABLE' ? 'PROBABLE' : 'EXPECTED'
  return {
    eventId: event.id,
    teamId,
    teamName,
    side,
    playerId: row.player_id,
    providerPlayerId: providerIdFromBag(row.metadata),
    playerName: row.player_name,
    status,
    confidence: status === 'CONFIRMED' ? 96 : status === 'PROBABLE' ? 86 : 68,
    source: 'sport_lineups',
    sourceTimestamp: row.source_timestamp,
    blockerReasons: [],
  } as MlbStarterContext
}

function starterFromWeather(event: EventRow, side: 'home' | 'away', starterWeather: Row) {
  const games = Array.isArray(starterWeather.games) ? (starterWeather.games as Row[]) : []
  const game = games.find((item) => item.eventId === event.id)
  const starter = asRecord(asRecord(game?.starters)[side])
  const playerId = text(starter.playerId)
  const teamId = side === 'home' ? event.home_team_id : event.away_team_id
  const teamName = side === 'home' ? event.home_team : event.away_team
  if (!playerId && !text(starter.name)) {
    return {
      eventId: event.id,
      teamId,
      teamName,
      side,
      playerId: null,
      providerPlayerId: null,
      playerName: null,
      status: 'UNAVAILABLE',
      confidence: 0,
      source: 'none',
      sourceTimestamp: null,
      blockerReasons: ['MISSING_PROBABLE_STARTER'],
    } as MlbStarterContext
  }
  const status = starter.confirmed === true ? 'CONFIRMED' : starter.probable === true ? 'PROBABLE' : 'EXPECTED'
  return {
    eventId: event.id,
    teamId,
    teamName,
    side,
    playerId: null,
    providerPlayerId: playerId,
    playerName: text(starter.name),
    status,
    confidence: num(starter.confidence) !== null ? Math.round(Number(starter.confidence) * 100) : status === 'CONFIRMED' ? 96 : status === 'PROBABLE' ? 86 : 68,
    source: text(starter.source) ?? 'sportsdataio_games_by_date_verified_snapshot',
    sourceTimestamp: text(starter.capturedAt),
    blockerReasons: [],
  } as MlbStarterContext
}

function eventContext(event: EventRow, storedRows: LineupRow[], playerStats: PlayerStatRow[], players: PlayerRow[], starterIntelligence: Row): MlbGameLineupContext {
  const homeConfirmed = confirmedLineupPlayers(event, 'home', storedRows)
  const awayConfirmed = confirmedLineupPlayers(event, 'away', storedRows)
  const homeLineup = homeConfirmed.length >= 8 ? homeConfirmed : expectedLineupPlayers(event, 'home', playerStats, players)
  const awayLineup = awayConfirmed.length >= 8 ? awayConfirmed : expectedLineupPlayers(event, 'away', playerStats, players)
  const homeStarter = starterFromIntelligence(event, 'home', starterIntelligence) ?? starterFromStored(event, 'home', storedRows) ?? starterFromWeather(event, 'home', { games: [] })
  const awayStarter = starterFromIntelligence(event, 'away', starterIntelligence) ?? starterFromStored(event, 'away', storedRows) ?? starterFromWeather(event, 'away', { games: [] })
  const lineups = { home: homeLineup, away: awayLineup }
  const starters = { home: homeStarter, away: awayStarter }
  return {
    eventId: event.id,
    matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
    scheduledTime: event.start_time,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    starters,
    lineups,
    coverage: {
      confirmedStarters: [homeStarter, awayStarter].filter((starter) => starter.status === 'CONFIRMED').length,
      probableStarters: [homeStarter, awayStarter].filter((starter) => starter.status === 'PROBABLE').length,
      expectedStarters: [homeStarter, awayStarter].filter((starter) => starter.status === 'EXPECTED').length,
      unavailableStarters: [homeStarter, awayStarter].filter((starter) => starter.status === 'UNAVAILABLE' || starter.status === 'QUESTIONABLE' || starter.status === 'SCRATCHED' || starter.status === 'LATE_SCRATCH').length,
      confirmedLineups: [homeLineup, awayLineup].filter((lineup) => lineup.length >= 8 && lineup.every((player) => player.status === 'CONFIRMED')).length,
      expectedLineups: [homeLineup, awayLineup].filter((lineup) => lineup.length >= 8 && lineup.some((player) => player.status === 'EXPECTED')).length,
      eligiblePitchers: [homeStarter, awayStarter].filter((starter) => starter.confidence >= 65 && starter.status !== 'UNAVAILABLE').length,
      eligibleBatters: [...homeLineup, ...awayLineup].filter((player) => player.confidence >= MIN_EXPECTED_LINEUP_CONFIDENCE).length,
    },
  }
}

export async function getMlbCurrentLineupContext(options: { date?: string | null; eventId?: string | null } = {}) {
  const selectedDate = options.date ?? todayLocalDate()
  const events = await eventsForDate(selectedDate)
  const scopedEvents = options.eventId ? events.filter((event) => event.id === options.eventId) : events
  const [storedRows, playerStats, players, starterWeather] = await Promise.all([
    loadStoredLineups(scopedEvents.map((event) => event.id)),
    loadPlayerStats(),
    loadPlayers(),
    getMlbStarterIntelligence({ date: selectedDate }).catch(() => ({ games: [], providerCallsMade: 0, sourceAudit: {} })),
  ])
  const games = scopedEvents.map((event) => eventContext(event, storedRows, playerStats, players, starterWeather as Row))
  const summary = games.reduce((acc, game) => {
    acc.confirmedStarters += game.coverage.confirmedStarters
    acc.probableStarters += game.coverage.probableStarters
    acc.expectedStarters += game.coverage.expectedStarters
    acc.unavailableStarters += game.coverage.unavailableStarters
    acc.confirmedLineups += game.coverage.confirmedLineups
    acc.expectedLineups += game.coverage.expectedLineups
    acc.eligiblePitchers += game.coverage.eligiblePitchers
    acc.eligibleBatters += game.coverage.eligibleBatters
    return acc
  }, {
    games: games.length,
    confirmedStarters: 0,
    probableStarters: 0,
    expectedStarters: 0,
    unavailableStarters: 0,
    confirmedLineups: 0,
    expectedLineups: 0,
    eligiblePitchers: 0,
    eligibleBatters: 0,
  })
  return {
    success: true,
    mode: 'mlb_current_lineup_context_v1',
    generatedAt: new Date().toISOString(),
    selectedDate,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    confidencePolicy: {
      minimumExpectedLineupConfidence: MIN_EXPECTED_LINEUP_CONFIDENCE,
      expectedIsNeverConfirmed: true,
    },
    sourceAudit: {
      storedLineupRows: storedRows.length,
      storedPlayerStatRows: playerStats.length,
      storedPlayerRows: players.length,
      starterIntelligenceGames: Array.isArray((starterWeather as Row).games) ? ((starterWeather as Row).games as unknown[]).length : 0,
      starterSourceAudit: asRecord((starterWeather as Row).sourceAudit),
    },
    summary,
    games,
    blockers: [
      summary.confirmedStarters + summary.probableStarters + summary.expectedStarters === 0 ? 'NO_CURRENT_STARTER_CONTEXT' : null,
      summary.confirmedLineups === 0 ? 'NO_CONFIRMED_LINEUPS' : null,
      summary.expectedLineups === 0 ? 'NO_EXPECTED_LINEUPS_FROM_STORED_PLAYER_STATS' : null,
    ].filter(Boolean),
  }
}
