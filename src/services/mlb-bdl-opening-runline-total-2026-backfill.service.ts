import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PROVIDER = 'balldontlie'
const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SEASON = 2026
const SOURCE = 'BDL_2026_RUNLINE_TOTAL_OPENING_V1'
const JOB_TYPE = 'mlb_bdl_opening_runline_total_2026_v1'
const TARGET_TABLE = 'mlb_bdl_opening_runline_total_2026_v1'
const MAX_DATES_PER_BATCH = 8
const MAX_GAMES_PAGES_PER_DATE = 2
const MAX_OPENING_PAGES_PER_DATE = 5
const REQUEST_PAUSE_MS = 120
const ALLOWED_VENDORS = new Set(['betmgm', 'betrivers'])

type JsonMap = Record<string, unknown>

type FeatureGame = {
  canonical_game_id: string
  game_pk: number | null
  game_date: string
  home_team: string
  away_team: string
  game_number: number
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
  total_value?: string | number | null
  total_over_odds?: number | null
  total_under_odds?: number | null
  opened_at?: string
}

type MappedGame = {
  feature: FeatureGame
  providerGameIds: number[]
  providerTimestamp: string
  mappingMethod: 'PAIR_SINGLE' | 'PAIR_ORDINAL_DATETIME'
}

type MarketSignature = {
  market: 'run_line' | 'total'
  signature: string
  outcomes: Array<{ outcome: string; line: number; price: number }>
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

function normalizeTeam(value: unknown) {
  const raw = String(value ?? '').trim().toUpperCase()
  const aliases: Record<string, string> = {
    ARI: 'AZ',
    AZ: 'AZ',
    CHW: 'CWS',
    CWS: 'CWS',
    WSN: 'WSH',
    WAS: 'WSH',
    WSH: 'WSH',
    TBR: 'TB',
    TB: 'TB',
    OAK: 'ATH',
    ATH: 'ATH',
  }
  return aliases[raw] ?? raw
}

function pairKey(home: unknown, away: unknown) {
  return normalizeTeam(home) + '|' + normalizeTeam(away)
}

function rowId(parts: unknown[]) {
  return 'bdlrt26_' + createHash('sha256')
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
        lastError = new Error('BALLDONTLIE_HTTP_' + response.status)
        await sleep(700 * attempt)
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

    if (pages > 1) await sleep(REQUEST_PAUSE_MS)
    const payload = await providerGet(url)
    if (Array.isArray(payload?.data)) rows.push(...payload.data)

    const next = payload?.meta?.next_cursor
    cursor = next === null || next === undefined || String(next) === '' ? null : String(next)
  } while (cursor)

  return { rows, pages }
}

async function seasonDates() {
  const dates = new Set<string>()
  const pageSize = 1000

  for (let offset = 0; ; offset += pageSize) {
    const result = await supabaseAdmin
      .from('mlb_ml_xyear_features_v1')
      .select('game_date')
      .eq('season', SEASON)
      .not('actual_winner', 'is', null)
      .order('game_date', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (result.error) throw new Error('XYEAR_DATE_READ_FAILED:' + result.error.message)
    const rows = result.data ?? []
    for (const row of rows) {
      const date = String(row.game_date ?? '')
      if (date) dates.add(date)
    }
    if (rows.length < pageSize) break
  }

  return [...dates].sort()
}

async function featureGames(date: string) {
  const result = await supabaseAdmin
    .from('mlb_ml_xyear_features_v1')
    .select('canonical_game_id,game_pk,game_date,home_team,away_team,game_number,start_time_local')
    .eq('season', SEASON)
    .eq('game_date', date)
    .not('actual_winner', 'is', null)
    .order('game_number', { ascending: true })
    .limit(100)

  if (result.error) throw new Error('XYEAR_GAME_READ_FAILED:' + result.error.message)
  return (result.data ?? []) as FeatureGame[]
}

async function completedDates() {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('metadata,completed_at')
    .eq('job_type', JOB_TYPE)
    .eq('sport_key', SPORT_KEY)
    .eq('provider', PROVIDER)
    .eq('season', String(SEASON))
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1000)

  if (result.error) throw new Error('CHECKPOINT_READ_FAILED:' + result.error.message)

  const out = new Set<string>()
  for (const row of result.data ?? []) {
    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as JsonMap
      : {}
    const targetDate = String(metadata.targetDate ?? '')
    if (/^2026-\d{2}-\d{2}$/.test(targetDate)) out.add(targetDate)
  }
  return out
}

function groupFeature(rows: FeatureGame[]) {
  const map = new Map<string, FeatureGame[]>()
  for (const row of rows) {
    const key = pairKey(row.home_team, row.away_team)
    const bucket = map.get(key) ?? []
    bucket.push(row)
    map.set(key, bucket)
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => (a.game_number ?? 0) - (b.game_number ?? 0))
  }
  return map
}

function groupProvider(rows: BdlGame[]) {
  const out = new Map<string, Map<string, BdlGame[]>>()

  for (const row of rows) {
    const gameId = finiteInt(row.id)
    const timestamp = validIso(row.date)
    const home = row.home_team?.abbreviation
    const away = row.away_team?.abbreviation
    if (gameId === null || !timestamp || !home || !away) continue

    const key = pairKey(home, away)
    const byTime = out.get(key) ?? new Map<string, BdlGame[]>()
    const bucket = byTime.get(timestamp) ?? []
    bucket.push(row)
    byTime.set(timestamp, bucket)
    out.set(key, byTime)
  }

  return out
}

function mapGames(features: FeatureGame[], providerRows: BdlGame[]) {
  const canonical = groupFeature(features)
  const provider = groupProvider(providerRows)
  const byProviderId = new Map<number, MappedGame>()
  const anomalies: Array<Record<string, unknown>> = []
  let mappedCanonicalGames = 0

  const allPairs = new Set([...canonical.keys(), ...provider.keys()])
  for (const key of allPairs) {
    const featureRows = canonical.get(key) ?? []
    const timeGroups = [...(provider.get(key)?.entries() ?? [])]
      .sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]))

    if (!featureRows.length || !timeGroups.length) {
      anomalies.push({
        pairKey: key,
        reason: !featureRows.length ? 'NO_XYEAR_PAIR' : 'NO_PROVIDER_PAIR',
        xyearGames: featureRows.length,
        providerTimeGroups: timeGroups.length,
      })
      continue
    }

    if (featureRows.length !== timeGroups.length) {
      anomalies.push({
        pairKey: key,
        reason: 'PAIR_GAME_COUNT_MISMATCH',
        xyearGames: featureRows.length,
        providerTimeGroups: timeGroups.length,
      })
      continue
    }

    for (let index = 0; index < featureRows.length; index += 1) {
      const [timestamp, games] = timeGroups[index]
      const ids = [...new Set(
        games.map((game) => finiteInt(game.id)).filter((id): id is number => id !== null)
      )].sort((a, b) => a - b)
      if (!ids.length) continue

      const mapped: MappedGame = {
        feature: featureRows[index],
        providerGameIds: ids,
        providerTimestamp: timestamp,
        mappingMethod: featureRows.length === 1 ? 'PAIR_SINGLE' : 'PAIR_ORDINAL_DATETIME',
      }

      for (const id of ids) byProviderId.set(id, mapped)
      mappedCanonicalGames += 1
    }
  }

  return { byProviderId, anomalies, mappedCanonicalGames }
}

function marketSignature(row: BdlOpening, market: 'run_line' | 'total'): MarketSignature | null {
  if (market === 'run_line') {
    const homeLine = finite(row.spread_home_value)
    const awayLine = finite(row.spread_away_value)
    const homePrice = finite(row.spread_home_odds)
    const awayPrice = finite(row.spread_away_odds)
    if (
      homeLine === null || awayLine === null ||
      homePrice === null || awayPrice === null ||
      homePrice === 0 || awayPrice === 0
    ) return null

    const outcomes = [
      { outcome: 'home', line: homeLine, price: Math.trunc(homePrice) },
      { outcome: 'away', line: awayLine, price: Math.trunc(awayPrice) },
    ]
    return { market, signature: JSON.stringify(outcomes), outcomes }
  }

  const totalLine = finite(row.total_value)
  const overPrice = finite(row.total_over_odds)
  const underPrice = finite(row.total_under_odds)
  if (totalLine === null || overPrice === null || underPrice === null || overPrice === 0 || underPrice === 0) {
    return null
  }

  const outcomes = [
    { outcome: 'over', line: totalLine, price: Math.trunc(overPrice) },
    { outcome: 'under', line: totalLine, price: Math.trunc(underPrice) },
  ]
  return { market, signature: JSON.stringify(outcomes), outcomes }
}

function normalize(
  date: string,
  rows: BdlOpening[],
  mapping: Map<number, MappedGame>,
) {
  const buckets = new Map<string, { mapped: MappedGame; vendor: string; rows: BdlOpening[] }>()
  let unmatchedOpeningRows = 0

  for (const row of rows) {
    const gameId = finiteInt(row.game_id)
    const vendor = String(row.vendor ?? '').trim().toLowerCase()
    if (gameId === null || !ALLOWED_VENDORS.has(vendor)) continue

    const mapped = mapping.get(gameId)
    if (!mapped) {
      unmatchedOpeningRows += 1
      continue
    }

    const key = mapped.feature.canonical_game_id + '|' + vendor
    const bucket = buckets.get(key) ?? { mapped, vendor, rows: [] }
    bucket.rows.push(row)
    buckets.set(key, bucket)
  }

  const output: Array<Record<string, unknown>> = []
  const blockedContracts: Array<Record<string, unknown>> = []

  for (const bucket of buckets.values()) {
    for (const market of ['run_line', 'total'] as const) {
      const candidates = bucket.rows
        .map((row) => ({ row, normalized: marketSignature(row, market) }))
        .filter((item): item is { row: BdlOpening; normalized: MarketSignature } => item.normalized !== null)

      if (!candidates.length) continue

      const signatures = [...new Set(candidates.map((item) => item.normalized.signature))]
      if (signatures.length !== 1) {
        blockedContracts.push({
          canonicalGameId: bucket.mapped.feature.canonical_game_id,
          vendor: bucket.vendor,
          market,
          reason: 'DUPLICATE_PROVIDER_GAME_CONFLICT',
          signatures,
        })
        continue
      }

      const same = candidates.filter((item) => item.normalized.signature === signatures[0])
      const openedAtValues = same
        .map((item) => validIso(item.row.opened_at))
        .filter((value): value is string => value !== null)
        .sort()

      if (!openedAtValues.length) {
        blockedContracts.push({
          canonicalGameId: bucket.mapped.feature.canonical_game_id,
          vendor: bucket.vendor,
          market,
          reason: 'MISSING_OPENED_AT',
        })
        continue
      }

      const providerGameIds = [...new Set(
        same.map((item) => finiteInt(item.row.game_id)).filter((id): id is number => id !== null)
      )].sort((a, b) => a - b)
      const providerOddsIds = [...new Set(
        same.map((item) => finiteInt(item.row.id)).filter((id): id is number => id !== null)
      )].sort((a, b) => a - b)
      const normalized = same[0].normalized

      for (const outcome of normalized.outcomes) {
        output.push({
          id: rowId([
            bucket.mapped.feature.canonical_game_id,
            bucket.vendor,
            market,
            outcome.outcome,
            outcome.line,
          ]),
          season: SEASON,
          game_date: date,
          xyear_canonical_game_id: bucket.mapped.feature.canonical_game_id,
          game_pk: bucket.mapped.feature.game_pk,
          home_team: bucket.mapped.feature.home_team,
          away_team: bucket.mapped.feature.away_team,
          game_number: bucket.mapped.feature.game_number,
          provider: PROVIDER,
          vendor: bucket.vendor,
          market,
          outcome: outcome.outcome,
          line: outcome.line,
          price: outcome.price,
          opened_at: openedAtValues[0],
          provider_game_ids: providerGameIds,
          provider_odds_ids: providerOddsIds,
          source: SOURCE,
          metadata: {
            researchOnly: true,
            diagnosticOnly: true,
            productionEligible: false,
            officialPicksEligible: false,
            apostarEnabled: false,
            exactIdentity: true,
            exactLineContract: true,
            mappingMethod: bucket.mapped.mappingMethod,
            providerTimestamp: bucket.mapped.providerTimestamp,
            providerGameIds,
            providerOddsIds,
            openedAtCandidates: [...new Set(openedAtValues)],
            historicalOddsApiCalls: 0,
          },
        })
      }
    }
  }

  return { rows: output, blockedContracts, unmatchedOpeningRows }
}

async function existingIds(ids: string[]) {
  const out = new Set<string>()
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100)
    if (!chunk.length) continue
    const result = await supabaseAdmin.from(TARGET_TABLE).select('id').in('id', chunk)
    if (result.error) throw new Error('EXISTING_READ_FAILED:' + result.error.message)
    for (const row of result.data ?? []) out.add(String(row.id))
  }
  return out
}

async function recordJob(input: {
  date: string
  status: 'completed' | 'failed'
  started: string
  completed: string
  fetched: number
  inserted: number
  skipped: number
  errorCount: number
  lastError: string | null
  metadata: JsonMap
}) {
  const write = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: JOB_TYPE,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season: String(SEASON),
    started_at: input.started,
    completed_at: input.completed,
    status: input.status,
    records_fetched: input.fetched,
    records_inserted: input.inserted,
    records_updated: 0,
    records_skipped: input.skipped,
    error_count: input.errorCount,
    last_error: input.lastError,
    duration_ms: Math.max(0, Date.parse(input.completed) - Date.parse(input.started)),
    metadata: {
      source: SOURCE,
      targetDate: input.date,
      researchOnly: true,
      diagnosticOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      historicalOddsApiCalls: 0,
      targetMarkets: ['run_line', 'total'],
      vendors: ['betmgm', 'betrivers'],
      ...input.metadata,
    },
    created_at: input.completed,
    updated_at: input.completed,
  })

  if (write.error) throw new Error('JOB_WRITE_FAILED:' + write.error.message)
}

async function processDate(date: string) {
  const started = new Date().toISOString()

  try {
    const features = await featureGames(date)
    const [games, opening] = await Promise.all([
      fetchPaged('https://api.balldontlie.io/mlb/v1/games', date, MAX_GAMES_PAGES_PER_DATE, {
        season_type: 'regular',
      }),
      fetchPaged('https://api.balldontlie.io/mlb/v1/odds/opening', date, MAX_OPENING_PAGES_PER_DATE),
    ])

    const gameMapping = mapGames(features, games.rows as BdlGame[])
    const normalized = normalize(date, opening.rows as BdlOpening[], gameMapping.byProviderId)
    const existing = await existingIds(normalized.rows.map((row) => String(row.id)))
    const fresh = normalized.rows.filter((row) => !existing.has(String(row.id)))

    for (let offset = 0; offset < fresh.length; offset += 500) {
      const write = await supabaseAdmin.from(TARGET_TABLE).insert(fresh.slice(offset, offset + 500))
      if (write.error) throw new Error('INSERT_FAILED:' + write.error.message)
    }

    const completed = new Date().toISOString()
    await recordJob({
      date,
      status: 'completed',
      started,
      completed,
      fetched: games.rows.length + opening.rows.length,
      inserted: fresh.length,
      skipped: existing.size + normalized.blockedContracts.length + normalized.unmatchedOpeningRows,
      errorCount: 0,
      lastError: null,
      metadata: {
        xyearGames: features.length,
        providerGames: games.rows.length,
        openingRows: opening.rows.length,
        providerCallsMade: games.pages + opening.pages,
        mappedCanonicalGames: gameMapping.mappedCanonicalGames,
        mappingAnomalies: gameMapping.anomalies,
        normalizedRows: normalized.rows.length,
        existingRows: existing.size,
        blockedContracts: normalized.blockedContracts,
        unmatchedOpeningRows: normalized.unmatchedOpeningRows,
      },
    })

    return {
      date,
      success: true,
      xyearGames: features.length,
      providerGames: games.rows.length,
      openingRows: opening.rows.length,
      providerCallsMade: games.pages + opening.pages,
      mappedCanonicalGames: gameMapping.mappedCanonicalGames,
      insertedRows: fresh.length,
      reusedRows: existing.size,
      blockedContractCount: normalized.blockedContracts.length,
    }
  } catch (error) {
    const completed = new Date().toISOString()
    const message = error instanceof Error ? error.message : 'UNKNOWN_BACKFILL_ERROR'
    await recordJob({
      date,
      status: 'failed',
      started,
      completed,
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

export async function runMlbBdlOpeningRunlineTotal2026Batch() {
  const base = {
    success: true,
    researchOnly: true,
    diagnosticOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    historicalOddsApiCalls: 0,
    provider: PROVIDER,
    vendors: ['betmgm', 'betrivers'],
    targetMarkets: ['run_line', 'total'],
    targetTable: TARGET_TABLE,
    maxDatesPerBatch: MAX_DATES_PER_BATCH,
  }

  if (!apiKey()) {
    return { ...base, success: false, status: 'BLOCKED_MISSING_BALLDONTLIE_API_KEY', done: false }
  }

  const [dates, completed] = await Promise.all([seasonDates(), completedDates()])
  const pending = dates.filter((date) => !completed.has(date))

  if (!pending.length) {
    const count = await supabaseAdmin.from(TARGET_TABLE).select('id', { count: 'exact', head: true })
    if (count.error) throw new Error('FINAL_COUNT_FAILED:' + count.error.message)
    return {
      ...base,
      status: 'BACKFILL_COMPLETE',
      done: true,
      totalDates: dates.length,
      completedDates: completed.size,
      remainingDates: 0,
      storedRows: count.count ?? null,
      processedDates: 0,
    }
  }

  const batch = pending.slice(0, MAX_DATES_PER_BATCH)
  const results = []

  for (const date of batch) {
    results.push(await processDate(date))
    await sleep(REQUEST_PAUSE_MS)
  }

  const after = await completedDates()
  const remaining = dates.filter((date) => !after.has(date)).length

  return {
    ...base,
    status: remaining === 0 ? 'BACKFILL_COMPLETE' : 'BACKFILL_BATCH_COMPLETE',
    done: remaining === 0,
    totalDates: dates.length,
    completedDates: after.size,
    remainingDates: remaining,
    processedDates: results.length,
    insertedRows: results.reduce((sum: number, row: any) => sum + Number(row.insertedRows ?? 0), 0),
    providerCallsMade: results.reduce((sum: number, row: any) => sum + Number(row.providerCallsMade ?? 0), 0),
    failedDates: results.filter((row: any) => !row.success).map((row: any) => row.date),
    dates: results,
  }
}
