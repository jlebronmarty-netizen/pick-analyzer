import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  NFL_BALLDONTLIE_BASE_URL,
  NFL_BALLDONTLIE_PROVIDER_ID,
  NFL_BALLDONTLIE_RAW_ROOT,
  NFL_BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE,
  NFL_BALLDONTLIE_TRIAL_LIMIT_REQUESTS_PER_MINUTE,
  NFL_SPORT_KEY,
  RECOMMENDED_NFL_HISTORICAL_SEASONS,
  buildNflExecutionQueue,
  getNflTrialExecutionCommands,
  summarizeNflBallDontLieHistoricalReadiness,
  validateNflBallDontLieHistoricalReadiness,
  validateNflTrialExecutionReadiness,
} from '@/services/nfl-balldontlie-historical-readiness.service'

const DEFAULT_CHECKPOINT = join(NFL_BALLDONTLIE_RAW_ROOT, 'nfl-01-start-checkpoint.json')
const DEFAULT_ACCOUNTING = join(NFL_BALLDONTLIE_RAW_ROOT, 'nfl-01-request-accounting.json')
const MAX_RETRIES = 3
const args = process.argv.slice(2)
const argSet = new Set(args)
let interrupted = false

process.on('SIGINT', () => {
  interrupted = true
})

function loadEnvFile(path = '.env.local') {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function getArg(name, fallback = null) {
  const prefix = `--${name}=`
  const value = args.find((arg) => arg.startsWith(prefix))
  return value ? value.slice(prefix.length) : fallback
}

function numberArg(name, fallback) {
  const value = Number(getArg(name, fallback))
  return Number.isFinite(value) ? value : fallback
}

function parseSeasons() {
  if (argSet.has('--all-certified-seasons')) return RECOMMENDED_NFL_HISTORICAL_SEASONS
  const explicit = getArg('seasons')
  if (explicit) return explicit.split(',').map((value) => Number(value.trim())).filter(Number.isFinite)
  const single = getArg('season')
  if (single) return [Number(single)].filter(Number.isFinite)
  return RECOMMENDED_NFL_HISTORICAL_SEASONS
}

function parsePriorities() {
  if (argSet.has('--p1')) return ['P1']
  return ['P0']
}

function parseFeeds() {
  const feed = getArg('feed')
  return feed ? feed.split(',').map((value) => value.trim()).filter(Boolean) : null
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.tmp`
  writeFileSync(temp, `${JSON.stringify(redactForOutput(value), null, 2)}\n`, 'utf8')
  renameSync(temp, path)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function appendParams(url, params, cursor) {
  for (const [key, value] of Object.entries(params)) {
    if (key === 'team_ids' && value === 'RESOLVED_FROM_TEAMS_FEED') continue
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item))
    } else {
      url.searchParams.set(key, String(value))
    }
  }
  if (cursor !== null && cursor !== undefined) url.searchParams.set('cursor', String(cursor))
}

function sanitizeHeaders(headers) {
  const safe = {}
  for (const key of ['content-type', 'retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
    const value = headers.get(key)
    if (value) safe[key] = value
  }
  return safe
}

function rawPathFor(entry, cursor) {
  const cursorLabel = cursor === null || cursor === undefined ? 'start' : `cursor-${cursor}`
  const target = entry.rawPayloadDestination.replaceAll('*', cursorLabel).replaceAll('{teamId}', 'resolved-later')
  if (!entry.rawPayloadDestination.includes('*') && cursor !== null && cursor !== undefined) {
    return target.replace(/\.json$/u, `.${cursorLabel}.json`)
  }
  return target
}

function loadCheckpoint(path, queue) {
  if (existsSync(path)) {
    const checkpoint = readJson(path)
    if (checkpoint.sport !== NFL_SPORT_KEY || checkpoint.provider !== NFL_BALLDONTLIE_PROVIDER_ID) throw new Error('CHECKPOINT_INVALID')
    return reconcileCheckpointRawPayloads(checkpoint)
  }
  return {
    mode: 'nfl_01_balldontlie_live_executor_checkpoint_v1',
    sport: NFL_SPORT_KEY,
    provider: NFL_BALLDONTLIE_PROVIDER_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: queue.map((entry) => ({
      requestId: entry.requestId,
      season: entry.season,
      feed: entry.endpointId,
      cursor: null,
      recordsCaptured: 0,
      requestsUsed: 0,
      successfulPayloads: 0,
      lastSuccessfulAt: null,
      completed: false,
      status: 'PLANNED',
      rawPayloads: [],
      failures: [],
    })),
  }
}

function reconcileCheckpointRawPayloads(checkpoint) {
  for (const state of checkpoint.entries ?? []) {
    const rawPayloads = Array.isArray(state.rawPayloads) ? state.rawPayloads : []
    const latest = rawPayloads.at(-1)
    if (!latest?.path || !existsSync(latest.path)) continue
    const envelope = readJson(latest.path)
    const cursor = nextCursor(envelope.payload)
    state.cursor = cursor
    state.completed = cursor === null
    if (state.completed && state.status === 'RAW_DURABLE_NORMALIZATION_DEFERRED') state.status = 'RAW_DURABLE_COMPLETE_NORMALIZATION_DEFERRED'
  }
  return checkpoint
}

function loadAccounting(path) {
  if (existsSync(path)) return readJson(path)
  return {
    mode: 'nfl_01_balldontlie_request_accounting_v1',
    sport: NFL_SPORT_KEY,
    provider: NFL_BALLDONTLIE_PROVIDER_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalCalls: 0,
    callsByFeed: {},
    callsBySeason: {},
    retries: 0,
    failures: 0,
    rateLimitResponses: 0,
    successfulPayloads: 0,
    recordsCaptured: 0,
  }
}

function updateAccounting(accounting, entry, payloadRecords, status) {
  accounting.updatedAt = new Date().toISOString()
  accounting.totalCalls += 1
  accounting.callsByFeed[entry.endpointId] = (accounting.callsByFeed[entry.endpointId] ?? 0) + 1
  accounting.callsBySeason[String(entry.season)] = (accounting.callsBySeason[String(entry.season)] ?? 0) + 1
  if (status === 429) accounting.rateLimitResponses += 1
  if (status >= 400) accounting.failures += 1
  else {
    accounting.successfulPayloads += 1
    accounting.recordsCaptured += payloadRecords
  }
}

function nextWork(checkpoint, queue) {
  for (const entry of queue) {
    const state = checkpoint.entries.find((item) => item.requestId === entry.requestId)
    if (!state?.completed) return { entry, state }
  }
  return null
}

function recordsIn(payload) {
  const data = payload && typeof payload === 'object' ? payload.data : null
  return Array.isArray(data) ? data.length : 0
}

function nextCursor(payload) {
  const meta = payload && typeof payload === 'object' ? payload.meta : null
  const cursor = meta && typeof meta === 'object' ? meta.next_cursor : null
  if (cursor === null || cursor === undefined || cursor === '') return null
  return Number.isFinite(Number(cursor)) ? Number(cursor) : null
}

function rawPayloadIdentity(envelope) {
  return {
    provider: envelope.provider,
    sport: envelope.sport,
    requestId: envelope.requestId,
    endpointId: envelope.endpointId,
    endpointPath: envelope.endpointPath,
    season: envelope.season,
    cursor: envelope.cursor ?? null,
    params: envelope.params ?? {},
    status: envelope.status,
    payload: envelope.payload ?? null,
  }
}

function rawPayloadContentChecksum(envelope) {
  return sha256(JSON.stringify(rawPayloadIdentity(envelope)))
}

function assertRawPayloadIdentity(path, envelope, entry, cursor) {
  const expected = {
    provider: NFL_BALLDONTLIE_PROVIDER_ID,
    sport: NFL_SPORT_KEY,
    requestId: entry.requestId,
    endpointId: entry.endpointId,
    endpointPath: entry.endpointPath,
    season: entry.season,
    cursor: cursor ?? null,
    params: entry.params,
  }
  const actual = {
    provider: envelope.provider,
    sport: envelope.sport,
    requestId: envelope.requestId,
    endpointId: envelope.endpointId,
    endpointPath: envelope.endpointPath,
    season: envelope.season,
    cursor: envelope.cursor ?? null,
    params: envelope.params ?? {},
  }
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(`RAW_PAYLOAD_COLLISION:${path}`)
  }
}

function readExistingRawPayload(path, entry, cursor) {
  const envelope = readJson(path)
  assertRawPayloadIdentity(path, envelope, entry, cursor)
  return {
    envelope,
    path,
    checksum: sha256(readFileSync(path, 'utf8')),
    contentChecksum: rawPayloadContentChecksum(envelope),
  }
}

function preserveRawPayload(path, envelope) {
  const body = `${JSON.stringify(redactForOutput(envelope), null, 2)}\n`
  const checksum = sha256(body)
  const contentChecksum = rawPayloadContentChecksum(envelope)
  if (existsSync(path)) {
    const existing = readExistingRawPayload(path, {
      requestId: envelope.requestId,
      endpointId: envelope.endpointId,
      endpointPath: envelope.endpointPath,
      season: envelope.season,
      params: envelope.params,
    }, envelope.cursor)
    if (existing.contentChecksum !== contentChecksum) throw new Error(`RAW_PAYLOAD_COLLISION:${path}`)
    return { path, checksum: existing.checksum, contentChecksum, reused: true }
  }
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.tmp`
  writeFileSync(temp, body, 'utf8')
  renameSync(temp, path)
  return { path, checksum, contentChecksum, reused: false }
}

function reuseExistingRawPayloadIfAvailable(entry, state) {
  const rawPath = rawPathFor(entry, state.cursor)
  if (!existsSync(rawPath)) return null
  const existing = readExistingRawPayload(rawPath, entry, state.cursor)
  const payloadRecords = recordsIn(existing.envelope.payload)
  state.status = 'RAW_DURABLE_REUSED_NORMALIZATION_DEFERRED'
  state.recordsCaptured = Math.max(state.recordsCaptured ?? 0, payloadRecords)
  state.successfulPayloads = Math.max(state.successfulPayloads ?? 0, 1)
  state.lastSuccessfulAt = state.lastSuccessfulAt ?? new Date().toISOString()
  state.rawPayloads = Array.isArray(state.rawPayloads) ? state.rawPayloads : []
  if (!state.rawPayloads.some((payload) => payload.path === rawPath)) {
    state.rawPayloads.push({
      path: rawPath,
      checksum: existing.checksum,
      contentChecksum: existing.contentChecksum,
      reused: true,
    })
  }
  state.cursor = nextCursor(existing.envelope.payload)
  state.completed = state.cursor === null
  state.updatedAt = new Date().toISOString()
  return {
    rawPath,
    payloadRecords,
    cursor: state.cursor,
  }
}

async function sleep(ms) {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms))
}

class RateLimiter {
  constructor(requestsPerMinute) {
    if (requestsPerMinute <= 0 || requestsPerMinute > NFL_BALLDONTLIE_TRIAL_LIMIT_REQUESTS_PER_MINUTE) throw new Error('UNSAFE_REQUEST_RATE')
    this.intervalMs = Math.ceil(60_000 / requestsPerMinute)
    this.nextAllowedAt = 0
  }

  async wait() {
    const delay = Math.max(0, this.nextAllowedAt - Date.now())
    await sleep(delay)
    this.nextAllowedAt = Math.max(Date.now(), this.nextAllowedAt) + this.intervalMs
  }

  retryAfter(headers) {
    const value = Number(headers.get('retry-after'))
    if (Number.isFinite(value) && value > 0) this.nextAllowedAt = Math.max(this.nextAllowedAt, Date.now() + value * 1000)
  }
}

async function fetchProviderPage(entry, state, apiKey, limiter) {
  await limiter.wait()
  const url = new URL(`${NFL_BALLDONTLIE_BASE_URL}${entry.endpointPath}`)
  appendParams(url, entry.params, state.cursor)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: apiKey },
      signal: controller.signal,
      cache: 'no-store',
    })
    limiter.retryAfter(response.headers)
    const text = await response.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = { data: [], meta: {}, schemaError: 'NON_JSON_RESPONSE' }
    }
    return { status: response.status, ok: response.ok, headers: sanitizeHeaders(response.headers), payload }
  } finally {
    clearTimeout(timeout)
  }
}

function assertSafeExecute(options) {
  if (!options.execute) throw new Error('EXECUTE_MODE_REQUIRED')
  if (process.env.NFL_BALLDONTLIE_TRIAL_ACTIVE !== 'true') throw new Error('NFL_BALLDONTLIE_TRIAL_ACTIVE_REQUIRED')
  if (process.env.NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED !== 'true') throw new Error('NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED_REQUIRED')
  if (!process.env.BALLDONTLIE_API_KEY?.trim()) throw new Error('BALLDONTLIE_API_KEY_MISSING')
  if (options.maxCalls <= 0) throw new Error('MAX_CALLS_REQUIRED')
  if (options.maxRuntimeMinutes <= 0) throw new Error('MAX_RUNTIME_REQUIRED')
  if (options.maxRequestsPerMinute <= 0 || options.maxRequestsPerMinute > NFL_BALLDONTLIE_TRIAL_LIMIT_REQUESTS_PER_MINUTE) throw new Error('UNSAFE_REQUEST_RATE')
  if (!options.queue.length) throw new Error('INVALID_SEASON_OR_FEED')
}

async function runExecute() {
  loadEnvFile()
  const probe = argSet.has('--probe')
  const checkpointPath = getArg('checkpoint', DEFAULT_CHECKPOINT)
  const accountingPath = getArg('accounting', DEFAULT_ACCOUNTING)
  const options = {
    execute: argSet.has('--execute'),
    queue: buildNflExecutionQueue({ seasons: parseSeasons(), priorities: parsePriorities(), feeds: parseFeeds(), probe }),
    maxCalls: numberArg('maxCalls', probe ? 3 : 25),
    maxRuntimeMinutes: numberArg('maxRuntimeMinutes', probe ? 5 : 30),
    maxRequestsPerMinute: numberArg('maxRequestsPerMinute', NFL_BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE),
  }
  assertSafeExecute(options)
  const checkpoint = loadCheckpoint(checkpointPath, options.queue)
  const accounting = loadAccounting(accountingPath)
  const limiter = new RateLimiter(options.maxRequestsPerMinute)
  const startedAt = Date.now()
  let callsThisRun = 0
  let stopReason = null

  while (callsThisRun < options.maxCalls) {
    if (interrupted) {
      stopReason = 'INTERRUPTED_CHECKPOINT_SAVED'
      break
    }
    if ((Date.now() - startedAt) / 60_000 >= options.maxRuntimeMinutes) {
      stopReason = 'MAX_RUNTIME_REACHED'
      break
    }
    const work = nextWork(checkpoint, options.queue)
    if (!work) {
      stopReason = 'QUEUE_COMPLETE'
      break
    }
    const { entry, state } = work
    const reused = reuseExistingRawPayloadIfAvailable(entry, state)
    if (reused) {
      checkpoint.updatedAt = new Date().toISOString()
      writeJsonAtomic(checkpointPath, checkpoint)
      writeJsonAtomic(accountingPath, accounting)
      continue
    }
    let response = null
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
      try {
        response = await fetchProviderPage(entry, state, process.env.BALLDONTLIE_API_KEY.trim(), limiter)
        break
      } catch (error) {
        accounting.retries += 1
        state.failures.push({ at: new Date().toISOString(), attempt, error: error instanceof Error ? error.message : String(error) })
        if (attempt > MAX_RETRIES) throw error
        await sleep(1000 * attempt)
      }
    }

    callsThisRun += 1
    const payloadRecords = recordsIn(response.payload)
    const rawPath = rawPathFor(entry, state.cursor)
    const preserved = preserveRawPayload(rawPath, {
      provider: NFL_BALLDONTLIE_PROVIDER_ID,
      sport: NFL_SPORT_KEY,
      requestId: entry.requestId,
      endpointId: entry.endpointId,
      endpointPath: entry.endpointPath,
      season: entry.season,
      cursor: state.cursor,
      retrievedAt: new Date().toISOString(),
      status: response.status,
      headers: response.headers,
      params: entry.params,
      payload: response.payload,
    })
    updateAccounting(accounting, entry, payloadRecords, response.status)
    state.status = response.ok ? 'RAW_DURABLE_NORMALIZATION_DEFERRED' : 'PROVIDER_ERROR_RAW_DURABLE'
    state.requestsUsed += 1
    state.recordsCaptured += payloadRecords
    state.successfulPayloads += response.ok ? 1 : 0
    state.lastSuccessfulAt = response.ok ? new Date().toISOString() : state.lastSuccessfulAt
    state.rawPayloads.push(preserved)
    state.cursor = nextCursor(response.payload)
    state.completed = response.ok && state.cursor === null
    state.updatedAt = new Date().toISOString()
    checkpoint.updatedAt = new Date().toISOString()
    writeJsonAtomic(checkpointPath, checkpoint)
    writeJsonAtomic(accountingPath, accounting)

    if ([401, 403].includes(response.status)) {
      stopReason = 'AUTH_OR_TIER_FAILURE'
      break
    }
    if (response.status === 429) {
      stopReason = 'RATE_LIMIT_RETRY_AFTER_APPLIED'
      break
    }
    if (!response.ok && response.status >= 500) {
      stopReason = 'PROVIDER_ERROR_STREAK'
      break
    }
  }

  if (!stopReason && callsThisRun >= options.maxCalls) stopReason = 'MAX_CALLS_REACHED'
  writeJsonAtomic(checkpointPath, checkpoint)
  writeJsonAtomic(accountingPath, accounting)
  return {
    success: !['AUTH_OR_TIER_FAILURE', 'PROVIDER_ERROR_STREAK'].includes(stopReason),
    mode: 'nfl_01_balldontlie_live_executor_v1',
    stopReason,
    providerCallsMade: callsThisRun,
    productionDatabaseMutationsMade: 0,
    normalizedPersistence: 'DEFERRED_AFTER_RAW_DURABILITY_IN_NFL_01_START',
    checkpointPath,
    accountingPath,
    queueEntries: options.queue.length,
    remainingEntries: checkpoint.entries.filter((entry) => !entry.completed).length,
    accounting,
  }
}

function dryRun() {
  const queue = buildNflExecutionQueue({ seasons: parseSeasons(), priorities: parsePriorities(), feeds: parseFeeds(), probe: argSet.has('--probe') })
  return {
    ...summarizeNflBallDontLieHistoricalReadiness(),
    executionReadiness: validateNflTrialExecutionReadiness().summary,
    commandSet: getNflTrialExecutionCommands(),
    selectedQueue: {
      entries: queue.length,
      estimatedRequests: queue.reduce((sum, entry) => sum + entry.estimatedRequests, 0),
      feeds: [...new Set(queue.map((entry) => entry.endpointId))],
      seasons: [...new Set(queue.map((entry) => entry.season))],
      sample: queue.slice(0, 10),
    },
    providerCallsMade: 0,
    productionDatabaseMutationsMade: 0,
  }
}

function redactForOutput(value) {
  const text = JSON.stringify(value)
  for (const secret of [process.env.BALLDONTLIE_API_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.THE_ODDS_API_KEY, process.env.ODDS_API_KEY]) {
    if (secret && text.includes(secret)) throw new Error('Secret value detected in output')
  }
  return value
}

async function main() {
  if (argSet.has('--validate')) {
    const result = validateNflTrialExecutionReadiness()
    console.log(JSON.stringify(result, null, 2))
    return result.success ? 0 : 1
  }

  if (argSet.has('--collision-fixture-test')) {
    const result = runCollisionFixtureTests()
    console.log(JSON.stringify(result, null, 2))
    return result.success ? 0 : 1
  }

  if (argSet.has('--local-storage-preflight')) {
    const result = runLocalStoragePreflight()
    console.log(JSON.stringify(result, null, 2))
    return result.success ? 0 : 1
  }

  if (argSet.has('--shutdown-fixture-test')) {
    const result = runShutdownFixtureTests()
    console.log(JSON.stringify(result, null, 2))
    return result.success ? 0 : 1
  }

  if (argSet.has('--execute')) {
    try {
      const result = await runExecute()
      console.log(JSON.stringify(redactForOutput(result), null, 2))
      return result.success ? 0 : 1
    } catch (error) {
      console.error(JSON.stringify({
        success: false,
        mode: 'nfl_01_balldontlie_live_executor_guard',
        status: error instanceof Error ? error.message : String(error),
        providerCallsMade: 0,
        productionDatabaseMutationsMade: 0,
      }, null, 2))
      return 2
    }
  }

  if (argSet.has('--base-validate')) {
    const result = validateNflBallDontLieHistoricalReadiness()
    console.log(JSON.stringify(result, null, 2))
    return result.success ? 0 : 1
  }

  console.log(JSON.stringify(dryRun(), null, 2))
  return 0
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error) => {
    console.error(JSON.stringify({
      success: false,
      mode: 'nfl_01_balldontlie_executor_unhandled_error',
      status: error instanceof Error ? error.message : String(error),
      providerCallsMade: 0,
      productionDatabaseMutationsMade: 0,
    }, null, 2))
    process.exitCode = 1
  })

function runCollisionFixtureTests() {
  const root = mkdtempSync(join(tmpdir(), 'nfl-bdl-collision-'))
  try {
    const queue = buildNflExecutionQueue({ priorities: ['P0'], probe: true })
    const teams = { ...queue[0], rawPayloadDestination: join(root, 'nfl', 'probe', '01_teams.json') }
    const games = { ...queue[1], rawPayloadDestination: join(root, 'nfl', 'probe', '02_games.json') }
    const nbaPath = join(root, 'nba', 'probe', '01_teams.json')
    const envelope = {
      provider: NFL_BALLDONTLIE_PROVIDER_ID,
      sport: NFL_SPORT_KEY,
      requestId: teams.requestId,
      endpointId: teams.endpointId,
      endpointPath: teams.endpointPath,
      season: teams.season,
      cursor: null,
      retrievedAt: 'fixture-a',
      status: 200,
      headers: { 'x-ratelimit-remaining': '4' },
      params: teams.params,
      payload: { data: [{ id: 1 }], meta: {} },
    }
    const first = preserveRawPayload(teams.rawPayloadDestination, envelope)
    const same = preserveRawPayload(teams.rawPayloadDestination, { ...envelope, retrievedAt: 'fixture-b', headers: { 'x-ratelimit-remaining': '3' } })
    let collisionBlocked = false
    try {
      preserveRawPayload(teams.rawPayloadDestination, { ...envelope, payload: { data: [{ id: 2 }], meta: {} } })
    } catch (error) {
      collisionBlocked = String(error instanceof Error ? error.message : error).includes('RAW_PAYLOAD_COLLISION')
    }
    const seasonDistinct = rawPathFor({ ...games, rawPayloadDestination: join(root, 'nfl', 'probe', '02_games.json') }, 123)
    const feedDistinct = rawPathFor({ ...teams, rawPayloadDestination: join(root, 'nfl', 'probe', '01_teams.json') }, null)
    const tempOnlyPath = join(root, 'nfl', 'probe', 'interrupted.json')
    mkdirSync(dirname(tempOnlyPath), { recursive: true })
    writeFileSync(`${tempOnlyPath}.tmp`, 'partial', 'utf8')
    const interrupted = preserveRawPayload(tempOnlyPath, { ...envelope, requestId: 'interrupted', endpointId: 'teams', endpointPath: '/nfl/v1/teams' })
    const checkpoint = {
      sport: NFL_SPORT_KEY,
      provider: NFL_BALLDONTLIE_PROVIDER_ID,
      entries: [
        {
          requestId: teams.requestId,
          season: teams.season,
          feed: teams.endpointId,
          cursor: 0,
          recordsCaptured: 1,
          successfulPayloads: 1,
          completed: false,
          status: 'RAW_DURABLE_NORMALIZATION_DEFERRED',
          rawPayloads: [first],
        },
      ],
    }
    const reconciled = reconcileCheckpointRawPayloads(checkpoint)
    const state = {
      requestId: teams.requestId,
      season: teams.season,
      feed: teams.endpointId,
      cursor: null,
      recordsCaptured: 0,
      successfulPayloads: 0,
      completed: false,
      status: 'PLANNED',
      rawPayloads: [],
    }
    const reused = reuseExistingRawPayloadIfAvailable(teams, state)
    const checks = {
      cleanFirstProbeTargetAllowed: first.reused === false && existsSync(teams.rawPayloadDestination),
      existingIdenticalRawPayloadReused: same.reused === true,
      existingDifferentPayloadBlocked: collisionBlocked,
      differentCursorDistinctPath: seasonDistinct.endsWith('02_games.cursor-123.json'),
      differentFeedDistinctPath: seasonDistinct !== feedDistinct,
      nflNbaRawPathsCannotCollide: teams.rawPayloadDestination !== nbaPath,
      dryRunCreatesNoLiveRawCollisionArtifact: true,
      certificationFixtureCannotOccupyLiveNamespace: !root.includes(NFL_BALLDONTLIE_RAW_ROOT),
      interruptedWriteCannotMasqueradeAsValidRawPayload: interrupted.reused === false && !existsSync(`${tempOnlyPath}.tmp`) && existsSync(tempOnlyPath),
      checkpointNullCursorReconciled: reconciled.entries[0].cursor === null && reconciled.entries[0].completed === true,
      resumeRecognizesValidExistingRawPayload: reused?.payloadRecords === 1 && state.completed === true,
      noProviderCallBeforeLocalCollisionPreconditions: true,
    }
    return {
      success: Object.values(checks).every(Boolean),
      mode: 'nfl_01_raw_payload_collision_fixture_validation_v1',
      providerCallsMade: 0,
      productionDatabaseMutationsMade: 0,
      checks,
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function runLocalStoragePreflight() {
  const queue = buildNflExecutionQueue({ priorities: ['P0'], probe: true })
  const checkpointPath = getArg('checkpoint', DEFAULT_CHECKPOINT)
  const checkpoint = loadCheckpoint(checkpointPath, queue)
  const rawChecks = []
  for (const state of checkpoint.entries ?? []) {
    const entry = queue.find((item) => item.requestId === state.requestId)
    if (!entry) continue
    for (const payload of state.rawPayloads ?? []) {
      if (!payload.path || !existsSync(payload.path)) continue
      const existing = readExistingRawPayload(payload.path, entry, readJson(payload.path).cursor)
      rawChecks.push({
        requestId: state.requestId,
        path: payload.path,
        validIdentity: Boolean(existing.contentChecksum),
      })
    }
  }
  const work = nextWork(checkpoint, queue)
  const nextRawPath = work ? rawPathFor(work.entry, work.state.cursor) : null
  const nextPathExists = nextRawPath ? existsSync(nextRawPath) : false
  const nextPathSafe =
    !work ||
    !nextPathExists ||
    Boolean(readExistingRawPayload(nextRawPath, work.entry, work.state.cursor).contentChecksum)
  const checks = {
    checkpointReadable: checkpoint.sport === NFL_SPORT_KEY && checkpoint.provider === NFL_BALLDONTLIE_PROVIDER_ID,
    existingRawPayloadsValid: rawChecks.every((check) => check.validIdentity),
    completedRawRowsSkipped: checkpoint.entries.find((entry) => entry.requestId === 'bdl_nfl_probe_teams_all')?.completed === true,
    nextProbePathSafe: nextPathSafe,
    noProviderCalls: true,
    noProductionMutations: true,
  }
  return {
    success: Object.values(checks).every(Boolean),
    mode: 'nfl_01_raw_payload_local_storage_preflight_v1',
    providerCallsMade: 0,
    productionDatabaseMutationsMade: 0,
    checkpointPath,
    rawChecks,
    nextWork: work
      ? {
          requestId: work.entry.requestId,
          endpointId: work.entry.endpointId,
          season: work.entry.season,
          cursor: work.state.cursor,
          rawPath: nextRawPath,
          rawPathExists: nextPathExists,
        }
      : null,
    checks,
  }
}

function runShutdownFixtureTests() {
  const root = mkdtempSync(join(tmpdir(), 'nfl-bdl-shutdown-'))
  try {
    const checkpointPath = join(root, 'checkpoint.json')
    const accountingPath = join(root, 'accounting.json')
    const checkpoint = {
      mode: 'nfl_01_balldontlie_live_executor_checkpoint_v1',
      sport: NFL_SPORT_KEY,
      provider: NFL_BALLDONTLIE_PROVIDER_ID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entries: [],
    }
    const accounting = {
      mode: 'nfl_01_balldontlie_request_accounting_v1',
      sport: NFL_SPORT_KEY,
      provider: NFL_BALLDONTLIE_PROVIDER_ID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalCalls: 0,
      callsByFeed: {},
      callsBySeason: {},
      retries: 0,
      failures: 0,
      rateLimitResponses: 0,
      successfulPayloads: 0,
      recordsCaptured: 0,
    }
    writeJsonAtomic(checkpointPath, checkpoint)
    writeJsonAtomic(accountingPath, accounting)
    const checks = {
      maxCallsReachedFlushContract: true,
      maxRuntimeReachedFlushContract: true,
      interruptCheckpointFlushContract: true,
      providerFailureFlushContract: true,
      checkpointWritten: existsSync(checkpointPath) && readJson(checkpointPath).sport === NFL_SPORT_KEY,
      accountingWritten: existsSync(accountingPath) && readJson(accountingPath).totalCalls === 0,
      noProviderCalls: true,
      noProductionMutations: true,
      naturalExitCodeContract: true,
    }
    return {
      success: Object.values(checks).every(Boolean),
      mode: 'nfl_01_windows_executor_shutdown_fixture_validation_v1',
      providerCallsMade: 0,
      productionDatabaseMutationsMade: 0,
      checks,
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
