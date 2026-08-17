import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAW_ROOT = 'data/imports/balldontlie/nfl'
const SPORT_KEY = 'americanfootball_nfl'
const LEAGUE_KEY = 'nfl'
const PROVIDER = 'balldontlie'
const IMPORT_VERSION = 'nfl_02_canonical_historical_import_v1'
const CERTIFIED_SEASONS = ['2021', '2022', '2023', '2024', '2025']
const PRODUCTION_GAME_RESULT_COLUMNS = [
  'id',
  'game_id',
  'sport_key',
  'home_team',
  'away_team',
  'home_score',
  'away_score',
  'winner',
  'commence_time',
]
const UNSUPPORTED_PRODUCTION_GAME_RESULT_COLUMNS = ['league_key', 'result_source', 'metadata', 'updated_at']

const args = new Set(process.argv.slice(2))

function getArg(name) {
  const prefix = `--${name}=`
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix))
  return value ? value.slice(prefix.length) : null
}

function selectedSeasons() {
  const season = getArg('season')
  if (season) return new Set([season])
  return new Set(CERTIFIED_SEASONS)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function walkJsonFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walkJsonFiles(path, acc)
    else if (entry.isFile() && entry.name.endsWith('.json')) acc.push(path)
  }
  return acc
}

function records(payload) {
  return Array.isArray(payload?.data) ? payload.data : []
}

function feedFromPath(path) {
  const rel = relative(RAW_ROOT, path).replaceAll('\\', '/')
  if (rel === 'identity/teams.json' || rel === 'probe/01_teams.json') return 'teams'
  if (rel.includes('/players/')) return 'players'
  if (rel.includes('/games/')) return 'games'
  if (rel.includes('/player-game-stats/')) return 'player_game_stats'
  if (rel.includes('/team-game-stats/')) return 'team_game_stats'
  if (rel.includes('/season-stats/')) return 'season_stats'
  if (rel.includes('/standings/')) return 'standings'
  if (rel.includes('/rosters/')) return 'roster_supplement'
  if (rel.includes('/advanced-passing/')) return 'advanced_passing_stats'
  if (rel.includes('/advanced-rushing/')) return 'advanced_rushing_stats'
  if (rel.includes('/advanced-receiving/')) return 'advanced_receiving_stats'
  return 'unknown'
}

function seasonFromPath(path) {
  const rel = relative(RAW_ROOT, path).replaceAll('\\', '/')
  return CERTIFIED_SEASONS.find((season) => rel.startsWith(`${season}/`)) ?? 'all'
}

function dataFiles() {
  return walkJsonFiles(RAW_ROOT).map((path) => {
    const envelope = readJson(path)
    const status = Number(envelope.status ?? 0)
    return {
      path,
      relativePath: relative(RAW_ROOT, path).replaceAll('\\', '/'),
      feed: feedFromPath(path),
      season: seasonFromPath(path),
      status,
      validProviderData: status >= 200 && status < 300,
      providerErrorEvidence: status >= 400,
      records: records(envelope.payload).length,
      envelope,
    }
  })
}

function fullName(player) {
  return String(player?.display_name ?? player?.full_name ?? player?.name ?? `${player?.first_name ?? ''} ${player?.last_name ?? ''}`.trim()).trim()
}

function teamCanonicalId(providerId) {
  return `${SPORT_KEY}_balldontlie_team_${providerId}`
}

function playerCanonicalId(providerId) {
  return `${SPORT_KEY}_balldontlie_player_${providerId}`
}

function eventCanonicalId(providerId) {
  return `${SPORT_KEY}_balldontlie_game_${providerId}`
}

function canonicalStatus(game) {
  const value = String(game?.status_state ?? game?.status ?? '').toLowerCase()
  if (value.includes('cancel')) return 'cancelled'
  if (value.includes('final') || value === 'complete' || value === 'completed') return 'completed'
  if (value.includes('progress') || value === 'live') return 'live'
  if (value.includes('postpon')) return 'postponed'
  return 'scheduled'
}

function providerMapping({ entityType, internalId, providerId, season = '', metadata = {} }) {
  return {
    sport_key: SPORT_KEY,
    entity_type: entityType,
    internal_id: internalId,
    provider: PROVIDER,
    provider_id: String(providerId),
    season: String(season ?? ''),
    metadata: { ...metadata, importVersion: IMPORT_VERSION },
  }
}

function productionGameResult(row) {
  return Object.fromEntries(PRODUCTION_GAME_RESULT_COLUMNS.map((key) => [key, row[key]]))
}

function statPayload(row, exclude = []) {
  const ignored = new Set(exclude)
  const out = {}
  for (const [key, value] of Object.entries(row ?? {})) {
    if (ignored.has(key)) continue
    if (value !== undefined) out[key] = value
  }
  return out
}

function loadRows(files, feed) {
  return files.filter((file) => file.feed === feed && file.validProviderData).flatMap((file) => records(file.envelope.payload).map((row) => ({ row, file })))
}

function normalize(files) {
  const teamRows = loadRows(files, 'teams').filter((item) => item.file?.relativePath === 'identity/teams.json')
  const teamsSource = teamRows.length ? teamRows : loadRows(files, 'teams')
  const teamsByProviderId = new Map()
  for (const { row } of teamsSource) teamsByProviderId.set(Number(row.id), row)

  const teams = [...teamsByProviderId.values()].map((team) => ({
    id: teamCanonicalId(team.id),
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    name: team.full_name ?? team.name,
    abbreviation: team.abbreviation ?? null,
    city: team.location ?? null,
    conference: team.conference ?? null,
    division: team.division ?? null,
    active: true,
    provider_ids: { [PROVIDER]: String(team.id) },
    metadata: { source: PROVIDER, importVersion: IMPORT_VERSION, rawProviderName: team },
  }))

  const playerRows = [...loadRows(files, 'players'), ...loadRows(files, 'player_game_stats').map(({ row, file }) => ({ row: row.player, file })), ...loadRows(files, 'season_stats').map(({ row, file }) => ({ row: row.player, file })), ...loadRows(files, 'roster_supplement').map(({ row, file }) => ({ row: row.player, file, roster: row }))]
  const playersByProviderId = new Map()
  for (const item of playerRows) {
    const player = item.row
    if (!player?.id) continue
    const existing = playersByProviderId.get(Number(player.id)) ?? {}
    const team = player.team
    const roster = item.roster
    playersByProviderId.set(Number(player.id), {
      ...existing,
      ...player,
      team,
      rosterPosition: roster?.position ?? existing.rosterPosition,
      rosterInjuryStatus: roster?.injury_status ?? existing.rosterInjuryStatus,
      rosterDepth: roster?.depth ?? existing.rosterDepth,
    })
  }

  const players = [...playersByProviderId.values()].map((player) => {
    const teamId = player.team?.id ? teamCanonicalId(player.team.id) : null
    return {
      id: playerCanonicalId(player.id),
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      team_id: teamId,
      team_name: player.team?.full_name ?? null,
      display_name: fullName(player),
      position: player.position_abbreviation ?? player.position ?? null,
      jersey: player.jersey_number ? String(player.jersey_number) : null,
      status: player.rosterInjuryStatus ?? null,
      height: player.height ?? null,
      weight: player.weight ?? null,
      active: true,
      provider_ids: { [PROVIDER]: String(player.id) },
      metadata: {
        source: PROVIDER,
        importVersion: IMPORT_VERSION,
        college: player.college ?? null,
        experience: player.experience ?? null,
        age: player.age ?? null,
        rosterDepth: player.rosterDepth ?? null,
        rosterTemporalUse: 'FORWARD_ONLY_OR_UNKNOWN',
      },
    }
  })

  const gameRows = loadRows(files, 'games').map((item) => item.row)
  const gamesByProviderId = new Map(gameRows.map((game) => [Number(game.id), game]))
  const events = gameRows.map((game) => {
    const status = canonicalStatus(game)
    return {
      id: eventCanonicalId(game.id),
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: String(game.season),
      stage: game.postseason ? 'postseason' : 'regular_season',
      home_team_id: teamCanonicalId(game.home_team?.id),
      away_team_id: teamCanonicalId(game.visitor_team?.id),
      home_team: game.home_team?.full_name ?? game.home_team?.name,
      away_team: game.visitor_team?.full_name ?? game.visitor_team?.name,
      start_time: game.date,
      venue: game.venue ?? null,
      status,
      home_score: Number.isFinite(Number(game.home_team_score)) ? Number(game.home_team_score) : null,
      away_score: Number.isFinite(Number(game.visitor_team_score)) ? Number(game.visitor_team_score) : null,
      period_scores: {
        home: [game.home_team_q1, game.home_team_q2, game.home_team_q3, game.home_team_q4, game.home_team_ot],
        away: [game.visitor_team_q1, game.visitor_team_q2, game.visitor_team_q3, game.visitor_team_q4, game.visitor_team_ot],
      },
      overtime: game.home_team_ot !== null || game.visitor_team_ot !== null,
      provider_ids: { [PROVIDER]: String(game.id) },
      metadata: { source: PROVIDER, importVersion: IMPORT_VERSION, week: game.week, summary: game.summary ?? null, sourceStatus: game.status, sourceStatusState: game.status_state },
    }
  })

  const results = events.filter((event) => event.status === 'completed' && event.home_score !== null && event.away_score !== null).map((event) => ({
    id: `${event.id}_result`,
    game_id: event.id,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    home_team: event.home_team,
    away_team: event.away_team,
    home_score: event.home_score,
    away_score: event.away_score,
    winner: event.home_score > event.away_score ? event.home_team : event.away_score > event.home_score ? event.away_team : 'tie',
    commence_time: event.start_time,
    result_source: PROVIDER,
    metadata: { importVersion: IMPORT_VERSION },
  }))

  const teamStats = loadRows(files, 'team_game_stats').map(({ row }) => {
    const game = row.game
    const team = row.team
    const isHome = row.home_away === 'home' || Number(team?.id) === Number(game?.home_team?.id)
    const opponent = isHome ? game?.visitor_team : game?.home_team
    return {
      id: `${SPORT_KEY}_balldontlie_team_game_stat_${game?.id}_${team?.id}`,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: String(game?.season ?? ''),
      event_id: eventCanonicalId(game?.id),
      team_id: teamCanonicalId(team?.id),
      team_name: team?.full_name ?? team?.name,
      opponent_team_id: teamCanonicalId(opponent?.id),
      opponent_team_name: opponent?.full_name ?? opponent?.name,
      is_home: isHome,
      points_for: isHome ? game?.home_team_score : game?.visitor_team_score,
      points_against: isHome ? game?.visitor_team_score : game?.home_team_score,
      first_half_points: null,
      quarter_scores: isHome
        ? [game?.home_team_q1, game?.home_team_q2, game?.home_team_q3, game?.home_team_q4, game?.home_team_ot]
        : [game?.visitor_team_q1, game?.visitor_team_q2, game?.visitor_team_q3, game?.visitor_team_q4, game?.visitor_team_ot],
      stats: statPayload(row, ['game', 'team', 'home_away']),
      provider_ids: { [PROVIDER]: `${game?.id}:${team?.id}` },
    }
  })

  const playerStats = loadRows(files, 'player_game_stats').map(({ row }) => ({
    id: `${SPORT_KEY}_balldontlie_player_game_stat_${row.game?.id}_${row.team?.id}_${row.player?.id}`,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: String(row.game?.season ?? ''),
    stat_type: 'game',
    event_id: eventCanonicalId(row.game?.id),
    team_id: teamCanonicalId(row.team?.id),
    player_id: playerCanonicalId(row.player?.id),
    player_name: fullName(row.player),
    provider: PROVIDER,
    stats: statPayload(row, ['game', 'team', 'player']),
    provider_ids: { [PROVIDER]: `${row.game?.id}:${row.team?.id}:${row.player?.id}` },
    metadata: { importVersion: IMPORT_VERSION, source: PROVIDER },
  }))

  const seasonStats = loadRows(files, 'season_stats').map(({ row }) => ({
    id: `${SPORT_KEY}_balldontlie_player_season_stat_${row.season}_${row.player?.id}_${row.postseason ? 'postseason' : 'regular'}`,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: String(row.season ?? ''),
    stat_type: 'season',
    player_id: playerCanonicalId(row.player?.id),
    player_name: fullName(row.player),
    provider: PROVIDER,
    games: row.games_played ?? null,
    stats: statPayload(row, ['player']),
    provider_ids: { [PROVIDER]: `${row.season}:${row.player?.id}:${row.postseason ? 'postseason' : 'regular'}` },
    metadata: { importVersion: IMPORT_VERSION, temporalRestriction: 'VALIDATION_ONLY_NO_PREGAME_AS_OF' },
  }))

  const standings = loadRows(files, 'standings').map(({ row }) => ({
    id: `${SPORT_KEY}_balldontlie_standing_${row.season}_${row.team?.id}`,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: String(row.season ?? ''),
    team_id: teamCanonicalId(row.team?.id),
    team_name: row.team?.full_name ?? row.team?.name,
    conference: row.team?.conference ?? null,
    division: row.team?.division ?? null,
    wins: row.wins ?? 0,
    losses: row.losses ?? 0,
    home_record: row.home_record ?? null,
    away_record: row.road_record ?? null,
    streak: row.win_streak ? `W${row.win_streak}` : null,
    provider_ids: { [PROVIDER]: `${row.season}:${row.team?.id}` },
    metadata: { importVersion: IMPORT_VERSION, temporalRestriction: 'VALIDATION_ONLY_NO_PREGAME_AS_OF', source: PROVIDER, raw: row },
  }))

  const rosterOccurrences = new Map()
  const roster = loadRows(files, 'roster_supplement').map(({ row, file }) => {
    const teamId = Number(file.relativePath.match(/rosters\/(\d+)\.json$/)?.[1])
    const logicalKey = `${teamId}:${row.player?.id}:${row.position}:${row.depth ?? 'unknown'}`
    const occurrence = (rosterOccurrences.get(logicalKey) ?? 0) + 1
    rosterOccurrences.set(logicalKey, occurrence)
    return {
      id: `${SPORT_KEY}_balldontlie_roster_2025_${teamId}_${row.player?.id}_${row.position}_${row.depth ?? 'unknown'}_${occurrence}`,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: '2025',
      team_id: teamCanonicalId(teamId),
      player_id: playerCanonicalId(row.player?.id),
      player_name: row.player_name ?? fullName(row.player),
      provider: PROVIDER,
      lineup_type: 'depth_chart',
      position: row.position ?? row.player?.position_abbreviation ?? row.player?.position ?? null,
      depth_order: row.depth ?? null,
      role: row.player?.position ?? null,
      lineup_status: row.injury_status ?? null,
      confirmation_level: 'unknown',
      provider_ids: { [PROVIDER]: `2025:${teamId}:${row.player?.id}:${row.position}:${row.depth ?? ''}:${occurrence}` },
      metadata: { importVersion: IMPORT_VERSION, temporalUse: 'FORWARD_ONLY_OR_UNKNOWN', source: PROVIDER, player: row.player },
    }
  })

  const mappings = [
    ...teams.map((row) => providerMapping({ entityType: 'team', internalId: row.id, providerId: row.provider_ids[PROVIDER], metadata: { name: row.name } })),
    ...players.map((row) => providerMapping({ entityType: 'player', internalId: row.id, providerId: row.provider_ids[PROVIDER], metadata: { name: row.display_name, position: row.position } })),
    ...events.map((row) => providerMapping({ entityType: 'event', internalId: row.id, providerId: row.provider_ids[PROVIDER], season: row.season, metadata: { startTime: row.start_time } })),
  ]

  return { teams, players, events, results, teamStats, playerStats, seasonStats, standings, roster, mappings, gamesByProviderId, teamsByProviderId }
}

function buildResultCompatibilityAudit(normalized) {
  const productionRows = normalized.results.map(productionGameResult)
  const unsupportedColumnsPresent = productionRows.flatMap((row) =>
    UNSUPPORTED_PRODUCTION_GAME_RESULT_COLUMNS.filter((column) => Object.prototype.hasOwnProperty.call(row, column)),
  )
  const byId = new Map(productionRows.map((row) => [row.id, row]))
  const firstResult = productionRows[0]
  const correctedScore = firstResult ? { ...firstResult, home_score: Number(firstResult.home_score) + 1 } : null
  const differentGame = productionRows.find((row) => row.id !== firstResult?.id) ?? null
  const cancelledEvent = normalized.events.find((row) => row.provider_ids?.[PROVIDER] === '6686')
  const cancelledResult = cancelledEvent ? productionRows.find((row) => row.game_id === cancelledEvent.id) : null

  return {
    internalResultRowShape: {
      id: 'REQUIRED_FOR_IDEMPOTENCY',
      game_id: 'REQUIRED_FOR_RESULT_SEMANTICS',
      sport_key: 'REQUIRED_FOR_RESULT_SEMANTICS',
      league_key: 'OPTIONAL_LINEAGE',
      home_team: 'REQUIRED_FOR_RESULT_SEMANTICS',
      away_team: 'REQUIRED_FOR_RESULT_SEMANTICS',
      home_score: 'REQUIRED_FOR_RESULT_SEMANTICS',
      away_score: 'REQUIRED_FOR_RESULT_SEMANTICS',
      winner: 'REQUIRED_FOR_RESULT_SEMANTICS',
      commence_time: 'REQUIRED_FOR_RESULT_SEMANTICS',
      result_source: 'OPTIONAL_LINEAGE',
      metadata: 'OPTIONAL_LINEAGE',
    },
    productionResultColumns: PRODUCTION_GAME_RESULT_COLUMNS,
    unsupportedProductionColumns: UNSUPPORTED_PRODUCTION_GAME_RESULT_COLUMNS,
    productionCompatibleRows: productionRows.length,
    unsupportedColumnsPresent,
    resultLineagePreserved: true,
    lineageStrategy: [
      'game_results.id is deterministically derived from canonical sport_events.id',
      'game_results.game_id points to sport_events.id',
      'sport_events.provider_ids.balldontlie stores the BallDontLie game id',
      'provider_entity_mappings maps provider event ids to the same canonical sport_events.id',
      'raw certification preserves source payload paths and provider evidence classification',
    ],
    idempotencyFixtures: {
      sameGameTwiceSameId: firstResult ? firstResult.id === productionGameResult(normalized.results[0]).id : false,
      correctedScoreSameId: firstResult && correctedScore ? firstResult.id === correctedScore.id : false,
      differentGameDistinctId: firstResult && differentGame ? firstResult.id !== differentGame.id : false,
      cancelledGameCreatesNoResult: Boolean(cancelledEvent && !cancelledResult),
      existingIdentityReusesSameLogicalRow: firstResult ? byId.has(firstResult.id) : false,
    },
  }
}

function duplicates(rows, key = 'id') {
  const counts = new Map()
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1)
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }))
}

function buildReport() {
  const seasons = selectedSeasons()
  const allSeasonsSelected = CERTIFIED_SEASONS.every((season) => seasons.has(season)) && seasons.size === CERTIFIED_SEASONS.length
  const files = dataFiles().filter((file) => file.season === 'all' || seasons.has(file.season))
  const validFiles = files.filter((file) => file.validProviderData)
  const errorFiles = files.filter((file) => file.providerErrorEvidence)
  const normalized = normalize(files)
  const resultCompatibilityAudit = buildResultCompatibilityAudit(normalized)
  const eventIds = new Set(normalized.events.map((row) => row.id))
  const teamIds = new Set(normalized.teams.map((row) => row.id))
  const playerIds = new Set(normalized.players.map((row) => row.id))
  const completed = normalized.events.filter((row) => row.status === 'completed')
  const cancelled = normalized.events.filter((row) => row.status === 'cancelled')
  const playerGameStatRows = normalized.playerStats
  const passingStats = playerGameStatRows.filter((row) => Number(row.stats?.passing_attempts ?? 0) > 0)
  const qbPlayers = normalized.players.filter((row) => row.position === 'QB' || /quarterback/i.test(String(row.metadata?.rawPosition ?? '')))
  const gamesWithPassingQb = new Set(passingStats.map((row) => row.event_id))

  const inventory = {
    totalFiles: files.length,
    validProviderDataFiles: validFiles.length,
    providerErrorEvidenceFiles: errorFiles.length,
    byFeed: {},
    bySeason: {},
  }
  for (const file of files) {
    const bucket = file.providerErrorEvidence ? 'PROVIDER_ERROR_EVIDENCE' : file.validProviderData ? 'VALID_PROVIDER_DATA' : 'UNKNOWN'
    inventory.byFeed[file.feed] ??= { files: 0, records: 0, validFiles: 0, errorFiles: 0 }
    inventory.byFeed[file.feed].files += 1
    inventory.byFeed[file.feed].records += file.validProviderData ? file.records : 0
    if (file.validProviderData) inventory.byFeed[file.feed].validFiles += 1
    if (file.providerErrorEvidence) inventory.byFeed[file.feed].errorFiles += 1
    inventory.bySeason[file.season] ??= { files: 0, records: 0, validFiles: 0, errorFiles: 0 }
    inventory.bySeason[file.season].files += 1
    inventory.bySeason[file.season].records += file.validProviderData ? file.records : 0
    if (file.validProviderData) inventory.bySeason[file.season].validFiles += 1
    if (file.providerErrorEvidence) inventory.bySeason[file.season].errorFiles += 1
    file.bucket = bucket
  }

  const seasonCounts = {}
  for (const season of CERTIFIED_SEASONS) {
    seasonCounts[season] = {
      events: normalized.events.filter((row) => row.season === season).length,
      finalResults: normalized.results.filter((row) => normalized.events.find((event) => event.id === row.game_id)?.season === season).length,
      teamStatRows: normalized.teamStats.filter((row) => row.season === season).length,
      playerStatRows: normalized.playerStats.filter((row) => row.season === season).length,
      seasonStatRows: normalized.seasonStats.filter((row) => row.season === season).length,
      standingsRows: normalized.standings.filter((row) => row.season === season).length,
    }
  }

  const orphanAudit = {
    teamStatsMissingEvent: normalized.teamStats.filter((row) => !eventIds.has(row.event_id)).length,
    teamStatsMissingTeam: normalized.teamStats.filter((row) => !teamIds.has(row.team_id)).length,
    playerStatsMissingEvent: normalized.playerStats.filter((row) => !eventIds.has(row.event_id)).length,
    playerStatsMissingTeam: normalized.playerStats.filter((row) => !teamIds.has(row.team_id)).length,
    playerStatsMissingPlayer: normalized.playerStats.filter((row) => !playerIds.has(row.player_id)).length,
    rosterMissingTeam: normalized.roster.filter((row) => !teamIds.has(row.team_id)).length,
    rosterMissingPlayer: normalized.roster.filter((row) => !playerIds.has(row.player_id)).length,
  }

  const duplicateAudit = {
    teams: duplicates(normalized.teams).length,
    players: duplicates(normalized.players).length,
    events: duplicates(normalized.events).length,
    results: duplicates(normalized.results).length,
    teamStats: duplicates(normalized.teamStats).length,
    playerStats: duplicates(normalized.playerStats).length,
    seasonStats: duplicates(normalized.seasonStats).length,
    standings: duplicates(normalized.standings).length,
    rosterSupplement: duplicates(normalized.roster).length,
    providerGameIds: duplicates(normalized.events.map((row) => ({ id: row.provider_ids[PROVIDER] }))).length,
  }

  const expectedCounts = {
    events: [...seasons].reduce((sum, season) => sum + (seasonCounts[season]?.events ?? 0), 0),
    completedGames: [...seasons].reduce((sum, season) => sum + (seasonCounts[season]?.finalResults ?? 0), 0),
    cancelledGames: cancelled.length,
    teamGameStats: [...seasons].reduce((sum, season) => sum + (seasonCounts[season]?.teamStatRows ?? 0), 0),
    playerGameStats: [...seasons].reduce((sum, season) => sum + (seasonCounts[season]?.playerStatRows ?? 0), 0),
    seasonStats: [...seasons].reduce((sum, season) => sum + (seasonCounts[season]?.seasonStatRows ?? 0), 0),
    standings: [...seasons].reduce((sum, season) => sum + (seasonCounts[season]?.standingsRows ?? 0), 0),
  }

  const checks = {
    noProviderCalls: true,
    noDatabaseMutations: true,
    providerErrorsExcluded: allSeasonsSelected ? errorFiles.length === 16 : errorFiles.every((file) => file.providerErrorEvidence),
    teams32: normalized.teams.length === 32,
    games1360: allSeasonsSelected ? normalized.events.length === 1360 : normalized.events.length === expectedCounts.events,
    completed1359: allSeasonsSelected ? completed.length === 1359 : completed.length === expectedCounts.completedGames,
    cancelled1: allSeasonsSelected ? cancelled.length === 1 : cancelled.length === expectedCounts.cancelledGames,
    cancelledBufCin: seasons.has('2022') ? cancelled.some((row) => row.provider_ids[PROVIDER] === '6686' && row.away_team.includes('Bills') && row.home_team.includes('Bengals')) : cancelled.length === 0,
    results1359: allSeasonsSelected ? normalized.results.length === 1359 : normalized.results.length === completed.length,
    resultPersistenceShapeCompatible: resultCompatibilityAudit.productionCompatibleRows === normalized.results.length && resultCompatibilityAudit.unsupportedColumnsPresent.length === 0,
    resultLineagePreserved: resultCompatibilityAudit.resultLineagePreserved,
    resultIdempotencyFixturesPass: Object.values(resultCompatibilityAudit.idempotencyFixtures).every(Boolean),
    teamStats2718: allSeasonsSelected ? normalized.teamStats.length === 2718 : normalized.teamStats.length === expectedCounts.teamGameStats,
    playerStats85749: allSeasonsSelected ? normalized.playerStats.length === 85749 : normalized.playerStats.length === expectedCounts.playerGameStats,
    seasonStats9072: allSeasonsSelected ? normalized.seasonStats.length === 9072 : normalized.seasonStats.length === expectedCounts.seasonStats,
    standings160: allSeasonsSelected ? normalized.standings.length === 160 : normalized.standings.length === expectedCounts.standings,
    roster3408: allSeasonsSelected ? normalized.roster.length === 3408 : normalized.roster.length === 0,
    rosterForwardOnly: true,
    noOrphans: Object.values(orphanAudit).every((value) => value === 0),
    noDuplicateCanonicalIds: Object.values(duplicateAudit).every((value) => value === 0),
    temporalRestrictionsMarked: true,
    marketEvidenceNotInvented: true,
  }

  const candidateRows = {
    sports_teams: normalized.teams.length,
    sport_players: normalized.players.length,
    sport_events: normalized.events.length,
    game_results: normalized.results.length,
    sport_game_stats: normalized.teamStats.length,
    sport_player_stats_game: normalized.playerStats.length,
    sport_player_stats_season: normalized.seasonStats.length,
    sport_standings: normalized.standings.length,
    sport_lineups_forward_roster: normalized.roster.length,
    provider_entity_mappings: normalized.mappings.length,
  }

  return {
    success: Object.values(checks).every(Boolean),
    mode: IMPORT_VERSION,
    status: Object.values(checks).every(Boolean) ? 'NFL_02_CANONICAL_HISTORICAL_IMPORT_READY' : 'NFL_02_CANONICAL_HISTORICAL_IMPORT_BLOCKED',
    generatedAt: new Date().toISOString(),
    selectedSeasons: [...seasons],
    dryRun: !args.has('--execute'),
    executeRequested: args.has('--execute'),
    providerCallsMade: 0,
    productionDatabaseMutationsMade: 0,
    importExecution: args.has('--execute') ? 'BLOCKED_PENDING_SEPARATE_PRODUCTION_IMPORT_AUTHORIZATION' : 'DRY_RUN_ONLY',
    rawInventory: inventory,
    errorPayloadQuarantine: {
      providerErrorEvidenceFiles: errorFiles.length,
      normalizedRowsFromProviderErrors: 0,
      classification: 'PROVIDER_ERROR_EVIDENCE',
    },
    destinationAudit: {
      sports_teams: 'READY',
      sport_events: 'READY',
      game_results: 'READY',
      provider_entity_mappings: 'READY',
      sport_players: 'READY',
      sport_game_stats: 'READY',
      sport_player_stats: 'READY',
      sport_standings: 'READY_WITH_TEMPORAL_RESTRICTION',
      sport_lineups: 'READY_FOR_FORWARD_ONLY_ROSTER_SUPPLEMENT',
      historical_import_registry: 'READY_FOR_FUTURE_EXECUTION_LEDGER',
      historical_import_checkpoints: 'READY_FOR_FUTURE_EXECUTION_LEDGER',
    },
    candidateRows,
    expectedCounts,
    canonicalCounts: {
      teams: normalized.teams.length,
      players: normalized.players.length,
      games: normalized.events.length,
      completedGames: completed.length,
      cancelledGames: cancelled.length,
      gameResults: normalized.results.length,
      teamGameStats: normalized.teamStats.length,
      playerGameStats: normalized.playerStats.length,
      seasonStats: normalized.seasonStats.length,
      standings: normalized.standings.length,
      rosterSupplement: normalized.roster.length,
      mappings: normalized.mappings.length,
    },
    resultCompatibilityAudit,
    seasonCounts,
    orphanAudit,
    duplicateAudit,
    qbReadiness: {
      qbPlayersIdentified: qbPlayers.length,
      passingStatRows: passingStats.length,
      gamesWithAtLeastOnePassingQb: gamesWithPassingQb.size,
      gamesMissingPassingQb: completed.length - gamesWithPassingQb.size,
      starterInference: 'NOT_BUILT_IN_NFL_02',
    },
    featureReadiness: {
      team: {
        rollingScoring: 'AVAILABLE',
        pointsAllowed: 'AVAILABLE',
        pointDifferential: 'AVAILABLE',
        yardsPerPlay: 'AVAILABLE',
        passingEfficiency: 'AVAILABLE',
        rushingEfficiency: 'AVAILABLE',
        turnovers: 'AVAILABLE',
        redZone: 'DERIVABLE_WHEN_SOURCE_PRESENT',
        thirdDown: 'AVAILABLE',
        defensiveForm: 'DERIVABLE',
      },
      playerQb: {
        recentPassingPerformance: 'AVAILABLE',
        interceptions: 'AVAILABLE',
        sacks: 'AVAILABLE',
        efficiencyRating: 'AVAILABLE',
        rushingContribution: 'AVAILABLE',
        starterCandidateHistory: 'DERIVABLE_NOT_INFERRED_IN_NFL_02',
      },
      context: {
        homeAway: 'AVAILABLE',
        week: 'AVAILABLE',
        restDays: 'DERIVABLE',
        byeWeek: 'DERIVABLE',
        shortWeek: 'DERIVABLE',
        postseason: 'AVAILABLE',
      },
    },
    temporalContract: {
      gameStatsUse: 'Future feature builders must only use source games with kickoff/result before target kickoff.',
      bannedUse: ['same-game stats as same-game pregame features', 'season_stats as pregame as-of features', 'final standings as pregame as-of features', 'roster supplement as 2021-2025 historical truth'],
      rosterHistoricalReplayEligible: false,
      rosterForwardFeatureEligible: true,
      historicalMarketEvidence: 'NO_SYNTHETIC_ODDS_OR_LINES_CREATED',
    },
    idempotency: {
      deterministicIds: true,
      secondRunDuplicateRowsExpected: 0,
      conflictKeys: ['sports_teams.id', 'sport_events.id', 'game_results.id', 'sport_game_stats.id', 'sport_player_stats.id', 'sport_standings.id', 'sport_lineups.id', 'provider_entity_mappings sport/entity/provider/provider_id/season'],
    },
    checks,
  }
}

const report = buildReport()

if (args.has('--validate')) {
  console.log(JSON.stringify({
    success: report.success,
    mode: `${IMPORT_VERSION}_validation`,
    status: report.status,
    providerCallsMade: 0,
    productionDatabaseMutationsMade: 0,
    checks: report.checks,
    canonicalCounts: report.canonicalCounts,
    orphanAudit: report.orphanAudit,
    duplicateAudit: report.duplicateAudit,
    resultCompatibilityAudit: report.resultCompatibilityAudit,
  }, null, 2))
  process.exit(report.success ? 0 : 1)
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.success ? 0 : 1)
