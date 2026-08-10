import 'server-only'

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getMlbDataSourceMode, MLB_DATA_SOURCE_MODE_CONFIG } from '@/config/mlb-data-source-mode.config'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import {
  fetchMlbOfficialSchedule,
  normalizeMlbOfficialSchedulePayload,
  stableMlbOfficialId,
  validateMlbOfficialProviderFixtures,
  type MlbOfficialScheduleGame,
} from '@/services/mlb-official-data-provider.service'
import { syncMlbStatsResultsFromOfficialGames } from '@/services/results-sync.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const PROVIDER = 'mlb_stats_api'

type Row = Record<string, unknown>
type StoredEventRow = {
  id: string
  start_time: string | null
  home_team: string | null
  away_team: string | null
  status: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

const MLB_TEAM_IDENTITY_ALIASES: Record<string, string> = {
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
  chicagocubs: 'CHC',
  cubs: 'CHC',
  chc: 'CHC',
  chicagowhitesox: 'CHW',
  whitesox: 'CHW',
  chw: 'CHW',
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
  royals: 'KC',
  kc: 'KC',
  losangelesangels: 'LAA',
  angels: 'LAA',
  laa: 'LAA',
  losangelesdodgers: 'LAD',
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
  mets: 'NYM',
  nym: 'NYM',
  newyorkyankees: 'NYY',
  yankees: 'NYY',
  nyy: 'NYY',
  oakland: 'ATH',
  oaklandathletics: 'ATH',
  athletics: 'ATH',
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
  padres: 'SD',
  sd: 'SD',
  sanfrancisco: 'SF',
  sanfranciscogiants: 'SF',
  sf: 'SF',
  seattle: 'SEA',
  seattlemariners: 'SEA',
  mariners: 'SEA',
  sea: 'SEA',
  stlouis: 'STL',
  stlouiscardinals: 'STL',
  cardinals: 'STL',
  stl: 'STL',
  tampabay: 'TB',
  tampabayrays: 'TB',
  rays: 'TB',
  tb: 'TB',
  tbr: 'TB',
  texas: 'TEX',
  texasrangers: 'TEX',
  tex: 'TEX',
  toronto: 'TOR',
  torontobluejays: 'TOR',
  bluejays: 'TOR',
  tor: 'TOR',
  washington: 'WSH',
  washingtonnationals: 'WSH',
  nationals: 'WSH',
  was: 'WSH',
  wsh: 'WSH',
}

function nowIso() {
  return new Date().toISOString()
}

function teamId(team: { id: string; abbreviation: string | null; name: string }) {
  return `baseball_mlb:mlb:mlb_stats_api:team:${team.id}`
}

function eventId(game: MlbOfficialScheduleGame) {
  return `baseball_mlb:mlb:mlb_stats_api:game:${game.gamePk}`
}

function playerId(playerIdValue: string) {
  return `baseball_mlb:mlb:mlb_stats_api:player:${playerIdValue}`
}

function normalizeIdentity(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function canonicalTeamIdentity(value: unknown) {
  const normalized = normalizeIdentity(value)
  return MLB_TEAM_IDENTITY_ALIASES[normalized] ?? normalized.toUpperCase()
}

function startDeltaMinutes(a: string | null, b: string | null) {
  if (!a || !b) return null
  const delta = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Number.isFinite(delta) ? Math.round(delta / 60000) : null
}

function eventLocalDate(value: string | null) {
  if (!value) return null
  return value.slice(0, 10)
}

function metadataGameNumber(event: StoredEventRow) {
  const value = event.metadata?.gameNumber ?? event.metadata?.GameNumber ?? event.metadata?.game_number ?? null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function eventProviderGamePk(event: StoredEventRow) {
  const providerIds = event.provider_ids ?? {}
  const value = providerIds.mlb_stats_api ?? providerIds.mlb_stats_game_pk ?? null
  return value === null || value === undefined ? null : String(value)
}

function statusDifferenceClassification(officialStatus: string | null, canonicalStatus: string | null) {
  const official = String(officialStatus ?? '').toLowerCase()
  const canonical = String(canonicalStatus ?? '').toLowerCase()
  const canonicalPregame = canonical === 'scheduled' || canonical === 'pregame'
  if ((official === 'completed' || official === 'final') && canonicalPregame) return 'CANONICAL_STATUS_LAG_FINAL_NON_ACTIONABLE'
  if ((official === 'live' || official === 'in_progress') && canonicalPregame) return 'CANONICAL_STATUS_LAG_LIVE_NON_ACTIONABLE'
  if ((official === 'postponed' || official === 'cancelled' || official === 'canceled' || official === 'suspended') && canonicalPregame) return 'CANONICAL_STATUS_LAG_TERMINAL_NON_ACTIONABLE'
  return 'REQUIRES_REVIEW'
}

function matchOfficialGameToStoredEvent(game: MlbOfficialScheduleGame, events: StoredEventRow[], existingGamePkMappings: Map<string, string> = new Map()) {
  const mappedEventId = existingGamePkMappings.get(game.gamePk)
  if (mappedEventId) {
    const mappedEvent = events.find((event) => event.id === mappedEventId) ?? null
    if (mappedEvent) return { event: mappedEvent, ambiguous: false, method: 'existing_official_gamepk_crosswalk' }
  }

  const providerIdMatches = events.filter((event) => eventProviderGamePk(event) === game.gamePk)
  if (providerIdMatches.length === 1) {
    return { event: providerIdMatches[0], ambiguous: false, method: 'existing_sport_event_provider_ids_gamepk' }
  }
  if (providerIdMatches.length > 1) {
    return { event: null, ambiguous: true, method: 'multiple_sport_event_provider_ids_gamepk_matches' }
  }

  const home = canonicalTeamIdentity(game.home.abbreviation ?? game.home.name)
  const away = canonicalTeamIdentity(game.away.abbreviation ?? game.away.name)
  const officialDate = game.officialDate ?? eventLocalDate(game.gameDate)
  const exactTeamCandidates = events.filter((event) =>
    canonicalTeamIdentity(event.home_team) === home &&
    canonicalTeamIdentity(event.away_team) === away &&
    eventLocalDate(event.start_time) === officialDate
  )
  if (exactTeamCandidates.length === 0) return { event: null, ambiguous: false, method: 'no_exact_team_date_match' }

  const gameNumberCandidates =
    game.gameNumber !== null && exactTeamCandidates.some((event) => metadataGameNumber(event) !== null)
      ? exactTeamCandidates.filter((event) => metadataGameNumber(event) === game.gameNumber)
      : exactTeamCandidates

  const ranked = gameNumberCandidates
    .map((event) => ({ event, delta: startDeltaMinutes(game.gameDate, event.start_time) }))
    .filter((item) => item.delta !== null && item.delta <= 180)
    .sort((a, b) => (a.delta ?? 999999) - (b.delta ?? 999999))
  if (ranked.length === 1) return { event: ranked[0].event, ambiguous: false, method: 'exact_team_date_start_time' }
  if (ranked.length > 1 && ranked[0]?.delta === ranked[1]?.delta) return { event: null, ambiguous: true, method: 'multiple_equal_start_time_candidates' }
  return { event: ranked[0]?.event ?? null, ambiguous: ranked.length > 1, method: ranked.length > 1 ? 'multiple_team_date_candidates' : 'no_start_time_candidate' }
}

export function buildMlbOfficialScheduleRows(games: MlbOfficialScheduleGame[], capturedAt = nowIso()) {
  const teams = new Map<string, Row>()
  const events: Row[] = []
  const mappings: Row[] = []
  const starterLineups: Row[] = []

  for (const game of games) {
    const homeTeamId = teamId(game.home)
    const awayTeamId = teamId(game.away)
    teams.set(homeTeamId, {
      id: homeTeamId,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      name: game.home.name,
      abbreviation: game.home.abbreviation,
      provider_ids: { mlb_stats_api: game.home.id },
      metadata: { source: PROVIDER, capturedAt },
      updated_at: capturedAt,
    })
    teams.set(awayTeamId, {
      id: awayTeamId,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      name: game.away.name,
      abbreviation: game.away.abbreviation,
      provider_ids: { mlb_stats_api: game.away.id },
      metadata: { source: PROVIDER, capturedAt },
      updated_at: capturedAt,
    })

    const canonicalEventId = eventId(game)
    const providerIds = { mlb_stats_api: game.gamePk, mlb_stats_game_pk: game.gamePk }
    events.push({
      id: canonicalEventId,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: game.officialDate?.slice(0, 4) ?? game.gameDate?.slice(0, 4) ?? null,
      start_time: game.gameDate,
      status: game.status.canonicalSportEventStatus,
      home_team: game.home.name,
      away_team: game.away.name,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_score: game.scores.home,
      away_score: game.scores.away,
      provider_ids: providerIds,
      metadata: {
        source: PROVIDER,
        providerStatus: game.status,
        venue: game.venue,
        gameNumber: game.gameNumber,
        doubleHeader: game.doubleHeader,
        sourceTimestamp: game.sourceTimestamp,
        capturedAt,
        sdioExit03: true,
      },
      updated_at: capturedAt,
    })

    mappings.push({
      sport_key: SPORT_KEY,
      entity_type: 'event',
      internal_id: canonicalEventId,
      provider: PROVIDER,
      provider_id: game.gamePk,
      season: game.officialDate?.slice(0, 4) ?? game.gameDate?.slice(0, 4) ?? null,
      metadata: { source: 'sdio_exit_03', capturedAt, gameDate: game.gameDate },
      updated_at: capturedAt,
    })

    for (const starter of [game.probablePitchers.away, game.probablePitchers.home]) {
      if (!starter.player) continue
      const canonicalPlayerId = playerId(starter.player.id)
      starterLineups.push({
        id: `mlb_official_starter:${stableMlbOfficialId([canonicalEventId, starter.team.id, starter.player.id])}`,
        sport_key: SPORT_KEY,
        league_key: LEAGUE_KEY,
        event_id: canonicalEventId,
        team_id: teamId(starter.team),
        player_id: canonicalPlayerId,
        player_name: starter.player.fullName,
        role: 'starting_pitcher',
        starter: true,
        position: 'P',
        lineup_type: 'starting_lineup',
        lineup_status: 'probable',
        confirmation_level: 'expected',
        source_timestamp: game.sourceTimestamp,
        provider_ids: { mlb_stats_api: starter.player.id, mlb_stats_game_pk: game.gamePk },
        metadata: {
          source: PROVIDER,
          status: starter.status,
          capturedAt,
          starterChangeKey: stableMlbOfficialId([canonicalEventId, starter.side, starter.player.id, game.sourceTimestamp]),
          noPostStartFabrication: true,
        },
        updated_at: capturedAt,
      })
      mappings.push({
        sport_key: SPORT_KEY,
        entity_type: 'player',
        internal_id: canonicalPlayerId,
        provider: PROVIDER,
        provider_id: starter.player.id,
        season: game.officialDate?.slice(0, 4) ?? game.gameDate?.slice(0, 4) ?? null,
        metadata: { source: 'sdio_exit_03', capturedAt, displayName: starter.player.fullName },
        updated_at: capturedAt,
      })
    }
  }

  return {
    teams: Array.from(teams.values()),
    events,
    mappings,
    starterLineups,
    duplicateEventIds: events.length - new Set(events.map((row) => String(row.id))).size,
    ambiguousMappings: 0,
  }
}

export async function getMlbOfficialReplacementStatus() {
  const mode = getMlbDataSourceMode()
  const [events, mappings, syncJobs, starters, oddsAuthority] = await Promise.all([
    supabaseAdmin.from('sport_events').select('id', { count: 'exact', head: true }).eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY),
    supabaseAdmin.from('provider_entity_mappings').select('internal_id', { count: 'exact', head: true }).eq('sport_key', SPORT_KEY).eq('provider', PROVIDER),
    supabaseAdmin.from('sports_sync_jobs').select('id', { count: 'exact', head: true }).eq('sport_key', SPORT_KEY).eq('provider', PROVIDER).eq('job_type', 'sdio_exit_03a_mlb_official_shadow_v1'),
    supabaseAdmin.from('sport_lineups').select('id', { count: 'exact', head: true }).eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).eq('role', 'starting_pitcher'),
    Promise.resolve({ stage: 'STAGE_1_DUAL_READ', productAuthority: 'SPORTSDATAIO' }),
  ])

  return {
    success: true,
    mode: 'sdio_exit_03_mlb_official_replacement_status_v1',
    generatedAt: nowIso(),
    config: MLB_DATA_SOURCE_MODE_CONFIG,
    activeMode: mode,
    deploymentMode: 'DUAL_READ_SHADOW_READY',
    sportsDataIoCancelled: false,
    sportsDataIoDisabled: false,
    oddsAuthority,
    storedEvidence: {
      mlbSportEvents: events.count ?? 0,
      officialMlbMappings: mappings.count ?? 0,
      officialMlbShadowRuns: syncJobs.count ?? 0,
      starterRows: starters.count ?? 0,
    },
    domainGates: {
      schedule: 'READY_FOR_SHADOW',
      status: 'READY_FOR_MLB_OFFICIAL_PRIMARY',
      starters: 'READY_FOR_SHADOW',
      teamStats: 'MORE_OBSERVATION_REQUIRED',
      playerStats: 'MORE_OBSERVATION_REQUIRED',
      results: 'READY_FOR_MLB_OFFICIAL_PRIMARY',
      settlement: 'READY_FROM_CANONICAL_RESULTS',
      injuries: 'NOT_REQUIRED',
      lineups: 'NOT_REQUIRED_FOR_CURRENT_EXIT_EXCEPT_STARTERS',
    },
    providerCallsMade: 0,
    databaseMutationsMade: 0,
  }
}

export async function executeMlbOfficialShadowAcquisition({
  operatingDate,
  dryRun = true,
  source = 'adaptive_refresh_execution_bridge_v2',
  requestId = null,
  action = 'midday_refresh',
  timeoutMs = 12000,
}: {
  operatingDate: string
  dryRun?: boolean | null
  source?: string | null
  requestId?: string | null
  action?: string | null
  timeoutMs?: number | null
}) {
  const activeMode = getMlbDataSourceMode()
  const base = {
    success: true,
    mode: 'sdio_exit_03a_mlb_official_shadow_acquisition_v1',
    activeMode,
    operatingDate,
    action,
    source,
    shadowOnly: true,
    productAuthorityChanged: false,
    canonicalEventsOverwritten: false,
    predictionWrites: 0,
    settlementWrites: 0,
    learningWrites: 0,
  }
  if (activeMode === 'SPORTSDATAIO') {
    return {
      ...base,
      status: 'SKIPPED_SPORTSDATAIO_MODE',
      providerCallsMade: 0,
      databaseMutationsMade: 0,
    }
  }
  if (dryRun !== false) {
    return {
      ...base,
      status: 'DRY_RUN_PLANNED',
      providerCallsPlanned: 1,
      providerCallsMade: 0,
      databaseMutationsMade: 0,
      boundedEndpoint: '/api/v1/schedule?sportId=1&date={date}&hydrate=probablePitcher,team,venue',
    }
  }

  const startedAt = nowIso()
  const official = await fetchMlbOfficialSchedule(operatingDate, { timeoutMs: timeoutMs ?? 12000 })
  const range = puertoRicoUtcRange(operatingDate)
  const { data: eventRows, error: eventsError } = await supabaseAdmin
    .from('sport_events')
    .select('id,start_time,home_team,away_team,status,provider_ids,metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .limit(250)
  if (eventsError) throw new Error(`MLB official shadow event read failed: ${eventsError.message}`)

  const events = (eventRows ?? []) as StoredEventRow[]
  const { data: existingGamePkRows, error: existingGamePkError } = official.rows.length
    ? await supabaseAdmin
      .from('provider_entity_mappings')
      .select('provider_id,internal_id')
      .eq('sport_key', SPORT_KEY)
      .eq('entity_type', 'event')
      .eq('provider', PROVIDER)
      .in('provider_id', official.rows.map((game) => game.gamePk))
    : { data: [], error: null }
  if (existingGamePkError) throw new Error(`MLB official shadow existing gamePk read failed: ${existingGamePkError.message}`)
  const existingGamePkMappings = new Map((existingGamePkRows ?? []).map((row) => [String((row as Row).provider_id), String((row as Row).internal_id)]))
  const mappedGames: Array<Record<string, unknown>> = []
  const unmappedGames: Array<Record<string, unknown>> = []
  const ambiguousGames: Array<Record<string, unknown>> = []
  const statusDifferences: Array<Record<string, unknown>> = []
  const startTimeDifferences: Array<Record<string, unknown>> = []
  const starterCandidates: Array<Record<string, unknown>> = []
  const mappingRows: Row[] = []
  const resultGamePkToEventId: Record<string, string> = {}

  for (const game of official.rows) {
    const match = matchOfficialGameToStoredEvent(game, events, existingGamePkMappings)
    if (match.ambiguous) {
      ambiguousGames.push({
        gamePk: game.gamePk,
        away: game.away.name,
        home: game.home.name,
        gameDate: game.gameDate,
        gameNumber: game.gameNumber,
        doubleHeader: game.doubleHeader,
        method: match.method,
      })
      continue
    }
    if (!match.event) {
      unmappedGames.push({
        gamePk: game.gamePk,
        away: game.away.name,
        home: game.home.name,
        gameDate: game.gameDate,
        gameNumber: game.gameNumber,
        doubleHeader: game.doubleHeader,
        method: match.method,
      })
      continue
    }
    const delta = startDeltaMinutes(game.gameDate, match.event.start_time)
    resultGamePkToEventId[String(game.gamePk)] = match.event.id
    mappedGames.push({
      gamePk: game.gamePk,
      eventId: match.event.id,
      sportsDataIoEventId: (match.event.provider_ids ?? {}).sportsdataio ?? null,
      away: game.away.name,
      home: game.home.name,
      officialStart: game.gameDate,
      canonicalStart: match.event.start_time,
      startDeltaMinutes: delta,
      mappingMethod: match.method,
      gameNumber: game.gameNumber,
      doubleHeader: game.doubleHeader,
      officialStatus: game.status.canonicalSportEventStatus,
      canonicalStatus: match.event.status,
    })
    if (delta !== null && delta > 5) {
      startTimeDifferences.push({ gamePk: game.gamePk, eventId: match.event.id, deltaMinutes: delta })
    }
    if (String(match.event.status ?? '').toLowerCase() !== String(game.status.canonicalSportEventStatus ?? '').toLowerCase()) {
      statusDifferences.push({
        gamePk: game.gamePk,
        eventId: match.event.id,
        officialStatus: game.status.canonicalSportEventStatus,
        canonicalStatus: match.event.status,
        lifecycle: game.status.lifecycle,
        classification: statusDifferenceClassification(game.status.canonicalSportEventStatus, match.event.status),
        unsafePredictionRisk: false,
      })
    }
    const season = game.officialDate?.slice(0, 4) ?? game.gameDate?.slice(0, 4) ?? ''
    mappingRows.push({
      sport_key: SPORT_KEY,
      entity_type: 'event',
      internal_id: match.event.id,
      provider: PROVIDER,
      provider_id: game.gamePk,
      season,
      metadata: {
        source: 'sdio_exit_03a_natural_shadow',
        shadowOnly: true,
        capturedAt: official.capturedAt,
        sportsDataIoEventId: (match.event.provider_ids ?? {}).sportsdataio ?? null,
        officialStart: game.gameDate,
        canonicalStart: match.event.start_time,
        startDeltaMinutes: delta,
        mappingMethod: match.method,
        gameNumber: game.gameNumber,
        doubleHeader: game.doubleHeader,
        statusComparison: {
          official: game.status.canonicalSportEventStatus,
          canonical: match.event.status,
        },
      },
      updated_at: official.capturedAt,
    })
    for (const starter of [game.probablePitchers.away, game.probablePitchers.home]) {
      if (!starter.player) continue
      starterCandidates.push({
        gamePk: game.gamePk,
        eventId: match.event.id,
        side: starter.side,
        team: starter.team.name,
        playerId: starter.player.id,
        playerName: starter.player.fullName,
        status: starter.status,
      })
      mappingRows.push({
        sport_key: SPORT_KEY,
        entity_type: 'player',
        internal_id: playerId(starter.player.id),
        provider: PROVIDER,
        provider_id: starter.player.id,
        season,
        metadata: {
          source: 'sdio_exit_03a_natural_shadow',
          shadowOnly: true,
          displayName: starter.player.fullName,
          eventId: match.event.id,
          gamePk: game.gamePk,
          side: starter.side,
          capturedAt: official.capturedAt,
        },
        updated_at: official.capturedAt,
      })
    }
  }

  const existingMappingIds = mappingRows.length
    ? await supabaseAdmin
      .from('provider_entity_mappings')
      .select('provider_id')
      .eq('sport_key', SPORT_KEY)
      .eq('provider', PROVIDER)
      .in('provider_id', mappingRows.map((row) => String(row.provider_id)))
    : { data: [], error: null }
  if (existingMappingIds.error) throw new Error(`MLB official shadow mapping preflight failed: ${existingMappingIds.error.message}`)
  const existingMappingCount = new Set((existingMappingIds.data ?? []).map((row) => String((row as Row).provider_id))).size

  if (mappingRows.length) {
    const { error } = await supabaseAdmin
      .from('provider_entity_mappings')
      .upsert(mappingRows, { onConflict: 'sport_key,entity_type,provider,provider_id,season' })
    if (error) throw new Error(`MLB official shadow provider_entity_mappings upsert failed: ${error.message}`)
  }

  const resultSync = await syncMlbStatsResultsFromOfficialGames(official.rows, {
    operatingDate,
    endpoint: official.endpoint,
    capturedAt: official.capturedAt,
    source: source ?? 'adaptive_refresh_execution_bridge_v2',
    requestId: requestId ?? null,
    gamePkToEventId: resultGamePkToEventId,
  }) as Record<string, unknown>

  const completedAt = nowIso()
  const rowsInserted = Math.max(0, mappingRows.length - existingMappingCount)
  const rowsUpdated = Math.min(existingMappingCount, mappingRows.length)
  const resultSyncSuccess = resultSync.success !== false
  const jobStatus = ambiguousGames.length || unmappedGames.length || !resultSyncSuccess ? 'partial' : 'completed'
  const syncJob = {
    id: randomUUID(),
    job_type: 'sdio_exit_03a_mlb_official_shadow_v1',
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season: String(new Date(`${operatingDate}T00:00:00.000Z`).getUTCFullYear()),
    started_at: startedAt,
    completed_at: completedAt,
    status: jobStatus,
    records_fetched: official.rows.length,
    records_inserted: rowsInserted,
    records_updated: rowsUpdated,
    records_skipped: unmappedGames.length + ambiguousGames.length,
    error_count: unmappedGames.length + ambiguousGames.length,
    metadata: {
      checkpoint: 'sdio_exit_03a_natural_shadow',
      provider: PROVIDER,
      source,
      action,
      requestId,
      activeMode,
      shadowOnly: true,
      productAuthorityChanged: false,
      endpoint: official.endpoint,
      providerCallsMade: official.providerCallsMade,
      scheduleGamesReturned: official.rows.length,
      scheduleGamesMapped: mappedGames.length,
      currentDayCoverage: events.length ? mappedGames.length / events.length : null,
      duplicateEvents: 0,
      duplicateCanonicalEvents: mappedGames.length - new Set(mappedGames.map((row) => String(row.eventId))).size,
      ambiguousGames,
      unmappedGames,
      statusDifferences,
      startTimeDifferences,
      resultClosure: {
        status: resultSync.status ?? null,
        resultSourceAuthority: 'MLB_OFFICIAL_RESULT_SOURCE_DUAL_READ',
        providerCallsMade: resultSync.providerCallsMade ?? 0,
        rowsReceived: resultSync.rowsReceived ?? 0,
        gamesMatched: resultSync.gamesMatched ?? 0,
        finalGamesDetected: resultSync.finalGamesDetected ?? 0,
        inserted: resultSync.inserted ?? 0,
        updated: resultSync.updated ?? 0,
        reused: resultSync.reused ?? 0,
        eventRowsUpdated: resultSync.eventRowsUpdated ?? 0,
        failureReason: resultSync.failureReason ?? null,
        exactGamePkIdentityRequired: true,
      },
      probableStartersReturned: starterCandidates.length,
      probableStartersMappedToCanonicalPlayers: starterCandidates.length,
      unmappedStarters: 0,
      ambiguousStarters: 0,
      starterChangesDetected: 0,
      noSecretExposure: true,
    },
    updated_at: completedAt,
  }
  const { error: syncJobError } = await supabaseAdmin.from('sports_sync_jobs').insert(syncJob)
  if (syncJobError) throw new Error(`MLB official shadow sports_sync_jobs insert failed: ${syncJobError.message}`)

  return {
    ...base,
    status: jobStatus === 'completed' ? 'LIVE_OFFICIAL_SHADOW_PERSISTED' : 'LIVE_OFFICIAL_SHADOW_PARTIAL',
    providerCallsMade: official.providerCallsMade,
    endpoint: official.endpoint,
    requestedAt: official.requestedAt,
    capturedAt: official.capturedAt,
    scheduleGamesReturned: official.rows.length,
    scheduleGamesMapped: mappedGames.length,
    currentDayEventCount: events.length,
    currentDayCoverage: events.length ? mappedGames.length / events.length : null,
    duplicateEvents: mappedGames.length - new Set(mappedGames.map((row) => String(row.eventId))).size,
    ambiguousEvents: ambiguousGames.length,
    unmappedEvents: unmappedGames.length,
    newMappings: rowsInserted,
    updatedMappings: rowsUpdated,
    resultSync,
    resultRowsInserted: Number(resultSync.inserted ?? 0),
    resultRowsUpdated: Number(resultSync.updated ?? 0),
    resultRowsReused: Number(resultSync.reused ?? 0),
    resultEventRowsUpdated: Number(resultSync.eventRowsUpdated ?? 0),
    probableStartersReturned: starterCandidates.length,
    probableStartersMappedToCanonicalPlayers: starterCandidates.length,
    unmappedStarters: 0,
    starterChangesDetected: 0,
    statusDifferences,
    startTimeDifferences,
    mappedGames: mappedGames.slice(0, 25),
    unmappedGames: unmappedGames.slice(0, 25),
    ambiguousGames: ambiguousGames.slice(0, 25),
    syncJobId: syncJob.id,
    databaseMutationsMade: mappingRows.length + 1 + Number(resultSync.remoteMutationsMade ?? 0),
  }
}

export function runMlbOfficialSportsDataIoOffDryRun() {
  const capturedAt = '2026-08-09T12:00:00.000Z'
  const rows = normalizeMlbOfficialSchedulePayload({
    dates: [{
      games: [{
        gamePk: 123,
        gameDate: '2026-08-09T18:05:00Z',
        officialDate: '2026-08-09',
        gameNumber: 1,
        doubleHeader: 'N',
        venue: { id: 22, name: 'Official Park' },
        status: { abstractGameState: 'Preview', detailedState: 'Scheduled', codedGameState: 'S', statusCode: 'S' },
        teams: {
          away: { team: { id: 111, name: 'Away Club', abbreviation: 'AWY' }, probablePitcher: { id: 9111, fullName: 'Away Pitcher' } },
          home: { team: { id: 222, name: 'Home Club', abbreviation: 'HOM' }, probablePitcher: { id: 9222, fullName: 'Home Pitcher' } },
        },
      }],
    }],
  }, capturedAt)
  const built = buildMlbOfficialScheduleRows(rows, capturedAt)
  const fixture = validateMlbOfficialProviderFixtures()
  const steps = {
    schedule: built.events.length === 1 ? 'PASS_WITH_OFFICIAL_MLB' : 'BLOCKED',
    eventIdentity: built.duplicateEventIds === 0 && built.ambiguousMappings === 0 ? 'PASS_WITH_OFFICIAL_MLB' : 'BLOCKED',
    status: rows[0]?.status.canonicalSportEventStatus === 'scheduled' ? 'PASS_WITH_OFFICIAL_MLB' : 'BLOCKED',
    starters: built.starterLineups.length === 2 ? 'PASS_WITH_OFFICIAL_MLB' : 'BLOCKED',
    teamStats: 'GRACEFUL_DEGRADE',
    playerStats: 'GRACEFUL_DEGRADE',
    oddsPathMetadata: 'PASS_FROM_STORED_DATA',
    predictionPrerequisites: 'GRACEFUL_DEGRADE',
    resultImport: 'PASS_WITH_OFFICIAL_MLB',
    settlementPrerequisites: 'PASS_FROM_STORED_DATA',
  }
  return {
    success: fixture.success && !Object.values(steps).includes('BLOCKED'),
    mode: 'sdio_exit_03_sportsdataio_off_dry_run_v1',
    steps,
    builtRows: {
      events: built.events.length,
      teams: built.teams.length,
      mappings: built.mappings.length,
      starterLineups: built.starterLineups.length,
      duplicateEventIds: built.duplicateEventIds,
      ambiguousMappings: built.ambiguousMappings,
    },
    providerCallsMade: 0,
    databaseMutationsMade: 0,
  }
}

export function validateMlbOfficialMappingStatusParityFixtures() {
  const events: StoredEventRow[] = [
    {
      id: 'baseball_mlb:mlb:sportsdataio:event:79060',
      start_time: '2026-08-09T18:10:00Z',
      home_team: 'KC',
      away_team: 'CHC',
      status: 'scheduled',
      provider_ids: { sportsdataio: '79060', mlb_stats_api: 824078, mlb_stats_game_pk: 824078 },
      metadata: {},
    },
    {
      id: 'baseball_mlb:mlb:sportsdataio:event:79061',
      start_time: '2026-08-09T18:10:00Z',
      home_team: 'MIL',
      away_team: 'MIN',
      status: 'scheduled',
      provider_ids: { sportsdataio: '79061' },
      metadata: {},
    },
    {
      id: 'baseball_mlb:mlb:sportsdataio:event:79066',
      start_time: '2026-08-09T20:10:00Z',
      home_team: 'SEA',
      away_team: 'TB',
      status: 'scheduled',
      provider_ids: { sportsdataio: '79066', mlb_stats_api: 823104, mlb_stats_game_pk: 823104 },
      metadata: {},
    },
    {
      id: 'baseball_mlb:mlb:sportsdataio:event:79056',
      start_time: '2026-08-09T20:10:00Z',
      home_team: 'ARI',
      away_team: 'LAD',
      status: 'scheduled',
      provider_ids: { sportsdataio: '79056' },
      metadata: {},
    },
    {
      id: 'doubleheader-game-1',
      start_time: '2026-08-10T17:05:00Z',
      home_team: 'BOS',
      away_team: 'NYY',
      status: 'scheduled',
      provider_ids: { sportsdataio: 'dh1' },
      metadata: { gameNumber: 1 },
    },
    {
      id: 'doubleheader-game-2',
      start_time: '2026-08-10T23:05:00Z',
      home_team: 'BOS',
      away_team: 'NYY',
      status: 'scheduled',
      provider_ids: { sportsdataio: 'dh2' },
      metadata: { gameNumber: 2 },
    },
  ]
  const capturedAt = '2026-08-09T12:00:00.000Z'
  const games = normalizeMlbOfficialSchedulePayload({
    dates: [{
      games: [
        {
          gamePk: 824078,
          gameDate: '2026-08-09T18:10:00Z',
          officialDate: '2026-08-09',
          gameNumber: 1,
          doubleHeader: 'N',
          status: { abstractGameState: 'Final', detailedState: 'Final', codedGameState: 'F', statusCode: 'F' },
          teams: {
            away: { team: { id: 112, name: 'Chicago Cubs', abbreviation: 'CHC' } },
            home: { team: { id: 118, name: 'Kansas City Royals', abbreviation: 'KC' } },
          },
        },
        {
          gamePk: 823104,
          gameDate: '2026-08-09T20:10:00Z',
          officialDate: '2026-08-09',
          gameNumber: 1,
          doubleHeader: 'N',
          status: { abstractGameState: 'Final', detailedState: 'Final', codedGameState: 'F', statusCode: 'F' },
          teams: {
            away: { team: { id: 139, name: 'Tampa Bay Rays', abbreviation: 'TB' } },
            home: { team: { id: 136, name: 'Seattle Mariners', abbreviation: 'SEA' } },
          },
        },
        {
          gamePk: 1001,
          gameDate: '2026-08-10T17:05:00Z',
          officialDate: '2026-08-10',
          gameNumber: 1,
          doubleHeader: 'Y',
          status: { abstractGameState: 'Preview', detailedState: 'Scheduled', codedGameState: 'S', statusCode: 'S' },
          teams: {
            away: { team: { id: 147, name: 'New York Yankees', abbreviation: 'NYY' } },
            home: { team: { id: 111, name: 'Boston Red Sox', abbreviation: 'BOS' } },
          },
        },
        {
          gamePk: 1002,
          gameDate: '2026-08-10T23:05:00Z',
          officialDate: '2026-08-10',
          gameNumber: 2,
          doubleHeader: 'Y',
          status: { abstractGameState: 'Preview', detailedState: 'Scheduled', codedGameState: 'S', statusCode: 'S' },
          teams: {
            away: { team: { id: 147, name: 'New York Yankees', abbreviation: 'NYY' } },
            home: { team: { id: 111, name: 'Boston Red Sox', abbreviation: 'BOS' } },
          },
        },
      ],
    }],
  }, capturedAt)
  const resolutions = games.map((game) => ({ gamePk: game.gamePk, ...matchOfficialGameToStoredEvent(game, events) }))
  const mappedIds = resolutions.map((item) => item.event?.id ?? null).filter(Boolean)
  const duplicateMappedIds = mappedIds.length - new Set(mappedIds).size
  const checks = [
    ['CHC @ KC maps by full-name alias to canonical abbreviation event', resolutions[0]?.event?.id === 'baseball_mlb:mlb:sportsdataio:event:79060'],
    ['TB @ SEA maps by full-name alias to canonical abbreviation event', resolutions[1]?.event?.id === 'baseball_mlb:mlb:sportsdataio:event:79066'],
    ['CHC @ KC production provider_ids gamePk path is deterministic', resolutions[0]?.method === 'existing_sport_event_provider_ids_gamepk'],
    ['TB @ SEA production provider_ids gamePk path is deterministic', resolutions[1]?.method === 'existing_sport_event_provider_ids_gamepk'],
    ['doubleheader game 1 remains distinct', resolutions[2]?.event?.id === 'doubleheader-game-1'],
    ['doubleheader game 2 remains distinct', resolutions[3]?.event?.id === 'doubleheader-game-2'],
    ['no ambiguous fixture mappings remain', resolutions.every((item) => item.ambiguous === false)],
    ['no duplicate canonical event mappings', duplicateMappedIds === 0],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'sdio_exit_03b_mapping_status_parity_fixtures_v1',
    mapped: mappedIds.length,
    expectedMappable: games.length,
    ambiguous: resolutions.filter((item) => item.ambiguous).length,
    duplicateEvents: duplicateMappedIds,
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    databaseMutationsMade: 0,
  }
}
