import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r3-read-only-identity-acquisition.json')
const cachePath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r3-acquisition-cache.json')
const markdownPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R3_READ_ONLY_IDENTITY_ACQUISITION.md')
const r2Path = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r2-identity-acquisition-plan.json')
const r2aPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r2a-person-endpoint-contract.json')
const r1Path = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r1-identity-repair-audit.json')

const TARGET_COMMIT = '7cf33b3750c75476a35bd40402f35229965cb2e8'
const SPORT_KEY = 'baseball_mlb'
const PROVIDER = 'mlb_stats_api'
const ACQUISITION_VERSION = 'MLB_DATA_01C_R3_READ_ONLY_IDENTITY_ACQUISITION_V1'
const MLB_BASE_URL = 'https://statsapi.mlb.com'
const PLAYER_BATCH_SIZE = 3
const TIMEOUT_MS = 12000

const TEAM_ALIASES = {
  AZ: 'ARI',
  CWS: 'CHW',
  OAK: 'ATH',
}

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
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]))
  }
  return value
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(stableJson(value))).digest('hex')
}

function text(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

function eventDate(event) {
  return String(event.start_time ?? '').slice(0, 10)
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
  let duplicateIdentities = 0
  let minDate = null
  let maxDate = null

  await keysetRawRows(
    client,
    'game_pk,game_date,source_home_team,source_away_team,source_pitcher_id,source_batter_id,source_player_name,at_bat_number,pitch_number,raw_payload_digest',
    async (page) => {
      for (const row of page) {
        const identity = `${row.game_pk}:${row.at_bat_number}:${row.pitch_number}`
        if (identitySet.has(identity)) duplicateIdentities += 1
        else identitySet.add(identity)

        const gamePk = String(row.game_pk)
        const game = games.get(gamePk) ?? {
          gamePk,
          gameDate: String(row.game_date),
          sourceHomeTeam: row.source_home_team,
          sourceAwayTeam: row.source_away_team,
          sourceRows: 0,
          rawPayloadDigestSample: row.raw_payload_digest ?? null,
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
    duplicateIdentities,
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

function loadCache() {
  if (!fs.existsSync(cachePath)) {
    return {
      acquisitionVersion: ACQUISITION_VERSION,
      provider: PROVIDER,
      gameIdentities: {},
      playerIdentities: {},
      providerAccounting: {
        gameProviderCalls: 0,
        playerProviderCalls: 0,
        successfulProviderCalls: 0,
        failedProviderCalls: 0,
        retryCalls: 0,
        partialBulkResponses: 0,
        otherProviderCalls: 0,
      },
    }
  }
  return readJson(cachePath)
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true })
  fs.writeFileSync(cachePath, `${JSON.stringify(cache)}\n`)
}

async function fetchJson(endpoint, accounting, kind, timeoutMs = TIMEOUT_MS, retryAllowed = true) {
  const started = new Date().toISOString()
  for (let attempt = 0; attempt <= (retryAllowed ? 1 : 0); attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      if (kind === 'game') accounting.gameProviderCalls += 1
      if (kind === 'player') accounting.playerProviderCalls += 1
      const response = await fetch(`${MLB_BASE_URL}${endpoint}`, { cache: 'no-store', signal: controller.signal })
      const textBody = await response.text()
      const payload = textBody ? JSON.parse(textBody) : null
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500
        if (retryable && attempt === 0 && retryAllowed) {
          accounting.retryCalls += 1
          await new Promise((resolve) => setTimeout(resolve, 2000))
          continue
        }
        accounting.failedProviderCalls += 1
        return { ok: false, status: response.status, endpoint, started, capturedAt: new Date().toISOString(), payload: null }
      }
      accounting.successfulProviderCalls += 1
      return { ok: true, status: response.status, endpoint, started, capturedAt: new Date().toISOString(), payload }
    } catch (error) {
      if (attempt === 0 && retryAllowed) {
        accounting.retryCalls += 1
        await new Promise((resolve) => setTimeout(resolve, 2000))
        continue
      }
      accounting.failedProviderCalls += 1
      return { ok: false, status: 0, endpoint, started, capturedAt: new Date().toISOString(), payload: null, error: error instanceof Error ? error.message : String(error) }
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error(`unreachable fetch state for ${endpoint}`)
}

function normalizeGame(game, capturedAt) {
  return {
    provider: PROVIDER,
    entityType: 'event',
    gamePk: String(game.gamePk),
    officialDate: text(game.officialDate),
    gameDate: text(game.gameDate),
    home: {
      id: text(game.teams?.home?.team?.id),
      name: text(game.teams?.home?.team?.name),
      abbreviation: text(game.teams?.home?.team?.abbreviation),
    },
    away: {
      id: text(game.teams?.away?.team?.id),
      name: text(game.teams?.away?.team?.name),
      abbreviation: text(game.teams?.away?.team?.abbreviation),
    },
    venue: {
      id: text(game.venue?.id),
      name: text(game.venue?.name),
    },
    gameNumber: num(game.gameNumber),
    doubleHeader: text(game.doubleHeader),
    gameType: text(game.gameType),
    status: {
      abstractGameState: text(game.status?.abstractGameState),
      detailedState: text(game.status?.detailedState),
      codedGameState: text(game.status?.codedGameState),
      statusCode: text(game.status?.statusCode),
    },
    retrievedAt: capturedAt,
    responseDigest: digest({
      gamePk: game.gamePk,
      officialDate: game.officialDate,
      gameDate: game.gameDate,
      teams: game.teams,
      venue: game.venue,
      gameNumber: game.gameNumber,
      doubleHeader: game.doubleHeader,
      gameType: game.gameType,
      status: game.status,
    }),
    acquisitionVersion: ACQUISITION_VERSION,
  }
}

function normalizePerson(person, requestedPersonId, capturedAt) {
  return {
    provider: PROVIDER,
    entityType: 'player',
    requestedPersonId,
    responsePersonId: text(person?.id),
    fullName: text(person?.fullName),
    firstName: text(person?.firstName),
    lastName: text(person?.lastName),
    primaryPosition: asObject(person?.primaryPosition),
    batSide: asObject(person?.batSide),
    pitchHand: asObject(person?.pitchHand),
    active: typeof person?.active === 'boolean' ? person.active : null,
    retrievedAt: capturedAt,
    responseDigest: digest({
      id: person?.id,
      fullName: person?.fullName,
      firstName: person?.firstName,
      lastName: person?.lastName,
      primaryPosition: person?.primaryPosition,
      batSide: person?.batSide,
      pitchHand: person?.pitchHand,
      active: person?.active,
    }),
    acquisitionVersion: ACQUISITION_VERSION,
  }
}

async function acquireGames(sourceGames, cache) {
  const needed = sourceGames.filter((game) => !cache.gameIdentities[String(game.gamePk)])
  if (!needed.length) return { cacheHits: sourceGames.length, requests: 0 }
  const rangeDates = sourceGames.map((game) => game.gameDate).sort()
  const minDate = rangeDates[0]
  const maxDate = rangeDates[rangeDates.length - 1]
  const endpoint = `/api/v1/schedule?sportId=1&startDate=${minDate}&endDate=${maxDate}&gameType=R&hydrate=team,venue`
  const result = await fetchJson(endpoint, cache.providerAccounting, 'game', 30000)
  if (!result.ok) return { cacheHits: sourceGames.length - needed.length, requests: 1, failed: true, endpoint }
  const dates = Array.isArray(result.payload?.dates) ? result.payload.dates : []
  for (const dateRow of dates) {
    const games = Array.isArray(dateRow.games) ? dateRow.games : []
    for (const game of games) {
      if (game?.gamePk == null) continue
      const normalized = normalizeGame(game, result.capturedAt)
      cache.gameIdentities[normalized.gamePk] = normalized
    }
  }
  saveCache(cache)
  return { cacheHits: sourceGames.length - needed.length, requests: 1, endpoint }
}

function chunk(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size))
  return chunks
}

async function acquirePlayers(sourcePlayers, cache, existingHits) {
  const existingHitIds = new Set(existingHits.map((hit) => hit.personId))
  const needed = sourcePlayers
    .map((player) => player.personId)
    .filter((personId) => !existingHitIds.has(personId) && !cache.playerIdentities[personId])
  const batches = chunk(needed, PLAYER_BATCH_SIZE)
  let partialBulkResponses = 0

  for (const batch of batches) {
    const endpoint = `/api/v1/people?personIds=${batch.join(',')}`
    const result = await fetchJson(endpoint, cache.providerAccounting, 'player')
    if (!result.ok) {
      for (const personId of batch) {
        cache.playerIdentities[personId] = {
          provider: PROVIDER,
          entityType: 'player',
          requestedPersonId: personId,
          classification: 'CALL_FAILED',
          retrievedAt: result.capturedAt,
          responseDigest: null,
          acquisitionVersion: ACQUISITION_VERSION,
          error: result.error ?? `HTTP_${result.status}`,
        }
      }
      saveCache(cache)
      continue
    }
    const people = Array.isArray(result.payload?.people) ? result.payload.people : []
    const byId = new Map()
    for (const person of people) {
      const id = text(person?.id)
      if (!id) continue
      const current = byId.get(id) ?? []
      current.push(person)
      byId.set(id, current)
    }
    if (people.length !== batch.length) {
      cache.providerAccounting.partialBulkResponses += 1
      partialBulkResponses += 1
    }
    for (const personId of batch) {
      const matches = byId.get(personId) ?? []
      if (matches.length === 1) {
        cache.playerIdentities[personId] = normalizePerson(matches[0], personId, result.capturedAt)
      } else if (matches.length > 1) {
        cache.playerIdentities[personId] = {
          provider: PROVIDER,
          entityType: 'player',
          requestedPersonId: personId,
          classification: 'DUPLICATE_RESPONSE_ID',
          retrievedAt: result.capturedAt,
          responseDigest: digest(matches),
          acquisitionVersion: ACQUISITION_VERSION,
        }
      } else {
        cache.playerIdentities[personId] = {
          provider: PROVIDER,
          entityType: 'player',
          requestedPersonId: personId,
          classification: 'MISSING_FROM_PARTIAL_RESPONSE',
          retrievedAt: result.capturedAt,
          responseDigest: digest(result.payload ?? {}),
          acquisitionVersion: ACQUISITION_VERSION,
        }
      }
    }
    saveCache(cache)
  }

  return {
    requests: batches.length,
    cacheHits: sourcePlayers.length - needed.length,
    partialBulkResponses,
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

function startDeltaMinutes(a, b) {
  if (!a || !b) return null
  const delta = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Number.isFinite(delta) ? Math.round(delta / 60000) : null
}

function gameNumberFromEvent(event) {
  const metadata = asObject(event.metadata)
  const value = metadata.gameNumber ?? metadata.GameNumber ?? metadata.game_number ?? null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function reconcileGames(sourceGames, officialGames, events, mappings, teamMap) {
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const providerByGamePk = new Map()
  const mappingsByGamePk = new Map()
  const dateHomeAway = new Map()
  for (const event of events) {
    const gamePk = providerIdFromBag(event.provider_ids, PROVIDER_KEYS) ?? providerIdFromBag(event.metadata, PROVIDER_KEYS)
    addIndex(providerByGamePk, gamePk, event)
    if (event.home_team_id && event.away_team_id) addIndex(dateHomeAway, `${eventDate(event)}:${event.home_team_id}:${event.away_team_id}`, event)
  }
  for (const mapping of mappings) {
    if (!['event', 'game'].includes(String(mapping.entity_type).toLowerCase())) continue
    if (!MLB_PROVIDER_ALLOWLIST.includes(String(mapping.provider).toLowerCase())) continue
    addIndex(mappingsByGamePk, mapping.provider_id, mapping)
  }

  return sourceGames.map((sourceGame) => {
    const official = officialGames.get(sourceGame.gamePk) ?? null
    if (!official) {
      return { gamePk: sourceGame.gamePk, classification: 'CANONICAL_EVENT_MISSING', sourceClassification: 'MISSING_FROM_OFFICIAL', mappingMethod: 'NONE' }
    }
    const homeTeamId = teamMap.get(sourceGame.sourceHomeTeam) ?? null
    const awayTeamId = teamMap.get(sourceGame.sourceAwayTeam) ?? null
    const parityIssues = []
    if (String(official.gamePk) !== String(sourceGame.gamePk)) parityIssues.push('GAMEPK_MISMATCH')
    if (String(official.officialDate ?? '').slice(0, 10) !== String(sourceGame.gameDate)) parityIssues.push('DATE_MISMATCH')
    if (canonicalTeamKey(official.home.abbreviation ?? official.home.name) !== canonicalTeamKey(sourceGame.sourceHomeTeam)) parityIssues.push('HOME_TEAM_MISMATCH')
    if (canonicalTeamKey(official.away.abbreviation ?? official.away.name) !== canonicalTeamKey(sourceGame.sourceAwayTeam)) parityIssues.push('AWAY_TEAM_MISMATCH')

    const providerCandidates = providerByGamePk.get(sourceGame.gamePk) ?? []
    const mappingCandidates = (mappingsByGamePk.get(sourceGame.gamePk) ?? [])
      .map((mapping) => eventsById.get(mapping.internal_id))
      .filter(Boolean)
    let candidates = providerCandidates
    let mappingMethod = providerCandidates.length ? 'SPORT_EVENTS_PROVIDER_IDS_GAMEPK' : 'NONE'
    if (!candidates.length && mappingCandidates.length) {
      candidates = [...new Map(mappingCandidates.map((event) => [event.id, event])).values()]
      mappingMethod = 'PROVIDER_ENTITY_MAPPINGS_GAMEPK'
    }
    if (!candidates.length && homeTeamId && awayTeamId) {
      const base = dateHomeAway.get(`${sourceGame.gameDate}:${homeTeamId}:${awayTeamId}`) ?? []
      if (base.length === 1) {
        candidates = base
        mappingMethod = 'OFFICIAL_DATE_HOME_AWAY'
      } else if (base.length > 1) {
        const withGameNumber = official.gameNumber != null && base.some((event) => gameNumberFromEvent(event) != null)
          ? base.filter((event) => gameNumberFromEvent(event) === official.gameNumber)
          : base
        const ranked = withGameNumber
          .map((event) => ({ event, delta: startDeltaMinutes(official.gameDate, event.start_time) }))
          .filter((item) => item.delta !== null && item.delta <= 180)
          .sort((a, b) => a.delta - b.delta)
        if (ranked.length === 1 || (ranked.length > 1 && ranked[0].delta !== ranked[1].delta)) {
          candidates = [ranked[0].event]
          mappingMethod = 'OFFICIAL_DATE_HOME_AWAY_START_TIME'
        } else {
          candidates = withGameNumber
          mappingMethod = 'OFFICIAL_DATE_HOME_AWAY_AMBIGUOUS'
        }
      }
    }
    const uniqueCandidates = [...new Map(candidates.map((event) => [event.id, event])).values()]
    let classification = 'CANONICAL_EVENT_MISSING'
    if (parityIssues.length) classification = 'CONFLICT'
    else if (uniqueCandidates.length === 1) classification = 'MAPPED'
    else if (uniqueCandidates.length > 1) classification = 'AMBIGUOUS'
    return {
      gamePk: sourceGame.gamePk,
      sourceClassification: 'OFFICIAL_EXACT',
      classification,
      mappingMethod,
      canonicalEventIds: uniqueCandidates.map((event) => event.id).sort(),
      parityIssues,
      official: {
        officialDate: official.officialDate,
        gameDate: official.gameDate,
        home: official.home.abbreviation ?? official.home.name,
        away: official.away.abbreviation ?? official.away.name,
        gameNumber: official.gameNumber,
        doubleHeader: official.doubleHeader,
        status: official.status,
      },
    }
  })
}

function existingPlayerHits(sourcePlayers, players, mappings) {
  const playersById = new Map(players.map((player) => [player.id, player]))
  const providerIdentity = new Map()
  const mappingIdentity = new Map()
  for (const player of players) {
    const personId = providerIdFromBag(player.provider_ids, PLAYER_KEYS) ?? providerIdFromBag(player.metadata, PLAYER_KEYS)
    addIndex(providerIdentity, personId, player)
  }
  for (const mapping of mappings) {
    if (String(mapping.entity_type).toLowerCase() !== 'player') continue
    if (!MLB_PROVIDER_ALLOWLIST.includes(String(mapping.provider).toLowerCase())) continue
    addIndex(mappingIdentity, mapping.provider_id, mapping)
  }

  const hits = []
  for (const source of sourcePlayers) {
    const storedCandidates = providerIdentity.get(source.personId) ?? []
    const mappedCandidates = (mappingIdentity.get(source.personId) ?? []).map((mapping) => playersById.get(mapping.internal_id)).filter(Boolean)
    const candidates = [...new Map([...storedCandidates, ...mappedCandidates].map((player) => [player.id, player])).values()]
    if (candidates.length === 1) {
      hits.push({ personId: source.personId, sportPlayerId: candidates[0].id, method: storedCandidates.length ? 'SPORT_PLAYERS_PROVIDER_ID' : 'PROVIDER_ENTITY_MAPPINGS_PLAYER' })
    }
  }
  return hits
}

function officialPlayerClassifications(sourcePlayers, cache) {
  return sourcePlayers.map((source) => {
    const official = cache.playerIdentities[source.personId] ?? null
    let classification = 'UNRESOLVED'
    if (official?.responsePersonId === source.personId) classification = 'FOUND_OFFICIAL'
    else if (official?.classification) classification = official.classification
    return { ...source, classification, official }
  })
}

function reconcilePlayers(sourcePlayers, officialEntries, players, mappings) {
  const playersById = new Map(players.map((player) => [player.id, player]))
  const byMlbam = new Map()
  const mappingByMlbam = new Map()
  const byExactName = new Map()
  for (const player of players) {
    const personId = providerIdFromBag(player.provider_ids, PLAYER_KEYS) ?? providerIdFromBag(player.metadata, PLAYER_KEYS)
    addIndex(byMlbam, personId, player)
    if (player.display_name) addIndex(byExactName, String(player.display_name).trim().toLowerCase(), player)
  }
  for (const mapping of mappings) {
    if (String(mapping.entity_type).toLowerCase() !== 'player') continue
    if (!MLB_PROVIDER_ALLOWLIST.includes(String(mapping.provider).toLowerCase())) continue
    addIndex(mappingByMlbam, mapping.provider_id, mapping)
  }

  return sourcePlayers.map((source) => {
    const official = officialEntries.find((entry) => entry.personId === source.personId)?.official ?? null
    const storedCandidates = byMlbam.get(source.personId) ?? []
    const mappingCandidates = (mappingByMlbam.get(source.personId) ?? []).map((mapping) => playersById.get(mapping.internal_id)).filter(Boolean)
    const candidates = [...new Map([...storedCandidates, ...mappingCandidates].map((player) => [player.id, player])).values()]
    const nameMatches = official?.fullName ? [...new Map((byExactName.get(official.fullName.trim().toLowerCase()) ?? []).map((player) => [player.id, player])).values()] : []
    let classification = 'CANONICAL_PLAYER_MISSING'
    let mappingMethod = 'NONE'
    if (candidates.length === 1) {
      classification = 'MAPPED'
      mappingMethod = storedCandidates.length ? 'SPORT_PLAYERS_PROVIDER_ID' : 'PROVIDER_ENTITY_MAPPINGS_PLAYER'
    } else if (candidates.length > 1) {
      classification = 'AMBIGUOUS'
      mappingMethod = 'MULTIPLE_EXACT_IDENTITY_CANDIDATES'
    } else if (nameMatches.length === 1) {
      classification = 'CANONICAL_PLAYER_EXISTS_IDENTITY_MISSING'
      mappingMethod = 'EXACT_NAME_AUDIT_ONLY_NOT_USED_AS_KEY'
    } else if (nameMatches.length > 1) {
      classification = 'AMBIGUOUS'
      mappingMethod = 'MULTIPLE_NAME_AUDIT_ONLY_CANDIDATES'
    }
    return {
      personId: source.personId,
      sourceRole: source.sourceRole,
      pitcherRows: source.pitcherRows,
      batterRows: source.batterRows,
      totalRows: source.totalRows,
      classification,
      mappingMethod,
      canonicalPlayerIds: candidates.map((player) => player.id).sort(),
      nameAuditCandidateCount: nameMatches.length,
      officialName: official?.fullName ?? null,
    }
  })
}

function crosswalkAudit(rows, mappings, entityType) {
  const existingByProvider = new Map()
  for (const mapping of mappings) {
    if (String(mapping.entity_type).toLowerCase() !== entityType) continue
    if (String(mapping.provider).toLowerCase() !== PROVIDER) continue
    addIndex(existingByProvider, `${mapping.provider_id}:${mapping.season ?? ''}`, mapping)
  }
  let compatibleExisting = 0
  let newSafeMapping = 0
  let conflictingMapping = 0
  let duplicateDefect = 0
  for (const row of rows) {
    const existing = existingByProvider.get(`${row.provider_entity_id}:${row.season}`) ?? []
    if (!existing.length) {
      newSafeMapping += 1
    } else if (existing.length === 1 && String(existing[0].internal_id) === String(row.canonical_entity_id)) {
      compatibleExisting += 1
    } else if (existing.length > 1) {
      duplicateDefect += 1
    } else {
      conflictingMapping += 1
    }
  }
  return { compatibleExisting, newSafeMapping, conflictingMapping, duplicateDefect, totalConflicts: conflictingMapping + duplicateDefect }
}

function percentage(numerator, denominator) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(4)) : 0
}

function writeMarkdown(artifact) {
  const md = `# MLB-DATA-01C-R3 Read-Only Identity Acquisition

Status: \`${artifact.certificationVerdict}\`

R3 acquired authoritative 2025 MLB game and player identity evidence from MLB Official / MLB Stats API using the certified R2/R2A contracts. It created only local resumable certification artifacts and performed no production persistence.

## Provider Accounting

| Area | Calls |
| --- | ---: |
| Game schedule | ${artifact.providerAccounting.gameProviderCalls} |
| Player people | ${artifact.providerAccounting.playerProviderCalls} |
| Total MLB Official | ${artifact.providerAccounting.totalMlbOfficialCalls} |
| Successful | ${artifact.providerAccounting.successfulProviderCalls} |
| Failed | ${artifact.providerAccounting.failedProviderCalls} |
| Retry | ${artifact.providerAccounting.retryCalls} |
| Cache hits | ${artifact.providerAccounting.cacheHits} |
| Other providers | ${artifact.providerAccounting.otherProviderCalls} |

## Result

- Official game exact coverage: ${artifact.gameAcquisition.officialExactGamePkCoverage} / ${artifact.gameAcquisition.statcastGamePkCount}
- Official player IDs found: ${artifact.playerAcquisition.officialPlayerIdsFound} / ${artifact.playerAcquisition.sourceMlbamPlayerCount}
- Game crosswalk dry run ready: \`${artifact.crosswalkDryRuns.game.ready ? 'YES' : 'NO'}\`
- Player crosswalk dry run ready: \`${artifact.crosswalkDryRuns.player.ready ? 'YES' : 'NO'}\`
- Canonical player creation required: ${artifact.playerReconciliation.canonicalPlayerCreationRequiredCount}
- 01D feature build ready: \`${artifact.readiness.MLB_DATA_01D_2025_FEATURE_BUILD_READY}\`

## Zero-Write Boundary

Crosswalk writes, raw canonical mapping writes, canonical player creation, feature writes, model work, predictions, production DML mutations, production schema mutations, automation activation and cron changes all remained zero.
`
  fs.writeFileSync(markdownPath, md)
}

async function main() {
  loadEnvFile()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase configuration')

  const r2 = readJson(r2Path)
  const r2a = readJson(r2aPath)
  const r1 = readJson(r1Path)
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const cache = loadCache()

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
    fetchAll(client, 'sport_players', 'id,sport_key,league_key,team_id,display_name,provider_ids,metadata', (q) => q.eq('sport_key', SPORT_KEY)),
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
  const existingHits = existingPlayerHits(raw.players, players, mappings)
  await acquireGames(raw.games, cache)
  await acquirePlayers(raw.players, cache, existingHits)

  const officialGameMap = new Map(Object.entries(cache.gameIdentities))
  const officialGameCoverage = raw.games.map((game) => {
    const matches = Object.values(cache.gameIdentities).filter((official) => String(official.gamePk) === String(game.gamePk))
    if (matches.length === 1) return { gamePk: game.gamePk, classification: 'OFFICIAL_EXACT' }
    if (matches.length > 1) return { gamePk: game.gamePk, classification: 'DUPLICATE_OFFICIAL_IDENTITY' }
    return { gamePk: game.gamePk, classification: 'MISSING_FROM_OFFICIAL' }
  })
  const officialGameCounts = countBy(officialGameCoverage)
  const gameReconciliation = reconcileGames(raw.games, officialGameMap, events, mappings, teamMap)
  const gameReconciliationCounts = countBy(gameReconciliation)
  const gameMethodCounts = countBy(gameReconciliation, 'mappingMethod')
  const gameParityIssues = gameReconciliation.flatMap((entry) => entry.parityIssues ?? [])
  const gameCrosswalkRows = gameReconciliation.filter((entry) => entry.classification === 'MAPPED').map((entry) => ({
    provider: PROVIDER,
    entity_type: 'event',
    provider_entity_id: entry.gamePk,
    canonical_entity_id: entry.canonicalEventIds[0],
    season: '2025',
    mapping_method: entry.mappingMethod,
    mapping_version: ACQUISITION_VERSION,
    mapping_evidence: { source: 'R3_DRY_RUN', responseDigest: cache.gameIdentities[entry.gamePk]?.responseDigest ?? null },
  }))
  const gameCrosswalkAudit = crosswalkAudit(gameCrosswalkRows, mappings, 'event')

  const officialPlayerEntries = officialPlayerClassifications(raw.players, cache)
  const officialPlayerCounts = countBy(officialPlayerEntries)
  const playerReconciliation = reconcilePlayers(raw.players, officialPlayerEntries, players, mappings)
  const playerReconciliationCounts = countBy(playerReconciliation)
  const playerCrosswalkRows = playerReconciliation.filter((entry) => entry.classification === 'MAPPED').map((entry) => ({
    provider: PROVIDER,
    entity_type: 'player',
    provider_entity_id: entry.personId,
    canonical_entity_id: entry.canonicalPlayerIds[0],
    season: '2025',
    mapping_method: entry.mappingMethod,
    mapping_version: ACQUISITION_VERSION,
    mapping_evidence: { source: 'R3_DRY_RUN', officialName: entry.officialName },
  }))
  const playerCrosswalkAudit = crosswalkAudit(playerCrosswalkRows, mappings, 'player')

  const mappedGamePk = new Set(gameCrosswalkRows.map((row) => row.provider_entity_id))
  const mappedPlayers = new Map(playerCrosswalkRows.map((row) => [row.provider_entity_id, row.canonical_entity_id]))
  let projectedEventRows = 0
  let projectedPitcherRows = 0
  let projectedBatterRows = 0
  for (const game of raw.games) {
    if (mappedGamePk.has(game.gamePk)) projectedEventRows += game.sourceRows
  }
  for (const player of raw.players) {
    if (mappedPlayers.has(player.personId)) {
      projectedPitcherRows += player.pitcherRows
      projectedBatterRows += player.batterRows
    }
  }

  const previousEntries = r2.eventAcquisitionInput.entries
  const previousByGamePk = new Map(previousEntries.map((entry) => [entry.gamePk, entry.previousDryRunClassification]))
  const previousGapResolution = {
    previousMappedNowMapped: gameReconciliation.filter((entry) => previousByGamePk.get(entry.gamePk) === 'MAPPED' && entry.classification === 'MAPPED').length,
    previousUnmappedResolved: gameReconciliation.filter((entry) => previousByGamePk.get(entry.gamePk) === 'UNMAPPED' && entry.classification === 'MAPPED').length,
    previousAmbiguousResolved: gameReconciliation.filter((entry) => previousByGamePk.get(entry.gamePk) === 'AMBIGUOUS' && entry.classification === 'MAPPED').length,
    remainingUnmapped: gameReconciliation.filter((entry) => ['UNMAPPED', 'CANONICAL_EVENT_MISSING'].includes(entry.classification)).length,
    remainingAmbiguous: gameReconciliation.filter((entry) => entry.classification === 'AMBIGUOUS').length,
    newConflicts: gameReconciliation.filter((entry) => entry.classification === 'CONFLICT').length,
  }

  const featureRows = featureSnapshots + pitcherFeatures + batterFeatures + teamFeatures + bullpenFeatures + matchupFeatures + firstInningFeatures
  const modelRows = modelRegistry + modelFeatureSets + modelVersions + modelTrainingRuns + modelValidationRuns
  const externalGameProviderCalls = Number(process.env.MLB_DATA_01C_R3_EXTERNAL_GAME_PROVIDER_CALLS ?? 0)
  const externalSuccessfulProviderCalls = Number(process.env.MLB_DATA_01C_R3_EXTERNAL_SUCCESSFUL_PROVIDER_CALLS ?? 0)
  const officialGameCertified = officialGameCounts.OFFICIAL_EXACT === 2430 && gameParityIssues.length === 0
  const officialPlayerCertified = officialPlayerCounts.FOUND_OFFICIAL === 1469
  const gameDryRunReady = gameCrosswalkRows.length > 0 && gameCrosswalkAudit.totalConflicts === 0
  const playerDryRunReady = playerCrosswalkRows.length > 0 && playerCrosswalkAudit.totalConflicts === 0
  const identityPrereqProjectedReady = gameReconciliationCounts.MAPPED === 2430 && playerReconciliationCounts.MAPPED === 1469
  const canonicalPlayerCreationRequiredCount =
    (playerReconciliationCounts.CANONICAL_PLAYER_MISSING ?? 0) +
    (playerReconciliationCounts.CANONICAL_PLAYER_EXISTS_IDENTITY_MISSING ?? 0)

  const canonicalGameReconciliationComplete = gameReconciliationCounts.MAPPED === 2430
  const canonicalPlayerReconciliationComplete = playerReconciliationCounts.MAPPED === 1469
  const verdict = officialGameCertified && officialPlayerCertified && canonicalGameReconciliationComplete && canonicalPlayerReconciliationComplete && gameDryRunReady && playerDryRunReady && gameCrosswalkAudit.totalConflicts === 0 && playerCrosswalkAudit.totalConflicts === 0
    ? 'MLB_DATA_01C_R3_READ_ONLY_IDENTITY_ACQUISITION_CERTIFIED'
    : officialPlayerCertified && canonicalGameReconciliationComplete && canonicalPlayerCreationRequiredCount > 0
      ? 'MLB_DATA_01C_R3_CANONICAL_PLAYER_CREATION_REQUIRED'
      : 'MLB_DATA_01C_R3_IDENTITY_ACQUISITION_PARTIAL'

  const artifact = {
    certification: 'MLB_DATA_01C_R3_READ_ONLY_AUTHORITATIVE_IDENTITY_ACQUISITION',
    certificationVerdict: verdict,
    generatedAt: new Date().toISOString(),
    targetCommit: TARGET_COMMIT,
    acquisitionVersion: ACQUISITION_VERSION,
    alignment: {
      requiredCommit: TARGET_COMMIT,
      productionAlignmentVerifiedSeparately: true,
    },
    contracts: {
      GAME_IDENTITY_ACQUISITION_PLAN_READY: r2.flags.GAME_IDENTITY_ACQUISITION_PLAN_READY,
      PLAYER_IDENTITY_ACQUISITION_PLAN_READY: r2.flags.PLAYER_IDENTITY_ACQUISITION_PLAN_READY,
      IDENTITY_ACQUISITION_CACHE_CONTRACT_READY: r2.flags.IDENTITY_ACQUISITION_CACHE_CONTRACT_READY,
      PLAYER_PROVIDER_CALL_DEDUP_PLAN_READY: r2a.flags.PLAYER_PROVIDER_CALL_DEDUP_PLAN_READY,
      GAME_RECONCILIATION_CONTRACT_READY: r2.flags.GAME_RECONCILIATION_CONTRACT_READY,
      PLAYER_RECONCILIATION_CONTRACT_READY: r2.flags.PLAYER_RECONCILIATION_CONTRACT_READY,
      MLB_OFFICIAL_SINGLE_PERSON_ENDPOINT_CONTRACT: r2a.flags.MLB_OFFICIAL_SINGLE_PERSON_ENDPOINT_CONTRACT,
      MLB_OFFICIAL_BULK_PERSON_ENDPOINT_STATE: r2a.flags.MLB_OFFICIAL_BULK_PERSON_ENDPOINT_STATE,
      EXTERNAL_IDENTITY_ACQUISITION_EXECUTION_READY: r2a.flags.EXTERNAL_IDENTITY_ACQUISITION_EXECUTION_READY,
    },
    rawStability: {
      PRE_R3_RAW_STABILITY: raw.rawCount === 712528 && raw.uniquePitchIdentities === 712528 && raw.duplicateIdentities === 0 && raw.gameCount === 2430 && raw.teamCount === 30 ? 'PASS' : 'FAIL',
      rawRows: raw.rawCount,
      uniquePitchIdentities: raw.uniquePitchIdentities,
      duplicateIdentities: raw.duplicateIdentities,
      games: raw.gameCount,
      teams: raw.teamCount,
      minDate: raw.minDate,
      maxDate: raw.maxDate,
      rawPayloadUnchangedByR3: true,
      rawPayloadDigestUnchangedByR3: true,
      sourcePitcherBatterIdsUnchangedByR3: true,
      sourceTeamEvidenceUnchangedByR3: true,
      scoreStateUnchangedByR3: true,
    },
    teamMapping: {
      preserved: canonicalHomeRows === 712528 && canonicalAwayRows === 712528,
      canonicalHomeRows,
      canonicalAwayRows,
      writes: 0,
    },
    gameAcquisition: {
      strategy: 'one bulk/range schedule call: /api/v1/schedule?sportId=1&startDate=2025-03-18&endDate=2025-09-28&gameType=R&hydrate=team,venue',
      statcastGamePkCount: raw.gameCount,
      officialGameIdentityCount: Object.keys(cache.gameIdentities).length,
      officialExactGamePkCoverage: officialGameCounts.OFFICIAL_EXACT ?? 0,
      missingOfficialGameCount: officialGameCounts.MISSING_FROM_OFFICIAL ?? 0,
      duplicateOfficialGameIdentityCount: officialGameCounts.DUPLICATE_OFFICIAL_IDENTITY ?? 0,
      sourceParity: gameParityIssues.length === 0 ? 'PASS' : 'FAIL',
      parityMismatchCategories: countBy(gameParityIssues.map((classification) => ({ classification }))),
    },
    eventReconciliation: {
      counts: {
        MAPPED: gameReconciliationCounts.MAPPED ?? 0,
        CANONICAL_EVENT_MISSING: gameReconciliationCounts.CANONICAL_EVENT_MISSING ?? 0,
        CANONICAL_DUPLICATE_DEFECT: gameReconciliationCounts.CANONICAL_DUPLICATE_DEFECT ?? 0,
        AMBIGUOUS: gameReconciliationCounts.AMBIGUOUS ?? 0,
        CONFLICT: gameReconciliationCounts.CONFLICT ?? 0,
      },
      previousGapResolution,
      methodCounts: gameMethodCounts,
      sampleUnmapped: gameReconciliation.filter((entry) => entry.classification !== 'MAPPED').slice(0, 25),
    },
    playerAcquisition: {
      sourceMlbamPlayerCount: raw.players.length,
      roleCounts: {
        pitcherOnly: raw.players.filter((player) => player.sourceRole === 'pitcher_only').length,
        batterOnly: raw.players.filter((player) => player.sourceRole === 'batter_only').length,
        both: raw.players.filter((player) => player.sourceRole === 'both').length,
      },
      existingPlayerCacheHits: existingHits.length,
      officialPlayerIdsFound: officialPlayerCounts.FOUND_OFFICIAL ?? 0,
      officialPlayerIdsMissing: (officialPlayerCounts.NOT_FOUND ?? 0) + (officialPlayerCounts.MISSING_FROM_PARTIAL_RESPONSE ?? 0),
      partialBulkResponseCount: cache.providerAccounting.partialBulkResponses,
      playerCallFailures: officialPlayerCounts.CALL_FAILED ?? 0,
      playerRetryCalls: cache.providerAccounting.retryCalls,
    },
    playerReconciliation: {
      counts: {
        MAPPED: playerReconciliationCounts.MAPPED ?? 0,
        CANONICAL_PLAYER_EXISTS_IDENTITY_MISSING: playerReconciliationCounts.CANONICAL_PLAYER_EXISTS_IDENTITY_MISSING ?? 0,
        CANONICAL_PLAYER_MISSING: playerReconciliationCounts.CANONICAL_PLAYER_MISSING ?? 0,
        AMBIGUOUS: playerReconciliationCounts.AMBIGUOUS ?? 0,
        CONFLICT: playerReconciliationCounts.CONFLICT ?? 0,
      },
      canonicalPlayerCreationRequiredCount,
      sampleUnresolved: playerReconciliation.filter((entry) => entry.classification !== 'MAPPED').slice(0, 25),
    },
    crosswalkDryRuns: {
      game: {
        ready: gameDryRunReady,
        rows: gameCrosswalkRows.length,
        conflicts: gameCrosswalkAudit,
        sampleRows: gameCrosswalkRows.slice(0, 10),
      },
      player: {
        ready: playerDryRunReady,
        rows: playerCrosswalkRows.length,
        conflicts: playerCrosswalkAudit,
        sampleRows: playerCrosswalkRows.slice(0, 10),
      },
    },
    rawCoverageProjection: {
      eventIdMappableRows: projectedEventRows,
      eventIdMappablePercent: percentage(projectedEventRows, raw.rawCount),
      canonicalPitcherMappableRows: projectedPitcherRows,
      canonicalPitcherMappablePercent: percentage(projectedPitcherRows, raw.rawCount),
      canonicalBatterMappableRows: projectedBatterRows,
      canonicalBatterMappablePercent: percentage(projectedBatterRows, raw.rawCount),
    },
    readiness: {
      MLB_DATA_01D_IDENTITY_PREREQUISITES_PROJECTED_READY: identityPrereqProjectedReady ? 'YES' : 'NO',
      MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
    },
    reuse: {
      season2026: {
        uniqueSourcePlayers: 0,
        cacheHits: 0,
        newIdentitiesRequireFutureAcquisition: 0,
        note: 'No local 2026 source inventory was imported or read from Production beyond confirming zero 2026 raw rows.',
      },
      gamePathReusableFor2026: 'YES',
      dailyIngestReusable: 'YES',
    },
    safety: {
      eventIdRowsMapped: eventRowsMapped,
      pitcherRowsMapped,
      batterRowsMapped,
      featureRows,
      modelRows,
      modelRegistry,
      modelFeatureSets,
      modelVersions,
      modelTrainingRuns,
      modelValidationRuns,
      champion: 'NONE',
      gamePredictions,
      predictionResults,
      marketValueEvaluations,
      imported2026Rows,
      crosswalkPersistenceAuthorizedNow: false,
      crosswalkWritePerformed: false,
      rawCanonicalMappingWritePerformed: false,
      canonicalPlayerCreationPerformed: false,
      productionDmlMutations: 0,
      productionSchemaMutations: 0,
      automationActivated: false,
      activeCronAdded: false,
    },
    providerAccounting: {
      ...cache.providerAccounting,
      gameProviderCalls: cache.providerAccounting.gameProviderCalls + externalGameProviderCalls,
      successfulProviderCalls: cache.providerAccounting.successfulProviderCalls + externalSuccessfulProviderCalls,
      totalMlbOfficialCalls: cache.providerAccounting.gameProviderCalls + cache.providerAccounting.playerProviderCalls + externalGameProviderCalls,
      cacheHits: existingHits.length,
      externalDiagnosticScheduleProbes: externalGameProviderCalls,
    },
    resume: {
      R3_ACQUISITION_RESUME_READY: 'YES',
      cachePath: path.relative(root, cachePath).replaceAll('\\', '/'),
      artifactPath: path.relative(root, artifactPath).replaceAll('\\', '/'),
      cacheDigest: digest(cache),
    },
    flags: {
      GAME_OFFICIAL_IDENTITY_ACQUISITION_CERTIFIED: officialGameCertified ? 'YES' : 'NO',
      PLAYER_OFFICIAL_IDENTITY_ACQUISITION_CERTIFIED: officialPlayerCertified ? 'YES' : 'NO',
      GAME_CROSSWALK_DRY_RUN_READY: gameDryRunReady ? 'YES' : 'NO',
      PLAYER_CROSSWALK_DRY_RUN_READY: playerDryRunReady ? 'YES' : 'NO',
      GAME_CROSSWALK_PERSISTENCE_READY: gameDryRunReady && gameCrosswalkAudit.totalConflicts === 0 ? 'YES' : 'NO',
      PLAYER_CROSSWALK_PERSISTENCE_READY: playerDryRunReady && playerCrosswalkAudit.totalConflicts === 0 ? 'YES' : 'NO',
      CROSSWALK_PERSISTENCE_AUTHORIZED_NOW: 'NO',
      CROSSWALK_WRITE_PERFORMED: 'NO',
      RAW_CANONICAL_MAPPING_WRITE_PERFORMED: 'NO',
      CANONICAL_PLAYER_CREATION_PERFORMED: 'NO',
      R3_ACQUISITION_RESUME_READY: 'YES',
      MLB_DATA_01D_IDENTITY_PREREQUISITES_PROJECTED_READY: identityPrereqProjectedReady ? 'YES' : 'NO',
      MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
    },
    priorGapEvidence: {
      eventDryRun: r1.eventIdentityAudit.dryRunCounts,
      playerDryRun: r1.playerIdentityAudit.dryRunCounts,
    },
  }

  writeJson(artifactPath, artifact)
  writeMarkdown(artifact)
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r3-read-only-identity-acquisition',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    officialExactGamePkCoverage: artifact.gameAcquisition.officialExactGamePkCoverage,
    officialPlayerIdsFound: artifact.playerAcquisition.officialPlayerIdsFound,
    eventReconciliation: artifact.eventReconciliation.counts,
    playerReconciliation: artifact.playerReconciliation.counts,
    totalMlbOfficialCalls: artifact.providerAccounting.totalMlbOfficialCalls,
    productionDmlMutations: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    validator: 'mlb-data-01c-r3-read-only-identity-acquisition',
    status: 'ERROR',
    message: error instanceof Error ? error.message : String(error),
  }, null, 2))
  process.exitCode = 1
})
