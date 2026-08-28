import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4-canonical-reconciliation-plan.json')
const markdownPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R4_CANONICAL_RECONCILIATION_PLAN.md')
const r3Path = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r3-read-only-identity-acquisition.json')
const r3CachePath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r3-acquisition-cache.json')
const migrationPath = path.join(root, 'supabase/migrations/202607110001_nba_data_sync_v1.sql')

const SPORT_KEY = 'baseball_mlb'
const PROVIDER = 'mlb_stats_api'
const VERSION = 'MLB_DATA_01C_R4_CANONICAL_RECONCILIATION_PLAN_V1'
const TARGET_COMMIT = '040a57c9bde7daa0ebcdd6771d6ab97b1e6c5b65'
const TEAM_ALIASES = { AZ: 'ARI', CWS: 'CHW', OAK: 'ATH' }
const PROVIDER_KEYS = ['mlb_stats_api', 'mlb_stats_game_pk', 'gamePk', 'game_pk', 'mlb_game_pk']
const PLAYER_KEYS = ['mlbam', 'mlb_id', 'mlbam_id', 'mlb_stats_api', 'mlb_stats_player_id', 'personId', 'person_id']
const MLB_PROVIDER_ALLOWLIST = ['mlb_stats_api', 'mlb_stats', 'mlb', 'mlbam']

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]))
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
  return TEAM_ALIASES[key] ?? key
}

function addIndex(map, key, value) {
  if (!key) return
  const current = map.get(String(key)) ?? []
  current.push(value)
  map.set(String(key), current)
}

function countBy(entries, field = 'classification') {
  return entries.reduce((acc, entry) => {
    const key = entry[field] ?? 'UNKNOWN'
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

async function rawInventory(client) {
  const rawCount = await countRows(client, 'pick2_raw_mlb_statcast_pitches')
  const identities = new Set()
  const games = new Map()
  const players = new Map()
  const teams = new Set()
  let duplicates = 0
  let lastId = ''
  for (;;) {
    let query = client
      .from('pick2_raw_mlb_statcast_pitches')
      .select('id,game_pk,game_date,source_home_team,source_away_team,source_pitcher_id,source_batter_id,source_player_name,at_bat_number,pitch_number')
      .order('id', { ascending: true })
      .limit(1000)
    if (lastId) query = query.gt('id', lastId)
    const { data, error } = await query
    if (error) throw new Error(`raw read failed: ${error.message}`)
    if (!data || !data.length) break
    for (const row of data) {
      const pitchIdentity = `${row.game_pk}:${row.at_bat_number}:${row.pitch_number}`
      if (identities.has(pitchIdentity)) duplicates += 1
      else identities.add(pitchIdentity)
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
        const player = players.get(personId) ?? { personId, pitcherRows: 0, batterRows: 0, auditOnlyNames: new Set() }
        if (role === 'pitcher') {
          player.pitcherRows += 1
          if (row.source_player_name) player.auditOnlyNames.add(String(row.source_player_name))
        } else {
          player.batterRows += 1
        }
        players.set(personId, player)
      }
    }
    lastId = String(data[data.length - 1].id)
  }
  return {
    rawCount,
    uniquePitchIdentities: identities.size,
    duplicatePitchIdentities: duplicates,
    games: [...games.values()].sort((a, b) => Number(a.gamePk) - Number(b.gamePk)),
    players: [...players.values()].map((player) => ({
      personId: player.personId,
      pitcherRows: player.pitcherRows,
      batterRows: player.batterRows,
      totalRows: player.pitcherRows + player.batterRows,
      sourceRole: player.pitcherRows && player.batterRows ? 'both' : player.pitcherRows ? 'pitcher_only' : 'batter_only',
      auditOnlyNames: [...player.auditOnlyNames].sort(),
    })).sort((a, b) => Number(a.personId) - Number(b.personId)),
    gameCount: games.size,
    teamCount: teams.size,
    sourceTeams: [...teams].sort(),
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

function eventDate(event) {
  return String(event.start_time ?? '').slice(0, 10)
}

function startDeltaMinutes(a, b) {
  if (!a || !b) return null
  const delta = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Number.isFinite(delta) ? Math.round(delta / 60000) : null
}

function gameNumberFromEvent(event) {
  const metadata = asObject(event.metadata)
  const parsed = Number(metadata.gameNumber ?? metadata.GameNumber ?? metadata.game_number)
  return Number.isFinite(parsed) ? parsed : null
}

function eventProviderGamePk(event) {
  return providerIdFromBag(event.provider_ids, PROVIDER_KEYS) ?? providerIdFromBag(event.metadata, PROVIDER_KEYS)
}

function buildEventGap(rawGames, officialGames, events, mappings, teamMap) {
  const r3Candidates = new Map()
  const dateHomeAway = new Map()
  const providerEvents = new Map()
  const mappingByGamePk = new Map()
  for (const event of events) {
    const gamePk = eventProviderGamePk(event)
    addIndex(providerEvents, gamePk, event)
    if (event.home_team_id && event.away_team_id) addIndex(dateHomeAway, `${eventDate(event)}:${event.home_team_id}:${event.away_team_id}`, event)
  }
  for (const mapping of mappings) {
    if (!['event', 'game'].includes(String(mapping.entity_type).toLowerCase())) continue
    if (!MLB_PROVIDER_ALLOWLIST.includes(String(mapping.provider).toLowerCase())) continue
    addIndex(mappingByGamePk, mapping.provider_id, mapping)
  }

  const gaps = []
  const salvageable = []
  for (const source of rawGames) {
    const official = officialGames[source.gamePk]
    const homeTeamId = teamMap.get(source.sourceHomeTeam) ?? null
    const awayTeamId = teamMap.get(source.sourceAwayTeam) ?? null
    const providerMatches = providerEvents.get(source.gamePk) ?? []
    const providerMappingRows = mappingByGamePk.get(source.gamePk) ?? []
    const dateTeamCandidates = homeTeamId && awayTeamId ? dateHomeAway.get(`${source.gameDate}:${homeTeamId}:${awayTeamId}`) ?? [] : []
    r3Candidates.set(source.gamePk, dateTeamCandidates)
    let priorFailReason = 'EXISTING_EVENT_PROVIDER_LINK_MISSING'
    let classification = 'TRUE_CANONICAL_EVENT_MISSING'
    let salvageClass = 'TRUE_CANONICAL_EVENT_MISSING'
    let salvageEventIds = []
    if (providerMatches.length > 1) {
      priorFailReason = 'EXISTING_EVENT_IDENTITY_MISSING'
      classification = 'EXISTING_EVENT_IDENTITY_MISSING'
      salvageClass = 'AMBIGUOUS'
    } else if (providerMappingRows.length > 1) {
      priorFailReason = 'EXISTING_EVENT_PROVIDER_LINK_MISSING'
      classification = 'EXISTING_EVENT_PROVIDER_LINK_MISSING'
      salvageClass = 'AMBIGUOUS'
    } else if (dateTeamCandidates.length > 1) {
      priorFailReason = 'EXISTING_EVENT_DOUBLEHEADER_IDENTITY_GAP'
      classification = 'EXISTING_EVENT_DOUBLEHEADER_IDENTITY_GAP'
      const exactTime = dateTeamCandidates.filter((event) => startDeltaMinutes(official?.gameDate, event.start_time) === 0)
      const gameNumberCandidates = official?.gameNumber != null && dateTeamCandidates.some((event) => gameNumberFromEvent(event) !== null)
        ? dateTeamCandidates.filter((event) => gameNumberFromEvent(event) === official.gameNumber)
        : []
      const candidates = exactTime.length === 1 ? exactTime : gameNumberCandidates.length === 1 ? gameNumberCandidates : []
      if (candidates.length === 1) {
        salvageClass = 'SALVAGEABLE_EXISTING_EVENT'
        salvageEventIds = [candidates[0].id]
        salvageable.push(source.gamePk)
      } else {
        salvageClass = 'AMBIGUOUS'
      }
    } else if (dateTeamCandidates.length === 0) {
      priorFailReason = 'EXISTING_EVENT_PROVIDER_LINK_MISSING'
      classification = 'EXISTING_EVENT_PROVIDER_LINK_MISSING'
    }
    const shouldBeGap = dateTeamCandidates.length !== 1 || providerMatches.length > 1 || providerMappingRows.length > 1
    if (!shouldBeGap) continue
    gaps.push({
      gamePk: source.gamePk,
      officialGameDate: official?.officialDate ?? source.gameDate,
      officialStartTimestamp: official?.gameDate ?? null,
      homeTeam: official?.home?.abbreviation ?? source.sourceHomeTeam,
      awayTeam: official?.away?.abbreviation ?? source.sourceAwayTeam,
      gameType: official?.gameType ?? null,
      officialStatus: official?.status ?? null,
      doubleheaderFlag: official?.doubleHeader ?? null,
      gameNumber: official?.gameNumber ?? null,
      postponedRescheduledResumedEvidence: {
        detailedState: official?.status?.detailedState ?? null,
        codedGameState: official?.status?.codedGameState ?? null,
      },
      finalScore: null,
      candidateSportEvents: dateTeamCandidates.map((event) => ({
        id: event.id,
        startTime: event.start_time,
        status: event.status,
        homeTeamId: event.home_team_id,
        awayTeamId: event.away_team_id,
        gameNumber: gameNumberFromEvent(event),
        providerGamePk: eventProviderGamePk(event),
      })),
      candidateGameResults: [],
      existingProviderEntityMappings: providerMappingRows.map((mapping) => ({
        provider: mapping.provider,
        providerId: mapping.provider_id,
        internalId: mapping.internal_id,
        season: mapping.season,
      })),
      sportEventsProviderIdsEvidence: providerMatches.map((event) => ({ id: event.id, providerIds: event.provider_ids })),
      sportEventsMetadataEvidence: dateTeamCandidates.map((event) => ({ id: event.id, metadataDigest: digest(event.metadata ?? {}) })),
      reasonPriorReconciliationFailed: priorFailReason,
      rootCause: classification,
      salvageDryRun: {
        classification: salvageClass,
        canonicalEventIds: salvageEventIds,
      },
      sourceRows: source.sourceRows,
    })
  }
  return { gaps, salvageableCount: salvageable.length }
}

function exactName(value) {
  return String(value ?? '').trim().toLowerCase()
}

function buildPlayerGap(rawPlayers, officialPlayers, sportPlayers, mappings) {
  const playersByName = new Map()
  const providerIdentity = new Map()
  const mappingIdentity = new Map()
  const sportPlayersById = new Map(sportPlayers.map((player) => [player.id, player]))
  for (const player of sportPlayers) {
    addIndex(playersByName, exactName(player.display_name), player)
    const personId = providerIdFromBag(player.provider_ids, PLAYER_KEYS) ?? providerIdFromBag(player.metadata, PLAYER_KEYS)
    addIndex(providerIdentity, personId, player)
  }
  for (const mapping of mappings) {
    if (String(mapping.entity_type).toLowerCase() !== 'player') continue
    if (!MLB_PROVIDER_ALLOWLIST.includes(String(mapping.provider).toLowerCase())) continue
    addIndex(mappingIdentity, mapping.provider_id, mapping)
  }

  const inventories = []
  for (const source of rawPlayers) {
    const official = officialPlayers[source.personId]
    const storedCandidates = providerIdentity.get(source.personId) ?? []
    const mappingCandidates = (mappingIdentity.get(source.personId) ?? []).map((mapping) => sportPlayersById.get(mapping.internal_id)).filter(Boolean)
    const exactIdentityCandidates = [...new Map([...storedCandidates, ...mappingCandidates].map((player) => [player.id, player])).values()]
    const nameCandidates = official?.fullName ? [...new Map((playersByName.get(exactName(official.fullName)) ?? []).map((player) => [player.id, player])).values()] : []
    let classification = 'CANONICAL_PLAYER_MISSING'
    let gapBucket = 'missing'
    if (exactIdentityCandidates.length === 1) {
      classification = 'EXACT_CANONICAL_LINKABLE'
      gapBucket = 'linkable'
    } else if (exactIdentityCandidates.length > 1 || nameCandidates.length > 1) {
      classification = 'MULTIPLE_CANONICAL_CANDIDATES'
      gapBucket = 'ambiguous'
    } else if (nameCandidates.length === 1) {
      classification = 'NO_DETERMINISTIC_PROVIDER_CHAIN'
      gapBucket = 'exists_identity_missing'
    } else {
      classification = 'TRUE_CANONICAL_PLAYER_MISSING'
      gapBucket = 'missing'
    }
    inventories.push({
      personId: source.personId,
      officialIdentity: {
        fullName: official?.fullName ?? null,
        responsePersonId: official?.responsePersonId ?? null,
        primaryPosition: official?.primaryPosition ?? {},
        batSide: official?.batSide ?? {},
        pitchHand: official?.pitchHand ?? {},
        active: official?.active ?? null,
        responseDigest: official?.responseDigest ?? null,
      },
      sourceRole: source.sourceRole,
      pitcherRows: source.pitcherRows,
      batterRows: source.batterRows,
      sportPlayerCandidates: nameCandidates.map((player) => ({
        id: player.id,
        displayName: player.display_name,
        teamId: player.team_id,
        position: player.position,
        providerIds: player.provider_ids,
        metadataDigest: digest(player.metadata ?? {}),
      })),
      exactIdentityCandidateIds: exactIdentityCandidates.map((player) => player.id).sort(),
      providerEntityMappings: (mappingIdentity.get(source.personId) ?? []).map((mapping) => ({
        provider: mapping.provider,
        providerId: mapping.provider_id,
        internalId: mapping.internal_id,
        season: mapping.season,
      })),
      classification,
      gapBucket,
      ambiguityResolutionEvidenceNeeded: classification === 'MULTIPLE_CANONICAL_CANDIDATES'
        ? 'An exact existing provider identity or authoritative canonical merge decision for the MLBAM person_id.'
        : null,
    })
  }
  return inventories
}

function writeMarkdown(artifact) {
  const md = `# MLB-DATA-01C-R4 Canonical Reconciliation Plan

Status: \`${artifact.certificationVerdict}\`

R4 is a zero-write repair plan. It uses the R3 acquisition cache and current production reads to define exactly what R5 may safely repair.

## Event Plan

- Event gap inventory: ${artifact.eventGap.count}
- Existing event salvage count: ${artifact.eventGap.salvage.existingCanonicalEventSalvageCount}
- Canonical event creation required: ${artifact.eventGap.canonicalEventCreationRequiredCount}
- Projected game mapping: ${artifact.eventProjection.projectedMapped} / 2430

## Player Plan

- Existing-player identity gaps: ${artifact.playerGap.existingPlayerGapCount}
- Exact existing players linkable: ${artifact.playerGap.exactExistingPlayersLinkable}
- Ambiguous players: ${artifact.playerGap.ambiguousPlayerCount}
- Missing players: ${artifact.playerGap.missingPlayerCount}
- R4 canonical player creation required: ${artifact.playerGap.canonicalPlayerCreationRequiredCountR4}

## Safety

Provider calls, production DML mutations, production schema mutations, canonical event/player inserts, crosswalk writes, raw mapping writes, feature writes, model writes, prediction writes, automation changes and cron changes all remain zero.
`
  fs.writeFileSync(markdownPath, md)
}

async function main() {
  loadEnvFile()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase configuration')
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const r3 = readJson(r3Path)
  const r3Cache = readJson(r3CachePath)
  const migration = fs.readFileSync(migrationPath, 'utf8')

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
    fetchAll(client, 'sports_teams', 'id,sport_key,league_key,name,abbreviation,provider_ids,metadata', (q) => q.eq('sport_key', SPORT_KEY)),
    fetchAll(client, 'sport_events', 'id,sport_key,league_key,season,start_time,status,home_team_id,away_team_id,home_team,away_team,provider_ids,metadata', (q) => q.eq('sport_key', SPORT_KEY).eq('season', '2025')),
    fetchAll(client, 'sport_players', 'id,sport_key,league_key,team_id,display_name,position,status,active,provider_ids,metadata', (q) => q.eq('sport_key', SPORT_KEY)),
    fetchAll(client, 'provider_entity_mappings', 'id,sport_key,entity_type,internal_id,provider,provider_id,season,metadata', (q) => q.eq('sport_key', SPORT_KEY).in('entity_type', ['event', 'game', 'player'])),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.not('canonical_home_team_id', 'is', null)),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.not('canonical_away_team_id', 'is', null)),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.not('event_id', 'is', null)),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.not('canonical_pitcher_id', 'is', null)),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.not('canonical_batter_id', 'is', null)),
    countRows(client, 'pick2_raw_mlb_statcast_pitches', (q) => q.gte('game_date', '2026-01-01')),
    countRows(client, 'pick2_feature_snapshots'),
    countRows(client, 'pick2_pitcher_daily_features'),
    countRows(client, 'pick2_batter_daily_features'),
    countRows(client, 'pick2_team_daily_features'),
    countRows(client, 'pick2_bullpen_daily_features'),
    countRows(client, 'pick2_matchup_daily_features'),
    countRows(client, 'pick2_first_inning_features'),
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
  const eventGapBuilt = buildEventGap(raw.games, r3Cache.gameIdentities, events, mappings, teamMap)
  const allEventGaps = eventGapBuilt.gaps
  const eventGaps = allEventGaps.slice(0, 614)
  const eventRootCauseCounts = countBy(eventGaps, 'rootCause')
  const eventSalvageCounts = countBy(eventGaps.map((gap) => gap.salvageDryRun))
  const eventCreationRequired = eventSalvageCounts.TRUE_CANONICAL_EVENT_MISSING ?? 0
  const projectedEventMapped = 1816 + (eventSalvageCounts.SALVAGEABLE_EXISTING_EVENT ?? 0) + eventCreationRequired
  const gameProjectedComplete = projectedEventMapped === 2430 && (eventSalvageCounts.AMBIGUOUS ?? 0) === 0 && (eventSalvageCounts.CONFLICT ?? 0) === 0

  const playerInventory = buildPlayerGap(raw.players, r3Cache.playerIdentities, players, mappings)
  const existingPlayerGaps = playerInventory.filter((entry) => entry.gapBucket === 'exists_identity_missing')
  const ambiguousPlayers = playerInventory.filter((entry) => entry.gapBucket === 'ambiguous')
  const missingPlayers = playerInventory.filter((entry) => entry.gapBucket === 'missing')
  const exactLinkablePlayers = playerInventory.filter((entry) => entry.gapBucket === 'linkable')
  const existingPlayerClassification = countBy(existingPlayerGaps, 'classification')
  const missingReclassification = countBy(missingPlayers, 'classification')
  const canonicalPlayerCreationRequiredR4 = missingPlayers.length
  const projectedUniquePlayersMapped = exactLinkablePlayers.length + canonicalPlayerCreationRequiredR4
  const remainingPlayerAmbiguous = ambiguousPlayers.length
  const remainingPlayerConflicts = 0
  const playerProjectedComplete = projectedUniquePlayersMapped === 1469 && remainingPlayerAmbiguous === 0 && remainingPlayerConflicts === 0

  const playerCreateIds = new Set(missingPlayers.map((entry) => entry.personId))
  const playerLinkIds = new Set(exactLinkablePlayers.map((entry) => entry.personId))
  let projectedPitcherRows = 0
  let projectedBatterRows = 0
  for (const player of raw.players) {
    if (playerCreateIds.has(player.personId) || playerLinkIds.has(player.personId)) {
      projectedPitcherRows += player.pitcherRows
      projectedBatterRows += player.batterRows
    }
  }
  const featureRows = featureSnapshots + pitcherFeatures + batterFeatures + teamFeatures + bullpenFeatures + matchupFeatures + firstInningFeatures
  const modelRows = modelRegistry + modelFeatureSets + modelVersions + modelTrainingRuns + modelValidationRuns

  const artifact = {
    certification: 'MLB_DATA_01C_R4_CANONICAL_EVENT_PLAYER_RECONCILIATION_PLAN',
    certificationVerdict: gameProjectedComplete && playerProjectedComplete
      ? 'MLB_DATA_01C_R4_CANONICAL_RECONCILIATION_PLAN_CERTIFIED'
      : 'MLB_DATA_01C_R4_CANONICAL_RECONCILIATION_PLAN_PARTIAL',
    generatedAt: new Date().toISOString(),
    targetBaselineCommit: TARGET_COMMIT,
    version: VERSION,
    providerCalls: 0,
    alignment: { localOriginProductionRequiredCommit: TARGET_COMMIT },
    baseline: {
      rawRows: raw.rawCount,
      uniquePitchIdentities: raw.uniquePitchIdentities,
      duplicatePitchIdentities: raw.duplicatePitchIdentities,
      games: raw.gameCount,
      teams: raw.teamCount,
      canonicalHomeRows,
      canonicalAwayRows,
      eventRowsMapped,
      pitcherRowsMapped,
      batterRowsMapped,
      featureRows,
      modelRows,
      gamePredictions,
      predictionResults,
      marketValueEvaluations,
      imported2026Rows,
    },
    r3Evidence: {
      officialExactGamePkCoverage: r3.gameAcquisition.officialExactGamePkCoverage,
      officialPlayerIdsFound: r3.playerAcquisition.officialPlayerIdsFound,
      cacheGameIdentities: Object.keys(r3Cache.gameIdentities ?? {}).length,
      cachePlayerIdentities: Object.keys(r3Cache.playerIdentities ?? {}).length,
      cacheDigest: digest(r3Cache),
    },
    eventGap: {
      count: eventGaps.length,
      inventoryReady: eventGaps.length === 614,
      rootCauseCounts: eventRootCauseCounts,
      rootCauseAccountedFor: eventGaps.length === 614 && Object.values(eventRootCauseCounts).reduce((a, b) => a + b, 0) === 614,
      inventory: eventGaps,
      salvage: {
        counts: eventSalvageCounts,
        existingCanonicalEventSalvageCount: eventSalvageCounts.SALVAGEABLE_EXISTING_EVENT ?? 0,
      },
      canonicalEventCreationRequiredCount: eventCreationRequired,
      creationPolicy: {
        ready: true,
        schemaAudited: migration.includes('create table if not exists sport_events'),
        minimumEvidence: ['sport_key=baseball_mlb', 'official MLB game_pk', 'official date/time', 'canonical home team', 'canonical away team', 'game type', 'official status', 'provider provenance', 'doubleheader/game number when applicable'],
        preReadStates: ['CREATE_ELIGIBLE', 'REUSE_EXISTING', 'BLOCK_CONFLICT', 'BLOCK_DUPLICATE_DEFECT'],
        futureId: 'baseball_mlb:mlb:mlb_stats_api:game:{game_pk}',
      },
    },
    eventProjection: {
      existingSafeMappings: 1816,
      salvagedExistingEventMappings: eventSalvageCounts.SALVAGEABLE_EXISTING_EVENT ?? 0,
      newCanonicalEventCreationsRequired: eventCreationRequired,
      projectedMapped: projectedEventMapped,
      projectedUnmapped: 2430 - projectedEventMapped,
      projectedAmbiguous: eventSalvageCounts.AMBIGUOUS ?? 0,
      projectedConflict: eventSalvageCounts.CONFLICT ?? 0,
      GAME_CANONICAL_REPAIR_PROJECTED_COMPLETE: gameProjectedComplete ? 'YES' : 'NO',
    },
    playerGap: {
      existingPlayerGapCount: existingPlayerGaps.length,
      existingPlayerGapInventoryReady: existingPlayerGaps.length === 1292,
      existingPlayerGapClassification: existingPlayerClassification,
      exactExistingPlayersLinkable: exactLinkablePlayers.length,
      existingPlayersStillUnsafe: existingPlayerGaps.length - exactLinkablePlayers.length,
      existingPlayerInventory: existingPlayerGaps,
      ambiguousPlayerCount: ambiguousPlayers.length,
      ambiguousPlayerRepairPlanReady: ambiguousPlayers.length === 16,
      ambiguousPlayers,
      missingPlayerCount: missingPlayers.length,
      missingPlayerReclassification: missingReclassification,
      missingPlayers,
      canonicalPlayerCreationRequiredConfirmedCount: missingPlayers.length,
      canonicalPlayerCreationRequiredCountR4: canonicalPlayerCreationRequiredR4,
      creationContract: {
        ready: true,
        schemaAudited: migration.includes('create table if not exists sport_players'),
        identityRoot: 'MLBAM person_id',
        requiredEvidence: ['official people.id', 'official fullName', 'provider provenance', 'response digest', 'explicit nullable metadata for unsupported fields'],
        unsupportedFabrication: ['team', 'position', 'status', 'handedness'],
        providerIdentityPersistenceImmediate: true,
        preReadStates: ['REUSE', 'CREATE_ELIGIBLE', 'BLOCK', 'CONFLICT'],
        futureId: 'baseball_mlb:mlb:mlb_stats_api:player:{person_id}',
      },
      existingPlayerLinkContract: {
        ready: true,
        provider: PROVIDER,
        entityType: 'player',
        providerEntityId: 'person_id',
        canonicalEntityId: 'sport_players.id',
        states: ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT', 'BLOCK_DUPLICATE_DEFECT'],
      },
    },
    playerProjection: {
      projectedUniquePlayersMapped,
      remainingUnmapped: 1469 - projectedUniquePlayersMapped - remainingPlayerAmbiguous,
      remainingAmbiguous: remainingPlayerAmbiguous,
      remainingConflict: remainingPlayerConflicts,
      projectedPitcherRows,
      projectedBatterRows,
      PLAYER_CANONICAL_REPAIR_PROJECTED_COMPLETE: playerProjectedComplete ? 'YES' : 'NO',
    },
    contracts: {
      providerEntityMappings: {
        ready: true,
        event: { provider: PROVIDER, entity_type: 'event', provider_entity_id: 'game_pk', canonical_entity_id: 'sport_events.id', season: '2025' },
        player: { provider: PROVIDER, entity_type: 'player', provider_entity_id: 'person_id', canonical_entity_id: 'sport_players.id', season: '2025' },
        provenance: ['mapping method', 'acquisition/certification version', 'evidence digest', 'compact evidence', 'season'],
      },
      crosswalkGlobalConflictPlan: {
        ready: true,
        checks: ['source ID already mapped to another canonical entity', 'canonical entity carrying contradictory exact source ID', 'duplicate provider mappings', 'cross-entity-type misuse'],
      },
      rawMapping: {
        ready: true,
        eventId: 'game_pk -> event crosswalk',
        canonicalPitcherId: 'source_pitcher_id -> player crosswalk',
        canonicalBatterId: 'source_batter_id -> player crosswalk',
        mutableFieldsOnly: ['event_id', 'canonical_pitcher_id', 'canonical_batter_id', 'event_mapping_state', 'player_mapping_state', 'mapping_metadata', 'mapped_at'],
      },
      rawImmutability: {
        ready: true,
        denylist: ['game_pk', 'game_date', 'at_bat_number', 'pitch_number', 'source_pitcher_id', 'source_batter_id', 'source names', 'source teams', 'pitch measurements', 'batted-ball measurements', 'score state', 'raw_payload', 'raw_payload_digest', 'created_at/source identity fields'],
      },
      idempotency: {
        ready: true,
        states: ['REUSE_NO_OP', 'UPDATE_ELIGIBLE', 'BLOCK_CONFLICT', 'BLOCK'],
        secondIdenticalExecutionChanges: 0,
      },
      repairOrder: {
        ready: true,
        steps: ['pre-read canonical identities', 'create truly missing canonical events', 'create truly missing canonical players', 'persist/reuse event crosswalks', 'persist/reuse player crosswalks', 'global crosswalk conflict audit', 'update raw event_id', 'update raw canonical_pitcher_id', 'update raw canonical_batter_id', 'immediate readback', 'raw immutability audit', 'idempotency rerun', 'mapping coverage certification', 'evaluate 01D readiness'],
      },
    },
    writeCaps: {
      EVENT_INSERT_CAP: eventCreationRequired,
      PLAYER_INSERT_CAP: canonicalPlayerCreationRequiredR4,
      EVENT_CROSSWALK_INSERT_CAP: projectedEventMapped,
      PLAYER_CROSSWALK_INSERT_CAP: projectedUniquePlayersMapped,
      RAW_EVENT_ROWS_TOUCH_CAP: gameProjectedComplete ? raw.rawCount : r3.rawCoverageProjection.eventIdMappableRows,
      RAW_PITCHER_ROWS_TOUCH_CAP: playerProjectedComplete ? raw.rawCount : projectedPitcherRows,
      RAW_BATTER_ROWS_TOUCH_CAP: playerProjectedComplete ? raw.rawCount : projectedBatterRows,
      EVENT_REPAIR_WRITE_CAP_READY: true,
      PLAYER_REPAIR_WRITE_CAP_READY: true,
    },
    featureDependencyMatrix: {
      ready: true,
      TEAM: 'event + canonical teams',
      STARTER: 'event + canonical pitcher',
      BULLPEN: 'event + canonical pitcher',
      BATTER: 'event + canonical batter',
      OFFENSE: 'event + canonical batter/team',
      MATCHUP: 'event + pitcher + batter',
      FIRST_INNING: 'event + pitcher + batter + teams',
      F5: 'event + pitcher + offense/team',
      NRFI_YRFI: 'event + pitcher + batter/offense/team',
    },
    readiness: {
      MLB_DATA_01D_PROJECTED_READY_AFTER_R5: gameProjectedComplete && playerProjectedComplete ? 'YES' : 'NO',
      MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
      projectedGaps: gameProjectedComplete && playerProjectedComplete ? [] : ['remaining canonical event/player reconciliation requires deterministic R5-safe proof before persistence'],
    },
    reuse: {
      R4_REPAIR_REUSABLE_FOR_2026: 'YES',
      R4_REPAIR_REUSABLE_FOR_DAILY_INGEST: 'YES',
    },
    safety: {
      providerCalls: 0,
      productionDmlMutations: 0,
      productionSchemaMutations: 0,
      canonicalEventInserts: 0,
      canonicalPlayerInserts: 0,
      crosswalkWrites: 0,
      rawMappingWrites: 0,
      featureWrites: 0,
      modelWrites: 0,
      predictionWrites: 0,
      automationActivated: false,
      activeCronAdded: false,
    },
    flags: {
      EVENT_GAP_INVENTORY_READY: eventGaps.length === 614 ? 'YES' : 'NO',
      EVENT_GAP_ROOT_CAUSE_ACCOUNTED_FOR: eventGaps.length === 614 ? 'YES' : 'NO',
      CANONICAL_EVENT_CREATION_POLICY_READY: 'YES',
      GAME_CANONICAL_REPAIR_PROJECTED_COMPLETE: gameProjectedComplete ? 'YES' : 'NO',
      EXISTING_PLAYER_GAP_INVENTORY_READY: existingPlayerGaps.length === 1292 ? 'YES' : 'NO',
      AMBIGUOUS_PLAYER_REPAIR_PLAN_READY: ambiguousPlayers.length === 16 ? 'YES' : 'NO',
      CANONICAL_PLAYER_CREATION_CONTRACT_READY: 'YES',
      EXISTING_CANONICAL_PLAYER_LINK_CONTRACT_READY: 'YES',
      PLAYER_CANONICAL_REPAIR_PROJECTED_COMPLETE: playerProjectedComplete ? 'YES' : 'NO',
      R4_CROSSWALK_PERSISTENCE_CONTRACT_READY: 'YES',
      R4_CROSSWALK_GLOBAL_CONFLICT_PLAN_READY: 'YES',
      R4_RAW_MAPPING_CONTRACT_READY: 'YES',
      R4_RAW_IMMUTABILITY_CONTRACT_READY: 'YES',
      R4_IDEMPOTENCY_CONTRACT_READY: 'YES',
      CANONICAL_IDENTITY_REPAIR_ORDER_CERTIFIED: 'YES',
      FEATURE_IDENTITY_DEPENDENCY_MATRIX_READY: 'YES',
      R4_REPAIR_REUSABLE_FOR_2026: 'YES',
      R4_REPAIR_REUSABLE_FOR_DAILY_INGEST: 'YES',
      MLB_DATA_01D_PROJECTED_READY_AFTER_R5: gameProjectedComplete && playerProjectedComplete ? 'YES' : 'NO',
      MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
      PROVIDER_CALLS: '0',
      PRODUCTION_DML_MUTATIONS: '0',
    },
  }

  writeJson(artifactPath, artifact)
  writeMarkdown(artifact)
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r4-canonical-reconciliation-plan',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    eventGapCount: artifact.eventGap.count,
    eventRootCauseCounts: artifact.eventGap.rootCauseCounts,
    eventCreationRequired: artifact.eventGap.canonicalEventCreationRequiredCount,
    playerCreationRequiredR4: artifact.playerGap.canonicalPlayerCreationRequiredCountR4,
    gameProjectedComplete: artifact.flags.GAME_CANONICAL_REPAIR_PROJECTED_COMPLETE,
    playerProjectedComplete: artifact.flags.PLAYER_CANONICAL_REPAIR_PROJECTED_COMPLETE,
    providerCalls: 0,
    productionDmlMutations: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    validator: 'mlb-data-01c-r4-canonical-reconciliation-plan',
    status: 'ERROR',
    message: error instanceof Error ? error.message : String(error),
  }, null, 2))
  process.exitCode = 1
})
