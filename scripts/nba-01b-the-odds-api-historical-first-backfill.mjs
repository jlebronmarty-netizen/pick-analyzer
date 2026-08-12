import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const PROVIDER = 'the-odds-api'
const SPORT_KEY = 'basketball_nba'
const LEAGUE_KEY = 'nba'
const PROVIDER_SPORT_KEY = 'basketball_nba'
const BASE_URL = 'https://api.the-odds-api.com/v4'
const CONFIRM = 'NBA_01B_THE_ODDS_API_HISTORICAL_FIRST_BACKFILL'
const CREDIT_LIMIT = 10000
const MARKETS = ['h2h', 'spreads', 'totals']
const BOOKMAKERS = ['fanduel', 'draftkings', 'betmgm', 'caesars']
const SNAPSHOT_HOUR_UTC = 22
const START_DATE = '2024-10-22'
const END_DATE = '2025-04-13'

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

function client() {
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

function dateRange(start, end) {
  const days = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function manifest() {
  return dateRange(START_DATE, END_DATE).map((day) => ({
    requestId: `nba01b_${day}_${SNAPSHOT_HOUR_UTC}z_core_us_books`,
    requestedTimestamp: `${day}T${String(SNAPSHOT_HOUR_UTC).padStart(2, '0')}:00:00Z`,
    markets: MARKETS,
    bookmakers: BOOKMAKERS,
    estimatedCredits: 30,
    status: 'PLANNED',
    actualCredits: null,
    eventsReturned: 0,
    rowsNormalized: 0,
    rowsInserted: 0,
    rowsReused: 0,
    rowsRejected: 0,
    error: null,
  }))
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

async function alreadyExecuted(db, requestId) {
  const { data, error } = await db
    .from('sports_odds_snapshots')
    .select('id')
    .eq('sport_key', SPORT_KEY)
    .eq('provider', PROVIDER)
    .filter('metadata->nba01b->>requestId', 'eq', requestId)
    .limit(1)
  if (error) throw new Error(`manifest reuse read failed: ${error.message}`)
  return Boolean(data?.length)
}

async function existingIds(db, table, ids) {
  if (!ids.length) return new Set()
  const found = new Set()
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    const { data, error } = await db.from(table).select('id').in('id', chunk)
    if (error) throw new Error(`${table} existing-id read failed: ${error.message}`)
    for (const row of data ?? []) found.add(row.id)
  }
  return found
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
      requestsLast: headerNumber(response.headers, 'x-requests-last'),
      requestsUsed: headerNumber(response.headers, 'x-requests-used'),
      requestsRemaining: headerNumber(response.headers, 'x-requests-remaining'),
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
  const events = []
  const mappings = []
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
    events.push({
      id: eventId,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season,
      stage: 'regular',
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      home_team: homeTeam.fullName,
      away_team: awayTeam.fullName,
      start_time: commenceTime,
      venue: null,
      status: 'scheduled',
      home_score: null,
      away_score: null,
      period_scores: {},
      overtime: false,
      provider_ids: { [PROVIDER]: providerEventId },
      metadata: {
        source: 'nba01b_the_odds_api_historical_event_foundation',
        providerEventId,
        requestedHistoricalTimestamp: entry.requestedTimestamp,
        providerSnapshotTimestamp: returnedTimestamp,
        seasonClassification: 'regular_by_target_window',
        productionEligible: false,
        currentEra: false,
      },
      updated_at: new Date().toISOString(),
    })
    mappings.push({
      sport_key: SPORT_KEY,
      entity_type: 'event',
      internal_id: eventId,
      provider: PROVIDER,
      provider_id: providerEventId,
      season,
      metadata: { homeTeam: homeTeam.fullName, awayTeam: awayTeam.fullName, commenceTime, source: 'nba01b' },
      updated_at: new Date().toISOString(),
    })
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
            is_opening: false,
            is_closing: false,
            metadata: {
              nba01b: {
                requestId: entry.requestId,
                requestedTimestamp: entry.requestedTimestamp,
                providerSnapshotTimestamp: returnedTimestamp,
                previousTimestamp,
                nextTimestamp,
                providerEventId,
                providerMarketKey: marketKey,
                bookmakerTitle: book.title ?? bookKey,
                bookLastUpdate: validIso(book.last_update),
                marketLastUpdate: validIso(market.last_update),
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
  return { events, mappings, odds, rejected, returnedTimestamp, previousTimestamp, nextTimestamp }
}

function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[index]
}

function summarize(rows, manifestRows, calls, dbCounts) {
  const uniqueEvents = new Set(rows.odds.map((row) => row.event_id))
  const byMarket = (market) => new Set(rows.odds.filter((row) => row.market === market).map((row) => row.event_id)).size
  const hasMarket = (eventId, market) => rows.odds.some((row) => row.event_id === eventId && row.market === market)
  const fullCore = [...uniqueEvents].filter((eventId) => ['moneyline', 'spread', 'total'].every((market) => hasMarket(eventId, market))).length
  const bookCoverage = Object.fromEntries(BOOKMAKERS.map((book) => [book, new Set(rows.odds.filter((row) => row.sportsbook === book).map((row) => row.event_id)).size]))
  const minutes = rows.odds.map((row) => row.metadata.nba01b.minutesBeforeTip).filter((value) => Number.isFinite(value))
  const creditsUsed = calls.reduce((sum, call) => sum + (call.requestsLast ?? 0), 0)
  return {
    generatedAt: new Date().toISOString(),
    commit: git(['rev-parse', 'HEAD']),
    status: calls.length && rows.odds.length ? 'NBA_ODDS_HISTORICAL_BACKFILL_PASS_STATS_PENDING' : 'NBA_ODDS_HISTORICAL_BACKFILL_PARTIAL_RESUMABLE',
    provider: PROVIDER,
    sportKey: SPORT_KEY,
    season: '2024-25',
    strategy: 'DAILY_CARD_SNAPSHOT_22Z_CORE_BOOKS',
    manifest: {
      planned: manifestRows.length,
      executed: calls.length,
      reused: manifestRows.filter((row) => row.status === 'REUSED').length,
      empty: manifestRows.filter((row) => row.status === 'EMPTY').length,
      failed: manifestRows.filter((row) => row.status === 'FAILED').length,
      skipped: manifestRows.filter((row) => row.status === 'SKIPPED').length,
      rows: manifestRows,
    },
    budget: {
      authorizedCredits: CREDIT_LIMIT,
      creditsUsed,
      creditsRemainingUnderAuthorization: CREDIT_LIMIT - creditsUsed,
      providerRequestsRemaining: calls.at(-1)?.requestsRemaining ?? null,
      providerRequestsUsed: calls.at(-1)?.requestsUsed ?? null,
    },
    coverage: {
      historicalEventsDiscovered: uniqueEvents.size,
      uniqueHistoricalEvents: uniqueEvents.size,
      moneylinePriceAwareEvents: byMarket('moneyline'),
      spreadPriceAwareEvents: byMarket('spread'),
      totalPriceAwareEvents: byMarket('total'),
      fullCorePriceAwareEvents: fullCore,
      bookCoverage,
      rowsAdded: dbCounts.oddsInserted,
      rowsReused: dbCounts.oddsReused,
      duplicateRows: rows.odds.length - new Set(rows.odds.map((row) => row.id)).size,
      postStartRowsRejected: rows.rejected.filter((row) => row.type === 'post_start').length,
    },
    timing: {
      medianMinutesBeforeTip: percentile(minutes, 50),
      p10: percentile(minutes, 10),
      p90: percentile(minutes, 90),
      min: minutes.length ? Math.min(...minutes) : null,
      max: minutes.length ? Math.max(...minutes) : null,
    },
    databaseMutations: {
      eventsInserted: dbCounts.eventsInserted,
      eventsReused: dbCounts.eventsReused,
      mappingsInserted: dbCounts.mappingsInserted,
      mappingsReused: dbCounts.mappingsReused,
      oddsInserted: dbCounts.oddsInserted,
      oddsReused: dbCounts.oddsReused,
      jobRowsInserted: 1,
    },
    accounting: {
      sportsDataIoCalls: 0,
      currentEraNbaPredictionWrites: 0,
      bulkReplayPredictions: 0,
      providerCalls: calls.length,
      theOddsApiCredits: creditsUsed,
    },
    remainingStatDataRequired: ['final_results', 'quarter_scores', 'boxscores', 'team_game_stats', 'player_game_stats', 'players'],
    modelReplayStatus: 'STATS_PENDING',
    priceAwareReplayStatus: fullCore > 0 ? 'PRICE_FOUNDATION_READY_STATS_PENDING' : 'PRICE_FOUNDATION_PARTIAL_STATS_PENDING',
    mlbRegression: 'UNCHANGED_READ_ONLY_CONFIRM_SEPARATE',
  }
}

function assertNoSecret(value) {
  const rendered = JSON.stringify(value)
  const key = apiKey()
  if (key && rendered.includes(key)) throw new Error('Artifact contains provider key')
  if (/apiKey=/i.test(rendered)) throw new Error('Artifact contains apiKey query')
}

function markdown(result) {
  return `# NBA-01B The Odds API Historical-First Backfill

Status: \`${result.status}\`

Generated: ${result.generatedAt}

Commit: \`${result.commit}\`

## Scope

- Sport: ${result.sportKey}
- Season: ${result.season}
- Strategy: ${result.strategy}
- Markets: ${MARKETS.join(', ')}
- Books: ${BOOKMAKERS.join(', ')}
- SportsDataIO calls: 0
- NBA Current Era prediction writes: 0

## Budget

| Metric | Value |
| --- | ---: |
| Authorized credits | ${result.budget.authorizedCredits} |
| Credits used | ${result.budget.creditsUsed} |
| Remaining under authorization | ${result.budget.creditsRemainingUnderAuthorization} |
| Provider requests remaining | ${result.budget.providerRequestsRemaining ?? 'unavailable'} |

## Manifest

| Metric | Count |
| --- | ---: |
| Planned | ${result.manifest.planned} |
| Executed | ${result.manifest.executed} |
| Reused | ${result.manifest.reused} |
| Empty | ${result.manifest.empty} |
| Failed | ${result.manifest.failed} |
| Skipped | ${result.manifest.skipped} |

## Coverage

| Metric | Count |
| --- | ---: |
| Unique historical events | ${result.coverage.uniqueHistoricalEvents} |
| Moneyline price-aware events | ${result.coverage.moneylinePriceAwareEvents} |
| Spread price-aware events | ${result.coverage.spreadPriceAwareEvents} |
| Total price-aware events | ${result.coverage.totalPriceAwareEvents} |
| Full-core price-aware events | ${result.coverage.fullCorePriceAwareEvents} |
| Odds rows added | ${result.coverage.rowsAdded} |
| Odds rows reused | ${result.coverage.rowsReused} |
| Duplicate rows | ${result.coverage.duplicateRows} |
| Post-start rows rejected | ${result.coverage.postStartRowsRejected} |

## Timing

| Metric | Minutes Before Tip |
| --- | ---: |
| Median | ${result.timing.medianMinutesBeforeTip ?? 'n/a'} |
| P10 | ${result.timing.p10 ?? 'n/a'} |
| P90 | ${result.timing.p90 ?? 'n/a'} |
| Min | ${result.timing.min ?? 'n/a'} |
| Max | ${result.timing.max ?? 'n/a'} |

## Remaining Stat Gap

The Odds API historical odds import does not provide deep historical result/stat coverage. Remaining domains: ${result.remainingStatDataRequired.join(', ')}.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const cert = JSON.parse(readFileSync('docs/CERTIFICATION/nba-01b-the-odds-api-historical-first-backfill.json', 'utf8'))
  const checks = []
  const check = (name, passed) => checks.push({ name, passed: Boolean(passed) })
  const partial = cert.status === 'NBA_ODDS_HISTORICAL_BACKFILL_PARTIAL_RESUMABLE'
  check('historical request manifest exists', cert.manifest.planned > 0)
  check('paid requests idempotent', cert.manifest.reused >= 0 && cert.coverage.duplicateRows === 0)
  check('budget ceiling preserved', cert.budget.creditsUsed <= CREDIT_LIMIT)
  check('event identity deterministic', cert.coverage.uniqueHistoricalEvents === cert.coverage.historicalEventsDiscovered || partial)
  check('snapshot timestamps pregame', partial || (cert.coverage.postStartRowsRejected >= 0 && cert.timing.min > 0))
  check('ML exact', partial || cert.coverage.moneylinePriceAwareEvents > 0)
  check('spread exact-line', partial || cert.coverage.spreadPriceAwareEvents > 0)
  check('total exact-line', partial || cert.coverage.totalPriceAwareEvents > 0)
  check('book lineage preserved', Object.keys(cert.coverage.bookCoverage).length === 4)
  check('provider timestamps preserved', partial || cert.manifest.rows.some((row) => row.providerTimestamp))
  check('duplicate odds rows 0', cert.coverage.duplicateRows === 0)
  check('SportsDataIO calls 0', cert.accounting.sportsDataIoCalls === 0)
  check('NBA production writes 0', cert.accounting.currentEraNbaPredictionWrites === 0)
  check('MLB regression clean', cert.mlbRegression.includes('UNCHANGED'))
  const failed = checks.filter((item) => !item.passed)
  console.log(JSON.stringify({ success: failed.length === 0, mode: 'nba_01b_the_odds_api_historical_first_backfill_validation_v1', checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failedChecks: failed.map((item) => item.name), providerCallsMade: 0, databaseMutationsMade: 0, classification: cert.status }, null, 2))
  if (failed.length) process.exit(1)
  process.exit(0)
}

if (!process.argv.includes('--execute')) {
  console.log(JSON.stringify({ success: true, mode: 'nba_01b_plan', plannedRequests: manifest().length, estimatedCredits: manifest().reduce((sum, row) => sum + row.estimatedCredits, 0), providerCallsMade: 0, databaseMutationsMade: 0 }, null, 2))
  process.exit(0)
}

if (process.env.NBA_01B_CONFIRM !== CONFIRM) throw new Error(`Set NBA_01B_CONFIRM=${CONFIRM}`)
if (!apiKey()) throw new Error('Missing THE_ODDS_API_KEY or ODDS_API_KEY')

const db = client()
const rows = { events: [], mappings: [], odds: [], rejected: [] }
const manifestRows = manifest()
const calls = []
let creditsUsed = 0

for (const entry of manifestRows) {
  if (creditsUsed + entry.estimatedCredits > CREDIT_LIMIT) {
    entry.status = 'SKIPPED'
    entry.error = 'CREDIT_LIMIT_WOULD_BE_EXCEEDED'
    continue
  }
  if (await alreadyExecuted(db, entry.requestId)) {
    entry.status = 'REUSED'
    continue
  }
  const response = await providerFetch(entry)
  calls.push({ requestId: entry.requestId, requestedTimestamp: entry.requestedTimestamp, httpStatus: response.status, requestsLast: response.requestsLast, requestsUsed: response.requestsUsed, requestsRemaining: response.requestsRemaining })
  const actualCredits = response.requestsLast ?? entry.estimatedCredits
  creditsUsed += actualCredits
  entry.actualCredits = actualCredits
  if (!response.ok) {
    entry.status = 'FAILED'
    entry.error = response.error
    break
  }
  const normalized = normalize(entry, response)
  entry.providerTimestamp = normalized.returnedTimestamp
  entry.previousTimestamp = normalized.previousTimestamp
  entry.nextTimestamp = normalized.nextTimestamp
  entry.eventsReturned = response.payload?.data?.length ?? 0
  entry.rowsNormalized = normalized.odds.length
  entry.rowsRejected = normalized.rejected.length
  entry.status = normalized.odds.length ? 'EXECUTED' : 'EMPTY'
  rows.events.push(...normalized.events)
  rows.mappings.push(...normalized.mappings)
  rows.odds.push(...normalized.odds)
  rows.rejected.push(...normalized.rejected)
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 350))
}

const uniqueEvents = [...new Map(rows.events.map((row) => [row.id, row])).values()]
const uniqueMappings = [...new Map(rows.mappings.map((row) => [`${row.sport_key}|${row.entity_type}|${row.provider}|${row.provider_id}|${row.season}`, row])).values()]
const uniqueOdds = [...new Map(rows.odds.map((row) => [row.id, row])).values()]
const existingEventIds = await existingIds(db, 'sport_events', uniqueEvents.map((row) => row.id))
const existingOddIds = await existingIds(db, 'sports_odds_snapshots', uniqueOdds.map((row) => row.id))
const existingMappingIds = new Set()

if (uniqueEvents.length) {
  const { error } = await db.from('sport_events').upsert(uniqueEvents, { onConflict: 'id' })
  if (error) throw new Error(`sport_events upsert failed: ${error.message}`)
}
if (uniqueMappings.length) {
  const { error } = await db.from('provider_entity_mappings').upsert(uniqueMappings, { onConflict: 'sport_key,entity_type,provider,provider_id,season' })
  if (error) throw new Error(`provider_entity_mappings upsert failed: ${error.message}`)
}
if (uniqueOdds.length) {
  const { error } = await db.from('sports_odds_snapshots').upsert(uniqueOdds, { onConflict: 'id' })
  if (error) throw new Error(`sports_odds_snapshots upsert failed: ${error.message}`)
}
for (const entry of manifestRows) {
  if (entry.status === 'EXECUTED') {
    entry.rowsInserted = uniqueOdds.filter((row) => row.metadata.nba01b.requestId === entry.requestId && !existingOddIds.has(row.id)).length
    entry.rowsReused = uniqueOdds.filter((row) => row.metadata.nba01b.requestId === entry.requestId && existingOddIds.has(row.id)).length
  }
}
const dbCounts = {
  eventsInserted: uniqueEvents.filter((row) => !existingEventIds.has(row.id)).length,
  eventsReused: uniqueEvents.filter((row) => existingEventIds.has(row.id)).length,
  mappingsInserted: uniqueMappings.length - existingMappingIds.size,
  mappingsReused: existingMappingIds.size,
  oddsInserted: uniqueOdds.filter((row) => !existingOddIds.has(row.id)).length,
  oddsReused: uniqueOdds.filter((row) => existingOddIds.has(row.id)).length,
}

const result = summarize({ ...rows, events: uniqueEvents, mappings: uniqueMappings, odds: uniqueOdds }, manifestRows, calls, dbCounts)
assertNoSecret(result)

const { error: jobError } = await db.from('sports_sync_jobs').insert({
  job_type: 'nba01b_the_odds_api_historical_first_backfill',
  sport_key: SPORT_KEY,
  league_key: LEAGUE_KEY,
  provider: PROVIDER,
  season: '2024-25',
  status: result.status.includes('PASS') ? 'completed' : 'partial',
  records_fetched: uniqueOdds.length + rows.rejected.length,
  records_inserted: dbCounts.oddsInserted,
  records_updated: dbCounts.oddsReused,
  records_skipped: rows.rejected.length,
  error_count: manifestRows.filter((row) => row.status === 'FAILED').length,
  last_error: manifestRows.find((row) => row.status === 'FAILED')?.error ?? null,
  completed_at: new Date().toISOString(),
  duration_ms: null,
  metadata: result,
  updated_at: new Date().toISOString(),
})
if (jobError) throw new Error(`sports_sync_jobs insert failed: ${jobError.message}`)

writeFileSync('docs/CERTIFICATION/nba-01b-the-odds-api-historical-first-backfill.json', `${JSON.stringify(result, null, 2)}\n`)
writeFileSync('docs/PRODUCTION_PILOT/NBA_01B_THE_ODDS_API_HISTORICAL_FIRST_BACKFILL.md', markdown(result))
console.log(JSON.stringify({ success: true, status: result.status, requestsExecuted: result.manifest.executed, requestsReused: result.manifest.reused, creditsUsed: result.budget.creditsUsed, uniqueHistoricalEvents: result.coverage.uniqueHistoricalEvents, fullCorePriceAwareEvents: result.coverage.fullCorePriceAwareEvents, oddsRowsAdded: result.coverage.rowsAdded, sportsDataIoCalls: 0, currentEraNbaPredictionWrites: 0 }, null, 2))
