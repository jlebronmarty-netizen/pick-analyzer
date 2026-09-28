import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isMlbModelGameType } from '@/services/mlb-game-type-policy'

const TABLE = 'mlb_exact_line_forward_shadow_v1'
const SEASON = 2026

type JsonMap = Record<string, unknown>

type Contract = {
  id: string
  market: 'pitcher_strikeouts' | 'pitcher_outs'
  direction: 'OVER' | 'UNDER'
  line: number
  threshold: number
  comparison: 'GTE' | 'LTE'
  accuracy2025: number
  accuracy2026: number
}

const CONTRACTS: Contract[] = [
  {
    id: 'MLB_PITCHER_K_O3P5_FORWARD_SHADOW_V1/1.0.0',
    market: 'pitcher_strikeouts',
    direction: 'OVER',
    line: 3.5,
    threshold: 4.25,
    comparison: 'GTE',
    accuracy2025: 0.7594,
    accuracy2026: 0.7603,
  },
  {
    id: 'MLB_PITCHER_K_U7P5_FORWARD_SHADOW_V1/1.0.0',
    market: 'pitcher_strikeouts',
    direction: 'UNDER',
    line: 7.5,
    threshold: 5.5,
    comparison: 'LTE',
    accuracy2025: 0.9019,
    accuracy2026: 0.9059,
  },
  {
    id: 'MLB_PITCHER_K_U8P5_FORWARD_SHADOW_V1/1.0.0',
    market: 'pitcher_strikeouts',
    direction: 'UNDER',
    line: 8.5,
    threshold: 4.75,
    comparison: 'LTE',
    accuracy2025: 0.9654,
    accuracy2026: 0.9656,
  },
  {
    id: 'MLB_PITCHER_OUTS_O13P5_FORWARD_SHADOW_V1/1.0.0',
    market: 'pitcher_outs',
    direction: 'OVER',
    line: 13.5,
    threshold: 16.0,
    comparison: 'GTE',
    accuracy2025: 0.8468,
    accuracy2026: 0.8503,
  },
  {
    id: 'MLB_PITCHER_OUTS_O14P5_FORWARD_SHADOW_V1/1.0.0',
    market: 'pitcher_outs',
    direction: 'OVER',
    line: 14.5,
    threshold: 15.75,
    comparison: 'GTE',
    accuracy2025: 0.7711442786069652,
    accuracy2026: 0.7896189950303699,
  },
]

type Quote = {
  id: string
  sportsbook: string
  market: string
  outcome: string
  price: number
  line: number
  snapshot_time: string
  metadata: JsonMap | null
}

type PitcherGame = {
  game_pk: number
  game_date: string
  pitcher: number
  starter: boolean
  batters_faced: number | null
  strikeouts: number | null
  outs: number | null
}

function record(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {}
}

function finite(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function integer(value: unknown) {
  const n = Number(value)
  return Number.isSafeInteger(n) ? n : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 40)
}

function puertoRicoDate(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Puerto_Rico',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function phaseForGameType(gameType: string) {
  return gameType === 'R' ? 'REGULAR_SEASON' : 'POSTSEASON'
}

function qualifies(contract: Contract, projection: number) {
  return contract.comparison === 'GTE'
    ? projection >= contract.threshold
    : projection <= contract.threshold
}

function sideMatches(contract: Contract, outcome: string) {
  const normalized = outcome.trim().toUpperCase()
  return normalized === contract.direction
}

function quotePlayerId(quote: Quote) {
  const metadata = record(quote.metadata)
  return integer(metadata.pitcherMlbamId ?? metadata.playerMlbamId)
}

function quotePlayerName(quote: Quote) {
  const metadata = record(quote.metadata)
  return text(metadata.canonicalPlayerName ?? metadata.pitcherName ?? metadata.providerPlayerName)
}

function quoteGamePk(quote: Quote) {
  const metadata = record(quote.metadata)
  return integer(metadata.canonicalGamePk)
}

function quoteTargetStart(quote: Quote) {
  const metadata = record(quote.metadata)
  const value = text(metadata.targetStart)
  if (!value || !Number.isFinite(Date.parse(value))) return null
  return new Date(value).toISOString()
}

function allowedQuoteSource(quote: Quote) {
  const metadata = record(quote.metadata)
  return [
    'MLB_APPROVED_PROP_MARKET_CAPTURE_V1',
    'MLB_APPROVED_PROP_MARKET_CAPTURE_BDL_FALLBACK_V1',
  ].includes(String(metadata.source ?? ''))
}

function pickDisplayQuote(quotes: Quote[]) {
  const latestByBook = new Map<string, Quote>()
  for (const quote of [...quotes].sort((a, b) => Date.parse(a.snapshot_time) - Date.parse(b.snapshot_time))) {
    latestByBook.set(String(quote.sportsbook).toLowerCase(), quote)
  }
  const latest = [...latestByBook.values()]
  const fanduel = latest.find((quote) => String(quote.sportsbook).toLowerCase() === 'fanduel')
  if (fanduel) return { display: fanduel, all: latest }
  const best = [...latest].sort((a, b) => Number(b.price) - Number(a.price))[0] ?? null
  return { display: best, all: latest }
}

function projectK(history: PitcherGame[]) {
  if (history.length < 5) return null
  const ordered = [...history].sort((a, b) => b.game_date.localeCompare(a.game_date) || b.game_pk - a.game_pk)
  const priorK = ordered.reduce((sum, row) => sum + (finite(row.strikeouts) ?? 0), 0)
  const priorBf = ordered.reduce((sum, row) => sum + (finite(row.batters_faced) ?? 0), 0)
  const l5 = ordered.slice(0, 5)
  const l5K = l5.reduce((sum, row) => sum + (finite(row.strikeouts) ?? 0), 0) / l5.length
  const l5Bf = l5.reduce((sum, row) => sum + (finite(row.batters_faced) ?? 0), 0) / l5.length
  if (priorBf <= 0 || !Number.isFinite(l5K) || !Number.isFinite(l5Bf)) return null
  return Math.max(0, 0.60 * ((priorK / priorBf) * l5Bf) + 0.40 * l5K)
}

function projectOuts(history: PitcherGame[]) {
  if (history.length < 5) return null
  const ordered = [...history].sort((a, b) => b.game_date.localeCompare(a.game_date) || b.game_pk - a.game_pk)
  const season = ordered.reduce((sum, row) => sum + (finite(row.outs) ?? 0), 0) / ordered.length
  const l5 = ordered.slice(0, 5).reduce((sum, row) => sum + (finite(row.outs) ?? 0), 0) / 5
  if (!Number.isFinite(season) || !Number.isFinite(l5)) return null
  return 0.50 * season + 0.50 * l5
}

async function loadQuotes(targetDate: string) {
  const utcStart = new Date(`${targetDate}T00:00:00-04:00`).toISOString()
  const utcEnd = new Date(new Date(utcStart).getTime() + 24 * 60 * 60 * 1000).toISOString()
  const rows: Quote[] = []
  for (let offset = 0; ; offset += 500) {
    const response = await supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id,sportsbook,market,outcome,price,line,snapshot_time,metadata')
      .in('market', ['pitcher_strikeouts', 'pitcher_outs'])
      .gte('snapshot_time', utcStart)
      .lt('snapshot_time', utcEnd)
      .order('snapshot_time', { ascending: true })
      .range(offset, offset + 499)
    if (response.error) throw new Error(`MLB_EXACT_LINE_QUOTE_READ_FAILED:${response.error.message}`)
    rows.push(...((response.data ?? []) as Quote[]))
    if (!response.data || response.data.length < 500) break
  }
  return rows.filter(allowedQuoteSource)
}

async function loadGameContext(gamePks: number[]) {
  const response = await supabaseAdmin
    .from('pick2_mlb_games')
    .select('game_pk,game_type,scheduled_at')
    .eq('season', SEASON)
    .in('game_pk', [...new Set(gamePks)])
  if (response.error) throw new Error(`MLB_EXACT_LINE_GAME_CONTEXT_FAILED:${response.error.message}`)
  return new Map((response.data ?? []).flatMap((row) => {
    const gamePk = integer(row.game_pk)
    const gameType = text(row.game_type)
    if (gamePk === null || !gameType || !isMlbModelGameType(gameType)) return []
    return [[gamePk, {
      gameType,
      startTime: String(row.scheduled_at),
      seasonPhase: phaseForGameType(gameType),
    }]]
  }))
}

async function loadHistory(pitcherIds: number[], targetDate: string) {
  const rows: PitcherGame[] = []
  const ids = [...new Set(pitcherIds)]
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100)
    const response = await supabaseAdmin
      .from('mlb_ml_xyear_pitcher_game_v1')
      .select('game_pk,game_date,pitcher,starter,batters_faced,strikeouts,outs')
      .eq('season', SEASON)
      .eq('starter', true)
      .in('pitcher', chunk)
      .lt('game_date', targetDate)
      .order('game_date', { ascending: false })
      .order('game_pk', { ascending: false })
    if (response.error) throw new Error(`MLB_EXACT_LINE_HISTORY_READ_FAILED:${response.error.message}`)
    rows.push(...((response.data ?? []) as PitcherGame[]))
  }
  const byPitcher = new Map<number, PitcherGame[]>()
  for (const row of rows) {
    const bucket = byPitcher.get(Number(row.pitcher)) ?? []
    bucket.push(row)
    byPitcher.set(Number(row.pitcher), bucket)
  }
  return byPitcher
}

export async function freezeMlbExactLineForwardShadows(input: { targetDate?: string; now?: Date } = {}) {
  const now = input.now ?? new Date()
  const targetDate = input.targetDate ?? puertoRicoDate(now)
  if (targetDate !== puertoRicoDate(now)) {
    return {
      success: false,
      status: 'BLOCK_NONCURRENT_FORWARD_FREEZE',
      targetDate,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
    }
  }

  const quotes = await loadQuotes(targetDate)
  const candidates = quotes.flatMap((quote) => {
    const gamePk = quoteGamePk(quote)
    const playerId = quotePlayerId(quote)
    const playerName = quotePlayerName(quote)
    const targetStart = quoteTargetStart(quote)
    if (gamePk === null || playerId === null || !playerName || !targetStart) return []
    if (Date.parse(targetStart) <= now.getTime()) return []
    if (Date.parse(quote.snapshot_time) >= Date.parse(targetStart)) return []
    return [{ quote, gamePk, playerId, playerName, targetStart }]
  })

  const gameContext = await loadGameContext(candidates.map((item) => item.gamePk))
  const history = await loadHistory(candidates.map((item) => item.playerId), targetDate)

  const grouped = new Map<string, typeof candidates>()
  for (const item of candidates) {
    for (const contract of CONTRACTS) {
      if (item.quote.market !== contract.market) continue
      if (Number(item.quote.line) !== contract.line) continue
      if (!sideMatches(contract, item.quote.outcome)) continue
      const key = [item.gamePk, item.playerId, contract.id].join('|')
      const bucket = grouped.get(key) ?? []
      bucket.push(item)
      grouped.set(key, bucket)
    }
  }

  const rows: Array<Record<string, unknown>> = []
  let blockedGameContext = 0
  let blockedHistory = 0
  let notQualified = 0

  for (const bucket of grouped.values()) {
    const first = bucket[0]
    if (!first) continue
    const contract = CONTRACTS.find((item) =>
      item.market === first.quote.market &&
      item.line === Number(first.quote.line) &&
      sideMatches(item, first.quote.outcome)
    )
    if (!contract) continue

    const context = gameContext.get(first.gamePk)
    if (!context) { blockedGameContext++; continue }

    const pitcherHistory = history.get(first.playerId) ?? []
    if (pitcherHistory.length < 5) { blockedHistory++; continue }

    const projection = contract.market === 'pitcher_strikeouts'
      ? projectK(pitcherHistory)
      : projectOuts(pitcherHistory)
    if (projection === null) { blockedHistory++; continue }
    if (!qualifies(contract, projection)) { notQualified++; continue }

    const selectedQuotes = bucket.map((item) => item.quote)
    const { display, all } = pickDisplayQuote(selectedQuotes)
    if (!display) continue

    const orderedHistory = [...pitcherHistory].sort((a, b) => b.game_date.localeCompare(a.game_date) || b.game_pk - a.game_pk)
    const id = 'mlbxlfwd_' + hash([targetDate, first.gamePk, contract.id, first.playerId])

    rows.push({
      id,
      tracking_date: targetDate,
      game_pk: first.gamePk,
      start_time: context.startTime,
      game_type: context.gameType,
      season_phase: context.seasonPhase,
      market: contract.market,
      contract_id: contract.id,
      player_mlbam_id: first.playerId,
      player_name: first.playerName,
      direction: contract.direction,
      exact_line: contract.line,
      sportsbook: display.sportsbook,
      price: display.price,
      odds_snapshot_id: display.id,
      quotes: all,
      projection,
      threshold: contract.threshold,
      historical_accuracy_2025: contract.accuracy2025,
      historical_accuracy_2026_diagnostic: contract.accuracy2026,
      evidence_class: context.seasonPhase === 'POSTSEASON'
        ? 'POSTSEASON_SHADOW_DOMAIN_SHIFT'
        : 'REGULAR_SEASON_FORWARD',
      freeze_timestamp: now.toISOString(),
      latest_prior_date: orderedHistory[0].game_date,
      prior_starts: pitcherHistory.length,
      result: null,
      actual_value: null,
      settled_at: null,
      metadata: {
        selectionIndependentOfPrice: true,
        quotePolicy: 'FANDUEL_FIRST_ELSE_HIGHEST_AMERICAN_PRICE',
        allQuotesRetained: true,
        sourceRule: 'source_game_date < target_game_date',
        noSameDayHistory: true,
        historicalAccuracyIsNotPerPlayProbability: true,
      },
      research_only: true,
      production_eligible: false,
      official_picks_eligible: false,
      apostar_enabled: false,
      updated_at: now.toISOString(),
    })
  }

  let inserted = 0
  for (let offset = 0; offset < rows.length; offset += 100) {
    const chunk = rows.slice(offset, offset + 100)
    const response = await supabaseAdmin
      .from(TABLE)
      .upsert(chunk, { onConflict: 'tracking_date,game_pk,contract_id,player_mlbam_id', ignoreDuplicates: true })
    if (response.error) throw new Error(`MLB_EXACT_LINE_FORWARD_WRITE_FAILED:${response.error.message}`)
    inserted += chunk.length
  }

  return {
    success: true,
    status: 'MLB_EXACT_LINE_FORWARD_SHADOWS_FROZEN',
    targetDate,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    evaluatedQuoteRows: quotes.length,
    contractGroups: grouped.size,
    qualifiedRows: rows.length,
    insertedOrReused: inserted,
    blockedGameContext,
    blockedHistory,
    notQualified,
    contracts: CONTRACTS.map((contract) => contract.id),
  }
}

export async function settleMlbExactLineForwardShadows(input: { throughDate?: string } = {}) {
  const throughDate = input.throughDate ?? puertoRicoDate()
  const response = await supabaseAdmin
    .from(TABLE)
    .select('id,tracking_date,game_pk,market,contract_id,player_mlbam_id,direction,exact_line,result')
    .is('result', null)
    .lt('tracking_date', throughDate)
    .order('tracking_date', { ascending: true })
    .limit(1000)
  if (response.error) throw new Error(`MLB_EXACT_LINE_OPEN_READ_FAILED:${response.error.message}`)

  const open = response.data ?? []
  if (!open.length) {
    return {
      success: true,
      status: 'NO_OPEN_EXACT_LINE_FORWARD_ROWS',
      writes: 0,
      researchOnly: true,
      officialPicksModified: false,
      apostarActivated: false,
    }
  }

  const gamePks = [...new Set(open.map((row) => Number(row.game_pk)))]
  const pitcherIds = [...new Set(open.map((row) => Number(row.player_mlbam_id)))]
  const outcomes = await supabaseAdmin
    .from('mlb_ml_xyear_pitcher_game_v1')
    .select('game_pk,game_date,pitcher,strikeouts,outs')
    .eq('season', SEASON)
    .in('game_pk', gamePks)
    .in('pitcher', pitcherIds)
  if (outcomes.error) throw new Error(`MLB_EXACT_LINE_OUTCOME_READ_FAILED:${outcomes.error.message}`)

  const byKey = new Map((outcomes.data ?? []).map((row) => [`${row.game_pk}:${row.pitcher}`, row]))
  let writes = 0
  const settledAt = new Date().toISOString()

  for (const row of open) {
    const outcome = byKey.get(`${row.game_pk}:${row.player_mlbam_id}`)
    if (!outcome) continue
    const actual = row.market === 'pitcher_strikeouts'
      ? finite(outcome.strikeouts)
      : row.market === 'pitcher_outs'
        ? finite(outcome.outs)
        : null
    if (actual === null) continue

    const line = Number(row.exact_line)
    const direction = String(row.direction)
    const result = actual === line
      ? 'PUSH'
      : direction === 'OVER'
        ? (actual > line ? 'WIN' : 'LOSS')
        : (actual < line ? 'WIN' : 'LOSS')

    const update = await supabaseAdmin
      .from(TABLE)
      .update({
        result,
        actual_value: actual,
        settled_at: settledAt,
        updated_at: settledAt,
      })
      .eq('id', row.id)
      .is('result', null)
    if (update.error) throw new Error(`MLB_EXACT_LINE_SETTLEMENT_WRITE_FAILED:${update.error.message}`)
    writes++
  }

  return {
    success: true,
    status: writes ? 'MLB_EXACT_LINE_FORWARD_ROWS_SETTLED' : 'WAITING_FOR_EXACT_LINE_OUTCOMES',
    writes,
    openRows: open.length,
    researchOnly: true,
    officialPicksModified: false,
    apostarActivated: false,
  }
}
