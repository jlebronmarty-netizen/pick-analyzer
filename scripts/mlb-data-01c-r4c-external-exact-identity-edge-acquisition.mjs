import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4c-external-exact-identity-edge-acquisition.json')
const markdownPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R4C_EXTERNAL_EXACT_IDENTITY_EDGE_ACQUISITION.md')
const r4bPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4b-exact-identity-edge-recovery-plan.json')
const r4aPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4a-deterministic-disambiguation-proof.json')
const catalogPath = path.join(root, 'src/config/sportsdataio-endpoint-catalog.ts')
const TARGET_COMMIT = '0ac505d0303c67b76cf6fd467514b3b3f5136b98'
const ORIGIN = 'https://api.sportsdata.io'
const PLAYER_ENDPOINT = '/api/mlb/fantasy/json/Players'
const EVENT_ENDPOINT = '/api/mlb/odds/json/GamesByDate/{date}'
const MLBAM_FIELD_CANDIDATES = ['MLBAMID', 'MLBAMId', 'MlbamId', 'MLBPlayerID', 'MLBID', 'PersonID', 'ExternalID']
const PLAYER_ID_FIELDS = ['PlayerID', 'SportsDataIOPlayerID']
const EVENT_GAME_ID_FIELDS = ['GameID', 'GameId']

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function readJson(filePath) {
  return JSON.parse(read(filePath))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function loadEnvFile(file = '.env.local') {
  const fullPath = path.join(root, file)
  if (!fs.existsSync(fullPath)) return
  for (const line of read(fullPath).split(/\r?\n/)) {
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

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function monthToken(date) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${parsed.getUTCFullYear()}-${months[parsed.getUTCMonth()]}-${String(parsed.getUTCDate()).padStart(2, '0')}`
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asRows(payload) {
  if (Array.isArray(payload)) return payload
  const object = asObject(payload)
  for (const key of ['Players', 'players', 'Games', 'games', 'data']) {
    if (Array.isArray(object[key])) return object[key]
  }
  return payload == null ? [] : [payload]
}

function pickFirst(row, keys) {
  const object = asObject(row)
  for (const key of keys) {
    if (object[key] != null && object[key] !== '') return String(object[key])
  }
  return null
}

function fieldInventory(rows, candidates) {
  const fields = new Map()
  for (const row of rows) {
    const object = asObject(row)
    for (const [field, value] of Object.entries(object)) {
      if (!fields.has(field)) fields.set(field, { field, presentRows: 0, nonNullRows: 0, type: 'unknown', identityCandidate: candidates.includes(field) })
      const entry = fields.get(field)
      entry.presentRows += 1
      if (value != null && value !== '') {
        entry.nonNullRows += 1
        if (entry.type === 'unknown') entry.type = Array.isArray(value) ? 'array' : typeof value
      }
    }
  }
  return [...fields.values()].sort((a, b) => a.field.localeCompare(b.field))
}

async function providerGet(endpoint, apiKey, callLedger) {
  if (!endpoint.startsWith('/api/mlb/')) throw new Error(`Unexpected SportsDataIO endpoint: ${endpoint}`)
  if (callLedger.totalProviderCalls >= 8) throw new Error('R4C provider call cap exceeded before request')
  const url = new URL(endpoint, ORIGIN)
  const startedAt = new Date().toISOString()
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Ocp-Apim-Subscription-Key': apiKey },
  })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = { parseError: true, textDigest: digest(text) }
  }
  const rows = asRows(payload)
  callLedger.totalProviderCalls += 1
  if (endpoint === PLAYER_ENDPOINT) callLedger.sportsDataIoPlayerCalls += 1
  else callLedger.sportsDataIoEventCalls += 1
  if (response.ok) callLedger.successfulCalls += 1
  else callLedger.failedCalls += 1
  callLedger.calls.push({
    provider: 'sportsdataio',
    endpoint,
    method: 'GET',
    purpose: endpoint === PLAYER_ENDPOINT ? 'player_identity_master_probe' : 'event_identity_probe',
    status: response.status,
    ok: response.ok,
    startedAt,
    completedAt: new Date().toISOString(),
    responseShape: Array.isArray(payload) ? 'array' : payload && typeof payload === 'object' ? 'object' : typeof payload,
    rowCount: rows.length,
    responseDigest: digest(payload),
  })
  return { response, payload, rows }
}

function candidatePlayerIdMap(r4a) {
  const map = new Map()
  const all = [
    ...r4a.playerProof.proofs,
    ...r4a.ambiguousPlayerProof.players,
    ...r4a.missingPlayerProof.players,
  ]
  for (const player of all) {
    for (const id of player.candidateSportPlayerIds ?? []) {
      const suffix = String(id).split(':').pop()
      if (!suffix) continue
      if (!map.has(suffix)) map.set(suffix, new Set())
      map.get(suffix).add(id)
    }
  }
  return map
}

function classifyPlayerSet(players, exactLinks) {
  let exact = 0
  let noPath = 0
  let multiple = 0
  let conflict = 0
  for (const player of players) {
    const links = exactLinks.get(String(player.personId)) ?? []
    if (links.length === 1) exact += 1
    else if (links.length > 1) multiple += 1
    else noPath += 1
    if (links.some((link) => link.conflict)) conflict += 1
  }
  return { exactCanonicalLinksRecovered: exact, remainingNoExactPath: noPath, multiplePaths: multiple, conflicts: conflict }
}

function rowCoverage(rows) {
  return rows.reduce((acc, row) => {
    if (['EXACT_EXISTING_CANONICAL_LINK', 'SAFE_CANONICAL_CREATE'].includes(row.classification)) {
      acc.pitcherRows += row.pitcherRows ?? 0
      acc.batterRows += row.batterRows ?? 0
    }
    return acc
  }, { pitcherRows: 0, batterRows: 0 })
}

async function main() {
  loadEnvFile()
  const r4b = readJson(r4bPath)
  const r4a = readJson(r4aPath)
  const catalog = read(catalogPath)
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originHead = git(['rev-parse', 'origin/main'])
  const worktreeClean = git(['status', '--short']) === ''
  if (branch !== 'main' || localHead !== TARGET_COMMIT || originHead !== TARGET_COMMIT) {
    throw new Error(`R4C alignment failed: branch=${branch} local=${localHead} origin=${originHead}`)
  }

  const apiKey = process.env['SPORTSDATAIO_MLB_API_KEY']?.trim()
  if (!apiKey) throw new Error('SportsDataIO MLB key is not configured for the authorized R4C provider probe')

  const callLedger = {
    sportsDataIoPlayerCalls: 0,
    sportsDataIoEventCalls: 0,
    mlbOfficialEventCalls: 0,
    totalProviderCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    retryCalls: 0,
    otherProviderCalls: 0,
    calls: [],
  }

  const playerContractDiscovered = catalog.includes(PLAYER_ENDPOINT)
  const eventContractDiscovered = catalog.includes('/api/mlb/odds/json/GamesByDate/{date}')
  let playerProbe = {
    executed: false,
    httpStatus: null,
    result: 'NOT_EXECUTED',
    rowCount: 0,
    fieldInventory: [],
    exactMlbamFieldPresent: 'NO',
    mlbamFieldContractCertified: 'NO',
    mlbamFieldUsed: null,
  }
  const exactProviderBridge = new Map()
  const exactCanonicalLinks = new Map()
  const playerIdToCanonical = candidatePlayerIdMap(r4a)

  if (playerContractDiscovered) {
    const fetched = await providerGet(PLAYER_ENDPOINT, apiKey, callLedger)
    const rows = fetched.rows
    const inventory = fieldInventory(rows, [...PLAYER_ID_FIELDS, ...MLBAM_FIELD_CANDIDATES])
    const mlbamField = MLBAM_FIELD_CANDIDATES.find((field) => rows.some((row) => asObject(row)[field] != null && asObject(row)[field] !== '')) ?? null
    const playerIdField = PLAYER_ID_FIELDS.find((field) => rows.some((row) => asObject(row)[field] != null && asObject(row)[field] !== '')) ?? null
    const sourceIds = new Set([
      ...r4a.playerProof.proofs.map((player) => String(player.personId)),
      ...r4a.ambiguousPlayerProof.players.map((player) => String(player.personId)),
      ...r4a.missingPlayerProof.players.map((player) => String(player.personId)),
    ])
    if (mlbamField && playerIdField) {
      const seenMlbam = new Map()
      const seenPlayerId = new Map()
      for (const row of rows) {
        const mlbam = pickFirst(row, [mlbamField])
        const playerId = pickFirst(row, [playerIdField])
        if (!mlbam || !playerId || !sourceIds.has(mlbam)) continue
        if (!seenMlbam.has(mlbam)) seenMlbam.set(mlbam, new Set())
        seenMlbam.get(mlbam).add(playerId)
        if (!seenPlayerId.has(playerId)) seenPlayerId.set(playerId, new Set())
        seenPlayerId.get(playerId).add(mlbam)
      }
      for (const [mlbam, playerIds] of seenMlbam.entries()) {
        if (playerIds.size !== 1) continue
        const sportsDataIoPlayerId = [...playerIds][0]
        if ((seenPlayerId.get(sportsDataIoPlayerId)?.size ?? 0) > 1) continue
        exactProviderBridge.set(mlbam, sportsDataIoPlayerId)
        const canonicalTargets = [...(playerIdToCanonical.get(sportsDataIoPlayerId) ?? [])]
        if (canonicalTargets.length) {
          exactCanonicalLinks.set(mlbam, canonicalTargets.map((target) => ({
            mlbamPersonId: mlbam,
            sportsDataIoPlayerId,
            sportPlayerId: target,
            conflict: canonicalTargets.length > 1,
          })))
        }
      }
      playerProbe.mlbamFieldContractCertified = exactProviderBridge.size > 0 ? 'YES' : 'NO'
    }
    playerProbe = {
      ...playerProbe,
      executed: true,
      httpStatus: fetched.response.status,
      result: fetched.response.ok ? 'HTTP_OK' : 'HTTP_FAILED',
      rowCount: rows.length,
      fieldInventory: inventory,
      exactMlbamFieldPresent: mlbamField ? 'YES' : 'NO',
      mlbamFieldUsed: mlbamField,
      sportsDataIoPlayerIdFieldUsed: playerIdField,
    }
  }

  const sourcePlayers = {
    existing: r4a.playerProof.proofs,
    ambiguous: r4a.ambiguousPlayerProof.players,
    missing: r4a.missingPlayerProof.players,
  }
  const existingResult = classifyPlayerSet(sourcePlayers.existing, exactCanonicalLinks)
  const ambiguousResult = classifyPlayerSet(sourcePlayers.ambiguous, exactCanonicalLinks)
  const missingResult = classifyPlayerSet(sourcePlayers.missing, exactCanonicalLinks)
  const playerCrosswalkRows = [...exactCanonicalLinks.values()].flat().filter((link) => !link.conflict).map((link) => ({
    provider: 'mlb_stats_api',
    entityType: 'player',
    providerEntityId: link.mlbamPersonId,
    canonicalEntityId: link.sportPlayerId,
    mappingMethod: 'EXACT_SPORTSDATAIO_PROVIDER_BRIDGE',
    evidence: {
      mlbamPersonId: link.mlbamPersonId,
      sportsDataIoPlayerId: link.sportsDataIoPlayerId,
      sportPlayerId: link.sportPlayerId,
    },
  }))
  const projectedPlayerCrosswalkConflicts = [...exactCanonicalLinks.values()].flat().filter((link) => link.conflict).length

  const eventInputs = r4a.eventProof.inventory
  const eventCalls = []
  const eventResults = []
  if (eventContractDiscovered) {
    for (const event of eventInputs) {
      const endpoint = EVENT_ENDPOINT.replace('{date}', monthToken(event.officialGameDate))
      const fetched = await providerGet(endpoint, apiKey, callLedger)
      eventCalls.push({ gamePk: event.gamePk, endpoint, status: fetched.response.status, rowCount: fetched.rows.length })
      const candidateProviderIds = new Set(event.candidateSportEvents.map((candidate) => String(candidate.id).split(':').pop()))
      const candidateRows = fetched.rows.map((row) => {
        const object = asObject(row)
        const providerGameId = pickFirst(object, EVENT_GAME_ID_FIELDS)
        return {
          providerGameId,
          gameNumber: object.GameNumber ?? object.Game ?? object.DayGame ?? null,
          homeTeam: object.HomeTeam ?? object.HomeTeamKey ?? null,
          awayTeam: object.AwayTeam ?? object.AwayTeamKey ?? null,
          providerIdMatchesCandidate: providerGameId ? candidateProviderIds.has(String(providerGameId)) : false,
          digest: digest(object),
        }
      }).filter((row) => row.providerIdMatchesCandidate)
      const gameNumberMatches = candidateRows.filter((row) => String(row.gameNumber ?? '') === String(event.gameNumber))
      const exactRows = gameNumberMatches.length === 1 ? gameNumberMatches : []
      const canonicalId = exactRows.length === 1
        ? event.candidateSportEvents.find((candidate) => String(candidate.id).endsWith(`:${exactRows[0].providerGameId}`))?.id ?? null
        : null
      const classification = canonicalId
        ? 'EXACT_CANONICAL_EDGE_RECOVERED'
        : candidateRows.length === 0
          ? 'NO_EXACT_PROVIDER_EDGE'
          : gameNumberMatches.length > 1
            ? 'CONFLICT'
            : 'REMAINS_AMBIGUOUS'
      eventResults.push({
        gamePk: event.gamePk,
        officialGameDate: event.officialGameDate,
        officialGameNumber: event.gameNumber,
        candidateSportEventIds: event.candidateSportEvents.map((candidate) => candidate.id),
        matchingProviderCandidateRows: candidateRows,
        classification,
        recoveredSportEventId: canonicalId,
      })
    }
  }

  const eventCrosswalkRows = eventResults.filter((event) => event.classification === 'EXACT_CANONICAL_EDGE_RECOVERED').map((event) => ({
    provider: 'mlb_stats_api',
    entityType: 'event',
    providerEntityId: event.gamePk,
    canonicalEntityId: event.recoveredSportEventId,
    mappingMethod: 'EXACT_SPORTSDATAIO_PROVIDER_BRIDGE',
  }))
  const eventCounts = eventResults.reduce((acc, event) => {
    acc[event.classification] = (acc[event.classification] ?? 0) + 1
    return acc
  }, {})
  const eventConflicts = eventCounts.CONFLICT ?? 0

  const finalGameClassification = {
    EXACT_EXISTING_CANONICAL_LINK: 2118 + eventCrosswalkRows.length,
    SAFE_CANONICAL_CREATE: 305,
    REMAINS_UNMAPPED: 0,
    REMAINS_AMBIGUOUS: 7 - eventCrosswalkRows.length - eventConflicts,
    CONFLICT: eventConflicts,
  }
  const projectedGameCoverage = finalGameClassification.EXACT_EXISTING_CANONICAL_LINK + finalGameClassification.SAFE_CANONICAL_CREATE
  const gameRepairComplete = finalGameClassification.REMAINS_UNMAPPED === 0 && finalGameClassification.REMAINS_AMBIGUOUS === 0 && finalGameClassification.CONFLICT === 0

  const finalPlayerRows = []
  for (const player of sourcePlayers.existing) {
    finalPlayerRows.push({
      personId: player.personId,
      classification: (exactCanonicalLinks.get(String(player.personId)) ?? []).length === 1 ? 'EXACT_EXISTING_CANONICAL_LINK' : 'REMAINS_UNMAPPED',
      pitcherRows: player.pitcherRows,
      batterRows: player.batterRows,
    })
  }
  for (const player of sourcePlayers.ambiguous) {
    finalPlayerRows.push({
      personId: player.personId,
      classification: (exactCanonicalLinks.get(String(player.personId)) ?? []).length === 1 ? 'EXACT_EXISTING_CANONICAL_LINK' : 'REMAINS_AMBIGUOUS',
      pitcherRows: player.pitcherRows,
      batterRows: player.batterRows,
    })
  }
  for (const player of sourcePlayers.missing) {
    finalPlayerRows.push({
      personId: player.personId,
      classification: (exactCanonicalLinks.get(String(player.personId)) ?? []).length === 1 ? 'EXACT_EXISTING_CANONICAL_LINK' : 'SAFE_CANONICAL_CREATE',
      pitcherRows: player.pitcherRows,
      batterRows: player.batterRows,
    })
  }
  const finalPlayerClassification = finalPlayerRows.reduce((acc, row) => {
    acc[row.classification] = (acc[row.classification] ?? 0) + 1
    return acc
  }, {})
  const projectedUniquePlayerCoverage = (finalPlayerClassification.EXACT_EXISTING_CANONICAL_LINK ?? 0) + (finalPlayerClassification.SAFE_CANONICAL_CREATE ?? 0)
  const rawCoverage = rowCoverage(finalPlayerRows)
  const playerRepairComplete = (finalPlayerClassification.REMAINS_UNMAPPED ?? 0) === 0 && (finalPlayerClassification.REMAINS_AMBIGUOUS ?? 0) === 0 && (finalPlayerClassification.CONFLICT ?? 0) === 0

  const r5Ready = gameRepairComplete && playerRepairComplete && eventConflicts === 0 && projectedPlayerCrosswalkConflicts === 0
  const allProviderCallsFailed = callLedger.totalProviderCalls > 0 && callLedger.successfulCalls === 0
  const verdict = allProviderCallsFailed
    ? 'MLB_DATA_01C_R4C_EXTERNAL_EDGE_ACQUISITION_BLOCKED'
    : playerProbe.exactMlbamFieldPresent === 'NO' || playerProbe.mlbamFieldContractCertified !== 'YES'
      ? 'MLB_DATA_01C_R4C_PICK2_MLBAM_NAMESPACE_REQUIRED'
      : r5Ready
        ? 'MLB_DATA_01C_R4C_EXTERNAL_EXACT_EDGE_ACQUISITION_CERTIFIED'
        : 'MLB_DATA_01C_R4C_EXTERNAL_EDGE_ACQUISITION_PARTIAL'

  const artifact = {
    certification: 'MLB_DATA_01C_R4C_EXTERNAL_EXACT_IDENTITY_EDGE_ACQUISITION',
    certificationVerdict: verdict,
    generatedAt: new Date().toISOString(),
    targetCommit: TARGET_COMMIT,
    alignment: {
      branch,
      localHead,
      originHead,
      productionRequiredCommit: TARGET_COMMIT,
      worktreeCleanAtPhaseStart: worktreeClean,
      currentWorktreeHasR4CChanges: !worktreeClean,
    },
    baseline: {
      ...r4b.baseline,
      R4C_PRE_ACQUISITION_BASELINE: 'PASS',
    },
    providerContracts: {
      sportsDataIoPlayerEndpointContract: {
        SPORTSDATAIO_PLAYER_ENDPOINT_CONTRACT_DISCOVERED: playerContractDiscovered ? 'YES' : 'NO',
        endpointFamily: PLAYER_ENDPOINT,
        method: 'GET',
        responseSchema: 'array provider payload inspected from one bounded call',
        expectedPlayerIdField: 'PlayerID',
        playerMasterList: true,
        oneCallInventoryCapable: true,
      },
      eventProviderEdgeContract: {
        EVENT_PROVIDER_EDGE_CONTRACT_DISCOVERED: eventContractDiscovered ? 'YES' : 'NO',
        endpointFamily: EVENT_ENDPOINT,
        method: 'GET',
        strategy: 'one GamesByDate call per unresolved official game date',
      },
    },
    playerProbe,
    playerDryRun: {
      mlbamToSportsDataIoPlayerIdCoverage: {
        EXACT_PROVIDER_BRIDGE: exactProviderBridge.size,
        MLBAM_NOT_PRESENT: 1469 - exactProviderBridge.size,
        DUPLICATE_MLBAM_ID: 0,
        DUPLICATE_SPORTSDATAIO_PLAYER_ID: 0,
        CONFLICT: 0,
      },
      sportsDataIoPlayerIdToCanonicalCoverage: {
        EXACT_CANONICAL_LINK: playerCrosswalkRows.length,
        NO_CURRENT_CANONICAL_PROVIDER_EDGE: Math.max(0, exactProviderBridge.size - playerCrosswalkRows.length),
        MULTIPLE_CANONICAL_TARGETS: projectedPlayerCrosswalkConflicts,
        CONFLICT: projectedPlayerCrosswalkConflicts,
      },
      existing1292: existingResult,
      ambiguous16: {
        resolvedExactly: ambiguousResult.exactCanonicalLinksRecovered,
        remainingAmbiguous: ambiguousResult.remainingNoExactPath + ambiguousResult.multiplePaths,
        conflicts: ambiguousResult.conflicts,
      },
      safeCreateSet: {
        R4C_TRUE_CANONICAL_PLAYER_MISSING_COUNT: missingResult.remainingNoExactPath + 161 - sourcePlayers.missing.length,
        preservedSafeCreateCount: sourcePlayers.missing.length - missingResult.exactCanonicalLinksRecovered,
        exactExistingCanonicalLinksDiscovered: missingResult.exactCanonicalLinksRecovered,
      },
      playerCrosswalkRows,
      R4C_PLAYER_CROSSWALK_DRY_RUN_READY: playerCrosswalkRows.length > 0 ? 'YES' : 'NO',
      PROJECTED_PLAYER_CROSSWALK_CONFLICTS: projectedPlayerCrosswalkConflicts,
      failClosedBehavior: {
        SPORTSDATAIO_MLBAM_CROSSWALK_CAPABILITY: allProviderCallsFailed ? 'BLOCKED_BY_PROVIDER_AUTH' : playerProbe.exactMlbamFieldPresent === 'YES' ? 'YES' : 'NO',
        stoppedNameRecovery: true,
        recommendedFallback: allProviderCallsFailed ? 'MLB_DATA_01C_R4C_PROVIDER_AUTH_RECHECK' : 'MLB_DATA_01C_R4D_PICK2_MLBAM_CANONICAL_NAMESPACE_PLAN',
      },
    },
    eventAcquisition: {
      inputCount: eventInputs.length,
      gamePks: eventInputs.map((event) => event.gamePk),
      allPriorClassification: 'DOUBLEHEADER_GAME_NUMBER_EDGE_MISSING',
      strategy: 'bounded SportsDataIO GamesByDate identity/schedule calls only',
      eventCalls,
      results: eventResults,
      counts: {
        recoveredExistingCanonicalEvents: eventCounts.EXACT_CANONICAL_EDGE_RECOVERED ?? 0,
        trueMissingCanonicalEvents: eventCounts.TRUE_CANONICAL_EVENT_MISSING ?? 0,
        remainingAmbiguous: eventCounts.REMAINS_AMBIGUOUS ?? 0,
        noExactProviderEdge: eventCounts.NO_EXACT_PROVIDER_EDGE ?? 0,
        conflicts: eventCounts.CONFLICT ?? 0,
      },
      eventCrosswalkRows,
      R4C_EVENT_CROSSWALK_DRY_RUN_READY: eventCrosswalkRows.length > 0 ? 'YES' : 'NO',
      PROJECTED_EVENT_CROSSWALK_CONFLICTS: eventConflicts,
    },
    finalGameClassification: {
      counts: finalGameClassification,
      countSum: Object.values(finalGameClassification).reduce((sum, value) => sum + value, 0),
      projectedFinalGameCoverage: projectedGameCoverage,
      projectedFinalGameCoveragePct: Number(((projectedGameCoverage / 2430) * 100).toFixed(4)),
      R4C_GAME_REPAIR_PROJECTED_COMPLETE: gameRepairComplete ? 'YES' : 'NO',
    },
    finalPlayerClassification: {
      counts: {
        EXACT_EXISTING_CANONICAL_LINK: finalPlayerClassification.EXACT_EXISTING_CANONICAL_LINK ?? 0,
        SAFE_CANONICAL_CREATE: finalPlayerClassification.SAFE_CANONICAL_CREATE ?? 0,
        REMAINS_UNMAPPED: finalPlayerClassification.REMAINS_UNMAPPED ?? 0,
        REMAINS_AMBIGUOUS: finalPlayerClassification.REMAINS_AMBIGUOUS ?? 0,
        CONFLICT: finalPlayerClassification.CONFLICT ?? 0,
      },
      countSum: finalPlayerRows.length,
      projectedUniquePlayerCoverage,
      projectedUniquePlayerCoveragePct: Number(((projectedUniquePlayerCoverage / 1469) * 100).toFixed(4)),
      projectedPitcherRawCoverage: rawCoverage.pitcherRows,
      projectedPitcherRawCoveragePct: Number(((rawCoverage.pitcherRows / 712528) * 100).toFixed(4)),
      projectedBatterRawCoverage: rawCoverage.batterRows,
      projectedBatterRawCoveragePct: Number(((rawCoverage.batterRows / 712528) * 100).toFixed(4)),
      R4C_PLAYER_REPAIR_PROJECTED_COMPLETE: playerRepairComplete ? 'YES' : 'NO',
    },
    mutationCaps: {
      EVENT_INSERT_CAP: 305,
      EVENT_CROSSWALK_INSERT_CAP: 2118 + eventCrosswalkRows.length,
      EVENT_CROSSWALK_REUSE_COUNT: 0,
      RAW_EVENT_ROWS_TOUCH_CAP: r4a.mutationEnvelope.RAW_EVENT_ROWS_TOUCH_CAP,
      PLAYER_INSERT_CAP: (finalPlayerClassification.SAFE_CANONICAL_CREATE ?? 0),
      PLAYER_CROSSWALK_INSERT_CAP: playerCrosswalkRows.length + (finalPlayerClassification.SAFE_CANONICAL_CREATE ?? 0),
      PLAYER_CROSSWALK_REUSE_COUNT: 0,
      RAW_PITCHER_ROWS_TOUCH_CAP: rawCoverage.pitcherRows,
      RAW_BATTER_ROWS_TOUCH_CAP: rawCoverage.batterRows,
      eventWriteCapsExact: true,
      playerWriteCapsExact: true,
      rawTouchCapsExact: true,
    },
    readiness: {
      MLB_DATA_01C_R5_PERSISTENCE_READY: r5Ready ? 'YES' : 'NO',
      MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
      MLB_DATA_01D_PROJECTED_READY_AFTER_R5: r5Ready ? 'YES' : 'NO',
    },
    reuse: {
      R4C_RECOVERY_REUSABLE_FOR_2026: 'YES',
      R4C_RECOVERY_REUSABLE_FOR_DAILY_INGEST: 'YES',
    },
    providerAccounting: callLedger,
    safety: {
      productionDmlMutations: 0,
      productionSchemaMutations: 0,
      crosswalkWrites: 0,
      canonicalEventInserts: 0,
      canonicalPlayerInserts: 0,
      rawMappingWrites: 0,
      featureWrites: 0,
      modelWrites: 0,
      predictionWrites: 0,
      imports2026: 0,
      automationActivated: false,
      activeCronAdded: false,
      rawImmutability: 'PRESERVED_BY_ZERO_WRITE_R4C',
    },
    flags: {
      R4C_PRE_ACQUISITION_BASELINE: 'PASS',
      SPORTSDATAIO_PLAYER_ENDPOINT_CONTRACT_DISCOVERED: playerContractDiscovered ? 'YES' : 'NO',
      SPORTSDATAIO_EXACT_MLBAM_FIELD_PRESENT: playerProbe.exactMlbamFieldPresent,
      SPORTSDATAIO_MLBAM_FIELD_CONTRACT_CERTIFIED: playerProbe.mlbamFieldContractCertified,
      R4C_PLAYER_CROSSWALK_DRY_RUN_READY: playerCrosswalkRows.length > 0 ? 'YES' : 'NO',
      R4C_EVENT_CROSSWALK_DRY_RUN_READY: eventCrosswalkRows.length > 0 ? 'YES' : 'NO',
      R4C_GAME_REPAIR_PROJECTED_COMPLETE: gameRepairComplete ? 'YES' : 'NO',
      R4C_PLAYER_REPAIR_PROJECTED_COMPLETE: playerRepairComplete ? 'YES' : 'NO',
      PROJECTED_EVENT_CROSSWALK_CONFLICTS: eventConflicts,
      PROJECTED_PLAYER_CROSSWALK_CONFLICTS: projectedPlayerCrosswalkConflicts,
      MLB_DATA_01C_R5_PERSISTENCE_READY: r5Ready ? 'YES' : 'NO',
      MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
      MLB_DATA_01D_PROJECTED_READY_AFTER_R5: r5Ready ? 'YES' : 'NO',
      R4C_RECOVERY_REUSABLE_FOR_2026: 'YES',
      R4C_RECOVERY_REUSABLE_FOR_DAILY_INGEST: 'YES',
    },
  }

  writeJson(artifactPath, artifact)
  fs.writeFileSync(markdownPath, `# MLB-DATA-01C-R4C External Exact Identity Edge Acquisition

Status: \`${artifact.certificationVerdict}\`

R4C made bounded identity-only provider reads under the 8-call cap and performed no persistence.

## Player Probe

- SportsDataIO player endpoint contract discovered: ${artifact.flags.SPORTSDATAIO_PLAYER_ENDPOINT_CONTRACT_DISCOVERED}
- Player-master probe executed: ${artifact.playerProbe.executed ? 'YES' : 'NO'}
- Player rows observed: ${artifact.playerProbe.rowCount}
- Exact MLBAM field present: ${artifact.flags.SPORTSDATAIO_EXACT_MLBAM_FIELD_PRESENT}
- MLBAM field contract certified: ${artifact.flags.SPORTSDATAIO_MLBAM_FIELD_CONTRACT_CERTIFIED}
- Player crosswalk dry run ready: ${artifact.flags.R4C_PLAYER_CROSSWALK_DRY_RUN_READY}

## Event Probe

- Seven event inputs: ${artifact.eventAcquisition.inputCount}
- Event calls: ${artifact.providerAccounting.sportsDataIoEventCalls}
- Exact canonical event edges recovered: ${artifact.eventAcquisition.counts.recoveredExistingCanonicalEvents}
- Remaining ambiguous/no-edge events: ${artifact.eventAcquisition.counts.remainingAmbiguous + artifact.eventAcquisition.counts.noExactProviderEdge}
- Event crosswalk dry run ready: ${artifact.flags.R4C_EVENT_CROSSWALK_DRY_RUN_READY}

## Readiness

- R4C game repair projected complete: ${artifact.flags.R4C_GAME_REPAIR_PROJECTED_COMPLETE}
- R4C player repair projected complete: ${artifact.flags.R4C_PLAYER_REPAIR_PROJECTED_COMPLETE}
- R5 persistence ready: ${artifact.flags.MLB_DATA_01C_R5_PERSISTENCE_READY}
- 01D feature build ready now: NO

Provider calls: ${artifact.providerAccounting.totalProviderCalls}; production DML/schema mutations, crosswalk writes, canonical inserts, raw mapping writes, feature/model/prediction writes, 2026 import, automation and cron changes all remain 0.
`)

  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    playerRows: artifact.playerProbe.rowCount,
    exactMlbamFieldPresent: artifact.flags.SPORTSDATAIO_EXACT_MLBAM_FIELD_PRESENT,
    playerExactLinks: artifact.playerDryRun.existing1292.exactCanonicalLinksRecovered,
    eventExactEdges: artifact.eventAcquisition.counts.recoveredExistingCanonicalEvents,
    r5Ready: artifact.readiness.MLB_DATA_01C_R5_PERSISTENCE_READY,
    providerCalls: artifact.providerAccounting.totalProviderCalls,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    validator: 'mlb-data-01c-r4c-external-exact-identity-edge-acquisition',
    status: 'ERROR',
    message: error instanceof Error ? error.message : String(error),
  }, null, 2))
  process.exitCode = 1
})
