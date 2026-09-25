import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PROVIDER = 'balldontlie'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SEASON = '2025'
const SOURCE = 'BDL_2025_OPENING_BACKFILL_V1'
const JOB_TYPE = 'mlb_bdl_opening_odds_2025_backfill_v1'
const TARGET_TABLE = 'mlb_bdl_opening_odds_2025_v1'
const MAX_DATES_PER_BATCH = 8
const MAX_GAMES_PAGES_PER_DATE = 2
const MAX_OPENING_PAGES_PER_DATE = 5
const REQUEST_PAUSE_MS = 120

type JsonMap = Record<string, unknown>

type HistoricalGame = {
  canonical_game_id: string
  game_date: string
  canonical_home_team: string
  canonical_away_team: string
  game_number: string | null
  start_time_local: string | null
}

type BdlGame = {
  id?: number
  date?: string
  home_team?: { abbreviation?: string }
  away_team?: { abbreviation?: string }
}

type BdlOpening = {
  id?: number
  game_id?: number
  vendor?: string
  spread_home_value?: string | number | null
  spread_home_odds?: number | null
  spread_away_value?: string | number | null
  spread_away_odds?: number | null
  moneyline_home_odds?: number | null
  moneyline_away_odds?: number | null
  total_value?: string | number | null
  total_over_odds?: number | null
  total_under_odds?: number | null
  opened_at?: string
}

type MappedGame = {
  canonical: HistoricalGame
  providerGameIds: number[]
  providerTimestamp: string
  pairKey: string
  mappingMethod: 'PAIR_SINGLE' | 'PAIR_ORDINAL_DATETIME'
}

type NormalizedSignature = {
  market: 'moneyline' | 'run_line' | 'total'
  signature: string
  outcomes: Array<{ outcome: string; line: number | null; price: number }>
}

function apiKey() {
  return process.env.BALLDONTLIE_API_KEY?.trim() ?? ''
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function finite(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function finiteInt(value: unknown) {
  const n = Number(value)
  return Number.isSafeInteger(n) ? n : null
}

function validIso(value: unknown) {
  const parsed = new Date(String(value ?? ''))
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

const TEAM_ALIAS: Record<string, string> = {
  ARI: 'AZ',
  AZ: 'AZ',
  CWS: 'CHW',
  CHW: 'CHW',
  WSN: 'WSH',
  WAS: 'WSH',
  WSH: 'WSH',
  TBR: 'TB',
  TB: 'TB',
  OAK: 'ATH',
  ATH: 'ATH',
}

function team(value: unknown) {
  const raw = String(value ?? '').trim().toUpperCase()
  return TEAM_ALIAS[raw] ?? raw
}

function pairKey(home: unknown, away: unknown) {
  return team(home) + '|' + team(away)
}

function parseClockMinutes(value: string | null) {
  const raw = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')
  const match = raw.match(/^(\d{1,2}):(\d{2})(AM|PM)$/)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null
  if (hour === 12) hour = 0
  if (match[3] === 'PM') hour += 12
  return hour * 60 + minute
}

function rowId(parts: unknown[]) {
  return 'bdlopen_' + createHash('sha256')
    .update(parts.map((part) => String(part ?? 'null')).join('|'))
    .digest('hex')
    .slice(0, 32)
}

async function providerGet(url: URL) {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: { Authorization: apiKey() },
        signal: AbortSignal.timeout(25_000),
      })
      if (response.ok) return response.json() as Promise<any>

      if (response.status === 429 || response.status >= 500) {
        const reset = Number(response.headers.get('x-ratelimit-reset'))
        const nowSec = Math.floor(Date.now() / 1000)
        const waitMs = Number.isFinite(reset) && reset > nowSec
          ? Math.min(10_000, Math.max(500, (reset - nowSec) * 1000))
          : 700 * attempt
        await sleep(waitMs)
        lastError = new Error('BALLDONTLIE_HTTP_' + response.status)
        continue
      }

      throw new Error('BALLDONTLIE_HTTP_' + response.status)
    } catch (error) {
      lastError = error
      if (attempt < 3) await sleep(500 * attempt)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('BALLDONTLIE_REQUEST_FAILED')
}

async function fetchPaged(
  base: string,
  date: string,
  maxPages: number,
  extra: Record<string, string> = {},
) {
  const rows: any[] = []
  let cursor: string | null = null
  let pages = 0

  do {
    pages += 1
    if (pages > maxPages) throw new Error('PAGINATION_BOUND_EXCEEDED:' + base + ':' + date)
    const url = new URL(base)
    url.searchParams.append('dates[]', date)
    url.searchParams.set('per_page', '100')
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value)
    if (cursor) url.searchParams.set('cursor', cursor)

    if (pages > 1 || rows.length > 0) await sleep(REQUEST_PAUSE_MS)
    const payload = await providerGet(url)
    if (Array.isArray(payload?.data)) rows.push(...payload.data)
    const next = payload?.meta?.next_cursor
    cursor = next === null || next === undefined || String(next) === '' ? null : String(next)
  } while (cursor)

  return { rows, pages }
}

async function historicalGames(date: string) {
  const result = await supabaseAdmin
    .from('historical_baseball_games')
    .select('canonical_game_id,game_date,canonical_home_team,canonical_away_team,game_number,start_time_local')
    .eq('sport_key', SPORT_KEY)
    .eq('season', SEASON)
    .eq('game_date', date)
    .order('canonical_game_id', { ascending: true })

  if (result.error) throw new Error('HISTORICAL_GAME_READ_FAILED:' + result.error.message)
  return (result.data ?? []) as HistoricalGame[]
}

async function seasonDates() {
  const result = await supabaseAdmin
    .from('historical_baseball_games')
    .select('game_date')
    .eq('sport_key', SPORT_KEY)
    .eq('season', SEASON)
    .order('game_date', { ascending: true })
    .limit(5000)

  if (result.error) throw new Error('HISTORICAL_DATE_READ_FAILED:' + result.error.message)
  return [...new Set((result.data ?? []).map((row) => String(row.game_date)).filter(Boolean))].sort()
}

async function completedDates() {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('metadata,completed_at')
    .eq('job_type', JOB_TYPE)
    .eq('sport_key', SPORT_KEY)
    .eq('provider', PROVIDER)
    .eq('season', SEASON)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1000)

  if (result.error) throw new Error('BACKFILL_CHECKPOINT_READ_FAILED:' + result.error.message)

  const out = new Set<string>()
  for (const row of result.data ?? []) {
    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as JsonMap
      : {}
    const targetDate = String(metadata.targetDate ?? '')
    if (/^2025-\d{2}-\d{2}$/.test(targetDate)) out.add(targetDate)
  }
  return out
}

function groupHistorical(rows: HistoricalGame[]) {
  const map = new Map<string, HistoricalGame[]>()
  for (const row of rows) {
    const key = pairKey(row.canonical_home_team, row.canonical_away_team)
    const bucket = map.get(key) ?? []
    bucket.push(row)
    map.set(key, bucket)
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => {
      const ta = parseClockMinutes(a.start_time_local)
      const tb = parseClockMinutes(b.start_time_local)
      if (ta !== null && tb !== null && ta !== tb) return ta - tb
      return String(a.game_number ?? '').localeCompare(String(b.game_number ?? ''))
    })
  }
  return map
}

function groupProviderGames(rows: BdlGame[]) {
  const byPair = new Map<string, Map<string, BdlGame[]>>()

  for (const row of rows) {
    const gameId = finiteInt(row.id)
    const timestamp = validIso(row.date)
    const home = row.home_team?.abbreviation
    const away = row.away_team?.abbreviation
    if (gameId === null || !timestamp || !home || !away) continue

    const key = pairKey(home, away)
    const byTime = byPair.get(key) ?? new Map<string, BdlGame[]>()
    const bucket = byTime.get(timestamp) ?? []
    bucket.push(row)
    byTime.set(timestamp, bucket)
    byPair.set(key, byTime)
  }

  return byPair
}

function mapGames(histRows: HistoricalGame[], providerRows: BdlGame[]) {
  const hist = groupHistorical(histRows)
  const provider = groupProviderGames(providerRows)
  const providerIdToMapped = new Map<number, MappedGame>()
  const anomalies: Array<Record<string, unknown>> = []
  let mappedCanonicalGames = 0

  const allPairs = new Set([...hist.keys(), ...provider.keys()])
  for (const key of allPairs) {
    const canonical = hist.get(key) ?? []
    const byTime = provider.get(key) ?? new Map<string, BdlGame[]>()
    const timeGroups = [...byTime.entries()]
      .sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]))

    if (!canonical.length || !timeGroups.length) {
      anomalies.push({
        pairKey: key,
        reason: !canonical.length ? 'NO_CANONICAL_PAIR' : 'NO_PROVIDER_PAIR',
        canonicalGames: canonical.length,
        providerTimeGroups: timeGroups.length,
      })
      continue
    }

    if (canonical.length !== timeGroups.length) {
      anomalies.push({
        pairKey: key,
        reason: 'PAIR_GAME_COUNT_MISMATCH',
        canonicalGames: canonical.length,
        providerTimeGroups: timeGroups.length,
        providerGameIds: timeGroups.flatMap(([, games]) => games.map((game) => finiteInt(game.id))).filter(Boolean),
      })
      continue
    }

    for (let index = 0; index < canonical.length; index += 1) {
      const [timestamp, games] = timeGroups[index]
      const ids = games.map((game) => finiteInt(game.id)).filter((id): id is number => id !== null)
      if (!ids.length) continue

      const mapped: MappedGame = {
        canonical: canonical[index],
        providerGameIds: [...new Set(ids)].sort((a, b) => a - b),
        providerTimestamp: timestamp,
        pairKey: key,
        mappingMethod: canonical.length === 1 ? 'PAIR_SINGLE' : 'PAIR_ORDINAL_DATETIME',
      }

      for (const id of mapped.providerGameIds) providerIdToMapped.set(id, mapped)
      mappedCanonicalGames += 1
    }
  }

  return { providerIdToMapped, anomalies, mappedCanonicalGames }
}

function openingSignature(row: BdlOpening, market: 'moneyline' | 'run_line' | 'total'): NormalizedSignature | null {
  if (market === 'moneyline') {
    const home = finite(row.moneyline_home_odds)
    const away = finite(row.moneyline_away_odds)
    if (home === null || away === null || home === 0 || away === 0) return null
    const outcomes = [
      { outcome: 'home', line: null, price: Math.trunc(home) },
      { outcome: 'away', line: null, price: Math.trunc(away) },
    ]
    return { market, signature: JSON.stringify(outcomes), outcomes }
  }

  if (market === 'run_line') {
    const homeLine = finite(row.spread_home_value)
    const awayLine = finite(row.spread_away_value)
    const home = finite(row.spread_home_odds)
    const away = finite(row.spread_away_odds)
    if (homeLine === null || awayLine === null || home === null || away === null || home === 0 || away === 0) return null
    const outcomes = [
      { outcome: 'home', line: homeLine, price: Math.trunc(home) },
      { outcome: 'away', line: awayLine, price: Math.trunc(away) },
    ]
    return { market, signature: JSON.stringify(outcomes), outcomes }
  }

  const totalLine = finite(row.total_value)
  const over = finite(row.total_over_odds)
  const under = finite(row.total_under_odds)
  if (totalLine === null || over === null || under === null || over === 0 || under === 0) return null
  const outcomes = [
    { outcome: 'over', line: totalLine, price: Math.trunc(over) },
    { outcome: 'under', line: totalLine, price: Math.trunc(under) },
  ]
  return { market, signature: JSON.stringify(outcomes), outcomes }
}

function normalizeOpeningRows(
  date: string,
  openingRows: BdlOpening[],
  providerIdToMapped: Map<number, MappedGame>,
) {
  const byCanonicalVendor = new Map<string, { mapped: MappedGame; vendor: string; rows: BdlOpening[] }>()
  let unmatchedOpeningRows = 0

  for (const row of openingRows) {
    const gameId = finiteInt(row.game_id)
    const vendor = String(row.vendor ?? '').trim().toLowerCase()
    if (gameId === null || !vendor) continue

    const mapped = providerIdToMapped.get(gameId)
    if (!mapped) {
      unmatchedOpeningRows += 1
      continue
    }

    const key = mapped.canonical.canonical_game_id + '|' + vendor
    const bucket = byCanonicalVendor.get(key) ?? { mapped, vendor, rows: [] }
    bucket.rows.push(row)
    byCanonicalVendor.set(key, bucket)
  }

  const output: Array<Record<string, unknown>> = []
  const blockedContracts: Array<Record<string, unknown>> = []

  for (const bucket of byCanonicalVendor.values()) {
    for (const market of ['moneyline', 'run_line', 'total'] as const) {
      const candidates = bucket.rows
        .map((row) => ({ row, normalized: openingSignature(row, market) }))
        .filter((item): item is { row: BdlOpening; normalized: NormalizedSignature } => item.normalized !== null)

      if (!candidates.length) continue

      const signatures = [...new Set(candidates.map((item) => item.normalized.signature))]
      if (signatures.length !== 1) {
        blockedContracts.push({
          canonicalGameId: bucket.mapped.canonical.canonical_game_id,
          vendor: bucket.vendor,
          market,
          reason: 'DUPLICATE_PROVIDER_GAME_CONFLICT',
          signatures,
          providerGameIds: bucket.mapped.providerGameIds,
        })
        continue
      }

      const same = candidates.filter((item) => item.normalized.signature === signatures[0])
      const normalized = same[0].normalized
      const providerGameIds = [...new Set(
        same.map((item) => finiteInt(item.row.game_id)).filter((id): id is number => id !== null)
      )].sort((a, b) => a - b)
      const providerOddsIds = [...new Set(
        same.map((item) => finiteInt(item.row.id)).filter((id): id is number => id !== null)
      )].sort((a, b) => a - b)
      const openedAtValues = same.map((item) => validIso(item.row.opened_at)).filter((value): value is string => value !== null)
      if (!openedAtValues.length) {
        blockedContracts.push({
          canonicalGameId: bucket.mapped.canonical.canonical_game_id,
          vendor: bucket.vendor,
          market,
          reason: 'MISSING_OPENED_AT',
        })
        continue
      }
      const openedAt = openedAtValues.sort()[0]

      for (const outcome of normalized.outcomes) {
        const id = rowId([
          bucket.mapped.canonical.canonical_game_id,
          bucket.vendor,
          market,
          outcome.outcome,
          outcome.line,
        ])
        output.push({
          id,
          season: SEASON,
          game_date: date,
          canonical_game_id: bucket.mapped.canonical.canonical_game_id,
          canonical_home_team: bucket.mapped.canonical.canonical_home_team,
          canonical_away_team: bucket.mapped.canonical.canonical_away_team,
          game_number: bucket.mapped.canonical.game_number,
          provider: PROVIDER,
          vendor: bucket.vendor,
          market,
          outcome: outcome.outcome,
          line: outcome.line,
          price: outcome.price,
          opened_at: openedAt,
          provider_game_ids: providerGameIds,
          provider_odds_ids: providerOddsIds,
          source: SOURCE,
          metadata: {
            researchOnly: true,
            productionEligible: false,
            officialPicksEligible: false,
            apostarEnabled: false,
            exactIdentity: true,
            mappingMethod: bucket.mapped.mappingMethod,
            pairKey: bucket.mapped.pairKey,
            providerScheduledAt: bucket.mapped.providerTimestamp,
            duplicateProviderGameIdsCollapsed: providerGameIds.length > 1,
            providerGameIds,
            providerOddsIds,
            openedAtCandidates: [...new Set(openedAtValues)].sort(),
            historicalOddsApiCalls: 0,
          },
        })
      }
    }
  }

  return {
    rows: output,
    blockedContracts,
    unmatchedOpeningRows,
  }
}

async function existingIds(ids: string[]) {
  const out = new Set<string>()
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100)
    if (!chunk.length) continue
    const result = await supabaseAdmin.from(TARGET_TABLE).select('id').in('id', chunk)
    if (result.error) throw new Error('BACKFILL_EXISTING_READ_FAILED:' + result.error.message)
    for (const row of result.data ?? []) out.add(String(row.id))
  }
  return out
}

async function recordJob(input: {
  targetDate: string
  status: 'completed' | 'failed'
  startedAt: string
  completedAt: string
  fetched: number
  inserted: number
  skipped: number
  errorCount: number
  lastError: string | null
  metadata: JsonMap
}) {
  const durationMs = Math.max(0, Date.parse(input.completedAt) - Date.parse(input.startedAt))
  const write = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: JOB_TYPE,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season: SEASON,
    started_at: input.startedAt,
    completed_at: input.completedAt,
    status: input.status,
    records_fetched: input.fetched,
    records_inserted: input.inserted,
    records_updated: 0,
    records_skipped: input.skipped,
    error_count: input.errorCount,
    last_error: input.lastError,
    duration_ms: durationMs,
    metadata: {
      source: SOURCE,
      targetDate: input.targetDate,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      historicalOddsApiCalls: 0,
      ...input.metadata,
    },
    created_at: input.completedAt,
    updated_at: input.completedAt,
  })
  if (write.error) throw new Error('BACKFILL_JOB_WRITE_FAILED:' + write.error.message)
}

async function processDate(date: string) {
  const startedAt = new Date().toISOString()
  try {
    const historical = await historicalGames(date)
    const [gamesResult, openingResult] = await Promise.all([
      fetchPaged('https://api.balldontlie.io/mlb/v1/games', date, MAX_GAMES_PAGES_PER_DATE, { season_type: 'regular' }),
      fetchPaged('https://api.balldontlie.io/mlb/v1/odds/opening', date, MAX_OPENING_PAGES_PER_DATE),
    ])

    const games = gamesResult.rows as BdlGame[]
    const opening = openingResult.rows as BdlOpening[]
    const mapping = mapGames(historical, games)
    const normalized = normalizeOpeningRows(date, opening, mapping.providerIdToMapped)
    const ids = normalized.rows.map((row) => String(row.id))
    const existing = await existingIds(ids)
    const newRows = normalized.rows.filter((row) => !existing.has(String(row.id)))

    if (newRows.length) {
      for (let offset = 0; offset < newRows.length; offset += 500) {
        const chunk = newRows.slice(offset, offset + 500)
        const write = await supabaseAdmin.from(TARGET_TABLE).insert(chunk)
        if (write.error) throw new Error('BACKFILL_INSERT_FAILED:' + write.error.message)
      }
    }

    const completedAt = new Date().toISOString()
    const skipped = existing.size + normalized.blockedContracts.length + normalized.unmatchedOpeningRows
    await recordJob({
      targetDate: date,
      status: 'completed',
      startedAt,
      completedAt,
      fetched: games.length + opening.length,
      inserted: newRows.length,
      skipped,
      errorCount: 0,
      lastError: null,
      metadata: {
        historicalGames: historical.length,
        providerGames: games.length,
        openingRows: opening.length,
        providerCallsMade: gamesResult.pages + openingResult.pages,
        mappedCanonicalGames: mapping.mappedCanonicalGames,
        mappingAnomalies: mapping.anomalies,
        normalizedRows: normalized.rows.length,
        existingRows: existing.size,
        blockedContracts: normalized.blockedContracts,
        unmatchedOpeningRows: normalized.unmatchedOpeningRows,
      },
    })

    return {
      date,
      success: true,
      historicalGames: historical.length,
      providerGames: games.length,
      openingRows: opening.length,
      providerCallsMade: gamesResult.pages + openingResult.pages,
      mappedCanonicalGames: mapping.mappedCanonicalGames,
      mappingAnomalyCount: mapping.anomalies.length,
      normalizedRows: normalized.rows.length,
      insertedRows: newRows.length,
      reusedRows: existing.size,
      blockedContractCount: normalized.blockedContracts.length,
      unmatchedOpeningRows: normalized.unmatchedOpeningRows,
    }
  } catch (error) {
    const completedAt = new Date().toISOString()
    const message = error instanceof Error ? error.message : 'UNKNOWN_BACKFILL_ERROR'
    await recordJob({
      targetDate: date,
      status: 'failed',
      startedAt,
      completedAt,
      fetched: 0,
      inserted: 0,
      skipped: 0,
      errorCount: 1,
      lastError: message,
      metadata: { error: message },
    })
    return { date, success: false, error: message }
  }
}

export async function runMlbBdlOpeningBackfillBatch() {
  const base = {
    success: true,
    status: 'BACKFILL_BATCH_COMPLETE',
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    historicalOddsApiCalls: 0,
    provider: PROVIDER,
    targetTable: TARGET_TABLE,
    maxDatesPerBatch: MAX_DATES_PER_BATCH,
  }

  if (!apiKey()) {
    return {
      ...base,
      success: false,
      status: 'BLOCKED_MISSING_BALLDONTLIE_API_KEY',
      done: false,
      processedDates: 0,
      remainingDates: null,
    }
  }

  const [dates, completedBefore] = await Promise.all([seasonDates(), completedDates()])
  const pending = dates.filter((date) => !completedBefore.has(date))

  if (!pending.length) {
    const count = await supabaseAdmin.from(TARGET_TABLE).select('id', { count: 'exact', head: true })
    if (count.error) throw new Error('BACKFILL_FINAL_COUNT_FAILED:' + count.error.message)
    return {
      ...base,
      status: 'BACKFILL_COMPLETE',
      done: true,
      totalDates: dates.length,
      completedDates: completedBefore.size,
      remainingDates: 0,
      storedRows: count.count ?? null,
      processedDates: 0,
      dates: [],
    }
  }

  const batch = pending.slice(0, MAX_DATES_PER_BATCH)
  const results = []
  for (const date of batch) {
    results.push(await processDate(date))
    await sleep(REQUEST_PAUSE_MS)
  }

  const completedAfter = await completedDates()
  const remainingDates = dates.filter((date) => !completedAfter.has(date)).length
  const insertedRows = results.reduce((sum, row: any) => sum + Number(row.insertedRows ?? 0), 0)
  const providerCallsMade = results.reduce((sum, row: any) => sum + Number(row.providerCallsMade ?? 0), 0)
  const failedDates = results.filter((row: any) => row.success === false).map((row: any) => row.date)

  return {
    ...base,
    status: remainingDates === 0 ? 'BACKFILL_COMPLETE' : 'BACKFILL_BATCH_COMPLETE',
    done: remainingDates === 0,
    totalDates: dates.length,
    completedDates: completedAfter.size,
    remainingDates,
    processedDates: results.length,
    insertedRows,
    providerCallsMade,
    failedDates,
    dates: results,
  }
}
