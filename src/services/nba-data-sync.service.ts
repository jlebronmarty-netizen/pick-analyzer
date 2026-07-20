import { supabaseAdmin } from '@/lib/supabase-admin'
import { planHistoricalFeatureGeneration } from '@/services/historical-feature-generation.service'
import { getMultiSportHealth } from '@/services/multi-sport-health.service'
import { assertSportEventStatusWrite } from '@/services/mlb-event-status-mapper.service'
import {
  getMultiSportEvents,
  getMultiSportOdds,
} from '@/services/multi-sport-query.service'
import { syncRecentResults } from '@/services/results-sync.service'
import { EventStatus, NormalizedEvent } from '@/types/multi-sport'

const NBA_SPORT_KEY = 'basketball_nba'
const NBA_LEAGUE_KEY = 'nba'
const ODDS_PROVIDER = 'the-odds-api'

type SyncMode =
  | 'incremental'
  | 'full'
  | 'date_range'
  | 'today'
  | 'live'
  | 'historical'

export type NbaSyncJobType =
  | 'all'
  | 'leagues'
  | 'teams'
  | 'games'
  | 'results'
  | 'standings'
  | 'stats'
  | 'players'
  | 'injuries'
  | 'lineups'
  | 'odds'
  | 'historical'

export type NbaSyncOptions = {
  season?: string
  mode?: SyncMode
  dateFrom?: string
  dateTo?: string
}

type SyncCounters = {
  fetched: number
  inserted: number
  updated: number
  skipped: number
  errors: string[]
  warnings: string[]
}

type SyncResult = {
  success: boolean
  jobType: NbaSyncJobType
  sportKey: string
  leagueKey: string
  provider: string
  season: string
  mode: SyncMode
  startedAt: string
  completedAt: string
  durationMs: number
  recordsFetched: number
  recordsInserted: number
  recordsUpdated: number
  recordsSkipped: number
  errorCount: number
  errors: string[]
  warnings: string[]
}

type NbaDailyOrchestrationStep = {
  order: number
  id: string
  label: string
  domain:
    | 'schedules'
    | 'results'
    | 'injuries'
    | 'lineups'
    | 'team_stats'
    | 'player_stats'
    | 'feature_store'
    | 'prediction_preview'
    | 'settlement'
    | 'data_quality'
  route: string
  method: 'GET' | 'POST'
  protected: boolean
  mutates: boolean
  status:
    | 'ready_existing_route'
    | 'read_only_ready'
    | 'contract_only_blocked_external'
  providerCallsAllowedByDefault: number
  idempotencyKey: string
  checkpoint: string
  productionSafetyGate: string
}

type TeamRecord = {
  id: string
  name: string
  abbreviation: string
  city: string
  conference: 'Eastern' | 'Western'
  division: string
}

type GameResultRow = {
  game_id: string
  sport_key: string
  commence_time: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
}

const NBA_TEAMS: TeamRecord[] = [
  { id: 'nba_atl', name: 'Atlanta Hawks', abbreviation: 'ATL', city: 'Atlanta', conference: 'Eastern', division: 'Southeast' },
  { id: 'nba_bos', name: 'Boston Celtics', abbreviation: 'BOS', city: 'Boston', conference: 'Eastern', division: 'Atlantic' },
  { id: 'nba_bkn', name: 'Brooklyn Nets', abbreviation: 'BKN', city: 'Brooklyn', conference: 'Eastern', division: 'Atlantic' },
  { id: 'nba_cha', name: 'Charlotte Hornets', abbreviation: 'CHA', city: 'Charlotte', conference: 'Eastern', division: 'Southeast' },
  { id: 'nba_chi', name: 'Chicago Bulls', abbreviation: 'CHI', city: 'Chicago', conference: 'Eastern', division: 'Central' },
  { id: 'nba_cle', name: 'Cleveland Cavaliers', abbreviation: 'CLE', city: 'Cleveland', conference: 'Eastern', division: 'Central' },
  { id: 'nba_dal', name: 'Dallas Mavericks', abbreviation: 'DAL', city: 'Dallas', conference: 'Western', division: 'Southwest' },
  { id: 'nba_den', name: 'Denver Nuggets', abbreviation: 'DEN', city: 'Denver', conference: 'Western', division: 'Northwest' },
  { id: 'nba_det', name: 'Detroit Pistons', abbreviation: 'DET', city: 'Detroit', conference: 'Eastern', division: 'Central' },
  { id: 'nba_gsw', name: 'Golden State Warriors', abbreviation: 'GSW', city: 'San Francisco', conference: 'Western', division: 'Pacific' },
  { id: 'nba_hou', name: 'Houston Rockets', abbreviation: 'HOU', city: 'Houston', conference: 'Western', division: 'Southwest' },
  { id: 'nba_ind', name: 'Indiana Pacers', abbreviation: 'IND', city: 'Indiana', conference: 'Eastern', division: 'Central' },
  { id: 'nba_lac', name: 'Los Angeles Clippers', abbreviation: 'LAC', city: 'Los Angeles', conference: 'Western', division: 'Pacific' },
  { id: 'nba_lal', name: 'Los Angeles Lakers', abbreviation: 'LAL', city: 'Los Angeles', conference: 'Western', division: 'Pacific' },
  { id: 'nba_mem', name: 'Memphis Grizzlies', abbreviation: 'MEM', city: 'Memphis', conference: 'Western', division: 'Southwest' },
  { id: 'nba_mia', name: 'Miami Heat', abbreviation: 'MIA', city: 'Miami', conference: 'Eastern', division: 'Southeast' },
  { id: 'nba_mil', name: 'Milwaukee Bucks', abbreviation: 'MIL', city: 'Milwaukee', conference: 'Eastern', division: 'Central' },
  { id: 'nba_min', name: 'Minnesota Timberwolves', abbreviation: 'MIN', city: 'Minnesota', conference: 'Western', division: 'Northwest' },
  { id: 'nba_nop', name: 'New Orleans Pelicans', abbreviation: 'NOP', city: 'New Orleans', conference: 'Western', division: 'Southwest' },
  { id: 'nba_nyk', name: 'New York Knicks', abbreviation: 'NYK', city: 'New York', conference: 'Eastern', division: 'Atlantic' },
  { id: 'nba_okc', name: 'Oklahoma City Thunder', abbreviation: 'OKC', city: 'Oklahoma City', conference: 'Western', division: 'Northwest' },
  { id: 'nba_orl', name: 'Orlando Magic', abbreviation: 'ORL', city: 'Orlando', conference: 'Eastern', division: 'Southeast' },
  { id: 'nba_phi', name: 'Philadelphia 76ers', abbreviation: 'PHI', city: 'Philadelphia', conference: 'Eastern', division: 'Atlantic' },
  { id: 'nba_phx', name: 'Phoenix Suns', abbreviation: 'PHX', city: 'Phoenix', conference: 'Western', division: 'Pacific' },
  { id: 'nba_por', name: 'Portland Trail Blazers', abbreviation: 'POR', city: 'Portland', conference: 'Western', division: 'Northwest' },
  { id: 'nba_sac', name: 'Sacramento Kings', abbreviation: 'SAC', city: 'Sacramento', conference: 'Western', division: 'Pacific' },
  { id: 'nba_sas', name: 'San Antonio Spurs', abbreviation: 'SAS', city: 'San Antonio', conference: 'Western', division: 'Southwest' },
  { id: 'nba_tor', name: 'Toronto Raptors', abbreviation: 'TOR', city: 'Toronto', conference: 'Eastern', division: 'Atlantic' },
  { id: 'nba_uta', name: 'Utah Jazz', abbreviation: 'UTA', city: 'Utah', conference: 'Western', division: 'Northwest' },
  { id: 'nba_was', name: 'Washington Wizards', abbreviation: 'WAS', city: 'Washington', conference: 'Eastern', division: 'Southeast' },
]

function nowIso() {
  return new Date().toISOString()
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export function resolveNbaSeason(date = new Date()) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const startYear = month >= 9 ? year : year - 1

  return {
    startYear,
    key: `${startYear}-${String(startYear + 1).slice(-2)}`,
    startsAt: `${startYear}-10-01T00:00:00.000Z`,
    endsAt: `${startYear + 1}-07-01T00:00:00.000Z`,
  }
}

function getSeason(options: NbaSyncOptions) {
  if (options.season && /^\d{4}-\d{2}$/.test(options.season)) {
    const startYear = Number(options.season.slice(0, 4))

    return {
      startYear,
      key: options.season,
      startsAt: `${startYear}-10-01T00:00:00.000Z`,
      endsAt: `${startYear + 1}-07-01T00:00:00.000Z`,
    }
  }

  return resolveNbaSeason()
}

function getMode(options: NbaSyncOptions): SyncMode {
  return options.mode ?? 'incremental'
}

function getTeamByName(name: string) {
  const normalized = slug(name)
  return NBA_TEAMS.find((team) => slug(team.name) === normalized)
}

function createCounters(): SyncCounters {
  return {
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  }
}

async function startJob(jobType: NbaSyncJobType, options: NbaSyncOptions) {
  const season = getSeason(options)
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .insert({
      job_type: jobType,
      sport_key: NBA_SPORT_KEY,
      league_key: NBA_LEAGUE_KEY,
      provider: ODDS_PROVIDER,
      season: season.key,
      status: 'running',
      metadata: {
        mode: getMode(options),
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
      },
    })
    .select('id')
    .single()

  if (error) {
    return {
      id: null,
      warning: `Sync job state could not be recorded: ${error.message}`,
    }
  }

  return {
    id: String(data.id),
    warning: null,
  }
}

async function finishJob(
  jobId: string | null,
  status: 'completed' | 'partial' | 'failed',
  counters: SyncCounters,
  startedAt: number
) {
  if (!jobId) return

  await supabaseAdmin
    .from('sports_sync_jobs')
    .update({
      completed_at: nowIso(),
      status,
      records_fetched: counters.fetched,
      records_inserted: counters.inserted,
      records_updated: counters.updated,
      records_skipped: counters.skipped,
      error_count: counters.errors.length,
      last_error: counters.errors.at(-1) ?? null,
      duration_ms: Date.now() - startedAt,
      updated_at: nowIso(),
    })
    .eq('id', jobId)
}

async function runTrackedJob(
  jobType: NbaSyncJobType,
  options: NbaSyncOptions,
  runner: (counters: SyncCounters) => Promise<void>
): Promise<SyncResult> {
  const startedAtMs = Date.now()
  const startedAt = new Date(startedAtMs).toISOString()
  const season = getSeason(options)
  const counters = createCounters()
  const job = await startJob(jobType, options)

  if (job.warning) counters.warnings.push(job.warning)

  try {
    await runner(counters)
  } catch (error) {
    counters.errors.push(
      error instanceof Error ? error.message : 'Unexpected NBA sync error'
    )
  }

  const status =
    counters.errors.length === 0
      ? 'completed'
      : counters.inserted + counters.updated + counters.skipped > 0
        ? 'partial'
        : 'failed'

  await finishJob(job.id, status, counters, startedAtMs)

  return {
    success: status !== 'failed',
    jobType,
    sportKey: NBA_SPORT_KEY,
    leagueKey: NBA_LEAGUE_KEY,
    provider: ODDS_PROVIDER,
    season: season.key,
    mode: getMode(options),
    startedAt,
    completedAt: nowIso(),
    durationMs: Date.now() - startedAtMs,
    recordsFetched: counters.fetched,
    recordsInserted: counters.inserted,
    recordsUpdated: counters.updated,
    recordsSkipped: counters.skipped,
    errorCount: counters.errors.length,
    errors: counters.errors,
    warnings: counters.warnings,
  }
}

async function upsertRows(
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  counters: SyncCounters
) {
  if (rows.length === 0) return
  const rowsToWrite = table === 'sport_events'
    ? rows.map((row) => ({
        ...row,
        status: assertSportEventStatusWrite({
          provider: ODDS_PROVIDER,
          functionName: 'upsertRows',
          file: 'src/services/nba-data-sync.service.ts',
          line: 330,
          eventId: typeof row.id === 'string' ? row.id : null,
          providerEventId: typeof row.id === 'string' ? row.id : null,
          rawProviderStatus: row.status ?? null,
          mappedStatus: row.status ?? null,
          dbStatus: row.status,
        }),
      }))
    : rows

  const { error } = await supabaseAdmin
    .from(table)
    .upsert(rowsToWrite, { onConflict })

  if (error) {
    counters.errors.push(`${table}: ${error.message}`)
    return
  }

  counters.updated += rows.length
}

function nbaTeamRows(seasonKey: string) {
  return NBA_TEAMS.map((team) => ({
    id: team.id,
    sport_key: NBA_SPORT_KEY,
    league_key: NBA_LEAGUE_KEY,
    name: team.name,
    abbreviation: team.abbreviation,
    city: team.city,
    conference: team.conference,
    division: team.division,
    active: true,
    provider_ids: {
      [ODDS_PROVIDER]: team.name,
      canonical: team.abbreviation,
    },
    metadata: {
      season: seasonKey,
    },
    updated_at: nowIso(),
  }))
}

async function ensureNbaTeamsForSync(
  seasonKey: string,
  counters: SyncCounters
) {
  await upsertRows('sports_teams', nbaTeamRows(seasonKey), 'id', counters)
}

async function ensureNbaEventsFromResults(
  results: GameResultRow[],
  seasonKey: string,
  counters: SyncCounters
) {
  const rows = results.map((result) => {
    const homeTeam = getTeamByName(result.home_team)
    const awayTeam = getTeamByName(result.away_team)

    return {
      id: result.game_id,
      sport_key: NBA_SPORT_KEY,
      league_key: NBA_LEAGUE_KEY,
      season: seasonKey,
      stage: 'regular',
      home_team_id: homeTeam?.id ?? null,
      away_team_id: awayTeam?.id ?? null,
      home_team: result.home_team,
      away_team: result.away_team,
      start_time: result.commence_time,
      venue: null,
      status: 'completed' as EventStatus,
      home_score: result.home_score,
      away_score: result.away_score,
      overtime: false,
      provider_ids: {
        [ODDS_PROVIDER]: result.game_id,
      },
      metadata: {
        source: 'game_results',
      },
      updated_at: nowIso(),
    }
  })

  await upsertRows('sport_events', rows, 'id', counters)
}

export async function syncNbaTeams(options: NbaSyncOptions = {}) {
  return runTrackedJob('teams', options, async (counters) => {
    const season = getSeason(options)
    const rows = nbaTeamRows(season.key)
    const mappings = NBA_TEAMS.map((team) => ({
      sport_key: NBA_SPORT_KEY,
      entity_type: 'team',
      internal_id: team.id,
      provider: ODDS_PROVIDER,
      provider_id: team.name,
      season: season.key,
      metadata: {
        abbreviation: team.abbreviation,
      },
      updated_at: nowIso(),
    }))

    counters.fetched = rows.length
    await upsertRows('sports_teams', rows, 'id', counters)
    await upsertRows(
      'provider_entity_mappings',
      mappings,
      'sport_key,entity_type,provider,provider_id,season',
      counters
    )
  })
}

function eventRow(event: NormalizedEvent, seasonKey: string) {
  const home = event.homeParticipant?.displayName ?? ''
  const away = event.awayParticipant?.displayName ?? ''
  const homeTeam = getTeamByName(home)
  const awayTeam = getTeamByName(away)

  return {
    id: event.id,
    sport_key: NBA_SPORT_KEY,
    league_key: NBA_LEAGUE_KEY,
    season: seasonKey,
    stage: 'regular',
    home_team_id: homeTeam?.id ?? null,
    away_team_id: awayTeam?.id ?? null,
    home_team: home,
    away_team: away,
    start_time: event.startTime,
    venue: event.venue.displayName ?? null,
    status: event.status,
    provider_ids: event.providerIds,
    metadata: event.metadata,
    updated_at: nowIso(),
  }
}

export async function syncNbaGames(options: NbaSyncOptions = {}) {
  return runTrackedJob('games', options, async (counters) => {
    const season = getSeason(options)
    const mode = getMode(options)
    const today = new Date().toISOString().slice(0, 10)
    const query =
      mode === 'today'
        ? { dateFrom: today, dateTo: today }
        : {
            dateFrom: options.dateFrom,
            dateTo: options.dateTo,
          }
    const result = await getMultiSportEvents({
      sportKey: NBA_SPORT_KEY,
      leagueKey: NBA_LEAGUE_KEY,
      limit: mode === 'full' ? 100 : 50,
      page: 1,
      ...query,
    })

    if (!result.success) {
      counters.errors.push(result.error ?? 'NBA event sync failed')
      return
    }

    counters.warnings.push(...result.warnings)
    counters.fetched = result.events.length

    await upsertRows(
      'sport_events',
      result.events.map((event) => eventRow(event, season.key)),
      'id',
      counters
    )

    const mappings = result.events.map((event) => ({
      sport_key: NBA_SPORT_KEY,
      entity_type: 'event',
      internal_id: event.id,
      provider: ODDS_PROVIDER,
      provider_id: event.providerIds[ODDS_PROVIDER] ?? event.id,
      season: season.key,
      metadata: {
        startTime: event.startTime,
      },
      updated_at: nowIso(),
    }))

    await upsertRows(
      'provider_entity_mappings',
      mappings,
      'sport_key,entity_type,provider,provider_id,season',
      counters
    )
  })
}

export async function syncNbaResults(options: NbaSyncOptions = {}) {
  return runTrackedJob('results', options, async (counters) => {
    const mode = getMode(options)
    const daysFrom = mode === 'historical' || mode === 'full' ? 3 : 1
    const result = await syncRecentResults(NBA_SPORT_KEY, daysFrom)

    counters.fetched = result.synced
    counters.updated = result.synced

    if (result.synced === 0) {
      counters.warnings.push(result.message ?? 'No completed NBA scores found.')
    }
  })
}

async function loadNbaResults(season: ReturnType<typeof getSeason>) {
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('*')
    .eq('sport_key', NBA_SPORT_KEY)
    .gte('commence_time', season.startsAt)
    .lt('commence_time', season.endsAt)
    .limit(2000)

  if (error) throw new Error(error.message)

  return (data ?? []) as GameResultRow[]
}

function buildRecords(results: GameResultRow[]) {
  const records = new Map<
    string,
    {
      team: TeamRecord
      wins: number
      losses: number
      homeWins: number
      homeLosses: number
      awayWins: number
      awayLosses: number
      recent: string[]
      pointsFor: number
      pointsAgainst: number
    }
  >()

  for (const team of NBA_TEAMS) {
    records.set(team.name, {
      team,
      wins: 0,
      losses: 0,
      homeWins: 0,
      homeLosses: 0,
      awayWins: 0,
      awayLosses: 0,
      recent: [],
      pointsFor: 0,
      pointsAgainst: 0,
    })
  }

  for (const result of results) {
    if (result.home_score === null || result.away_score === null) continue

    const home = records.get(result.home_team)
    const away = records.get(result.away_team)

    if (!home || !away) continue

    const homeWon = result.home_score > result.away_score

    home.wins += homeWon ? 1 : 0
    home.losses += homeWon ? 0 : 1
    home.homeWins += homeWon ? 1 : 0
    home.homeLosses += homeWon ? 0 : 1
    home.pointsFor += result.home_score
    home.pointsAgainst += result.away_score
    home.recent.push(homeWon ? 'W' : 'L')

    away.wins += homeWon ? 0 : 1
    away.losses += homeWon ? 1 : 0
    away.awayWins += homeWon ? 0 : 1
    away.awayLosses += homeWon ? 1 : 0
    away.pointsFor += result.away_score
    away.pointsAgainst += result.home_score
    away.recent.push(homeWon ? 'L' : 'W')
  }

  return Array.from(records.values())
}

function currentStreak(recent: string[]) {
  const latest = recent.at(-1)
  if (!latest) return '0'

  let count = 0
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    if (recent[index] !== latest) break
    count += 1
  }

  return `${latest}${count}`
}

export async function syncNbaStandings(options: NbaSyncOptions = {}) {
  return runTrackedJob('standings', options, async (counters) => {
    const season = getSeason(options)
    await ensureNbaTeamsForSync(season.key, counters)
    const results = await loadNbaResults(season)
    const records = buildRecords(results)
    const byConference = new Map<string, typeof records>()

    for (const record of records) {
      const group = byConference.get(record.team.conference) ?? []
      group.push(record)
      byConference.set(record.team.conference, group)
    }

    for (const group of byConference.values()) {
      group.sort((a, b) => b.wins - a.wins || a.losses - b.losses)
    }

    const rows = records.map((record) => {
      const games = record.wins + record.losses
      const conferenceRank =
        (byConference.get(record.team.conference) ?? []).findIndex(
          (item) => item.team.id === record.team.id
        ) + 1

      return {
        id: `${NBA_SPORT_KEY}_${season.key}_${record.team.id}`,
        sport_key: NBA_SPORT_KEY,
        league_key: NBA_LEAGUE_KEY,
        season: season.key,
        team_id: record.team.id,
        team_name: record.team.name,
        conference: record.team.conference,
        division: record.team.division,
        conference_rank: conferenceRank || null,
        division_rank: null,
        wins: record.wins,
        losses: record.losses,
        win_percentage: games > 0 ? record.wins / games : 0,
        games_behind: null,
        home_record: `${record.homeWins}-${record.homeLosses}`,
        away_record: `${record.awayWins}-${record.awayLosses}`,
        streak: currentStreak(record.recent),
        last_ten: `${record.recent.slice(-10).filter((item) => item === 'W').length}-${record.recent.slice(-10).filter((item) => item === 'L').length}`,
        metadata: {
          source: 'derived_from_game_results',
        },
        updated_at: nowIso(),
      }
    })

    counters.fetched = results.length
    await upsertRows('sport_standings', rows, 'id', counters)
  })
}

export async function syncNbaTeamStats(options: NbaSyncOptions = {}) {
  return runTrackedJob('stats', options, async (counters) => {
    const season = getSeason(options)
    await ensureNbaTeamsForSync(season.key, counters)
    const results = await loadNbaResults(season)
    await ensureNbaEventsFromResults(results, season.key, counters)
    const records = buildRecords(results)
    const rows = records.map((record) => {
      const games = record.wins + record.losses
      const recent = record.recent.slice(-10)

      return {
        team_name: record.team.name,
        sport_key: NBA_SPORT_KEY,
        season: season.startYear,
        wins: record.wins,
        losses: record.losses,
        ties: 0,
        home_wins: record.homeWins,
        home_losses: record.homeLosses,
        away_wins: record.awayWins,
        away_losses: record.awayLosses,
        last_5_wins: record.recent.slice(-5).filter((item) => item === 'W').length,
        last_5_losses: record.recent.slice(-5).filter((item) => item === 'L').length,
        last_10_wins: recent.filter((item) => item === 'W').length,
        last_10_losses: recent.filter((item) => item === 'L').length,
        streak: Number(currentStreak(record.recent).replace(/\D/g, '')) || 0,
        win_percentage: games > 0 ? record.wins / games : 0,
        raw_data: {
          source: 'derived_from_game_results',
          points_per_game: games > 0 ? record.pointsFor / games : null,
          opponent_points_per_game:
            games > 0 ? record.pointsAgainst / games : null,
          net_rating:
            games > 0
              ? (record.pointsFor - record.pointsAgainst) / games
              : null,
          conference: record.team.conference,
          division: record.team.division,
        },
        updated_at: nowIso(),
      }
    })

    counters.fetched = results.length
    await upsertRows(
      'team_stats',
      rows,
      'team_name,sport_key,season',
      counters
    )

    const gameRows = results.flatMap((result) => {
      const home = getTeamByName(result.home_team)
      const away = getTeamByName(result.away_team)
      if (!home || !away) return []

      return [
        {
          id: `${result.game_id}_${home.id}`,
          sport_key: NBA_SPORT_KEY,
          league_key: NBA_LEAGUE_KEY,
          season: season.key,
          event_id: result.game_id,
          team_id: home.id,
          team_name: home.name,
          opponent_team_id: away.id,
          opponent_team_name: away.name,
          is_home: true,
          points_for: result.home_score,
          points_against: result.away_score,
          provider_ids: { [ODDS_PROVIDER]: result.game_id },
          updated_at: nowIso(),
        },
        {
          id: `${result.game_id}_${away.id}`,
          sport_key: NBA_SPORT_KEY,
          league_key: NBA_LEAGUE_KEY,
          season: season.key,
          event_id: result.game_id,
          team_id: away.id,
          team_name: away.name,
          opponent_team_id: home.id,
          opponent_team_name: home.name,
          is_home: false,
          points_for: result.away_score,
          points_against: result.home_score,
          provider_ids: { [ODDS_PROVIDER]: result.game_id },
          updated_at: nowIso(),
        },
      ]
    })

    await upsertRows('sport_game_stats', gameRows, 'id', counters)
  })
}

export async function syncNbaPlayers(options: NbaSyncOptions = {}) {
  return runTrackedJob('players', options, async (counters) => {
    counters.warnings.push(
      'The current NBA provider does not expose player rosters in this project. Contract is ready; no player rows were fabricated.'
    )
    counters.skipped = 1
  })
}

export async function syncNbaInjuries(options: NbaSyncOptions = {}) {
  return runTrackedJob('injuries', options, async (counters) => {
    counters.warnings.push(
      'The current NBA provider does not expose injuries in this project. Contract is ready; no injury rows were fabricated.'
    )
    counters.skipped = 1
  })
}

export async function syncNbaLineups(options: NbaSyncOptions = {}) {
  return runTrackedJob('lineups', options, async (counters) => {
    counters.warnings.push(
      'The current NBA provider does not expose lineups in this project. Contract is ready; no lineup rows were fabricated.'
    )
    counters.skipped = 1
  })
}

export async function syncNbaOdds(options: NbaSyncOptions = {}) {
  return runTrackedJob('odds', options, async (counters) => {
    const season = getSeason(options)
    const result = await getMultiSportOdds({
      sportKey: NBA_SPORT_KEY,
      leagueKey: NBA_LEAGUE_KEY,
      limit: 100,
      page: 1,
    })

    if (!result.success) {
      counters.errors.push(result.error ?? 'NBA odds sync failed')
      return
    }

    counters.warnings.push(...result.warnings)
    counters.fetched = result.odds.length

    const rows = result.odds.flatMap((snapshot) =>
      snapshot.outcomes.map((outcome) => {
        const minute = snapshot.lastUpdated.slice(0, 16)
        return {
          id: slug(
            `${snapshot.eventId}_${snapshot.sportsbook}_${snapshot.marketKey}_${outcome.label}_${outcome.price ?? 0}_${outcome.point ?? 0}_${minute}`
          ),
          sport_key: NBA_SPORT_KEY,
          league_key: NBA_LEAGUE_KEY,
          season: season.key,
          event_id: snapshot.eventId,
          provider: snapshot.provider,
          sportsbook: snapshot.sportsbook,
          market: snapshot.marketKey,
          outcome: outcome.label,
          price: outcome.price ?? null,
          line: outcome.point ?? null,
          snapshot_time: snapshot.lastUpdated,
          is_opening: false,
          is_closing: false,
          metadata: snapshot.metadata,
          updated_at: nowIso(),
        }
      })
    )

    await upsertRows('sports_odds_snapshots', rows, 'id', counters)
  })
}

export async function runNbaSync(
  jobType: NbaSyncJobType = 'all',
  options: NbaSyncOptions = {}
) {
  const jobs: NbaSyncJobType[] =
    jobType === 'all'
      ? [
          'teams',
          'games',
          'results',
          'standings',
          'stats',
          'players',
          'injuries',
          'lineups',
          'odds',
        ]
      : [jobType]

  const results: SyncResult[] = []

  for (const job of jobs) {
    if (job === 'teams') results.push(await syncNbaTeams(options))
    if (job === 'games') results.push(await syncNbaGames(options))
    if (job === 'results') results.push(await syncNbaResults(options))
    if (job === 'standings') results.push(await syncNbaStandings(options))
    if (job === 'stats') results.push(await syncNbaTeamStats(options))
    if (job === 'players') results.push(await syncNbaPlayers(options))
    if (job === 'injuries') results.push(await syncNbaInjuries(options))
    if (job === 'lineups') results.push(await syncNbaLineups(options))
    if (job === 'odds') results.push(await syncNbaOdds(options))
    if (job === 'historical') results.push(await syncNbaResults({
      ...options,
      mode: 'historical',
    }))
  }

  return {
    success: results.every((result) => result.success),
    sportKey: NBA_SPORT_KEY,
    leagueKey: NBA_LEAGUE_KEY,
    provider: ODDS_PROVIDER,
    season: getSeason(options).key,
    mode: getMode(options),
    results,
  }
}

export async function getNbaSyncStatus() {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('*')
    .eq('sport_key', NBA_SPORT_KEY)
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) {
    return {
      success: false,
      error: error.message,
      jobs: [],
    }
  }

  return {
    success: true,
    jobs: data ?? [],
    orchestration: getNbaDailySyncOrchestrationContract(),
  }
}

export function getNbaDailySyncOrchestrationContract() {
  const featureGenerationHandoff = planHistoricalFeatureGeneration({
    sportKey: NBA_SPORT_KEY,
    leagueKey: NBA_LEAGUE_KEY,
    market: 'moneyline',
    executionMode: 'trial_only',
    batchSize: 100,
  })
  const steps: NbaDailyOrchestrationStep[] = [
    {
      order: 1,
      id: 'nba_daily_schedules',
      label: 'Schedules and event updates',
      domain: 'schedules',
      route: '/api/nba/sync/games?mode=incremental',
      method: 'POST',
      protected: true,
      mutates: true,
      status: 'ready_existing_route',
      providerCallsAllowedByDefault: 0,
      idempotencyKey: 'sport_events.id',
      checkpoint: 'sports_sync_jobs:nba:games',
      productionSafetyGate: 'Exclude trial/non-production events from prediction generation.',
    },
    {
      order: 2,
      id: 'nba_daily_results',
      label: 'Results and scores',
      domain: 'results',
      route: '/api/nba/sync/games?mode=incremental',
      method: 'POST',
      protected: true,
      mutates: true,
      status: 'ready_existing_route',
      providerCallsAllowedByDefault: 0,
      idempotencyKey: 'sport_events.id',
      checkpoint: 'sports_sync_jobs:nba:results',
      productionSafetyGate: 'Settle only completed or voidable events with final scores.',
    },
    {
      order: 3,
      id: 'nba_daily_injuries',
      label: 'Injuries',
      domain: 'injuries',
      route: '/api/nba/sync/injuries?mode=incremental',
      method: 'POST',
      protected: true,
      mutates: true,
      status: 'contract_only_blocked_external',
      providerCallsAllowedByDefault: 0,
      idempotencyKey: 'sport_injuries.id',
      checkpoint: 'sports_sync_jobs:nba:injuries',
      productionSafetyGate: 'Trial injury rows cannot improve production confidence.',
    },
    {
      order: 4,
      id: 'nba_daily_lineups',
      label: 'Depth charts and lineups',
      domain: 'lineups',
      route: '/api/nba/sync/lineups?mode=incremental',
      method: 'POST',
      protected: true,
      mutates: true,
      status: 'contract_only_blocked_external',
      providerCallsAllowedByDefault: 0,
      idempotencyKey: 'sport_lineups.id',
      checkpoint: 'sports_sync_jobs:nba:lineups',
      productionSafetyGate: 'Trial lineup rows cannot remove lineup confidence penalties.',
    },
    {
      order: 5,
      id: 'nba_daily_team_stats',
      label: 'Team and game stats',
      domain: 'team_stats',
      route: '/api/nba/sync/stats?mode=incremental',
      method: 'POST',
      protected: true,
      mutates: true,
      status: 'ready_existing_route',
      providerCallsAllowedByDefault: 0,
      idempotencyKey: 'team_stats(team_name,sport_key,season), sport_game_stats.id',
      checkpoint: 'sports_sync_jobs:nba:stats',
      productionSafetyGate: 'Use completed results only for derived stats.',
    },
    {
      order: 6,
      id: 'nba_daily_player_stats',
      label: 'Player season and game stats',
      domain: 'player_stats',
      route: '/api/historical-import/execute',
      method: 'POST',
      protected: true,
      mutates: true,
      status: 'contract_only_blocked_external',
      providerCallsAllowedByDefault: 0,
      idempotencyKey: 'sport_player_stats.id',
      checkpoint: 'sports_sync_jobs:nba:player_stats',
      productionSafetyGate: 'Trial player stats cannot improve production confidence or train models.',
    },
    {
      order: 7,
      id: 'nba_daily_feature_preview',
      label: 'Feature Store preview',
      domain: 'feature_store',
      route: '/api/nba/features/preview',
      method: 'GET',
      protected: false,
      mutates: false,
      status: 'read_only_ready',
      providerCallsAllowedByDefault: 0,
      idempotencyKey: 'feature_store_core_v1:snapshot_id',
      checkpoint: 'computed:feature_preview:historical_feature_generation_orchestrator_v1',
      productionSafetyGate:
        'Historical/current feature eligibility is checked with provider calls 0; no durable feature persistence or production confidence lift until no-leakage and persistence gates pass.',
    },
    {
      order: 8,
      id: 'nba_daily_prediction_preview',
      label: 'Prediction preview',
      domain: 'prediction_preview',
      route: '/api/nba/predictions',
      method: 'GET',
      protected: false,
      mutates: false,
      status: 'read_only_ready',
      providerCallsAllowedByDefault: 0,
      idempotencyKey: 'prediction_preview:event_market_team',
      checkpoint: 'computed:prediction_preview',
      productionSafetyGate: 'Preview does not persist picks and excludes trial/non-production rows.',
    },
    {
      order: 9,
      id: 'nba_daily_settlement',
      label: 'Settlement',
      domain: 'settlement',
      route: '/api/nba/predictions/settle',
      method: 'POST',
      protected: true,
      mutates: true,
      status: 'ready_existing_route',
      providerCallsAllowedByDefault: 0,
      idempotencyKey: 'prediction_history.id',
      checkpoint: 'prediction_history:lifecycle_status',
      productionSafetyGate: 'Settle from stored prediction terms and final scores only.',
    },
    {
      order: 10,
      id: 'nba_daily_data_quality',
      label: 'Data-quality audit',
      domain: 'data_quality',
      route: '/api/nba/data-quality',
      method: 'GET',
      protected: false,
      mutates: false,
      status: 'read_only_ready',
      providerCallsAllowedByDefault: 0,
      idempotencyKey: 'read_only_audit',
      checkpoint: 'computed:data_quality',
      productionSafetyGate: 'Report trial contamination and orphan rows before production use.',
    },
  ]

  return {
    mode: 'nba_daily_sync_orchestration_contract_v1',
    generatedAt: nowIso(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'static_existing_route_contracts',
    },
    routeCountDelta: 0,
    defaultProviderCallsAllowed: 0,
    concurrencyLimit: 1,
    automaticRetries: false,
    steps,
    summary: {
      steps: steps.length,
      mutatingSteps: steps.filter((step) => step.mutates).length,
      readOnlySteps: steps.filter((step) => !step.mutates).length,
      readySteps: steps.filter((step) => step.status !== 'contract_only_blocked_external').length,
      blockedExternalSteps: steps.filter((step) => step.status === 'contract_only_blocked_external').length,
      protectedSteps: steps.filter((step) => step.protected).length,
    },
    blockers: [
      'Production injury, lineup and player-stat refreshes remain blocked until real-data approval and production eligibility rules are supplied.',
      'Live odds, historical odds and player props remain blocked by endpoint, entitlement and settlement approval gates.',
      ...featureGenerationHandoff.eligibility.blockingMissingDomains,
    ],
    featureGenerationHandoff: {
      mode: featureGenerationHandoff.mode,
      eligible: featureGenerationHandoff.eligibility.eligible,
      providerCallsMade: featureGenerationHandoff.providerUsage.externalProviderCallsMade,
      predictionCutoffStrategy: featureGenerationHandoff.eligibility.predictionCutoffStrategy,
      persistenceReady: featureGenerationHandoff.eligibility.persistenceReady,
      persistenceStatus: featureGenerationHandoff.persistenceReadiness.status,
      migrationFilename: featureGenerationHandoff.persistenceReadiness.migration.filename,
      migrationApplied: featureGenerationHandoff.persistenceReadiness.migration.applied,
      leakageValidationReady: featureGenerationHandoff.eligibility.leakageValidationReady,
      backtestHandoffReady: featureGenerationHandoff.eligibility.backtestHandoffReady,
      backtestReady: featureGenerationHandoff.backtestInputReadiness.ready,
      immutablePregameSnapshots:
        'Postgame updates must not mutate original pregame snapshots; corrected data requires a new versioned audit/research snapshot.',
      checkpointStrategy: featureGenerationHandoff.batching.checkpointStrategy,
      deterministicSnapshotId: featureGenerationHandoff.idempotency.deterministicSnapshotId,
      deterministicPersistenceKey: featureGenerationHandoff.persistenceReadiness.deterministicKey,
    },
  }
}

export async function getNbaDataHealth() {
  const season = resolveNbaSeason()
  const [teams, events, results, standings, stats, odds, jobs, health] =
    await Promise.all([
      supabaseAdmin
        .from('sports_teams')
        .select('id')
        .eq('sport_key', NBA_SPORT_KEY),
      supabaseAdmin
        .from('sport_events')
        .select('id, home_team_id, away_team_id, provider_ids')
        .eq('sport_key', NBA_SPORT_KEY)
        .eq('season', season.key),
      supabaseAdmin
        .from('game_results')
        .select('game_id, home_score, away_score')
        .eq('sport_key', NBA_SPORT_KEY)
        .gte('commence_time', season.startsAt),
      supabaseAdmin
        .from('sport_standings')
        .select('id, updated_at')
        .eq('sport_key', NBA_SPORT_KEY)
        .eq('season', season.key),
      supabaseAdmin
        .from('team_stats')
        .select('id, updated_at')
        .eq('sport_key', NBA_SPORT_KEY)
        .eq('season', season.startYear),
      supabaseAdmin
        .from('sports_odds_snapshots')
        .select('id, snapshot_time')
        .eq('sport_key', NBA_SPORT_KEY)
        .gte('snapshot_time', season.startsAt)
        .limit(1000),
      getNbaSyncStatus(),
      getMultiSportHealth(),
    ])

  const issues: string[] = []

  if (teams.error) issues.push(`teams health failed: ${teams.error.message}`)
  if (events.error) issues.push(`events health failed: ${events.error.message}`)
  if (results.error) issues.push(`results health failed: ${results.error.message}`)
  if (standings.error) issues.push(`standings health failed: ${standings.error.message}`)
  if (stats.error) issues.push(`stats health failed: ${stats.error.message}`)
  if (odds.error) issues.push(`odds health failed: ${odds.error.message}`)

  const teamsCount = teams.data?.length ?? 0
  const eventsRows =
    (events.data as Array<{
      home_team_id: string | null
      away_team_id: string | null
      provider_ids: Record<string, string> | null
    }> | null) ?? []
  const missingLinkedTeams = eventsRows.filter(
    (event) => !event.home_team_id || !event.away_team_id
  ).length
  const missingProviderIds = eventsRows.filter(
    (event) => !event.provider_ids?.[ODDS_PROVIDER]
  ).length

  if (teamsCount < 30) issues.push(`${30 - teamsCount} NBA teams missing.`)
  if (missingLinkedTeams > 0) {
    issues.push(`${missingLinkedTeams} games are missing team links.`)
  }
  if (missingProviderIds > 0) {
    issues.push(`${missingProviderIds} games are missing provider IDs.`)
  }
  if ((standings.data?.length ?? 0) < 30) {
    issues.push('NBA standings coverage is incomplete.')
  }
  if ((stats.data?.length ?? 0) < 30) {
    issues.push('NBA team statistics coverage is incomplete.')
  }
  if ((odds.data?.length ?? 0) === 0) {
    issues.push('No NBA odds snapshots found for the active season.')
  }

  const recentFailures = jobs.jobs.filter(
    (job: { status?: string }) => job.status === 'failed'
  )

  if (recentFailures.length > 0) {
    issues.push(`${recentFailures.length} recent NBA sync jobs failed.`)
  }

  const providerHealth = health.coverage.find(
    (item) => item.sportKey === NBA_SPORT_KEY
  )
  const status =
    issues.length === 0
      ? 'healthy'
      : teamsCount > 0 || eventsRows.length > 0
        ? 'degraded'
        : 'unavailable'

  return {
    success: true,
    generatedAt: nowIso(),
    sportKey: NBA_SPORT_KEY,
    leagueKey: NBA_LEAGUE_KEY,
    season: season.key,
    status,
    issues,
    provider: {
      id: ODDS_PROVIDER,
      status: providerHealth?.status ?? 'unavailable',
    },
    coverage: {
      teams: teamsCount,
      events: eventsRows.length,
      results: results.data?.length ?? 0,
      standings: standings.data?.length ?? 0,
      teamStats: stats.data?.length ?? 0,
      oddsSnapshots: odds.data?.length ?? 0,
    },
    freshness: {
      lastSync: jobs.jobs[0]?.completed_at ?? jobs.jobs[0]?.started_at ?? null,
      lastOddsSnapshot:
        odds.data?.sort((a, b) =>
          String(b.snapshot_time).localeCompare(String(a.snapshot_time))
        )[0]?.snapshot_time ?? null,
    },
    recentJobs: jobs.jobs.slice(0, 10),
    orchestration: getNbaDailySyncOrchestrationContract(),
  }
}

export function parseNbaSyncOptions(searchParams: URLSearchParams): NbaSyncOptions {
  const mode = searchParams.get('mode') as SyncMode | null

  return {
    season: searchParams.get('season') ?? undefined,
    mode: mode ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
  }
}

export function normalizeNbaInjuryStatus(value: string) {
  const normalized = value.trim().toLowerCase()

  if (['probable', 'questionable', 'doubtful', 'out', 'inactive'].includes(normalized)) {
    return normalized
  }
  if (normalized.includes('day')) return 'day-to-day'
  if (normalized.includes('active')) return 'active'

  return 'inactive'
}

export function validateNbaSyncOptions(options: NbaSyncOptions) {
  const errors: string[] = []

  if (options.season && !/^\d{4}-\d{2}$/.test(options.season)) {
    errors.push('season must use YYYY-YY format.')
  }

  for (const key of ['dateFrom', 'dateTo'] as const) {
    if (options[key] && Number.isNaN(new Date(options[key]!).getTime())) {
      errors.push(`${key} is not a valid date.`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
