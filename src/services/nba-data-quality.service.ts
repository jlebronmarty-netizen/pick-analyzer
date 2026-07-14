import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolveNbaSeason } from '@/services/nba-data-sync.service'
import { NBA_SPORT_KEY } from '@/services/nba-prediction-validation.service'

const NBA_LEAGUE_KEY = 'nba'
const EXPECTED_NBA_TEAMS = 30
const VALID_EVENT_STATUSES = new Set([
  'scheduled',
  'live',
  'completed',
  'postponed',
  'cancelled',
])

export type DataQualitySeverity = 'info' | 'warning' | 'error' | 'critical'

type TeamRow = {
  id: string
  sport_key: string
  league_key: string
  name: string
  provider_ids: Record<string, unknown> | null
  active: boolean | null
  updated_at: string | null
}

type EventRow = {
  id: string
  sport_key: string
  league_key: string
  season: string
  home_team_id: string | null
  away_team_id: string | null
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  provider_ids: Record<string, unknown> | null
  updated_at: string | null
}

type GameStatsRow = {
  id: string
  sport_key: string
  season: string
  event_id: string
  team_id: string
  team_name: string
  is_home: boolean
  points_for: number | null
  points_against: number | null
  updated_at: string | null
}

type PlayerRow = {
  id: string
  sport_key: string
  league_key: string
  team_id: string | null
  team_name: string | null
  display_name: string
  position: string | null
  active: boolean | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type PlayerStatsRow = {
  id: string
  sport_key: string
  league_key: string
  season: string
  stat_type: 'season' | 'game' | string
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  provider: string
  games: number | null
  starts: number | null
  minutes: number | null
  points: number | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type InjuryRow = {
  id: string
  sport_key: string
  league_key: string
  player_id: string | null
  team_id: string | null
  player_name: string | null
  status: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type LineupRow = {
  id: string
  sport_key: string
  league_key: string
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  lineup_type: string
  position: string | null
  depth_order: number | null
  role: string | null
  starter: boolean | null
  lineup_status: string | null
  confirmation_level: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type StandingRow = {
  id: string
  sport_key: string
  season: string
  team_id: string
  team_name: string
  wins: number
  losses: number
  updated_at: string | null
}

type OddsRow = {
  id: string
  sport_key: string
  season: string | null
  event_id: string
  sportsbook: string
  market: string
  outcome: string
  price: number | null
  line: number | null
  snapshot_time: string | null
  updated_at: string | null
}

type SyncJobRow = {
  id: string
  job_type: string
  sport_key: string
  season: string | null
  started_at: string | null
  completed_at: string | null
  status: string
  error_count: number | null
  last_error: string | null
}

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string | null
  market: string | null
  team: string | null
  result: string | null
  status: string | null
  lifecycle_status: string | null
  settled_at: string | null
  model_version: string | null
}

type ResultRow = {
  game_id: string
  sport_key: string
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
}

type TeamStatsRow = {
  id: string
  team_name: string
  sport_key: string
  season: number
  wins: number
  losses: number
  updated_at: string | null
}

type ProviderMappingRow = {
  id: string
  sport_key: string
  entity_type: string
  internal_id: string
  provider: string
  provider_id: string
  season: string
  updated_at: string | null
}

type AuditRows = {
  teams: TeamRow[]
  events: EventRow[]
  gameStats: GameStatsRow[]
  players: PlayerRow[]
  playerStats: PlayerStatsRow[]
  playerStatsUnavailableReason: string | null
  injuries: InjuryRow[]
  injuriesUnavailableReason: string | null
  lineups: LineupRow[]
  lineupsUnavailableReason: string | null
  standings: StandingRow[]
  odds: OddsRow[]
  jobs: SyncJobRow[]
  predictions: PredictionRow[]
  results: ResultRow[]
  teamStats: TeamStatsRow[]
  mappings: ProviderMappingRow[]
}

export type DataQualityIssue = {
  id: string
  severity: DataQualitySeverity
  category: string
  entity: string
  message: string
  count: number
  sampleIds: string[]
  recommendation: string
}

export type CoverageMetric = {
  key: string
  label: string
  total: number
  expected: number
  percent: number
  status: 'healthy' | 'degraded' | 'empty'
}

type DateRange = {
  start: string
  end: string
  days: number
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function dateKey(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function isValidDate(value: string | null | undefined) {
  return dateKey(value) !== null
}

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function daysBetween(start: string, end: string) {
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime()
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime()
  return Math.max(0, Math.round((endMs - startMs) / 86400000) + 1)
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function dateRangeDays(start: string, end: string) {
  const days: string[] = []
  let current = start
  while (current <= end) {
    days.push(current)
    current = addDays(current, 1)
  }
  return days
}

function compressDates(days: string[], maxRanges = 25): DateRange[] {
  const sorted = Array.from(new Set(days)).sort()
  const ranges: DateRange[] = []
  let start: string | null = null
  let previous: string | null = null

  for (const day of sorted) {
    if (!start) {
      start = day
      previous = day
      continue
    }

    if (previous && day === addDays(previous, 1)) {
      previous = day
      continue
    }

    ranges.push({
      start,
      end: previous ?? start,
      days: daysBetween(start, previous ?? start),
    })
    start = day
    previous = day
  }

  if (start) {
    ranges.push({
      start,
      end: previous ?? start,
      days: daysBetween(start, previous ?? start),
    })
  }

  return ranges.slice(0, maxRanges)
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = getKey(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return Array.from(groups.entries()).map(([key, rows]) => ({ key, rows }))
}

function pct(total: number, expected: number) {
  if (expected <= 0) return total > 0 ? 100 : 0
  return round(Math.min(100, (total / expected) * 100))
}

function coverageMetric(
  key: string,
  label: string,
  total: number,
  expected: number
): CoverageMetric {
  const percent = pct(total, expected)
  return {
    key,
    label,
    total,
    expected,
    percent,
    status: total === 0 ? 'empty' : percent >= 90 ? 'healthy' : 'degraded',
  }
}

function issue({
  severity,
  category,
  entity,
  message,
  rows,
  recommendation,
}: {
  severity: DataQualitySeverity
  category: string
  entity: string
  message: string
  rows: Array<{ id?: string; game_id?: string }>
  recommendation: string
}): DataQualityIssue | null {
  if (rows.length === 0) return null

  return {
    id: `${category}:${entity}:${message}`.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    severity,
    category,
    entity,
    message,
    count: rows.length,
    sampleIds: rows
      .slice(0, 5)
      .map((row) => String(row.id ?? row.game_id ?? 'unknown')),
    recommendation,
  }
}

function metadataFlag(row: { metadata: Record<string, unknown> | null }, key: string) {
  return row.metadata ? row.metadata[key] : undefined
}

function statusFromIssues(issues: DataQualityIssue[]) {
  if (issues.some((item) => item.severity === 'critical')) return 'critical'
  if (issues.some((item) => item.severity === 'error')) return 'error'
  if (issues.some((item) => item.severity === 'warning')) return 'warning'
  return 'healthy'
}

async function loadRows(seasonKey: string, seasonStartYear: number): Promise<AuditRows> {
  const [
    teams,
    events,
    gameStats,
    players,
    playerStats,
    injuries,
    lineups,
    standings,
    odds,
    jobs,
    predictions,
    results,
    teamStats,
    mappings,
  ] = await Promise.all([
    supabaseAdmin.from('sports_teams').select('*').eq('sport_key', NBA_SPORT_KEY).limit(1000),
    supabaseAdmin.from('sport_events').select('*').eq('sport_key', NBA_SPORT_KEY).limit(5000),
    supabaseAdmin.from('sport_game_stats').select('*').eq('sport_key', NBA_SPORT_KEY).limit(5000),
    supabaseAdmin.from('sport_players').select('*').eq('sport_key', NBA_SPORT_KEY).limit(5000),
    supabaseAdmin.from('sport_player_stats').select('*').eq('sport_key', NBA_SPORT_KEY).limit(5000),
    supabaseAdmin.from('sport_injuries').select('*').eq('sport_key', NBA_SPORT_KEY).limit(5000),
    supabaseAdmin.from('sport_lineups').select('*').eq('sport_key', NBA_SPORT_KEY).limit(5000),
    supabaseAdmin.from('sport_standings').select('*').eq('sport_key', NBA_SPORT_KEY).limit(1000),
    supabaseAdmin.from('sports_odds_snapshots').select('*').eq('sport_key', NBA_SPORT_KEY).limit(5000),
    supabaseAdmin.from('sports_sync_jobs').select('*').eq('sport_key', NBA_SPORT_KEY).limit(500),
    supabaseAdmin.from('prediction_history').select('*').eq('sport_key', NBA_SPORT_KEY).limit(5000),
    supabaseAdmin.from('game_results').select('*').eq('sport_key', NBA_SPORT_KEY).limit(5000),
    supabaseAdmin.from('team_stats').select('*').eq('sport_key', NBA_SPORT_KEY).eq('season', seasonStartYear).limit(1000),
    supabaseAdmin.from('provider_entity_mappings').select('*').eq('sport_key', NBA_SPORT_KEY).limit(5000),
  ])

  const errors = [
    teams.error,
    events.error,
    gameStats.error,
    players.error,
    standings.error,
    odds.error,
    jobs.error,
    predictions.error,
    results.error,
    teamStats.error,
    mappings.error,
  ].filter(Boolean)

  if (errors.length > 0) {
    throw new Error(errors.map((error) => error?.message).join('; '))
  }

  const playerStatsUnavailableReason = playerStats.error
    ? `sport_player_stats unavailable: ${playerStats.error.message}`
    : null
  const injuriesUnavailableReason = injuries.error
    ? `sport_injuries unavailable: ${injuries.error.message}`
    : null
  const lineupsUnavailableReason = lineups.error
    ? `sport_lineups unavailable: ${lineups.error.message}`
    : null

  return {
    teams: (teams.data ?? []) as TeamRow[],
    events: (events.data ?? []) as EventRow[],
    gameStats: (gameStats.data ?? []) as GameStatsRow[],
    players: (players.data ?? []) as PlayerRow[],
    playerStats: (playerStats.error ? [] : (playerStats.data ?? [])) as PlayerStatsRow[],
    playerStatsUnavailableReason,
    injuries: (injuries.error ? [] : (injuries.data ?? [])) as InjuryRow[],
    injuriesUnavailableReason,
    lineups: (lineups.error ? [] : (lineups.data ?? [])) as LineupRow[],
    lineupsUnavailableReason,
    standings: ((standings.data ?? []) as StandingRow[]).filter((row) => row.season === seasonKey),
    odds: ((odds.data ?? []) as OddsRow[]).filter((row) => !row.season || row.season === seasonKey),
    jobs: (jobs.data ?? []) as SyncJobRow[],
    predictions: (predictions.data ?? []) as PredictionRow[],
    results: (results.data ?? []) as ResultRow[],
    teamStats: (teamStats.data ?? []) as TeamStatsRow[],
    mappings: (mappings.data ?? []) as ProviderMappingRow[],
  }
}

function buildCoverage(rows: AuditRows) {
  const completedEvents = rows.events.filter((row) => row.status === 'completed')
  const settledPredictions = rows.predictions.filter((row) =>
    ['win', 'loss', 'push', 'void'].includes(String(row.result ?? row.status ?? '').toLowerCase())
  )
  const completedWithStats = completedEvents.filter(
    (event) => rows.gameStats.filter((stat) => stat.event_id === event.id).length >= 2
  )

  return [
    coverageMetric('teams', 'Teams', rows.teams.length, EXPECTED_NBA_TEAMS),
    coverageMetric('players', 'Players', rows.players.length, EXPECTED_NBA_TEAMS * 12),
    coverageMetric('events', 'Events', rows.events.length, Math.max(rows.results.length, rows.events.length, 1)),
    coverageMetric('completedGames', 'Completed Games', completedEvents.length, Math.max(rows.results.length, completedEvents.length, 1)),
    coverageMetric('gameStats', 'Game Stats', completedWithStats.length, Math.max(completedEvents.length, 1)),
    coverageMetric('playerStats', 'Player Stats', rows.playerStats.length, Math.max(rows.players.length, 1)),
    coverageMetric('injuries', 'Injuries', rows.injuries.length, Math.max(rows.players.length, 1)),
    coverageMetric('lineups', 'Lineups', rows.lineups.length, Math.max(rows.players.length, 1)),
    coverageMetric('standings', 'Standings', rows.standings.length, EXPECTED_NBA_TEAMS),
    coverageMetric('oddsSnapshots', 'Odds Snapshots', rows.odds.length, Math.max(rows.events.length, 1)),
    coverageMetric('predictions', 'Predictions', rows.predictions.length, Math.max(rows.events.length, 1)),
    coverageMetric('settledPredictions', 'Settled Predictions', settledPredictions.length, Math.max(rows.predictions.length, 1)),
    coverageMetric('providerMappings', 'Provider Mappings', rows.mappings.length, EXPECTED_NBA_TEAMS),
  ]
}

function buildIssues(rows: AuditRows, seasonKey: string) {
  const teamIds = new Set(rows.teams.map((row) => row.id))
  const eventIds = new Set(rows.events.map((row) => row.id))
  const playerIds = new Set(rows.players.map((row) => row.id))
  const standingsTeamIds = new Set(rows.standings.map((row) => row.team_id))
  const nowMs = Date.now()
  const staleMs = 7 * 24 * 60 * 60 * 1000
  const staleOddsMs = 24 * 60 * 60 * 1000

  const duplicateTeams = groupBy(rows.teams, (row) => normalize(row.name)).filter((group) => group.rows.length > 1)
  const duplicatePlayers = groupBy(rows.players, (row) =>
    [normalize(row.display_name), normalize(row.team_id), normalize(row.position)].join('|')
  ).filter((group) => group.rows.length > 1)
  const duplicateEvents = groupBy(rows.events, (row) =>
    [normalize(row.home_team), normalize(row.away_team), dateKey(row.start_time)].join('|')
  ).filter((group) => group.rows.length > 1)
  const duplicateStats = groupBy(rows.gameStats, (row) =>
    [row.event_id, row.team_id].join('|')
  ).filter((group) => group.rows.length > 1)
  const duplicatePlayerStats = groupBy(rows.playerStats, (row) =>
    [row.stat_type, row.season, row.event_id ?? 'season', row.team_id ?? 'unresolved_team', row.player_id ?? row.player_name ?? 'unresolved_player'].join('|')
  ).filter((group) => group.rows.length > 1)
  const duplicateLineups = groupBy(rows.lineups, (row) =>
    [
      row.lineup_type,
      row.event_id ?? 'depth_chart',
      row.team_id ?? 'unresolved_team',
      row.player_id ?? row.player_name ?? 'unresolved_player',
      row.position ?? 'unknown_position',
      row.depth_order ?? 'unknown_depth',
    ].join('|')
  ).filter((group) => group.rows.length > 1)
  const contradictoryInjuries = groupBy(rows.injuries, (row) =>
    String(row.player_id ?? row.player_name ?? row.id)
  ).filter((group) => new Set(group.rows.map((row) => normalize(row.status))).size > 1)
  const staleInjuries = rows.injuries.filter(
    (row) => !row.updated_at || nowMs - new Date(row.updated_at).getTime() > 24 * 60 * 60 * 1000
  )
  const staleLineups = rows.lineups.filter(
    (row) => !row.updated_at || nowMs - new Date(row.updated_at).getTime() > 6 * 60 * 60 * 1000
  )
  const duplicateOdds = groupBy(rows.odds, (row) =>
    [
      row.event_id,
      row.sportsbook,
      row.market,
      row.outcome,
      row.price,
      row.line,
      row.snapshot_time,
    ].join('|')
  ).filter((group) => group.rows.length > 1)

  const completedEvents = rows.events.filter((row) => row.status === 'completed')
  const finalPredictionRows = rows.predictions.filter((row) =>
    ['win', 'loss', 'push', 'void'].includes(String(row.result ?? row.status ?? '').toLowerCase())
  )

  const rawIssues = [
    issue({
      severity: 'critical',
      category: 'teams',
      entity: 'sports_teams',
      message: 'Missing NBA teams',
      rows: Array.from({ length: Math.max(0, EXPECTED_NBA_TEAMS - rows.teams.length) }).map((_, index) => ({ id: `missing_team_${index + 1}` })),
      recommendation: 'Run safe incremental teams sync before prediction generation.',
    }),
    issue({
      severity: 'error',
      category: 'teams',
      entity: 'sports_teams',
      message: 'Duplicate NBA team names',
      rows: duplicateTeams.flatMap((group) => group.rows),
      recommendation: 'Review duplicate team rows and provider mappings before reconciliation.',
    }),
    issue({
      severity: 'warning',
      category: 'teams',
      entity: 'sports_teams',
      message: 'Teams missing provider IDs',
      rows: rows.teams.filter((row) => !row.provider_ids || Object.keys(row.provider_ids).length === 0),
      recommendation: 'Refresh team provider mappings.',
    }),
    issue({
      severity: 'warning',
      category: 'players',
      entity: 'sport_players',
      message: 'Duplicate NBA player identity keys',
      rows: duplicatePlayers.flatMap((group) => group.rows),
      recommendation: 'Deduplicate player identity rows by provider player ID before player-stat imports.',
    }),
    issue({
      severity: 'warning',
      category: 'players',
      entity: 'sport_players',
      message: 'Players missing team links',
      rows: rows.players.filter((row) => !row.team_id || (row.team_id && !teamIds.has(row.team_id))),
      recommendation: 'Refresh roster and team mappings before player-stat or prop readiness work.',
    }),
    issue({
      severity: 'error',
      category: 'events',
      entity: 'sport_events',
      message: 'Events reference teams that are not in sports_teams',
      rows: rows.events.filter(
        (row) =>
          (row.home_team_id && !teamIds.has(row.home_team_id)) ||
          (row.away_team_id && !teamIds.has(row.away_team_id))
      ),
      recommendation: 'Refresh teams and event mappings before prediction generation.',
    }),
    issue({
      severity: 'warning',
      category: 'events',
      entity: 'sport_events',
      message: 'Events have unresolved team links',
      rows: rows.events.filter((row) => !row.home_team_id || !row.away_team_id),
      recommendation: 'Resolve team IDs through provider mappings.',
    }),
    issue({
      severity: 'error',
      category: 'events',
      entity: 'sport_events',
      message: 'Events have invalid statuses',
      rows: rows.events.filter((row) => !VALID_EVENT_STATUSES.has(String(row.status))),
      recommendation: 'Normalize event statuses before settlement.',
    }),
    issue({
      severity: 'error',
      category: 'events',
      entity: 'sport_events',
      message: 'Completed events are missing final scores',
      rows: completedEvents.filter((row) => row.home_score === null && row.away_score === null),
      recommendation: 'Plan score reconciliation for these events.',
    }),
    issue({
      severity: 'error',
      category: 'events',
      entity: 'sport_events',
      message: 'Events have partial scores',
      rows: rows.events.filter(
        (row) => (row.home_score === null && row.away_score !== null) || (row.home_score !== null && row.away_score === null)
      ),
      recommendation: 'Plan score reconciliation for partial scores.',
    }),
    issue({
      severity: 'error',
      category: 'events',
      entity: 'sport_events',
      message: 'Events have invalid start dates',
      rows: rows.events.filter((row) => !isValidDate(row.start_time)),
      recommendation: 'Repair event start_time before scheduling or settlement.',
    }),
    issue({
      severity: 'warning',
      category: 'events',
      entity: 'sport_events',
      message: 'Duplicate event matchup/date keys',
      rows: duplicateEvents.flatMap((group) => group.rows),
      recommendation: 'Deduplicate by provider event ID and matchup date.',
    }),
    issue({
      severity: 'warning',
      category: 'stats',
      entity: 'sport_game_stats',
      message: 'Completed events missing two team game-stat rows',
      rows: completedEvents.filter(
        (event) => rows.gameStats.filter((stat) => stat.event_id === event.id).length < 2
      ),
      recommendation: 'Plan stats reconciliation after score reconciliation.',
    }),
    issue({
      severity: 'warning',
      category: 'stats',
      entity: 'sport_game_stats',
      message: 'Duplicate game stat rows',
      rows: duplicateStats.flatMap((group) => group.rows),
      recommendation: 'Deduplicate stats by sport, event and team.',
    }),
    issue({
      severity: 'info',
      category: 'player_stats',
      entity: 'sport_player_stats',
      message: 'Player stats table unavailable',
      rows: rows.playerStatsUnavailableReason ? [{ id: 'sport_player_stats_not_available' }] : [],
      recommendation: 'Apply supabase/migrations/202607130002_sport_player_stats_v1.sql before any player-stat persistence pilot.',
    }),
    issue({
      severity: 'warning',
      category: 'player_stats',
      entity: 'sport_player_stats',
      message: 'Duplicate player stat rows',
      rows: duplicatePlayerStats.flatMap((group) => group.rows),
      recommendation: 'Deduplicate player stats by stat type, season, event, team and player before feature generation.',
    }),
    issue({
      severity: 'error',
      category: 'player_stats',
      entity: 'sport_player_stats',
      message: 'Player game stats reference missing events',
      rows: rows.playerStats.filter(
        (row) => row.stat_type === 'game' && (!row.event_id || !eventIds.has(row.event_id))
      ),
      recommendation: 'Persist or resolve event mappings before player game stat imports.',
    }),
    issue({
      severity: 'warning',
      category: 'player_stats',
      entity: 'sport_player_stats',
      message: 'Player stat rows have unresolved player links',
      rows: rows.playerStats.filter((row) => !row.player_id || !playerIds.has(row.player_id)),
      recommendation: 'Preserve unresolved rows safely, but do not use them for production player features until mapped.',
    }),
    issue({
      severity: 'warning',
      category: 'player_stats',
      entity: 'sport_player_stats',
      message: 'Player stat rows have unresolved team links',
      rows: rows.playerStats.filter((row) => !row.team_id || !teamIds.has(row.team_id)),
      recommendation: 'Resolve team mappings before using player stats in feature generation.',
    }),
    issue({
      severity: 'warning',
      category: 'player_stats',
      entity: 'sport_player_stats',
      message: 'Player stat rows have season mismatches',
      rows: rows.playerStats.filter((row) => row.season !== seasonKey),
      recommendation: 'Filter player-stat features by active season and provider season key.',
    }),
    issue({
      severity: 'error',
      category: 'player_stats',
      entity: 'sport_player_stats',
      message: 'Trial player stats marked production eligible',
      rows: rows.playerStats.filter(
        (row) => metadataFlag(row, 'trial') === true && metadataFlag(row, 'production_eligible') !== false
      ),
      recommendation: 'Trial player stats must remain production_eligible=false and excluded from confidence lifts.',
    }),
    issue({
      severity: 'info',
      category: 'injuries',
      entity: 'sport_injuries',
      message: 'Injury table unavailable',
      rows: rows.injuriesUnavailableReason ? [{ id: 'sport_injuries_not_available' }] : [],
      recommendation: 'Keep injury context unavailable until the stored injury table is present.',
    }),
    issue({
      severity: 'warning',
      category: 'injuries',
      entity: 'sport_injuries',
      message: 'Injury rows have unresolved player links',
      rows: rows.injuries.filter((row) => !row.player_id || !playerIds.has(row.player_id)),
      recommendation: 'Resolve player mappings before using injuries as production feature inputs.',
    }),
    issue({
      severity: 'warning',
      category: 'injuries',
      entity: 'sport_injuries',
      message: 'Injury rows have unresolved team links',
      rows: rows.injuries.filter((row) => !row.team_id || !teamIds.has(row.team_id)),
      recommendation: 'Resolve team mappings before using injuries as production feature inputs.',
    }),
    issue({
      severity: 'warning',
      category: 'injuries',
      entity: 'sport_injuries',
      message: 'Contradictory injury statuses',
      rows: contradictoryInjuries.flatMap((group) => group.rows),
      recommendation: 'Resolve multiple statuses for the same player before applying production injury impact.',
    }),
    issue({
      severity: 'warning',
      category: 'injuries',
      entity: 'sport_injuries',
      message: 'Stale injury rows',
      rows: staleInjuries,
      recommendation: 'Refresh injuries before relying on injury freshness or availability.',
    }),
    issue({
      severity: 'error',
      category: 'injuries',
      entity: 'sport_injuries',
      message: 'Trial injuries marked production eligible',
      rows: rows.injuries.filter(
        (row) => metadataFlag(row, 'trial') === true && metadataFlag(row, 'production_eligible') !== false
      ),
      recommendation: 'Trial injuries must remain production_eligible=false and excluded from confidence lifts.',
    }),
    issue({
      severity: 'info',
      category: 'lineups',
      entity: 'sport_lineups',
      message: 'Lineup table unavailable',
      rows: rows.lineupsUnavailableReason ? [{ id: 'sport_lineups_not_available' }] : [],
      recommendation: 'Keep lineup context unavailable until the stored lineup table is present.',
    }),
    issue({
      severity: 'warning',
      category: 'lineups',
      entity: 'sport_lineups',
      message: 'Duplicate lineup natural keys',
      rows: duplicateLineups.flatMap((group) => group.rows),
      recommendation: 'Deduplicate lineups by type, event, team, player, position and depth order before feature generation.',
    }),
    issue({
      severity: 'warning',
      category: 'lineups',
      entity: 'sport_lineups',
      message: 'Lineup rows have unresolved player links',
      rows: rows.lineups.filter((row) => !row.player_id || !playerIds.has(row.player_id)),
      recommendation: 'Preserve unresolved rows safely, but do not use them for production lineup features until mapped.',
    }),
    issue({
      severity: 'warning',
      category: 'lineups',
      entity: 'sport_lineups',
      message: 'Lineup rows have unresolved team links',
      rows: rows.lineups.filter((row) => !row.team_id || !teamIds.has(row.team_id)),
      recommendation: 'Resolve team mappings before using lineups in feature generation.',
    }),
    issue({
      severity: 'warning',
      category: 'lineups',
      entity: 'sport_lineups',
      message: 'Starting lineups have unresolved event links',
      rows: rows.lineups.filter((row) => row.lineup_type === 'starting_lineup' && (!row.event_id || !eventIds.has(row.event_id))),
      recommendation: 'Resolve event mappings before using starting lineups as event-specific features.',
    }),
    issue({
      severity: 'warning',
      category: 'lineups',
      entity: 'sport_lineups',
      message: 'Lineup rows have invalid depth order',
      rows: rows.lineups.filter((row) => row.lineup_type === 'depth_chart' && (row.depth_order === null || row.depth_order < 1)),
      recommendation: 'Normalize depth order to positive integers for depth-chart feature generation.',
    }),
    issue({
      severity: 'warning',
      category: 'lineups',
      entity: 'sport_lineups',
      message: 'Stale lineup rows',
      rows: staleLineups,
      recommendation: 'Refresh lineups before relying on lineup freshness or starter availability.',
    }),
    issue({
      severity: 'error',
      category: 'lineups',
      entity: 'sport_lineups',
      message: 'Trial lineups marked production eligible',
      rows: rows.lineups.filter(
        (row) => metadataFlag(row, 'trial') === true && metadataFlag(row, 'production_eligible') !== false
      ),
      recommendation: 'Trial lineups must remain production_eligible=false and excluded from confidence lifts.',
    }),
    issue({
      severity: 'warning',
      category: 'standings',
      entity: 'sport_standings',
      message: 'Missing standings rows',
      rows: Array.from({ length: Math.max(0, EXPECTED_NBA_TEAMS - rows.standings.length) }).map((_, index) => ({ id: `missing_standing_${index + 1}` })),
      recommendation: 'Refresh standings from stored results or provider data.',
    }),
    issue({
      severity: 'warning',
      category: 'standings',
      entity: 'sport_standings',
      message: 'Stale standings rows',
      rows: rows.standings.filter(
        (row) => !row.updated_at || nowMs - new Date(row.updated_at).getTime() > staleMs
      ),
      recommendation: 'Refresh standings for the active season.',
    }),
    issue({
      severity: 'warning',
      category: 'odds',
      entity: 'sports_odds_snapshots',
      message: 'No odds snapshots available',
      rows: rows.odds.length === 0 ? [{ id: 'missing_odds_snapshots' }] : [],
      recommendation: 'Plan odds refresh for available upcoming events.',
    }),
    issue({
      severity: 'warning',
      category: 'odds',
      entity: 'sports_odds_snapshots',
      message: 'Stale odds snapshots',
      rows: rows.odds.filter(
        (row) => !row.snapshot_time || nowMs - new Date(row.snapshot_time).getTime() > staleOddsMs
      ),
      recommendation: 'Refresh odds snapshots incrementally before prediction generation.',
    }),
    issue({
      severity: 'warning',
      category: 'odds',
      entity: 'sports_odds_snapshots',
      message: 'Duplicate odds snapshots',
      rows: duplicateOdds.flatMap((group) => group.rows),
      recommendation: 'Review deterministic odds snapshot IDs.',
    }),
    issue({
      severity: 'error',
      category: 'odds',
      entity: 'sports_odds_snapshots',
      message: 'Impossible odds or lines',
      rows: rows.odds.filter((row) => {
        const price = Number(row.price)
        const line = Number(row.line)
        return (
          !Number.isFinite(price) ||
          price === 0 ||
          Math.abs(price) > 100000 ||
          (row.line !== null && (!Number.isFinite(line) || Math.abs(line) > 1000))
        )
      }),
      recommendation: 'Exclude impossible odds from prediction generation.',
    }),
    issue({
      severity: 'error',
      category: 'predictions',
      entity: 'prediction_history',
      message: 'Prediction records reference missing events',
      rows: rows.predictions.filter((row) => !eventIds.has(row.game_id)),
      recommendation: 'Reconcile events before settlement or calibration.',
    }),
    issue({
      severity: 'warning',
      category: 'predictions',
      entity: 'prediction_history',
      message: 'Completed predictions are not settled',
      rows: rows.predictions.filter((prediction) => {
        const event = rows.events.find((row) => row.id === prediction.game_id)
        const result = String(prediction.result ?? prediction.status ?? '').toLowerCase()
        return event?.status === 'completed' && !['win', 'loss', 'push', 'void'].includes(result)
      }),
      recommendation: 'Run protected settlement after score reconciliation.',
    }),
    issue({
      severity: 'warning',
      category: 'sync',
      entity: 'sports_sync_jobs',
      message: 'Recent sync jobs failed',
      rows: rows.jobs.filter((row) => row.status === 'failed' || Number(row.error_count ?? 0) > 0),
      recommendation: 'Review last_error before running reconciliation.',
    }),
    issue({
      severity: 'warning',
      category: 'sync',
      entity: 'sports_sync_jobs',
      message: 'Sync jobs remained running',
      rows: rows.jobs.filter((row) => {
        if (row.status !== 'running') return false
        if (!row.started_at) return true
        return nowMs - new Date(row.started_at).getTime() > 2 * 60 * 60 * 1000
      }),
      recommendation: 'Mark stale running jobs before relying on job health.',
    }),
    issue({
      severity: 'warning',
      category: 'mappings',
      entity: 'provider_entity_mappings',
      message: 'Provider mapping conflicts',
      rows: groupBy(rows.mappings, (row) =>
        [row.entity_type, row.provider, row.provider_id, row.season].join('|')
      )
        .filter((group) => new Set(group.rows.map((row) => row.internal_id)).size > 1)
        .flatMap((group) => group.rows),
      recommendation: 'Resolve conflicting provider mappings before reconciliation.',
    }),
    issue({
      severity: 'info',
      category: 'season',
      entity: 'seasonal_rows',
      message: 'Rows exist outside the active NBA season',
      rows: [
        ...rows.events.filter((row) => row.season !== seasonKey),
        ...rows.standings.filter((row) => row.season !== seasonKey),
        ...rows.odds.filter((row) => row.season && row.season !== seasonKey),
      ],
      recommendation: 'Keep historical seasons, but filter active-season dashboards by season.',
    }),
    issue({
      severity: 'info',
      category: 'standings',
      entity: 'sport_standings',
      message: 'Standings missing teams present in sports_teams',
      rows: rows.teams.filter((row) => !standingsTeamIds.has(row.id)),
      recommendation: 'Refresh standings from stored results.',
    }),
    issue({
      severity: 'info',
      category: 'predictions',
      entity: 'prediction_history',
      message: 'Settled prediction sample is empty',
      rows: finalPredictionRows.length === 0 ? [{ id: 'no_settled_predictions' }] : [],
      recommendation: 'Backtesting will remain directional until predictions are generated and settled.',
    }),
  ]

  return rawIssues.filter((item): item is DataQualityIssue => item !== null)
}

function historicalGaps(rows: AuditRows, season: ReturnType<typeof resolveNbaSeason>) {
  const today = new Date().toISOString().slice(0, 10)
  const end = today < season.endsAt.slice(0, 10) ? today : season.endsAt.slice(0, 10)
  const start = season.startsAt.slice(0, 10)
  const expectedDays = dateRangeDays(start, end)
  const eventDays = new Set(rows.events.map((row) => dateKey(row.start_time)).filter(Boolean))
  const resultDays = new Set(rows.results.map((row) => dateKey(row.commence_time)).filter(Boolean))
  const oddsDays = new Set(rows.odds.map((row) => dateKey(row.snapshot_time)).filter(Boolean))

  return {
    eventGaps: compressDates(expectedDays.filter((day) => !eventDays.has(day))),
    resultGaps: compressDates(expectedDays.filter((day) => !resultDays.has(day))),
    oddsGaps: compressDates(expectedDays.filter((day) => !oddsDays.has(day))),
  }
}

function countRangeDays(ranges: DateRange[]) {
  return ranges.reduce((sum, range) => sum + range.days, 0)
}

function buildPlan(rows: AuditRows, issues: DataQualityIssue[], gaps: ReturnType<typeof historicalGaps>, dryRun: boolean) {
  const completedEvents = rows.events.filter((row) => row.status === 'completed')
  const eventsRequiringScores = rows.events.filter(
    (row) =>
      row.status === 'completed' &&
      (row.home_score === null || row.away_score === null)
  )
  const eventsRequiringStats = completedEvents.filter(
    (event) => rows.gameStats.filter((stat) => stat.event_id === event.id).length < 2
  )
  const seasonsRequiringStandings = issues.some(
    (item) => item.category === 'standings' && item.count > 0
  )
    ? [resolveNbaSeason().key]
    : []
  const oddsGapDays = countRangeDays(gaps.oddsGaps)
  const eventGapDays = countRangeDays(gaps.eventGaps)
  const resultGapDays = countRangeDays(gaps.resultGaps)
  const estimatedCalls = {
    teams: rows.teams.length < EXPECTED_NBA_TEAMS ? 1 : 0,
    events: eventGapDays,
    scores: Math.max(resultGapDays, Math.ceil(eventsRequiringScores.length / 50)),
    odds: oddsGapDays,
    standings: seasonsRequiringStandings.length,
    stats: eventsRequiringStats.length > 0 ? 1 : 0,
  }
  const totalEstimatedProviderCalls = Object.values(estimatedCalls).reduce(
    (sum, value) => sum + value,
    0
  )

  return {
    dryRun,
    externalProviderCallsMade: 0,
    missingDateRanges: {
      events: gaps.eventGaps,
      results: gaps.resultGaps,
      odds: gaps.oddsGaps,
    },
    entitiesRequiringRefresh: {
      teams: rows.teams.length < EXPECTED_NBA_TEAMS ? EXPECTED_NBA_TEAMS - rows.teams.length : 0,
      events: eventGapDays,
      oddsSnapshots: oddsGapDays,
      providerMappings: issues.filter((item) => item.category === 'mappings').reduce((sum, item) => sum + item.count, 0),
      playerStats: issues.filter((item) => item.category === 'player_stats').reduce((sum, item) => sum + item.count, 0),
      injuries: issues.filter((item) => item.category === 'injuries').reduce((sum, item) => sum + item.count, 0),
      lineups: issues.filter((item) => item.category === 'lineups').reduce((sum, item) => sum + item.count, 0),
    },
    eventsRequiringScoreReconciliation: eventsRequiringScores.map((event) => ({
      id: event.id,
      startTime: event.start_time,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
    })),
    eventsRequiringStatsReconciliation: eventsRequiringStats.map((event) => ({
      id: event.id,
      startTime: event.start_time,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
    })),
    seasonsRequiringStandingsRefresh: seasonsRequiringStandings,
    oddsGaps: gaps.oddsGaps,
    estimatedProviderCalls: estimatedCalls,
    totalEstimatedProviderCalls,
    estimatedQuotaImpact:
      totalEstimatedProviderCalls === 0
        ? 'none'
        : totalEstimatedProviderCalls <= 10
          ? 'low'
          : totalEstimatedProviderCalls <= 50
            ? 'medium'
            : 'high',
    recommendedBatchSize: totalEstimatedProviderCalls > 50 ? 5 : 10,
    recommendedExecutionOrder: [
      'teams',
      'provider_mappings',
      'events_by_small_date_range',
      'results_by_small_date_range',
      'standings_from_results',
      'game_stats_from_results',
      'odds_by_upcoming_window',
      'injuries_after_exact_endpoint_confirmation',
      'lineups_after_exact_endpoint_confirmation',
      'player_stats_after_exact_endpoint_confirmation',
      'settlement_after_scores',
      'backtest_after_settlement',
    ],
    safeIncrementalReconciliationPlan: [
      'Run teams sync first if team coverage is below 30.',
      'Refresh events in capped date windows only after confirming provider quota.',
      'Refresh scores for completed-event gaps before stats and settlement.',
      'Rebuild standings and team/game stats from stored results.',
      'Refresh odds only for current or upcoming windows.',
      'Run NBA settlement only after score reconciliation completes.',
    ],
    quotaWarning:
      totalEstimatedProviderCalls > 0
        ? 'Phase A is dry-run only. Phase B must cap date windows and confirm provider quota before execution.'
        : 'No provider calls are estimated from the current stored data state.',
  }
}

export async function getNbaDataQualityAudit() {
  const season = resolveNbaSeason()
  const rows = await loadRows(season.key, season.startYear)
  const issues = buildIssues(rows, season.key)
  const coverage = buildCoverage(rows)
  const gaps = historicalGaps(rows, season)
  const severityCounts = {
    info: issues.filter((item) => item.severity === 'info').length,
    warning: issues.filter((item) => item.severity === 'warning').length,
    error: issues.filter((item) => item.severity === 'error').length,
    critical: issues.filter((item) => item.severity === 'critical').length,
  }
  const plan = buildPlan(rows, issues, gaps, true)

  return {
    success: true,
    mode: 'nba_data_quality_phase_a',
    generatedAt: new Date().toISOString(),
    sportKey: NBA_SPORT_KEY,
    leagueKey: NBA_LEAGUE_KEY,
    season: season.key,
    status: statusFromIssues(issues),
    dryRun: true,
    issueSummary: {
      total: issues.length,
      bySeverity: severityCounts,
      byCategory: groupBy(issues, (item) => item.category).map(({ key, rows }) => ({
        category: key,
        count: rows.length,
      })),
    },
    coverage,
    historicalGaps: gaps,
    issues,
    reconciliationPlan: plan,
  }
}

export async function getNbaDataQualityIssues() {
  const audit = await getNbaDataQualityAudit()
  return {
    success: true,
    mode: 'nba_data_quality_issues_phase_a',
    generatedAt: audit.generatedAt,
    status: audit.status,
    issueSummary: audit.issueSummary,
    issues: audit.issues,
  }
}

export async function getNbaDataQualityCoverage() {
  const audit = await getNbaDataQualityAudit()
  return {
    success: true,
    mode: 'nba_data_quality_coverage_phase_a',
    generatedAt: audit.generatedAt,
    status: audit.status,
    coverage: audit.coverage,
    historicalGaps: audit.historicalGaps,
  }
}

export async function getNbaReconciliationPlan({ dryRun = true } = {}) {
  const audit = await getNbaDataQualityAudit()

  return {
    success: true,
    mode: 'nba_reconciliation_plan_phase_a',
    generatedAt: new Date().toISOString(),
    status: audit.status,
    dryRun,
    note: 'Phase A never calls external providers. This response is a local stored-data plan only.',
    plan: {
      ...audit.reconciliationPlan,
      dryRun,
    },
  }
}

export async function getNbaReconciliationStatus() {
  const audit = await getNbaDataQualityAudit()

  return {
    success: true,
    mode: 'nba_reconciliation_status_phase_a',
    generatedAt: new Date().toISOString(),
    status: audit.status,
    dryRunOnly: true,
    externalExecutionAvailable: false,
    lastPlan: audit.reconciliationPlan,
    blockers:
      audit.reconciliationPlan.totalEstimatedProviderCalls > 0
        ? ['Provider quota approval is required before Phase B execution.']
        : [],
  }
}
