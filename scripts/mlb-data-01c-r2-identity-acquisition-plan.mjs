import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r2-identity-acquisition-plan.json')
const prior01cPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-2025-canonical-mapping.json')
const priorR1Path = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r1-identity-repair-audit.json')
const baselineCommit = 'b1b53d38fc4eb00bbb0a69ae862e0223108cd034'
const sportKey = 'baseball_mlb'
const provider = 'mlb_stats_api'
const version = 'MLB_DATA_01C_R2_IDENTITY_ACQUISITION_PLAN_V1'

const teamAliases = {
  AZ: 'ARI',
  CWS: 'CHW',
}

const providerKeyAllowlist = ['mlb_stats_game_pk', 'mlb_stats_api', 'gamePk', 'game_pk', 'mlb_game_pk']
const playerKeyAllowlist = ['mlbam', 'mlb_id', 'mlbam_id', 'mlb_stats_api', 'mlb_stats_player_id', 'personId']
const mlbProviderAllowlist = ['mlb_stats_api', 'mlb_stats', 'mlb', 'mlbam']

function loadEnvFile(file = '.env.local') {
  const fullPath = path.join(root, file)
  if (!fs.existsSync(fullPath)) return
  for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[key] ||= value
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]))
  }
  return value
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(stableJson(value))).digest('hex')
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function providerIdFromBag(value, keys) {
  const bag = asObject(value)
  for (const key of keys) {
    const found = bag[key]
    if (found == null || found === '') continue
    if (typeof found === 'object') {
      const nested = providerIdFromBag(found, keys)
      if (nested) return nested
      if (found.gamePk != null) return String(found.gamePk)
      if (found.id != null) return String(found.id)
    } else {
      return String(found)
    }
  }
  for (const item of Object.values(bag)) {
    if (item && typeof item === 'object') {
      const nested = providerIdFromBag(item, keys)
      if (nested) return nested
    }
  }
  return null
}

function canonicalTeamKey(value) {
  const key = String(value ?? '').trim().toUpperCase()
  return teamAliases[key] ?? key
}

function eventDate(event) {
  return String(event.start_time ?? '').slice(0, 10)
}

function addIndex(map, key, value) {
  if (!key) return
  const current = map.get(String(key)) ?? []
  current.push(value)
  map.set(String(key), current)
}

function countClassifications(entries) {
  return {
    MAPPED: entries.filter((entry) => entry.classification === 'MAPPED').length,
    UNMAPPED: entries.filter((entry) => entry.classification === 'UNMAPPED').length,
    AMBIGUOUS: entries.filter((entry) => entry.classification === 'AMBIGUOUS').length,
    CONFLICT: entries.filter((entry) => entry.classification === 'CONFLICT').length,
  }
}

function countMethods(entries) {
  return entries.reduce((acc, entry) => {
    const key = entry.method ?? 'NONE'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

async function fetchAll(client, table, columns, configure = null, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    let query = client.from(table).select(columns).range(from, from + pageSize - 1)
    if (configure) query = configure(query)
    const { data, error } = await query
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

async function countRows(client, table, configure = null) {
  let query = client.from(table).select('id', { count: 'exact', head: true }).limit(0)
  if (configure) query = configure(query)
  const { count, error } = await query
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function keysetRawRows(client, columns, onPage) {
  let lastId = ''
  for (;;) {
    let query = client.from('pick2_raw_mlb_statcast_pitches').select(`id,${columns}`).order('id', { ascending: true }).limit(1000)
    if (lastId) query = query.gt('id', lastId)
    const { data, error } = await query
    if (error) throw new Error(`raw keyset read failed after ${lastId || 'START'}: ${error.message}`)
    if (!data || !data.length) break
    await onPage(data)
    lastId = String(data[data.length - 1].id)
  }
}

async function rawInventory(client) {
  const rawCount = await countRows(client, 'pick2_raw_mlb_statcast_pitches')
  const identitySet = new Set()
  const games = new Map()
  const teams = new Set()
  const players = new Map()
  let duplicates = 0
  let minDate = null
  let maxDate = null

  await keysetRawRows(
    client,
    'game_pk,game_date,source_home_team,source_away_team,source_pitcher_id,source_batter_id,source_player_name,at_bat_number,pitch_number',
    async (page) => {
      for (const row of page) {
        const identity = `${row.game_pk}:${row.at_bat_number}:${row.pitch_number}`
        if (identitySet.has(identity)) duplicates += 1
        else identitySet.add(identity)

        const gamePk = String(row.game_pk)
        const game = games.get(gamePk) ?? {
          gamePk,
          gameDate: String(row.game_date),
          sourceHomeTeam: row.source_home_team,
          sourceAwayTeam: row.source_away_team,
          sourceRows: 0,
        }
        game.sourceRows += 1
        games.set(gamePk, game)
        teams.add(String(row.source_home_team))
        teams.add(String(row.source_away_team))

        for (const [id, role] of [[row.source_pitcher_id, 'pitcher'], [row.source_batter_id, 'batter']]) {
          if (id == null) continue
          const personId = String(id)
          const current = players.get(personId) ?? {
            personId,
            sourceRoles: new Set(),
            auditOnlySourceNames: new Set(),
            pitcherRows: 0,
            batterRows: 0,
          }
          current.sourceRoles.add(role)
          if (role === 'pitcher') {
            current.pitcherRows += 1
            if (row.source_player_name) current.auditOnlySourceNames.add(String(row.source_player_name))
          } else {
            current.batterRows += 1
          }
          players.set(personId, current)
        }

        const date = String(row.game_date)
        if (!minDate || date < minDate) minDate = date
        if (!maxDate || date > maxDate) maxDate = date
      }
    },
  )

  return {
    rawCount,
    uniquePitchIdentities: identitySet.size,
    duplicateIdentities: duplicates,
    games: [...games.values()].sort((a, b) => Number(a.gamePk) - Number(b.gamePk)),
    players: [...players.values()].map((player) => ({
      personId: player.personId,
      sourceRole: player.pitcherRows > 0 && player.batterRows > 0 ? 'both' : player.pitcherRows > 0 ? 'pitcher_only' : 'batter_only',
      auditOnlySourceNames: [...player.auditOnlySourceNames].sort(),
      pitcherRows: player.pitcherRows,
      batterRows: player.batterRows,
      totalRows: player.pitcherRows + player.batterRows,
    })).sort((a, b) => Number(a.personId) - Number(b.personId)),
    gameCount: games.size,
    teamCount: teams.size,
    sourceTeams: [...teams].sort(),
    minDate,
    maxDate,
  }
}

function buildTeamMap(teams, sourceTeams) {
  const byKey = new Map()
  for (const team of teams) {
    for (const candidate of [team.abbreviation, team.name, asObject(team.provider_ids).abbreviation, asObject(team.metadata).abbreviation, asObject(team.metadata).mlb_abbreviation]) {
      if (candidate) addIndex(byKey, canonicalTeamKey(candidate), team)
    }
  }
  return new Map(sourceTeams.map((sourceTeam) => {
    const candidates = [...new Map((byKey.get(canonicalTeamKey(sourceTeam)) ?? []).map((team) => [team.id, team])).values()]
    return [sourceTeam, candidates.length === 1 ? candidates[0].id : null]
  }))
}

function buildGameInputs(raw, events, mappings, teamMap) {
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const providerByGamePk = new Map()
  const mappingByGamePk = new Map()
  const dateHomeAway = new Map()
  for (const event of events) {
    const gamePk = providerIdFromBag(event.provider_ids, providerKeyAllowlist) ?? providerIdFromBag(event.metadata, providerKeyAllowlist)
    addIndex(providerByGamePk, gamePk, event)
    if (event.home_team_id && event.away_team_id) addIndex(dateHomeAway, `${eventDate(event)}:${event.home_team_id}:${event.away_team_id}`, event)
  }
  for (const mapping of mappings) {
    if (!['event', 'game'].includes(String(mapping.entity_type).toLowerCase())) continue
    if (!mlbProviderAllowlist.includes(String(mapping.provider).toLowerCase())) continue
    addIndex(mappingByGamePk, mapping.provider_id, mapping)
  }

  const entries = raw.games.map((game) => {
    const homeTeamId = teamMap.get(game.sourceHomeTeam) ?? null
    const awayTeamId = teamMap.get(game.sourceAwayTeam) ?? null
    const directEventCandidates = providerByGamePk.get(game.gamePk) ?? []
    const providerMappings = mappingByGamePk.get(game.gamePk) ?? []
    const mappedEventCandidates = [...new Map(providerMappings.map((mapping) => [mapping.internal_id, eventsById.get(mapping.internal_id)]).filter(([, event]) => event).map(([id, event]) => [id, event])).values()]
    const dateTeamCandidates = homeTeamId && awayTeamId ? dateHomeAway.get(`${game.gameDate}:${homeTeamId}:${awayTeamId}`) ?? [] : []
    let method = null
    let candidates = directEventCandidates
    if (candidates.length === 1) method = 'EXACT_GAMEPK'
    if (candidates.length === 0 && mappedEventCandidates.length) {
      candidates = mappedEventCandidates
      if (candidates.length === 1) method = 'EXACT_PROVIDER_CROSSWALK'
    }
    if (candidates.length === 0 && dateTeamCandidates.length) {
      candidates = dateTeamCandidates
      if (candidates.length === 1) method = 'EXACT_DATE_HOME_AWAY'
    }
    const classification = candidates.length === 1 ? 'MAPPED' : candidates.length === 0 ? 'UNMAPPED' : 'AMBIGUOUS'
    return {
      gamePk: game.gamePk,
      statcastGameDate: game.gameDate,
      sourceHomeTeam: game.sourceHomeTeam,
      sourceAwayTeam: game.sourceAwayTeam,
      sourceRows: game.sourceRows,
      existingDeterministicCandidateSportEvents: candidates.map((event) => ({
        sportEventId: event.id,
        startTime: event.start_time ?? null,
        homeTeamId: event.home_team_id ?? null,
        awayTeamId: event.away_team_id ?? null,
        status: event.status ?? null,
      })).sort((a, b) => a.sportEventId.localeCompare(b.sportEventId)),
      previousDryRunClassification: classification,
      previousAmbiguityCount: classification === 'AMBIGUOUS' ? candidates.length : 0,
      previousMethod: method,
      existingProviderEvidence: {
        sportEventProviderIdMatches: directEventCandidates.map((event) => event.id).sort(),
        providerEntityMappingRows: providerMappings.map((mapping) => ({
          provider: mapping.provider,
          providerId: mapping.provider_id,
          internalId: mapping.internal_id,
          season: mapping.season ?? '',
        })).sort((a, b) => `${a.provider}:${a.providerId}:${a.internalId}`.localeCompare(`${b.provider}:${b.providerId}:${b.internalId}`)),
        dateHomeAwayCandidateCount: dateTeamCandidates.length,
      },
    }
  })

  return {
    entries,
    counts: countClassifications(entries.map((entry) => ({ classification: entry.previousDryRunClassification }))),
    methodCounts: countMethods(entries.map((entry) => ({ method: entry.previousMethod }))),
    uniqueStatcastGameDates: new Set(entries.map((entry) => entry.statcastGameDate)).size,
  }
}

function buildPlayerInputs(raw, players, mappings) {
  const playersById = new Map(players.map((player) => [player.id, player]))
  const byMlbam = new Map()
  const mappingByMlbam = new Map()
  for (const player of players) {
    const id = providerIdFromBag(player.provider_ids, playerKeyAllowlist) ?? providerIdFromBag(player.metadata, playerKeyAllowlist)
    addIndex(byMlbam, id, player)
  }
  for (const mapping of mappings) {
    if (String(mapping.entity_type).toLowerCase() !== 'player') continue
    if (!mlbProviderAllowlist.includes(String(mapping.provider).toLowerCase())) continue
    addIndex(mappingByMlbam, mapping.provider_id, mapping)
  }

  const entries = raw.players.map((sourcePlayer) => {
    const storedCandidates = byMlbam.get(sourcePlayer.personId) ?? []
    const providerMappings = mappingByMlbam.get(sourcePlayer.personId) ?? []
    const mappingCandidates = [...new Map(providerMappings.map((mapping) => [mapping.internal_id, playersById.get(mapping.internal_id)]).filter(([, player]) => player).map(([id, player]) => [id, player])).values()]
    const candidates = storedCandidates.length ? storedCandidates : mappingCandidates
    const classification = candidates.length === 1 ? 'MAPPED' : candidates.length === 0 ? 'UNMAPPED' : 'AMBIGUOUS'
    return {
      personId: sourcePlayer.personId,
      sourceRole: sourcePlayer.sourceRole,
      auditOnlySourceNames: sourcePlayer.auditOnlySourceNames,
      pitcherRows: sourcePlayer.pitcherRows,
      batterRows: sourcePlayer.batterRows,
      totalRows: sourcePlayer.totalRows,
      existingProviderMappingEvidence: providerMappings.map((mapping) => ({
        provider: mapping.provider,
        providerId: mapping.provider_id,
        internalId: mapping.internal_id,
        season: mapping.season ?? '',
      })).sort((a, b) => `${a.provider}:${a.providerId}:${a.internalId}`.localeCompare(`${b.provider}:${b.providerId}:${b.internalId}`)),
      existingCanonicalCandidates: candidates.map((player) => ({
        sportPlayerId: player.id,
        displayName: player.display_name ?? null,
        teamId: player.team_id ?? null,
      })).sort((a, b) => a.sportPlayerId.localeCompare(b.sportPlayerId)),
      previousGapClassification: classification,
      gapReason: classification === 'UNMAPPED' ? 'PROVIDER_CROSSWALK_MISSING' : classification === 'AMBIGUOUS' ? 'IDENTITY_AMBIGUITY' : null,
      namesAreIdentityKeys: false,
    }
  })

  return {
    entries,
    counts: countClassifications(entries.map((entry) => ({ classification: entry.previousGapClassification }))),
    roleCounts: {
      pitcherOnly: entries.filter((entry) => entry.sourceRole === 'pitcher_only').length,
      batterOnly: entries.filter((entry) => entry.sourceRole === 'batter_only').length,
      both: entries.filter((entry) => entry.sourceRole === 'both').length,
    },
  }
}

async function main() {
  loadEnvFile()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase configuration')
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const prior01c = readJson(prior01cPath)
  const priorR1 = readJson(priorR1Path)

  const raw = await rawInventory(client)
  const [
    teams,
    events,
    players,
    mappings,
    canonicalHomeRows,
    canonicalAwayRows,
    eventRowsMapped,
    pitcherRowsMapped,
    batterRowsMapped,
    imported2026Rows,
    featureSnapshots,
    pitcherFeatures,
    batterFeatures,
    teamFeatures,
    bullpenFeatures,
    matchupFeatures,
    firstInningFeatures,
    modelRegistry,
    modelFeatureSets,
    modelVersions,
    modelTrainingRuns,
    modelValidationRuns,
    gamePredictions,
    predictionResults,
    marketValueEvaluations,
  ] = await Promise.all([
    fetchAll(client, 'sports_teams', 'id,sport_key,league_key,name,abbreviation,provider_ids,metadata', (q) => q.eq('sport_key', sportKey)),
    fetchAll(client, 'sport_events', 'id,sport_key,league_key,season,start_time,status,home_team_id,away_team_id,home_team,away_team,provider_ids,metadata', (q) => q.eq('sport_key', sportKey).eq('season', '2025')),
    fetchAll(client, 'sport_players', 'id,sport_key,league_key,team_id,display_name,provider_ids,metadata', (q) => q.eq('sport_key', sportKey)),
    fetchAll(client, 'provider_entity_mappings', 'id,sport_key,entity_type,internal_id,provider,provider_id,season,metadata', (q) => q.eq('sport_key', sportKey).in('entity_type', ['event', 'game', 'player'])),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.not('canonical_home_team_id', 'is', null)),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.not('canonical_away_team_id', 'is', null)),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.not('event_id', 'is', null)),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.not('canonical_pitcher_id', 'is', null)),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.not('canonical_batter_id', 'is', null)),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.eq('game_year', 2026)),
    countRows(client, 'pick2_feature_snapshots'),
    countRows(client, 'pick2_mlb_pitcher_daily_features'),
    countRows(client, 'pick2_mlb_batter_daily_features'),
    countRows(client, 'pick2_mlb_team_daily_features'),
    countRows(client, 'pick2_mlb_bullpen_daily_features'),
    countRows(client, 'pick2_mlb_matchup_daily_features'),
    countRows(client, 'pick2_mlb_first_inning_daily_features'),
    countRows(client, 'pick2_model_registry'),
    countRows(client, 'pick2_model_feature_sets'),
    countRows(client, 'pick2_model_versions'),
    countRows(client, 'pick2_model_training_runs'),
    countRows(client, 'pick2_model_validation_runs'),
    countRows(client, 'pick2_game_predictions'),
    countRows(client, 'pick2_prediction_results'),
    countRows(client, 'pick2_market_value_evaluations'),
  ])

  const teamMap = buildTeamMap(teams, raw.sourceTeams)
  const gameInputs = buildGameInputs(raw, events, mappings, teamMap)
  const playerInputs = buildPlayerInputs(raw, players, mappings)
  const featureTables = featureSnapshots + pitcherFeatures + batterFeatures + teamFeatures + bullpenFeatures + matchupFeatures + firstInningFeatures
  const uniqueCanonicalDateHomeAway = new Set(events.filter((event) => event.home_team_id && event.away_team_id).map((event) => `${eventDate(event)}:${event.home_team_id}:${event.away_team_id}`)).size
  const mlbamStoredOnPlayers = playerInputs.entries.filter((entry) => entry.existingCanonicalCandidates.length > 0 && entry.previousGapClassification === 'MAPPED').length
  const mlbamProviderCrosswalkRows = mappings.filter((mapping) => String(mapping.entity_type).toLowerCase() === 'player' && mlbProviderAllowlist.includes(String(mapping.provider).toLowerCase())).length

  const artifact = {
    certification: 'MLB_DATA_01C_R2_AUTHORITATIVE_IDENTITY_ACQUISITION_PLAN',
    certificationVerdict: 'MLB_DATA_01C_R2_IDENTITY_ACQUISITION_PLAN_BLOCKED',
    generatedAt: new Date().toISOString(),
    baselineCommit,
    version,
    scope: {
      planOnly: true,
      providerCallsMade: 0,
      mlbOfficialCallsMade: 0,
      sportsDataIoCallsMade: 0,
      oddsApiCallsMade: 0,
      weatherCallsMade: 0,
      productionDmlMutations: 0,
      productionSchemaMutations: 0,
      canonicalMappingWrites: 0,
      featureWrites: 0,
      modelWrites: 0,
      predictionWrites: 0,
      automationActivated: false,
      activeCronAdded: false,
    },
    baselineReadback: {
      productionCommitTarget: baselineCommit,
      rawRows: raw.rawCount,
      uniquePitchIdentities: raw.uniquePitchIdentities,
      duplicateIdentities: raw.duplicateIdentities,
      games: raw.gameCount,
      teams: raw.teamCount,
      minDate: raw.minDate,
      maxDate: raw.maxDate,
      canonicalHomeRows,
      canonicalAwayRows,
      eventRowsMapped,
      pitcherRowsMapped,
      batterRowsMapped,
      featureTables,
      modelRegistry,
      modelFeatureSets,
      modelVersions,
      modelTrainingRuns,
      modelValidationRuns,
      gamePredictions,
      predictionResults,
      marketValueEvaluations,
      imported2026Rows,
    },
    existingInternalIdentitySources: {
      complete: true,
      schema: {
        providerEntityMappings: {
          table: 'provider_entity_mappings',
          columns: ['id', 'sport_key', 'entity_type', 'internal_id', 'provider', 'provider_id', 'season', 'metadata', 'created_at', 'updated_at'],
          uniqueConstraint: 'unique(sport_key, entity_type, provider, provider_id, season)',
          lookupIndex: '(sport_key, entity_type, internal_id)',
          sufficientForCrosswalkInfrastructure: true,
        },
        rawStatcast: {
          table: 'pick2_raw_mlb_statcast_pitches',
          sourceIdentity: 'game_pk + at_bat_number + pitch_number',
          sourceGameIdentity: 'game_pk',
          sourcePlayerIdentities: ['source_pitcher_id', 'source_batter_id'],
          canonicalTargets: ['event_id', 'canonical_pitcher_id', 'canonical_batter_id'],
        },
      },
      codePaths: [
        'src/services/mlb-official-data-provider.service.ts: fetchMlbOfficialSchedule(date), fetchMlbOfficialLiveFeedLineups(gamePk)',
        'src/services/mlb-official-replacement.service.ts: buildMlbOfficialScheduleRows, matchOfficialGameToStoredEvent, provider_entity_mappings rows',
        'src/services/results-sync.service.ts: schedule range endpoint and gamePk result linkage',
        'scripts/mlb-data-01c-2025-canonical-mapping.mjs: deterministic team/game/player dry-run and raw mapping write guard',
      ],
      storedIdentityPaths: {
        sportEventsProviderIdsGamePkRowsObservedIn01C: priorR1.eventIdentityAudit.exactGamePkOnSportEventsAvailable,
        providerEntityGameCrosswalkRowsObservedIn01C: priorR1.eventIdentityAudit.providerCrosswalkGamePkRowsFrom01C,
        sportPlayersMlbamStoredRowsObservedIn01C: priorR1.playerIdentityAudit.mlbamStoredOnPlayerCount,
        providerEntityPlayerMlbamRowsObservedIn01C: priorR1.playerIdentityAudit.mlbamProviderCrosswalkCount,
        gameResultsProviderLineageAvailableInCode: true,
        sportsDataIoEventIdsPresentButNotAuthoritativeForStatcastGamePk: true,
        sportsDataIoPlayerIdsPresentButNotMlbamPersonIdentity: true,
        historicalJsonFieldsAudited: ['sport_events.provider_ids', 'sport_events.metadata', 'sport_players.provider_ids', 'sport_players.metadata', 'provider_entity_mappings.metadata'],
      },
    },
    eventAcquisitionInput: {
      ready: true,
      sourceGamePkCount: gameInputs.entries.length,
      uniqueStatcastGameDates: gameInputs.uniqueStatcastGameDates,
      counts: gameInputs.counts,
      methodCounts: gameInputs.methodCounts,
      canonicalMlb2025EventRows: events.length,
      canonicalDateHomeAwayIdentities: uniqueCanonicalDateHomeAway,
      canonicalDuplicateOrExcessDateHomeAwayRows: events.length - uniqueCanonicalDateHomeAway,
      entries: gameInputs.entries,
    },
    playerAcquisitionInput: {
      ready: true,
      sourceMlbamPersonCount: playerInputs.entries.length,
      roleCounts: playerInputs.roleCounts,
      counts: playerInputs.counts,
      canonicalMlbPlayerRows: players.length,
      providerPlayerMappingRows: mappings.filter((mapping) => String(mapping.entity_type).toLowerCase() === 'player').length,
      mlbamStoredOnPlayerRows: mlbamStoredOnPlayers,
      mlbamProviderCrosswalkRows,
      namesAreAuditOnly: true,
      entries: playerInputs.entries,
    },
    authoritativeIdentitySource: {
      selected: 'MLB Official / MLB Stats API',
      provider,
      gameSufficiency: 'SUFFICIENT_FROM_REPOSITORY_CONTRACT_FOR_GAME_IDENTITY',
      playerSufficiency: 'INSUFFICIENT_ENDPOINT_CONTRACT_FROM_REPOSITORY_FOR_ALL_PERSON_IDENTITY',
      reason: 'Repository code establishes MLB Official schedule/live-feed gamePk, team, status, probable pitcher and lineup contracts, but it does not establish an exact no-call person endpoint contract for all 1,469 source MLBAM person ids with position, bat side and throw side.',
    },
    endpointRequestPlan: {
      games: {
        contractStatus: 'ESTABLISHED_FROM_REPOSITORY',
        preferredEndpoint: '/api/v1/schedule?sportId=1&startDate={startDate}&endDate={endDate}&hydrate=team,venue',
        existingDateEndpoint: '/api/v1/schedule?sportId=1&date={date}&hydrate=probablePitcher,team,venue',
        purpose: 'Acquire authoritative gamePk, official date, home/away teams, game type/status, doubleheader/game number, start time and venue metadata for all 2025 Statcast game dates.',
        inputIdentity: 'Statcast game_pk plus game_date/source_home_team/source_away_team',
        expectedResponseIdentity: 'MLB Stats API game.gamePk',
        fieldsRequired: ['gamePk', 'officialDate', 'gameDate', 'teams.home.team.id/name/abbreviation', 'teams.away.team.id/name/abbreviation', 'gameNumber', 'doubleHeader', 'status'],
        deduplicationStrategy: 'Deduplicate by gamePk; reject duplicate response gamePk rows unless payloads are byte-equivalent and same canonical candidate.',
        cacheKey: 'mlb_stats_api:game:{gamePk}',
        failureBehavior: 'Quarantine failed game identities; do not write event_id or crosswalks for incomplete, duplicate or conflicting responses.',
      },
      players: {
        contractStatus: 'NEEDS_ENDPOINT_CONTRACT_VERIFICATION',
        preferredEndpoint: null,
        knownRepositoryEndpoints: ['/api/v1/schedule?sportId=1&date={date}&hydrate=probablePitcher,team,venue', '/api/v1.1/game/{gamePk}/feed/live'],
        purpose: 'Acquire authoritative MLBAM person identity for every source pitcher/batter id.',
        inputIdentity: 'Statcast source_pitcher_id/source_batter_id MLBAM person_id',
        expectedResponseIdentity: 'MLB Stats API person.id, if endpoint contract is verified later',
        fieldsRequired: ['id', 'fullName', 'primaryPosition or position', 'batSide', 'pitchHand or throwSide', 'team context when available'],
        deduplicationStrategy: 'Deduplicate by person_id; reject conflicting official identity payloads for the same person_id.',
        cacheKey: 'mlb_stats_api:person:{personId}',
        failureBehavior: 'Return NEEDS_ENDPOINT_CONTRACT_VERIFICATION before any person acquisition; no name-only canonical player linkage.',
      },
    },
    acquisitionStrategies: {
      game: {
        ready: true,
        strategy: 'Use bulk or date-level MLB Official schedule reads, then reconcile gamePk to exactly one sport_events.id through existing provider evidence first and official date/team/start/doubleheader evidence second.',
        evidenceOrder: ['existing provider_entity_mappings event gamePk', 'sport_events.provider_ids gamePk', 'official date + canonical home + canonical away', 'official start time', 'doubleheader/gameNumber', 'game_results linkage'],
        noFuzzyMatching: true,
      },
      player: {
        ready: false,
        strategy: 'Blocked until an exact MLB Official person endpoint or repository-supported bulk person identity contract is verified. Existing live feed/lineup contracts are useful supplemental evidence but do not cover all source person IDs as a certified person identity endpoint.',
        allowedEvidenceOrderAfterContract: ['existing MLBAM provider mapping', 'official person_id response identity', 'other exact stored provider identity chain', 'name as validation only'],
        noNameOnlyMatching: true,
      },
    },
    requestVolumeEstimate: {
      gameCallsPlanned: {
        preferredBulkRangeCalls: 1,
        conservativeDateLevelCalls: gameInputs.uniqueStatcastGameDates,
        individualGameCallsAvoided: raw.gameCount,
        cacheHitsExpectedBeforeExecution: 0,
        retryAllowance: 'UNKNOWN provider limit; one retry per failed date/range with conservative backoff.',
      },
      playerCallsPlanned: {
        contractStatus: 'NEEDS_ENDPOINT_CONTRACT_VERIFICATION',
        individualPersonCallsIfVerified: playerInputs.entries.length,
        bulkCalls: 'UNKNOWN',
        cacheHitsExpectedBeforeExecution: 0,
        retryAllowance: 'UNKNOWN provider limit; no player calls authorized before endpoint contract verification.',
      },
      totalCallsPlanned: {
        minimumAfterPlayerContractVerification: `1 game range call + player contract-dependent calls`,
        boundedConservativeUpperAfterVerification: `${gameInputs.uniqueStatcastGameDates} date schedule calls + ${playerInputs.entries.length} individual person calls`,
        exactTotalNow: 'NOT_EXECUTION_READY_FOR_PLAYERS',
      },
    },
    cacheContract: {
      ready: true,
      storage: 'local durable acquisition cache before production persistence',
      gameKey: 'game_pk',
      playerKey: 'person_id',
      requiredFields: ['provider', 'requested_identity', 'response_identity', 'retrieved_at', 'response_digest', 'acquisition_version'],
      digest: 'sha256 stable JSON digest',
      productionTablesRequired: false,
    },
    rateFailureSafety: {
      maximumConcurrency: 1,
      retryPolicy: 'At most one retry for retryable network/5xx/429 failures.',
      backoff: 'Start at 2000ms and increase conservatively; do not invent provider rate limits.',
      timeoutMs: 12000,
      failedCallQuarantine: true,
      resumeStrategy: 'Resume from durable cache and manifest status; never repeat successful cached identities unless digest verification is requested.',
      partialAcquisitionHandling: 'Do not persist crosswalks or raw mapping for incomplete acquisition groups.',
      exactProviderRateLimits: 'UNKNOWN',
    },
    reconciliationContracts: {
      game: {
        ready: true,
        identityRoot: 'MLB Official gamePk',
        classifications: ['MAPPED', 'CANONICAL_EVENT_MISSING', 'CANONICAL_DUPLICATE_DEFECT', 'AMBIGUOUS', 'CONFLICT'],
        finalRule: 'One MLBAM game_pk must resolve to exactly one canonical sport_events.id before any crosswalk or raw event_id write.',
      },
      player: {
        ready: true,
        identityRoot: 'MLBAM person_id',
        allowedCanonicalLinkage: ['existing MLBAM provider mapping', 'existing exact provider crosswalk chain', 'other exact stored provider identity'],
        classifications: ['MAPPED', 'CANONICAL_PLAYER_EXISTS_IDENTITY_MISSING', 'CANONICAL_PLAYER_MISSING', 'AMBIGUOUS', 'CONFLICT'],
        finalRule: 'Names may validate official identity but cannot establish sport_players.id linkage alone.',
      },
    },
    canonicalPlayerCreationPolicy: {
      ready: true,
      createNow: false,
      minimumEvidence: ['verified official person_id endpoint contract', 'official person.id', 'official fullName', 'position or explicit null', 'bat/throw handedness or explicit unsupported warning', 'no existing exact provider mapping conflict'],
      duplicatePrevention: ['pre-read provider_entity_mappings by provider/person_id/season', 'pre-read sport_players provider_ids and metadata exact MLBAM ids', 'block same person_id to multiple sport_players.id'],
      gate: 'separate canonical-player creation authorization after acquisition, before crosswalk persistence for missing players',
    },
    providerEntityMappingsWriteContract: {
      ready: true,
      table: 'provider_entity_mappings',
      providerNaming: provider,
      gameRow: {
        sport_key: sportKey,
        entity_type: 'event',
        internal_id: 'sport_events.id',
        provider,
        provider_id: 'MLB Official gamePk',
        season: '2025',
        metadata: ['source', 'acquisitionVersion', 'retrievedAt', 'responseDigest', 'mappingMethod', 'canonicalParity'],
      },
      playerRow: {
        sport_key: sportKey,
        entity_type: 'player',
        internal_id: 'sport_players.id',
        provider,
        provider_id: 'MLBAM person_id',
        season: '2025',
        metadata: ['source', 'acquisitionVersion', 'retrievedAt', 'responseDigest', 'mappingMethod', 'officialName'],
      },
      uniqueness: 'unique(sport_key, entity_type, provider, provider_id, season)',
      versioning: 'additive rows with acquisitionVersion in metadata; do not rewrite historical source ids',
    },
    cardinalityContracts: {
      game: {
        ready: true,
        guarantee: 'one MLBAM game_pk -> exactly one canonical sport_event',
        preReadStates: ['0 matches', '1 compatible match', '1 conflicting match', '>1 defect'],
        oneToManyAllowed: false,
      },
      player: {
        ready: true,
        guarantee: 'one MLBAM person_id -> exactly one sport_players.id',
        preReadStates: ['0 matches', '1 compatible match', '1 conflicting match', '>1 defect'],
        oneToManyAllowed: false,
      },
    },
    rawCanonicalMappingWritePlan: {
      ready: true,
      executeNow: false,
      futureColumns: ['event_id', 'canonical_pitcher_id', 'canonical_batter_id', 'event_mapping_state', 'player_mapping_state', 'mapping_metadata', 'mapped_at'],
      immutableColumns: ['game_pk', 'at_bat_number', 'pitch_number', 'source_pitcher_id', 'source_batter_id', 'source_home_team', 'source_away_team', 'raw_payload', 'raw_payload_digest', 'score-state fields'],
      batching: 'game_pk batches for event_id; source_pitcher_id/source_batter_id batches for player ids',
      writeCaps: 'cap expected touched rows to certified raw row count and exact mapped identity counts',
      readback: 'count mapped rows, verify no duplicate event identity collisions, verify no canonical player ambiguity, digest immutable sample before/after',
      idempotency: 'pre-read current canonical fields and skip compatible existing values; fail on conflicts',
    },
    completenessTargets: {
      game: {
        ready: true,
        preferred: '2430 / 2430 exact authoritative mappings, 0 ambiguous, 0 conflict',
        exclusionPolicy: 'If canonical defects prevent 100%, excluded games must be explicitly listed and omitted from feature construction without lowering the target silently.',
      },
      player: {
        ready: true,
        preferred: 'All source identities required by 01D feature construction deterministically mapped',
        missingPolicy: 'Quantify canonical players requiring creation in the later acquisition phase before any feature construction.',
      },
    },
    featureDependencyMatrix: {
      STARTER: { requiredMappingLevel: 'event + pitcher' },
      BULLPEN: { requiredMappingLevel: 'event + pitcher' },
      BATTER_OFFENSE: { requiredMappingLevel: 'event + batter' },
      MATCHUP: { requiredMappingLevel: 'event + pitcher + batter' },
      FIRST_INNING: { requiredMappingLevel: 'event + pitcher/batter/team' },
      TEAM: { requiredMappingLevel: 'event + canonical teams' },
    },
    reusePlans: {
      season2026: {
        reusable: true,
        plan: 'Reuse existing person crosswalks immediately, acquire new person IDs incrementally, and acquire 2026 game_pk identities through the same MLB Official game path.',
      },
      dailyIngest: {
        reusable: true,
        flow: ['new Statcast raw identity', 'crosswalk pre-read', 'cache hit if known', 'official identity acquisition only if new and authorized', 'deterministic reconciliation', 'provider_entity_mappings persistence after separate authorization', 'raw canonical mapping after separate authorization'],
      },
    },
    authorizationGates: {
      externalIdentityAcquisitionExecutionReady: false,
      reasonExecutionNotReady: 'Game acquisition is ready, but player acquisition still needs exact endpoint contract verification from repository evidence.',
      crosswalkPersistenceAuthorizedNow: false,
      rawMappingAuthorizedNow: false,
    },
    downstreamReadiness: {
      MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
    },
    flags: {
      EXISTING_INTERNAL_IDENTITY_PATHS_COMPLETE: 'YES',
      EVENT_IDENTITY_ACQUISITION_INPUT_READY: 'YES',
      PLAYER_IDENTITY_ACQUISITION_INPUT_READY: 'YES',
      AUTHORITATIVE_IDENTITY_SOURCE_SELECTED: 'MLB Official / MLB Stats API',
      NEEDS_ENDPOINT_CONTRACT_VERIFICATION: 'YES',
      GAME_IDENTITY_ACQUISITION_PLAN_READY: 'YES',
      PLAYER_IDENTITY_ACQUISITION_PLAN_READY: 'NO',
      IDENTITY_ACQUISITION_CACHE_CONTRACT_READY: 'YES',
      GAME_RECONCILIATION_CONTRACT_READY: 'YES',
      PLAYER_RECONCILIATION_CONTRACT_READY: 'YES',
      CANONICAL_PLAYER_CREATION_POLICY_READY: 'YES',
      PROVIDER_ENTITY_MAPPINGS_WRITE_CONTRACT_READY: 'YES',
      GAME_CROSSWALK_CARDINALITY_CONTRACT_READY: 'YES',
      PLAYER_CROSSWALK_CARDINALITY_CONTRACT_READY: 'YES',
      RAW_CANONICAL_MAPPING_WRITE_PLAN_READY: 'YES',
      GAME_MAPPING_COMPLETENESS_TARGET_READY: 'YES',
      PLAYER_MAPPING_COMPLETENESS_TARGET_READY: 'YES',
      IDENTITY_ACQUISITION_PLAN_REUSABLE_FOR_2026: 'YES',
      IDENTITY_ACQUISITION_PLAN_REUSABLE_FOR_DAILY_INGEST: 'YES',
      EXTERNAL_IDENTITY_ACQUISITION_EXECUTION_READY: 'NO',
      CROSSWALK_PERSISTENCE_AUTHORIZED_NOW: 'NO',
      PROVIDER_CALLS: '0',
      PRODUCTION_DML_MUTATIONS: '0',
      PRODUCTION_SCHEMA_MUTATIONS: '0',
      AUTOMATION_ACTIVATED: 'NO',
      ACTIVE_CRON_ADDED: 'NO',
      MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
    },
    priorArtifactDigest: digest({ prior01c, priorR1 }),
  }

  fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r2-identity-acquisition-plan',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    sourceGamePkCount: artifact.eventAcquisitionInput.sourceGamePkCount,
    sourceMlbamPersonCount: artifact.playerAcquisitionInput.sourceMlbamPersonCount,
    gamePlanReady: artifact.flags.GAME_IDENTITY_ACQUISITION_PLAN_READY,
    playerPlanReady: artifact.flags.PLAYER_IDENTITY_ACQUISITION_PLAN_READY,
    needsEndpointContractVerification: artifact.flags.NEEDS_ENDPOINT_CONTRACT_VERIFICATION,
    providerCallsMade: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    validator: 'mlb-data-01c-r2-identity-acquisition-plan',
    status: 'ERROR',
    message: error instanceof Error ? error.message : String(error),
    providerCallsMade: 0,
  }, null, 2))
  process.exitCode = 1
})
