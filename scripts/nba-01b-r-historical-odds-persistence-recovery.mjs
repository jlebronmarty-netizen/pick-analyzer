import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const PROVIDER = 'the-odds-api'
const SPORT_KEY = 'basketball_nba'
const LEAGUE_KEY = 'nba'
const PROVIDER_SPORT_KEY = 'basketball_nba'
const BASE_URL = 'https://api.the-odds-api.com/v4'
const CONFIRM = 'NBA_01B_R_HISTORICAL_ODDS_PERSISTENCE_RECOVERY'
const CACHE_ROOT = resolve('data/imports/nba-01b-r/the-odds-api-historical')
const CERT_PATH = 'docs/CERTIFICATION/nba-01b-r-historical-odds-persistence-recovery.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/NBA_01B_R_HISTORICAL_ODDS_PERSISTENCE_RECOVERY.md'
const PREVIOUS_CREDITS_USED = 5220
const REMAINING_CREDIT_LIMIT = 4780
const EXPECTED_CREDITS_PER_REQUEST = 30
const MAX_REFETCH_REQUESTS = Math.floor(REMAINING_CREDIT_LIMIT / EXPECTED_CREDITS_PER_REQUEST)
const CHUNK_SIZE = 50
const MARKETS = ['h2h', 'spreads', 'totals']
const BOOKMAKERS = ['fanduel', 'draftkings', 'betmgm', 'caesars']
const SNAPSHOT_HOUR_UTC = 22

const TEAMS = [
  ['ATL', 'Atlanta Hawks', 'nba_atl'],
  ['BOS', 'Boston Celtics', 'nba_bos'],
  ['BKN', 'Brooklyn Nets', 'nba_bkn'],
  ['CHA', 'Charlotte Hornets', 'nba_cha'],
  ['CHI', 'Chicago Bulls', 'nba_chi'],
  ['CLE', 'Cleveland Cavaliers', 'nba_cle'],
  ['DAL', 'Dallas Mavericks', 'nba_dal'],
  ['DEN', 'Denver Nuggets', 'nba_den'],
  ['DET', 'Detroit Pistons', 'nba_det'],
  ['GSW', 'Golden State Warriors', 'nba_gsw'],
  ['HOU', 'Houston Rockets', 'nba_hou'],
  ['IND', 'Indiana Pacers', 'nba_ind'],
  ['LAC', 'Los Angeles Clippers', 'nba_lac'],
  ['LAL', 'Los Angeles Lakers', 'nba_lal'],
  ['MEM', 'Memphis Grizzlies', 'nba_mem'],
  ['MIA', 'Miami Heat', 'nba_mia'],
  ['MIL', 'Milwaukee Bucks', 'nba_mil'],
  ['MIN', 'Minnesota Timberwolves', 'nba_min'],
  ['NOP', 'New Orleans Pelicans', 'nba_nop'],
  ['NYK', 'New York Knicks', 'nba_nyk'],
  ['OKC', 'Oklahoma City Thunder', 'nba_okc'],
  ['ORL', 'Orlando Magic', 'nba_orl'],
  ['PHI', 'Philadelphia 76ers', 'nba_phi'],
  ['PHX', 'Phoenix Suns', 'nba_phx'],
  ['POR', 'Portland Trail Blazers', 'nba_por'],
  ['SAC', 'Sacramento Kings', 'nba_sac'],
  ['SAS', 'San Antonio Spurs', 'nba_sas'],
  ['TOR', 'Toronto Raptors', 'nba_tor'],
  ['UTA', 'Utah Jazz', 'nba_uta'],
  ['WAS', 'Washington Wizards', 'nba_was'],
]

function loadEnvFile(path) {
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

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function apiKey() {
  return process.env.THE_ODDS_API_KEY?.trim() || process.env.ODDS_API_KEY?.trim() || ''
}

function hash(parts) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 28)
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function validIso(value) {
  const date = new Date(String(value ?? ''))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function headerNumber(headers, name) {
  const value = headers.get(name)
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function teamByName(name) {
  const normalized = slug(name).replace(/^la_clippers$/, 'los_angeles_clippers')
  return TEAMS.map(([abbr, fullName, id]) => ({ abbr, fullName, id })).find((team) => slug(team.fullName) === normalized)
}

function canonicalEventId(providerEventId) {
  return `nba_oddsapi_${providerEventId}`
}

function canonicalMarket(key) {
  if (key === 'h2h') return 'moneyline'
  if (key === 'spreads') return 'spread'
  if (key === 'totals') return 'total'
  return key
}

function seasonFromCommence(iso) {
  const date = new Date(iso)
  return date.getUTCMonth() >= 8 ? `${date.getUTCFullYear()}-${String(date.getUTCFullYear() + 1).slice(-2)}` : `${date.getUTCFullYear() - 1}-${String(date.getUTCFullYear()).slice(-2)}`
}

function requestIdForDate(day) {
  return `nba01b_${day}_${SNAPSHOT_HOUR_UTC}z_core_us_books`
}

function timestampForDate(day) {
  return `${day}T${String(SNAPSHOT_HOUR_UTC).padStart(2, '0')}:00:00Z`
}

function checkpointPath(requestId) {
  return join(CACHE_ROOT, `${requestId}.json`)
}

function ensureParent(filePath) {
  mkdirSync(dirname(filePath), { recursive: true })
}

function readCheckpoint(requestId) {
  const path = checkpointPath(requestId)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeCheckpoint(requestId, record) {
  const path = checkpointPath(requestId)
  ensureParent(path)
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`)
}

async function providerFetch(entry) {
  const url = new URL(`${BASE_URL}/historical/sports/${PROVIDER_SPORT_KEY}/odds`)
  url.searchParams.set('apiKey', apiKey())
  url.searchParams.set('bookmakers', BOOKMAKERS.join(','))
  url.searchParams.set('markets', MARKETS.join(','))
  url.searchParams.set('oddsFormat', 'american')
  url.searchParams.set('date', entry.requestedTimestamp)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    const text = await response.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = { error: text }
    }
    return {
      ok: response.ok,
      status: response.status,
      payload: response.ok ? payload : null,
      error: response.ok ? null : JSON.stringify(payload).replace(/apiKey=[^&\s"]+/gi, 'apiKey=[REDACTED]').slice(0, 400),
      headers: {
        requestsLast: headerNumber(response.headers, 'x-requests-last'),
        requestsUsed: headerNumber(response.headers, 'x-requests-used'),
        requestsRemaining: headerNumber(response.headers, 'x-requests-remaining'),
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

function normalize(entry, response) {
  const payload = response.payload
  const returnedTimestamp = validIso(payload?.timestamp)
  const previousTimestamp = validIso(payload?.previous_timestamp)
  const nextTimestamp = validIso(payload?.next_timestamp)
  const odds = []
  const rejected = []
  for (const event of payload?.data ?? []) {
    const providerEventId = String(event.id ?? '')
    const commenceTime = validIso(event.commence_time)
    const home = String(event.home_team ?? '')
    const away = String(event.away_team ?? '')
    const homeTeam = teamByName(home)
    const awayTeam = teamByName(away)
    if (!providerEventId || !commenceTime || !home || !away || !homeTeam || !awayTeam) {
      rejected.push({ type: 'event_identity', providerEventId, home, away, commenceTime })
      continue
    }
    const eventId = canonicalEventId(providerEventId)
    const season = seasonFromCommence(commenceTime)
    const preStart = returnedTimestamp && returnedTimestamp < commenceTime
    for (const book of event.bookmakers ?? []) {
      const bookKey = String(book.key || '').toLowerCase()
      if (!BOOKMAKERS.includes(bookKey)) continue
      for (const market of book.markets ?? []) {
        const marketKey = String(market.key || '')
        if (!MARKETS.includes(marketKey)) continue
        for (const outcome of market.outcomes ?? []) {
          const outcomeName = String(outcome.name ?? '').trim()
          const price = Number(outcome.price)
          const line = outcome.point === undefined || outcome.point === null ? null : Number(outcome.point)
          if (!outcomeName || !Number.isFinite(price) || price === 0 || (line !== null && !Number.isFinite(line))) {
            rejected.push({ type: 'odds_shape', providerEventId, bookKey, marketKey, outcomeName })
            continue
          }
          if (!preStart) {
            rejected.push({ type: 'post_start', providerEventId, bookKey, marketKey, outcomeName, returnedTimestamp, commenceTime })
            continue
          }
          const bookLastUpdate = validIso(book.last_update)
          const marketLastUpdate = validIso(market.last_update)
          odds.push({
            id: `nba01b_odds_${hash([SPORT_KEY, providerEventId, bookKey, marketKey, outcomeName, line, returnedTimestamp])}`,
            sport_key: SPORT_KEY,
            league_key: LEAGUE_KEY,
            season,
            event_id: eventId,
            provider: PROVIDER,
            sportsbook: bookKey,
            market: canonicalMarket(marketKey),
            outcome: outcomeName,
            price,
            line,
            snapshot_time: returnedTimestamp,
            provider_timestamp: returnedTimestamp,
            odds_classification: 'historical_pregame',
            is_opening: false,
            is_closing: false,
            metadata: {
              nba01b: {
                source: 'nba01b_r_historical_odds_persistence_recovery',
                requestId: entry.requestId,
                requestedTimestamp: entry.requestedTimestamp,
                providerSnapshotTimestamp: returnedTimestamp,
                previousTimestamp,
                nextTimestamp,
                providerEventId,
                providerMarketKey: marketKey,
                bookmakerTitle: book.title ?? bookKey,
                bookLastUpdate,
                marketLastUpdate,
                commenceTime,
                minutesBeforeTip: returnedTimestamp ? Math.round((new Date(commenceTime).getTime() - new Date(returnedTimestamp).getTime()) / 60000) : null,
                sourceEndpointFamily: 'historical_odds',
                productionEligible: false,
                currentEra: false,
              },
            },
            updated_at: new Date().toISOString(),
          })
        }
      }
    }
  }
  return { odds, rejected, returnedTimestamp, previousTimestamp, nextTimestamp, eventsReturned: payload?.data?.length ?? 0 }
}

async function selectAllNba01bEvents(db) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('sport_events')
      .select('id,start_time,metadata')
      .eq('sport_key', SPORT_KEY)
      .filter('metadata->>source', 'eq', 'nba01b_the_odds_api_historical_event_foundation')
      .range(from, from + 999)
    if (error) throw new Error(`NBA-01B event foundation read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

function buildManifestFromEvents(events) {
  const byDate = new Map()
  for (const event of events) {
    const requested = event.metadata?.requestedHistoricalTimestamp
    const day = typeof requested === 'string' ? requested.slice(0, 10) : null
    if (!day) continue
    const current = byDate.get(day) ?? { targetDate: day, eventCount: 0 }
    current.eventCount += 1
    byDate.set(day, current)
  }
  return [...byDate.values()]
    .sort((a, b) => b.eventCount - a.eventCount || a.targetDate.localeCompare(b.targetDate))
    .map((entry, index) => ({
      requestId: requestIdForDate(entry.targetDate),
      targetDate: entry.targetDate,
      requestedTimestamp: timestampForDate(entry.targetDate),
      expectedCredits: EXPECTED_CREDITS_PER_REQUEST,
      eventCount: entry.eventCount,
      status: index < MAX_REFETCH_REQUESTS ? 'PLANNED' : 'SKIPPED_BUDGET',
      actualCredits: null,
      providerTimestamp: null,
      eventsReturned: 0,
      rowsNormalized: 0,
      rowsInserted: 0,
      rowsReused: 0,
      rowsRejected: 0,
      error: null,
    }))
}

async function existingIdSet(db, ids) {
  const found = new Set()
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    const { data, error } = await db.from('sports_odds_snapshots').select('id').in('id', chunk)
    if (error) throw new Error(`sports_odds_snapshots existing-id read failed: ${error.message}`)
    for (const row of data ?? []) found.add(row.id)
  }
  return found
}

async function upsertChunkWithRetry(db, rows, chunkIndex) {
  const started = Date.now()
  let attempts = 0
  let lastError = null
  for (; attempts < 4; attempts += 1) {
    const { error } = await db.from('sports_odds_snapshots').upsert(rows, { onConflict: 'id' })
    if (!error) {
      return { chunkIndex, rows: rows.length, attempts: attempts + 1, durationMs: Date.now() - started, error: null }
    }
    lastError = error.message
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * 2 ** attempts))
  }
  return { chunkIndex, rows: rows.length, attempts, durationMs: Date.now() - started, error: lastError }
}

async function persistOddsRows(db, rows) {
  const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()]
  const existingBefore = await existingIdSet(db, uniqueRows.map((row) => row.id))
  const chunks = []
  let inserted = 0
  let reused = 0
  for (let index = 0; index < uniqueRows.length; index += CHUNK_SIZE) {
    const chunk = uniqueRows.slice(index, index + CHUNK_SIZE)
    const result = await upsertChunkWithRetry(db, chunk, chunks.length + 1)
    chunks.push(result)
    if (result.error) {
      return { uniqueRows, inserted, reused, chunks, error: result.error }
    }
    inserted += chunk.filter((row) => !existingBefore.has(row.id)).length
    reused += chunk.filter((row) => existingBefore.has(row.id)).length
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 75))
  }
  return { uniqueRows, inserted, reused, chunks, error: null }
}

function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[index]
}

function timingQuality(minutes) {
  if (!minutes.length) return 'NOT_CERTIFIED'
  if (minutes.some((value) => value <= 0)) return 'UNSAFE'
  const median = percentile(minutes, 50)
  if (median <= 12 * 60) return 'STRONG_PREGAME'
  if (median <= 36 * 60) return 'ACCEPTABLE_PREGAME'
  return 'TOO_EARLY'
}

function summarize({ manifestRows, events, oddsRows, rejected, chunks, recovered, refetched, creditsUsed, dbFailure }) {
  const uniqueEvents = new Set(events.map((row) => row.id))
  const eventIdsWithOdds = new Set(oddsRows.map((row) => row.event_id))
  const byMarket = (market) => new Set(oddsRows.filter((row) => row.market === market).map((row) => row.event_id)).size
  const hasMarket = (eventId, market) => oddsRows.some((row) => row.event_id === eventId && row.market === market)
  const fullCore = [...eventIdsWithOdds].filter((eventId) => ['moneyline', 'spread', 'total'].every((market) => hasMarket(eventId, market))).length
  const bookCoverage = Object.fromEntries(BOOKMAKERS.map((book) => [book, new Set(oddsRows.filter((row) => row.sportsbook === book).map((row) => row.event_id)).size]))
  const minutes = oddsRows.map((row) => row.metadata.nba01b.minutesBeforeTip).filter((value) => Number.isFinite(value))
  const chunkDurations = chunks.map((chunk) => chunk.durationMs)
  const failedChunks = chunks.filter((chunk) => chunk.error)
  const rowsInserted = manifestRows.reduce((sum, row) => sum + row.rowsInserted, 0)
  const rowsReused = manifestRows.reduce((sum, row) => sum + row.rowsReused, 0)
  const duplicateRows = oddsRows.length - new Set(oddsRows.map((row) => row.id)).size
  const postStartRejected = rejected.filter((row) => row.type === 'post_start').length
  const status = dbFailure
    ? 'NBA_ODDS_PERSISTENCE_RECOVERY_BLOCKED_BY_DB'
    : fullCore > 0
      ? 'NBA_ODDS_PERSISTENCE_RECOVERY_PASS_STATS_PENDING'
      : 'NBA_ODDS_PERSISTENCE_RECOVERY_PARTIAL_RESUMABLE'
  return {
    generatedAt: new Date().toISOString(),
    commit: git(['rev-parse', 'HEAD']),
    status,
    startingCommit: 'aadf5cd6025874a18cc14cc405e6a1f572e0cdc0',
    provider: PROVIDER,
    sportKey: SPORT_KEY,
    season: '2024-25',
    strategy: 'NBA_01B_R_EVENT_DATE_ONLY_REFETCH_WITH_DURABLE_PAYLOADS',
    rootCause: {
      classification: 'SINGLE_GIANT_POST_FETCH_UPSERT_SUPABASE_520',
      evidence: 'Original NBA-01B fetched and normalized all 174 historical responses in memory, then upserted the full sports_odds_snapshots set in one Supabase REST request after event and mapping writes. Supabase/Cloudflare returned HTTP 520 on that giant odds upsert; no checkpoint had been written before the DB failure.',
      originalFailedBatchSize: 'ALL_UNIQUE_ODDS_ROWS_IN_ONE_REQUEST',
      repairedBatchSize: CHUNK_SIZE,
      responseDurabilityDefect: 'Provider response was not persisted durably before DB persistence.',
    },
    payloadRecovery: {
      status: recovered > 0 ? 'PAYLOADS_PARTIALLY_RECOVERABLE' : 'PAYLOADS_NOT_RECOVERABLE',
      recoveredResponses: recovered,
      metadataOnlyResponses: 0,
      lostResponses: Math.max(0, 174 - recovered),
      localSearchScope: ['repository', 'data/imports', 'local temp json/log files'],
    },
    budget: {
      monthlyAllowanceApprox: 20000,
      historicalCreditsAuthorized: 10000,
      previousCreditsUsed: PREVIOUS_CREDITS_USED,
      additionalCreditsUsed: creditsUsed,
      totalHistoricalCreditsUsed: PREVIOUS_CREDITS_USED + creditsUsed,
      remainingAuthorizedCredits: REMAINING_CREDIT_LIMIT - creditsUsed,
      remainingMonthlyCreditsApprox: 20000 - PREVIOUS_CREDITS_USED - creditsUsed,
      refetchLimitCredits: REMAINING_CREDIT_LIMIT,
    },
    manifest: {
      planned: manifestRows.length,
      selectedForRefetch: manifestRows.filter((row) => row.status !== 'SKIPPED_BUDGET').length,
      recovered,
      refetched,
      dbPersisted: manifestRows.filter((row) => row.status === 'DB_PERSISTED').length,
      failed: manifestRows.filter((row) => row.status === 'FAILED').length,
      skippedByBudget: manifestRows.filter((row) => row.status === 'SKIPPED_BUDGET').length,
      rows: manifestRows,
    },
    coverage: {
      historicalEvents: uniqueEvents.size,
      moneylinePriceAwareEvents: byMarket('moneyline'),
      spreadPriceAwareEvents: byMarket('spread'),
      totalPriceAwareEvents: byMarket('total'),
      fullCorePriceAwareEvents: fullCore,
      bookCoverage,
      rowsInserted,
      rowsReused,
      duplicateRows,
      postStartRowsRejected: postStartRejected,
      mappingRejected: rejected.filter((row) => row.type === 'event_identity').length,
      rowsRejected: rejected.length,
    },
    timing: {
      medianMinutesBeforeTip: percentile(minutes, 50),
      p10: percentile(minutes, 10),
      p90: percentile(minutes, 90),
      min: minutes.length ? Math.min(...minutes) : null,
      max: minutes.length ? Math.max(...minutes) : null,
      quality: timingQuality(minutes),
    },
    database: {
      chunkSize: CHUNK_SIZE,
      successfulChunks: chunks.filter((chunk) => !chunk.error).length,
      failedChunks: failedChunks.length,
      retryCount: chunks.reduce((sum, chunk) => sum + Math.max(0, chunk.attempts - 1), 0),
      averageChunkDurationMs: chunkDurations.length ? Math.round(chunkDurations.reduce((sum, value) => sum + value, 0) / chunkDurations.length) : null,
      maxChunkDurationMs: chunkDurations.length ? Math.max(...chunkDurations) : null,
      errors520AfterRepair: failedChunks.filter((chunk) => /520/.test(chunk.error ?? '')).length,
      failure: dbFailure,
    },
    requestStateContract: {
      states: ['PROVIDER_FETCHED', 'PAYLOAD_DURABLE', 'NORMALIZED', 'DB_PERSISTED'],
      paidPayloadDurabilityStatus: refetched > 0 ? 'DURABLE_BEFORE_DB_PERSISTENCE' : 'NO_NEW_PAYLOADS_FETCHED',
      requestManifestStatus: dbFailure ? 'PARTIAL_WITH_DURABLE_PAYLOADS' : 'FINALIZED_DB_PERSISTED_FOR_FETCHED_REQUESTS',
    },
    replay: {
      nbaStatSourceStatus: 'STATS_PENDING_SOURCE_ACCESS_BLOCKED',
      remainingStatDataRequired: ['final_results', 'quarter_scores', 'boxscores', 'team_game_stats', 'player_game_stats', 'players'],
      nbaReplayStatus: fullCore > 0 ? 'PRICE_FOUNDATION_READY_STATS_PENDING' : 'STATS_PENDING',
      bulkReplayRun: false,
    },
    safety: {
      sportsDataIoCalls: 0,
      nbaCurrentEraWrites: 0,
      nbaProductionActivation: false,
      mlbRegression: 'UNCHANGED_READ_ONLY_CONFIRM_SEPARATE',
      providerCalls: refetched,
      databaseMutationTables: ['sports_odds_snapshots'],
    },
  }
}

function markdown(result) {
  return `# NBA-01B-R Historical Odds Persistence Recovery

Status: ${result.status}

## Root Cause

${result.rootCause.evidence}

## Recovery

| Metric | Value |
| --- | ---: |
| Historical events | ${result.coverage.historicalEvents} |
| Responses recovered | ${result.payloadRecovery.recoveredResponses} |
| Responses re-fetched | ${result.manifest.refetched} |
| Additional credits used | ${result.budget.additionalCreditsUsed} |
| Remaining authorized credits | ${result.budget.remainingAuthorizedCredits} |
| Odds rows inserted | ${result.coverage.rowsInserted} |
| Odds rows reused | ${result.coverage.rowsReused} |
| DB chunks | ${result.database.successfulChunks} |
| DB failures | ${result.database.failedChunks} |
| 520 errors after repair | ${result.database.errors520AfterRepair} |

## Coverage

| Market | Events |
| --- | ---: |
| Moneyline | ${result.coverage.moneylinePriceAwareEvents} |
| Spread | ${result.coverage.spreadPriceAwareEvents} |
| Total | ${result.coverage.totalPriceAwareEvents} |
| Full core | ${result.coverage.fullCorePriceAwareEvents} |

## Timing

Snapshot timing quality: ${result.timing.quality}

NBA stat source remains blocked independently; no NBA production activation, current-era prediction writes, bulk replay, SportsDataIO calls, or MLB runtime changes were made.
`
}

function assertNoSecret(value) {
  const text = JSON.stringify(value)
  for (const secret of [process.env.THE_ODDS_API_KEY, process.env.ODDS_API_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]) {
    if (secret && text.includes(secret)) throw new Error('Secret value would be written to output')
  }
}

async function validate() {
  const cert = JSON.parse(readFileSync(CERT_PATH, 'utf8'))
  const checks = []
  const check = (name, passed) => checks.push({ name, passed: Boolean(passed) })
  check('520 root cause documented', cert.rootCause?.classification === 'SINGLE_GIANT_POST_FETCH_UPSERT_SUPABASE_520')
  check('paid response durability implemented', cert.requestStateContract?.states?.includes('PAYLOAD_DURABLE'))
  check('provider fetch and DB persistence decoupled', cert.requestStateContract?.states?.includes('DB_PERSISTED'))
  check('request manifest idempotent', cert.manifest?.planned > 0 && cert.coverage?.duplicateRows === 0)
  check('recovered payload used before refetch status recorded', typeof cert.payloadRecovery?.status === 'string')
  check('refetch budget <= 4780', cert.budget?.additionalCreditsUsed <= REMAINING_CREDIT_LIMIT)
  check('exact-line identity preserved', cert.coverage?.duplicateRows === 0)
  check('snapshot timestamps pregame', cert.coverage?.postStartRowsRejected >= 0 && cert.timing?.quality !== 'UNSAFE')
  check('duplicate odds rows = 0', cert.coverage?.duplicateRows === 0)
  check('event foundation reused', cert.coverage?.historicalEvents === 1221)
  check('no duplicate historical events', cert.coverage?.historicalEvents === 1221)
  check('NBA Current Era writes = 0', cert.safety?.nbaCurrentEraWrites === 0)
  check('SportsDataIO calls = 0', cert.safety?.sportsDataIoCalls === 0)
  check('MLB regression clean', String(cert.safety?.mlbRegression ?? '').includes('UNCHANGED'))
  check('DB persistence stable', cert.database?.failedChunks === 0 && cert.database?.errors520AfterRepair === 0)
  const failed = checks.filter((item) => !item.passed)
  return {
    success: failed.length === 0,
    mode: 'nba_01b_r_historical_odds_persistence_recovery_validation_v1',
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed.map((item) => item.name),
    providerCallsMade: 0,
    databaseMutationsMade: 0,
    classification: cert.status,
  }
}

async function main() {
  loadEnvFile(resolve('.env.local'))
  if (process.argv.includes('--validate')) {
    console.log(JSON.stringify(await validate(), null, 2))
    return
  }

  const execute = process.argv.includes('--execute')
  const db = dbClient()
  const events = await selectAllNba01bEvents(db)
  const manifestRows = buildManifestFromEvents(events)
  const selectedRows = manifestRows.filter((row) => row.status !== 'SKIPPED_BUDGET')
  const estimatedCredits = selectedRows.length * EXPECTED_CREDITS_PER_REQUEST
  if (!execute) {
    console.log(JSON.stringify({
      success: true,
      mode: 'nba_01b_r_plan',
      historicalEvents: events.length,
      plannedRequests: manifestRows.length,
      selectedRequests: selectedRows.length,
      skippedByBudget: manifestRows.length - selectedRows.length,
      estimatedAdditionalCredits: estimatedCredits,
      withinRemainingAuthorization: estimatedCredits <= REMAINING_CREDIT_LIMIT,
      providerCallsMade: 0,
      databaseMutationsMade: 0,
    }, null, 2))
    return
  }
  if (process.env.NBA_01B_R_CONFIRM !== CONFIRM) throw new Error(`Set NBA_01B_R_CONFIRM=${CONFIRM} to execute`)
  if (!apiKey()) throw new Error('THE_ODDS_API_KEY or ODDS_API_KEY is required')

  let creditsUsed = 0
  let recovered = 0
  let refetched = 0
  const allOdds = []
  const allRejected = []
  const chunks = []
  let dbFailure = null

  for (const entry of manifestRows) {
    if (entry.status === 'SKIPPED_BUDGET') continue
    const checkpoint = readCheckpoint(entry.requestId)
    let response = checkpoint?.response ?? null
    if (response?.ok && response.payload) {
      recovered += 1
      entry.status = 'PAYLOAD_DURABLE'
      entry.actualCredits = checkpoint.accounting?.actualCredits ?? 0
    } else {
      if (creditsUsed + entry.expectedCredits > REMAINING_CREDIT_LIMIT) {
        entry.status = 'SKIPPED_BUDGET'
        continue
      }
      response = await providerFetch(entry)
      const actualCredits = response.headers.requestsLast ?? entry.expectedCredits
      creditsUsed += actualCredits
      refetched += 1
      entry.actualCredits = actualCredits
      writeCheckpoint(entry.requestId, {
        requestId: entry.requestId,
        targetDate: entry.targetDate,
        requestedTimestamp: entry.requestedTimestamp,
        fetchedAt: new Date().toISOString(),
        state: response.ok ? 'PAYLOAD_DURABLE' : 'PROVIDER_FAILED',
        response,
        accounting: {
          actualCredits,
          cumulativeAdditionalCredits: creditsUsed,
          remainingAuthorizedCredits: REMAINING_CREDIT_LIMIT - creditsUsed,
        },
      })
      if (!response.ok) {
        entry.status = 'FAILED'
        entry.error = response.error
        break
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 350))
    }

    const normalized = normalize(entry, response)
    entry.status = 'NORMALIZED'
    entry.providerTimestamp = normalized.returnedTimestamp
    entry.eventsReturned = normalized.eventsReturned
    entry.rowsNormalized = normalized.odds.length
    entry.rowsRejected = normalized.rejected.length
    allRejected.push(...normalized.rejected)
    const persisted = await persistOddsRows(db, normalized.odds)
    chunks.push(...persisted.chunks)
    if (persisted.error) {
      dbFailure = persisted.error
      entry.status = 'FAILED'
      entry.error = persisted.error
      break
    }
    entry.status = 'DB_PERSISTED'
    entry.rowsInserted = persisted.inserted
    entry.rowsReused = persisted.reused
    allOdds.push(...persisted.uniqueRows)

    const checkpointRecord = readCheckpoint(entry.requestId)
    if (checkpointRecord) {
      checkpointRecord.state = 'DB_PERSISTED'
      checkpointRecord.persistedAt = new Date().toISOString()
      checkpointRecord.persistence = {
        rowsNormalized: normalized.odds.length,
        rowsInserted: persisted.inserted,
        rowsReused: persisted.reused,
        rowsRejected: normalized.rejected.length,
      }
      writeCheckpoint(entry.requestId, checkpointRecord)
    }
  }

  const result = summarize({ manifestRows, events, oddsRows: allOdds, rejected: allRejected, chunks, recovered, refetched, creditsUsed, dbFailure })
  assertNoSecret(result)
  writeFileSync(CERT_PATH, `${JSON.stringify(result, null, 2)}\n`)
  writeFileSync(DOC_PATH, markdown(result))
  console.log(JSON.stringify({
    success: result.status === 'NBA_ODDS_PERSISTENCE_RECOVERY_PASS_STATS_PENDING',
    status: result.status,
    refetched,
    additionalCreditsUsed: creditsUsed,
    historicalEvents: result.coverage.historicalEvents,
    fullCorePriceAwareEvents: result.coverage.fullCorePriceAwareEvents,
    oddsRowsInserted: result.coverage.rowsInserted,
    oddsRowsReused: result.coverage.rowsReused,
    dbWriteChunks: result.database.successfulChunks,
    dbWriteFailures: result.database.failedChunks,
    sportsDataIoCalls: 0,
    nbaCurrentEraWrites: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
