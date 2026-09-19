import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { getMlbPitcherBbShadowProjection } from '@/services/mlb-pitcher-bb-shadow.service'

const CAPTURE_SOURCE = 'MLB_APPROVED_PROP_MARKET_CAPTURE_V1'
const JOB_TYPE = 'mlb_approved_prop_daily_freeze_v1'
const PAGE_SIZE = 1000

type JsonMap = Record<string, unknown>
type GameRow = { game_pk: number; scheduled_at: string; metadata: JsonMap | null }
type Quote = {
  id: string
  event_id: string
  sportsbook: string
  market: string
  outcome: string
  price: number | string | null
  line: number | string | null
  snapshot_time: string
  metadata: JsonMap | null
}
type PitcherFeature = {
  target_game_pk: number
  mlbam_pitcher_id: number
  previous_pitch_count: number | string | null
  feature_date: string
  as_of_date: string
  source_window: JsonMap | null
}
type LedgerRow = Record<string, unknown>

const PENDING_DEFS = [
  { market: 'pitcher_earned_runs', candidateId: 'pitcher_er_over_1p5_p70_v1', direction: 'OVER', line: 1.5, accuracy: 0.802197802197802, playerType: 'pitcher' },
  { market: 'pitcher_hits_allowed', candidateId: 'pitcher_hits_allowed_under_6p5_proj_5p0_v1', direction: 'UNDER', line: 6.5, accuracy: 0.789559543230016, playerType: 'pitcher' },
  { market: 'batter_singles', candidateId: 'batter_singles_under_1p5_proj_0p50_v1', direction: 'UNDER', line: 1.5, accuracy: 0.9308, playerType: 'batter' },
  { market: 'batter_doubles', candidateId: 'batter_doubles_under_0p5_proj_0p16_v1', direction: 'UNDER', line: 0.5, accuracy: 0.8693, playerType: 'batter' },
  { market: 'batter_triples', candidateId: 'batter_triples_under_0p5_proj_0p015_v1', direction: 'UNDER', line: 0.5, accuracy: 0.9882, playerType: 'batter' },
] as const

function asRecord(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {}
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 30)
}

function normalizePerson(value: string) {
  const trimmed = value.trim()
  const ordered = trimmed.includes(',')
    ? trimmed.split(',').slice(1).join(',').trim() + ' ' + trimmed.split(',')[0].trim()
    : trimmed
  return ordered
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function puertoRicoClock(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Puerto_Rico',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  )
  return {
    date: String(parts.year) + '-' + String(parts.month) + '-' + String(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

function probablePitchers(game: GameRow) {
  const metadata = asRecord(game.metadata)
  const out: Array<{ id: number; name: string }> = []
  for (const key of ['homeProbablePitcher', 'awayProbablePitcher']) {
    const value = asRecord(metadata[key])
    const id = n(value.id)
    const name = typeof value.fullName === 'string' ? value.fullName : ''
    if (id !== null && name) out.push({ id, name })
  }
  return out
}

function quoteGamePk(quote: Quote) {
  return n(asRecord(quote.metadata).canonicalGamePk)
}

function quotePlayer(quote: Quote) {
  return String(asRecord(quote.metadata).providerPlayerName ?? '').trim()
}

function requiredOutcome(direction: string) {
  if (direction === 'UNDER') return 'under'
  if (direction === 'OVER') return 'over'
  if (direction === 'NO') return 'no'
  return 'yes'
}

function bestQuote(input: {
  quotes: Quote[]
  gamePk: number
  market: string
  playerName: string
  direction: string
  line: number | null
}) {
  const playerKey = normalizePerson(input.playerName)
  const outcome = requiredOutcome(input.direction)
  const candidates = input.quotes.filter((quote) => {
    if (quoteGamePk(quote) !== input.gamePk || quote.market !== input.market) return false
    if (normalizePerson(quotePlayer(quote)) !== playerKey || quote.outcome.toLowerCase() !== outcome) return false
    if (input.line === null) return true
    const line = n(quote.line)
    return line !== null && Math.abs(line - input.line) < 1e-9
  })
  candidates.sort((a, b) => (n(b.price) ?? -Infinity) - (n(a.price) ?? -Infinity) || b.snapshot_time.localeCompare(a.snapshot_time))
  return candidates[0] ?? null
}

function observedLines(quotes: Quote[], gamePk: number, market: string, playerName: string) {
  const playerKey = normalizePerson(playerName)
  return Array.from(new Set(
    quotes
      .filter((quote) => quoteGamePk(quote) === gamePk && quote.market === market && normalizePerson(quotePlayer(quote)) === playerKey)
      .map((quote) => n(quote.line))
      .filter((line): line is number => line !== null),
  )).sort((a, b) => a - b)
}

function statusFor(modelQualifies: boolean, marketVerified: boolean) {
  if (!modelQualifies) return 'NO_PLAY'
  return marketVerified ? 'QUALIFIES_MARKET_VERIFIED' : 'MODEL_QUALIFIES_MARKET_NOT_VERIFIED'
}

function ledgerRow(input: {
  date: string
  game: GameRow
  market: string
  candidateId: string
  playerId: number | null
  playerName: string
  direction: string
  line: number | null
  accuracy: number | null
  projection?: number | null
  probability?: number | null
  qualifies?: boolean | null
  quote?: Quote | null
  status: string
  blocker?: string | null
  featureSnapshot?: JsonMap
  marketSnapshot?: JsonMap
  frozenAt: string
}): LedgerRow {
  const quote = input.quote ?? null
  return {
    id: 'approvedprop_' + hash([input.date, input.game.game_pk, input.candidateId, input.playerId, normalizePerson(input.playerName)]),
    tracking_date: input.date,
    game_pk: input.game.game_pk,
    start_time: input.game.scheduled_at,
    market: input.market,
    candidate_id: input.candidateId,
    player_mlbam_id: input.playerId,
    player_name: input.playerName,
    direction: input.direction,
    required_line: input.line,
    sportsbook: quote?.sportsbook ?? null,
    observed_line: quote ? n(quote.line) : null,
    price: quote ? n(quote.price) : null,
    odds_snapshot_id: quote?.id ?? null,
    model_projection: input.projection ?? null,
    model_probability: input.probability ?? null,
    historical_accuracy: input.accuracy,
    model_qualifies: input.qualifies ?? null,
    market_verified: Boolean(quote),
    status: input.status,
    blocker: input.blocker ?? null,
    feature_snapshot: input.featureSnapshot ?? {},
    market_snapshot: input.marketSnapshot ?? {},
    frozen_at: input.frozenAt,
    research_only: true,
    production_eligible: false,
    official_picks_eligible: false,
    apostar_enabled: false,
    updated_at: input.frozenAt,
  }
}

async function pagedRead<T>(table: string, columns: string, configure: (query: any) => any): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = configure(supabaseAdmin.from(table).select(columns)).range(offset, offset + PAGE_SIZE - 1)
    const result = await query
    if (result.error) throw new Error('MLB_APPROVED_PROP_READ_FAILED:' + table + ':' + result.error.message)
    rows.push(...((result.data ?? []) as T[]))
    if (!result.data || result.data.length < PAGE_SIZE) break
  }
  return rows
}

async function loadQuotes(targetDate: string): Promise<Quote[]> {
  const range = puertoRicoUtcRange(targetDate)
  const rows = await pagedRead<Quote>(
    'sports_odds_snapshots',
    'id,event_id,sportsbook,market,outcome,price,line,snapshot_time,metadata',
    (query) => query.eq('provider', 'the-odds-api').gte('snapshot_time', range.utcStart).lt('snapshot_time', range.utcEndExclusive).order('snapshot_time', { ascending: true }),
  )
  return rows.filter((row) => asRecord(row.metadata).source === CAPTURE_SOURCE)
}

async function loadPlayers() {
  const rows = await pagedRead<{ mlbam_person_id: number; full_name: string }>(
    'pick2_mlb_players',
    'mlbam_person_id,full_name',
    (query) => query.order('mlbam_person_id', { ascending: true }),
  )
  const map = new Map<string, Array<{ id: number; name: string }>>()
  for (const row of rows) {
    const key = normalizePerson(String(row.full_name))
    if (!key) continue
    const bucket = map.get(key) ?? []
    bucket.push({ id: Number(row.mlbam_person_id), name: String(row.full_name) })
    map.set(key, bucket)
  }
  return map
}

async function loadPitcherFeatures(targetDate: string) {
  const result = await supabaseAdmin
    .from('pick2_mlb_pitcher_daily_features')
    .select('target_game_pk,mlbam_pitcher_id,previous_pitch_count,feature_date,as_of_date,source_window')
    .eq('feature_date', targetDate)
    .eq('feature_version', 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1')
    .order('target_game_pk', { ascending: true })
  if (result.error) throw new Error('MLB_APPROVED_PROP_PITCHER_FEATURE_READ_FAILED:' + result.error.message)
  return (result.data ?? []) as PitcherFeature[]
}

async function pitcherOutsResiduals() {
  const rows = await pagedRead<any>(
    'mlb_pitcher_prop_backtest_2025_v1_enriched',
    'fixed_split,target_outs,prior_outs_l5,prior_outs_all,previous_pitch_count,prior_pitch_count_all',
    (query) => query.eq('fixed_split', 'TRAIN'),
  )
  return rows.flatMap((row) => {
    const actual = n(row.target_outs)
    const l5 = n(row.prior_outs_l5)
    const all = n(row.prior_outs_all)
    const previous = n(row.previous_pitch_count)
    const pitchAll = n(row.prior_pitch_count_all)
    if (actual === null || l5 === null || all === null || previous === null || pitchAll === null || pitchAll <= 0) return []
    const raw = 0.7 * (0.2 * l5 + 0.8 * all) + 0.3 * (previous * (all / pitchAll))
    const predicted = 7.2635858445929635 + 0.547385023095297 * raw
    return [actual - predicted]
  }).sort((a, b) => a - b)
}

function residualAboveProbability(sorted: number[], threshold: number) {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (sorted[mid] <= threshold) low = mid + 1
    else high = mid
  }
  return sorted.length ? (sorted.length - low) / sorted.length : 0
}

async function loadSportsDataStarters() {
  return pagedRead<any>(
    'sport_player_stats',
    'player_name,stats',
    (query) => query
      .eq('sport_key', 'baseball_mlb')
      .eq('league_key', 'mlb')
      .eq('season', '2026')
      .eq('stat_type', 'game')
      .eq('provider', 'sportsdataio')
      .eq('stats->>Started', '1')
      .gt('stats->>PitchesThrown', 0)
      .order('source_timestamp', { ascending: true }),
  )
}

function pitcherOutsProjection(input: {
  pitcherName: string
  previousPitchCount: number
  targetDate: string
  starters: any[]
  residuals: number[]
}) {
  const key = normalizePerson(input.pitcherName)
  const history = input.starters.flatMap((row) => {
    if (normalizePerson(String(row.player_name ?? '')) !== key) return []
    const stats = asRecord(row.stats)
    const date = String(stats.Day ?? '').slice(0, 10)
    const outs = n(stats.TotalOutsPitched)
    const pitches = n(stats.PitchesThrown)
    if (!date || date >= input.targetDate || outs === null || pitches === null || pitches <= 0) return []
    return [{ date, outs, pitches }]
  }).sort((a, b) => a.date.localeCompare(b.date))
  if (!history.length) return null
  const priorOutsAll = mean(history.map((row) => row.outs))
  const priorOutsL5 = mean(history.slice(-5).map((row) => row.outs))
  const priorPitchCountAll = mean(history.map((row) => row.pitches))
  if (priorOutsAll === null || priorOutsL5 === null || priorPitchCountAll === null || priorPitchCountAll <= 0) return null
  const raw = 0.7 * (0.2 * priorOutsL5 + 0.8 * priorOutsAll)
    + 0.3 * (input.previousPitchCount * (priorOutsAll / priorPitchCountAll))
  const predicted = 7.2635858445929635 + 0.547385023095297 * raw
  const pOver = residualAboveProbability(input.residuals, 18.5 - predicted)
  return {
    predicted,
    pUnder: 1 - pOver,
    priorStarts: history.length,
    priorOutsAll,
    priorOutsL5,
    priorPitchCountAll,
    latestPriorDate: history[history.length - 1].date,
  }
}

async function loadBatterHits(ids: number[], targetDate: string) {
  if (!ids.length) return [] as any[]
  return pagedRead<any>(
    'mlb_statcast_batter_game_logs',
    'game_pk,game_date,batter,hits,home_runs,strikeouts,walks,plate_appearances',
    (query) => query.eq('season', 2026).in('batter', ids).lt('game_date', targetDate).gte('plate_appearances', 1).order('game_date', { ascending: true }).order('game_pk', { ascending: true }),
  )
}

async function loadBatterTb(ids: number[], targetDate: string) {
  if (!ids.length) return [] as any[]
  return pagedRead<any>(
    'mlb_statcast_batter_total_bases_game_mv',
    'game_pk,game_date,batter,total_bases,plate_appearances',
    (query) => query.eq('season', 2026).in('batter', ids).lt('game_date', targetDate).gte('plate_appearances', 1).order('game_date', { ascending: true }).order('game_pk', { ascending: true }),
  )
}

function batterLinearProjection(
  rows: any[],
  playerId: number,
  metric: 'hits' | 'home_runs' | 'strikeouts' | 'walks' | 'total_bases',
  intercept: number,
  slope: number,
) {
  const history = rows.filter((row) => Number(row.batter) === playerId)
  if (history.length < 10) return null
  const recent = history.slice(-10)
  const priorPa = history.reduce((sum, row) => sum + Number(row.plate_appearances ?? 0), 0)
  const priorY = history.reduce((sum, row) => sum + Number(row[metric] ?? 0), 0)
  const recentPa = recent.reduce((sum, row) => sum + Number(row.plate_appearances ?? 0), 0)
  if (priorPa <= 0 || recentPa <= 0) return null
  const raw = (recentPa / recent.length) * (priorY / priorPa)
  return {
    predicted: Math.max(0, intercept + slope * raw),
    priorGames: history.length,
    priorPa,
    recentPaPerGame: recentPa / recent.length,
    priorRate: priorY / priorPa,
    latestPriorDate: String(history[history.length - 1].game_date),
  }
}

async function existingFreeze(targetDate: string) {
  const result = await supabaseAdmin
    .from('mlb_approved_prop_daily_v1')
    .select('id,status')
    .eq('tracking_date', targetDate)
    .limit(1)
  if (result.error) throw new Error('MLB_APPROVED_PROP_EXISTING_FREEZE_READ_FAILED:' + result.error.message)
  return result.data?.[0] ?? null
}

export async function evaluateMlbApprovedPropsDaily(input: { targetDate?: string; now?: Date } = {}) {
  const now = input.now ?? new Date()
  const clock = puertoRicoClock(now)
  const targetDate = input.targetDate ?? clock.date
  const base = {
    success: true,
    targetDate,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    writes: 0,
  }
  if (targetDate !== clock.date) return { ...base, success: false, status: 'BLOCK_NONCURRENT_WRITE_DATE' }
  if (clock.hour !== 10 || clock.minute < 45) return { ...base, status: 'NOT_IN_FREEZE_WINDOW' }
  if (await existingFreeze(targetDate)) {
    const summary = await getMlbApprovedPropsDailyBoard(targetDate)
    return { ...base, status: 'REUSE_NO_OP', writes: 0, summary }
  }

  const gamesResult = await supabaseAdmin
    .from('pick2_mlb_games')
    .select('game_pk,scheduled_at,metadata')
    .eq('game_date', targetDate)
    .eq('game_type', 'R')
    .order('scheduled_at', { ascending: true })
  if (gamesResult.error) throw new Error('MLB_APPROVED_PROP_GAME_READ_FAILED:' + gamesResult.error.message)
  const games = (gamesResult.data ?? []) as unknown as GameRow[]
  if (!games.length) return { ...base, status: 'NO_SCHEDULED_GAMES' }
  const earliest = Math.min(...games.map((game) => Date.parse(game.scheduled_at)))
  if (!Number.isFinite(earliest) || now.getTime() >= earliest) {
    return { ...base, success: false, status: 'BLOCK_FREEZE_AFTER_FIRST_PITCH' }
  }

  const frozenAt = now.toISOString()
  const [quotes, features, playerMap, starters, residuals] = await Promise.all([
    loadQuotes(targetDate),
    loadPitcherFeatures(targetDate),
    loadPlayers(),
    loadSportsDataStarters(),
    pitcherOutsResiduals(),
  ])
  const gameByPk = new Map(games.map((game) => [Number(game.game_pk), game]))
  const rows: LedgerRow[] = []

  for (const feature of features) {
    const game = gameByPk.get(Number(feature.target_game_pk))
    if (!game) continue
    const pitcher = probablePitchers(game).find((item) => item.id === Number(feature.mlbam_pitcher_id))
    if (!pitcher) {
      rows.push(ledgerRow({
        date: targetDate, game, market: 'pitcher_walks', candidateId: 'pitcher_bb_under_2p5_p85_v1',
        playerId: Number(feature.mlbam_pitcher_id), playerName: 'MLBAM ' + feature.mlbam_pitcher_id,
        direction: 'UNDER', line: 2.5, accuracy: 0.912408759124088,
        status: 'NO_EVALUABLE_IDENTITY_UNRESOLVED', blocker: 'PROBABLE_PITCHER_IDENTITY_MISSING', frozenAt,
      }))
      continue
    }

    const walkQuote = bestQuote({ quotes, gamePk: game.game_pk, market: 'pitcher_walks', playerName: pitcher.name, direction: 'UNDER', line: 2.5 })
    const walk = await getMlbPitcherBbShadowProjection({ targetGamePk: game.game_pk, pitcherId: pitcher.id, line: 2.5 })
    if (walk.status !== 'READY' || walk.probability.status !== 'READY') {
      rows.push(ledgerRow({
        date: targetDate, game, market: 'pitcher_walks', candidateId: 'pitcher_bb_under_2p5_p85_v1',
        playerId: pitcher.id, playerName: pitcher.name, direction: 'UNDER', line: 2.5, accuracy: 0.912408759124088,
        projection: walk.status === 'READY' ? walk.projection.expectedWalks : null,
        quote: walkQuote, status: 'NO_EVALUABLE_FEATURE_MISSING',
        blocker: walk.status === 'READY' ? walk.probability.status : walk.status,
        marketSnapshot: { observedLines: observedLines(quotes, game.game_pk, 'pitcher_walks', pitcher.name) },
        frozenAt,
      }))
    } else {
      const qualifies = walk.probability.underProbability >= 0.85
      rows.push(ledgerRow({
        date: targetDate, game, market: 'pitcher_walks', candidateId: 'pitcher_bb_under_2p5_p85_v1',
        playerId: pitcher.id, playerName: pitcher.name, direction: 'UNDER', line: 2.5, accuracy: 0.912408759124088,
        projection: walk.projection.expectedWalks, probability: walk.probability.underProbability,
        qualifies, quote: walkQuote, status: statusFor(qualifies, Boolean(walkQuote)),
        featureSnapshot: {
          priorAppearances: walk.featureState.priorAppearances,
          priorPlateAppearances: walk.featureState.priorPlateAppearances,
          expectedBattersFaced: walk.featureState.expectedBattersFaced,
          predictionBin: walk.probability.predictionBin,
          calibrationSample: walk.probability.sampleSize,
        },
        marketSnapshot: { observedLines: observedLines(quotes, game.game_pk, 'pitcher_walks', pitcher.name) },
        frozenAt,
      }))
    }

    const previousPitchCount = n(feature.previous_pitch_count)
    const outsQuote = bestQuote({ quotes, gamePk: game.game_pk, market: 'pitcher_outs', playerName: pitcher.name, direction: 'UNDER', line: 18.5 })
    const outs = previousPitchCount === null ? null : pitcherOutsProjection({
      pitcherName: pitcher.name,
      previousPitchCount,
      targetDate,
      starters,
      residuals,
    })
    if (!outs) {
      rows.push(ledgerRow({
        date: targetDate, game, market: 'pitcher_outs', candidateId: 'pitcher_outs_under_18p5_p90_v1',
        playerId: pitcher.id, playerName: pitcher.name, direction: 'UNDER', line: 18.5, accuracy: 0.951327433628319,
        quote: outsQuote, status: 'NO_EVALUABLE_INSUFFICIENT_HISTORY', blocker: 'PITCHER_OUTS_PRIOR_START_HISTORY_MISSING',
        marketSnapshot: { observedLines: observedLines(quotes, game.game_pk, 'pitcher_outs', pitcher.name) },
        frozenAt,
      }))
    } else {
      const qualifies = outs.pUnder >= 0.90
      rows.push(ledgerRow({
        date: targetDate, game, market: 'pitcher_outs', candidateId: 'pitcher_outs_under_18p5_p90_v1',
        playerId: pitcher.id, playerName: pitcher.name, direction: 'UNDER', line: 18.5, accuracy: 0.951327433628319,
        projection: outs.predicted, probability: outs.pUnder, qualifies, quote: outsQuote,
        status: statusFor(qualifies, Boolean(outsQuote)),
        featureSnapshot: {
          previousPitchCount,
          priorStarts: outs.priorStarts,
          priorOutsAll: outs.priorOutsAll,
          priorOutsL5: outs.priorOutsL5,
          priorPitchCountAll: outs.priorPitchCountAll,
          latestPriorDate: outs.latestPriorDate,
          trainResidualN: residuals.length,
        },
        marketSnapshot: { observedLines: observedLines(quotes, game.game_pk, 'pitcher_outs', pitcher.name) },
        frozenAt,
      }))
    }
  }

  const exactBatterDefs = [
    {
      market: 'batter_hits',
      candidateId: 'batter_hits_under_1p5_edge_0p75_v1',
      metric: 'hits',
      line: 1.5,
      accuracy: 0.864029289128445,
      maxProjection: 0.75,
      intercept: 0.362037519693316,
      slope: 0.562031288216736,
      source: 'statcast',
    },
    {
      market: 'batter_total_bases',
      candidateId: 'batter_total_bases_under_2p5_edge_1p5_v1',
      metric: 'total_bases',
      line: 2.5,
      accuracy: 0.865154109589041,
      maxProjection: 1.0,
      intercept: 0.599532796678854,
      slope: 0.563175501776575,
      source: 'total_bases',
    },
    {
      market: 'batter_home_runs',
      candidateId: 'batter_hr_under_0p5_proj_0p10_v1',
      metric: 'home_runs',
      line: 0.5,
      accuracy: 0.9216,
      maxProjection: 0.10,
      intercept: 0.0562641814171271,
      slope: 0.536870614141035,
      source: 'statcast',
    },
    {
      market: 'batter_strikeouts',
      candidateId: 'batter_k_under_1p5_proj_0p5_v1',
      metric: 'strikeouts',
      line: 1.5,
      accuracy: 0.9311,
      maxProjection: 0.50,
      intercept: 0.243436273584974,
      slope: 0.713440597820141,
      source: 'statcast',
    },
    {
      market: 'batter_walks',
      candidateId: 'batter_walks_under_0p5_proj_0p20_v1',
      metric: 'walks',
      line: 0.5,
      accuracy: 0.8339,
      maxProjection: 0.20,
      intercept: 0.117815177785939,
      slope: 0.593708345578887,
      source: 'statcast',
    },
  ] as const

  const exactBatterMarkets = new Set(exactBatterDefs.map((item) => item.market))
  const exactBatterNames = Array.from(new Set(
    quotes
      .filter((quote) => exactBatterMarkets.has(quote.market as any))
      .map((quote) => quotePlayer(quote))
      .filter(Boolean),
  ))
  const resolved = new Map<string, { id: number; name: string }>()
  for (const name of exactBatterNames) {
    const matches = playerMap.get(normalizePerson(name)) ?? []
    if (matches.length === 1) resolved.set(normalizePerson(name), matches[0])
  }
  const batterIds = Array.from(new Set(Array.from(resolved.values()).map((player) => player.id)))
  const [statcastBatterLogs, tbLogs] = await Promise.all([
    loadBatterHits(batterIds, targetDate),
    loadBatterTb(batterIds, targetDate),
  ])

  for (const def of exactBatterDefs) {
    const names = Array.from(new Set(
      quotes.filter((quote) => quote.market === def.market).map((quote) => quotePlayer(quote)).filter(Boolean),
    ))
    for (const name of names) {
      const samePlayerQuotes = quotes.filter(
        (quote) => quote.market === def.market && normalizePerson(quotePlayer(quote)) === normalizePerson(name),
      )
      const gamePk = samePlayerQuotes.map(quoteGamePk).find((value): value is number => value !== null)
      if (gamePk === undefined) continue
      const game = gameByPk.get(gamePk)
      if (!game) continue
      const player = resolved.get(normalizePerson(name))
      const quote = bestQuote({
        quotes,
        gamePk,
        market: def.market,
        playerName: name,
        direction: 'UNDER',
        line: def.line,
      })
      if (!player) {
        rows.push(ledgerRow({
          date: targetDate,
          game,
          market: def.market,
          candidateId: def.candidateId,
          playerId: null,
          playerName: name,
          direction: 'UNDER',
          line: def.line,
          accuracy: def.accuracy,
          quote,
          status: 'NO_EVALUABLE_IDENTITY_UNRESOLVED',
          blocker: 'EXACT_MLBAM_NAME_MATCH_NOT_UNIQUE',
          marketSnapshot: { observedLines: observedLines(quotes, gamePk, def.market, name) },
          frozenAt,
        }))
        continue
      }
      const sourceRows = def.source === 'total_bases' ? tbLogs : statcastBatterLogs
      const projection = batterLinearProjection(
        sourceRows,
        player.id,
        def.metric,
        def.intercept,
        def.slope,
      )
      if (!projection) {
        rows.push(ledgerRow({
          date: targetDate,
          game,
          market: def.market,
          candidateId: def.candidateId,
          playerId: player.id,
          playerName: name,
          direction: 'UNDER',
          line: def.line,
          accuracy: def.accuracy,
          quote,
          status: 'NO_EVALUABLE_INSUFFICIENT_HISTORY',
          blocker: 'MINIMUM_10_PRIOR_GAMES_NOT_MET',
          marketSnapshot: { observedLines: observedLines(quotes, gamePk, def.market, name) },
          frozenAt,
        }))
        continue
      }
      const qualifies = projection.predicted <= def.maxProjection
      rows.push(ledgerRow({
        date: targetDate,
        game,
        market: def.market,
        candidateId: def.candidateId,
        playerId: player.id,
        playerName: name,
        direction: 'UNDER',
        line: def.line,
        accuracy: def.accuracy,
        projection: projection.predicted,
        qualifies,
        quote,
        status: statusFor(qualifies, Boolean(quote)),
        featureSnapshot: {
          rawFormulaAlpha: 0,
          priorGames: projection.priorGames,
          priorPa: projection.priorPa,
          priorRate: projection.priorRate,
          recentPaPerGame: projection.recentPaPerGame,
          latestPriorDate: projection.latestPriorDate,
        },
        marketSnapshot: { observedLines: observedLines(quotes, gamePk, def.market, name) },
        frozenAt,
      }))
    }
  }

  const pitcherWin = await supabaseAdmin
    .from('mlb_pitcher_win_forward_tracker_v1')
    .select('game_pk,start_time,starter_mlbam_id,pitcher_name,p_win,selected_no,threshold')
    .eq('tracking_date', targetDate)
  if (pitcherWin.error) throw new Error('MLB_APPROVED_PROP_PITCHER_WIN_READ_FAILED:' + pitcherWin.error.message)
  for (const item of pitcherWin.data ?? []) {
    const game = gameByPk.get(Number(item.game_pk))
    if (!game) continue
    const name = String(item.pitcher_name)
    const quote = bestQuote({ quotes, gamePk: game.game_pk, market: 'pitcher_record_a_win', playerName: name, direction: 'NO', line: null })
    const qualifies = item.selected_no === true
    const pWin = n(item.p_win)
    rows.push(ledgerRow({
      date: targetDate, game, market: 'pitcher_record_a_win', candidateId: 'pitcher_win_forward_numeric_p015_v1',
      playerId: Number(item.starter_mlbam_id), playerName: name, direction: 'NO', line: null,
      accuracy: 0.870748299319728, projection: pWin, probability: pWin === null ? null : 1 - pWin,
      qualifies, quote, status: statusFor(qualifies, Boolean(quote)),
      featureSnapshot: { pWin, threshold: n(item.threshold) },
      marketSnapshot: { observedLines: observedLines(quotes, game.game_pk, 'pitcher_record_a_win', name) }, frozenAt,
    }))
  }

  for (const def of PENDING_DEFS) {
    const defQuotes = quotes.filter((quote) => quote.market === def.market)
    const identities = new Map<string, { gamePk: number; name: string }>()
    for (const quote of defQuotes) {
      const gamePk = quoteGamePk(quote)
      const name = quotePlayer(quote)
      if (gamePk !== null && name) identities.set(String(gamePk) + ':' + normalizePerson(name), { gamePk, name })
    }
    for (const identity of identities.values()) {
      const game = gameByPk.get(identity.gamePk)
      if (!game) continue
      let playerId: number | null = null
      if (def.playerType === 'pitcher') {
        playerId = probablePitchers(game).find((pitcher) => normalizePerson(pitcher.name) === normalizePerson(identity.name))?.id ?? null
      } else {
        const matches = playerMap.get(normalizePerson(identity.name)) ?? []
        playerId = matches.length === 1 ? matches[0].id : null
      }
      const quote = bestQuote({
        quotes, gamePk: identity.gamePk, market: def.market, playerName: identity.name,
        direction: def.direction, line: def.line,
      })
      rows.push(ledgerRow({
        date: targetDate, game, market: def.market, candidateId: def.candidateId,
        playerId, playerName: identity.name, direction: def.direction, line: def.line,
        accuracy: def.accuracy, quote,
        status: playerId === null ? 'NO_EVALUABLE_IDENTITY_UNRESOLVED' : 'NO_EVALUABLE_EXACT_RUNTIME_PENDING',
        blocker: playerId === null
          ? 'EXACT_MLBAM_NAME_MATCH_NOT_UNIQUE'
          : 'FROZEN_RAW_FEATURE_OR_ELIGIBILITY_CONTRACT_NOT_YET_SERIALIZED_FOR_DAILY_RUNTIME',
        marketSnapshot: { observedLines: observedLines(quotes, identity.gamePk, def.market, identity.name) },
        frozenAt,
      }))
    }
  }

  if (rows.length) {
    const write = await supabaseAdmin.from('mlb_approved_prop_daily_v1').upsert(rows, { onConflict: 'id' })
    if (write.error) throw new Error('MLB_APPROVED_PROP_LEDGER_WRITE_FAILED:' + write.error.message)
  }
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const status = String(row.status)
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})
  const marketSummary = rows.reduce<Record<string, Record<string, number>>>((acc, row) => {
    const market = String(row.market)
    const status = String(row.status)
    acc[market] = acc[market] ?? {}
    acc[market][status] = (acc[market][status] ?? 0) + 1
    return acc
  }, {})

  const completedAt = new Date().toISOString()
  const jobId = randomUUID()
  const job = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: jobId,
    job_type: JOB_TYPE,
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    provider: 'internal-model',
    season: '2026',
    started_at: frozenAt,
    completed_at: completedAt,
    status: 'completed',
    records_fetched: quotes.length,
    records_inserted: rows.length,
    records_updated: 0,
    records_skipped: 0,
    error_count: 0,
    metadata: {
      targetDate,
      frozenAt,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      quoteRowsRead: quotes.length,
      ledgerRows: rows.length,
      statusCounts: counts,
      marketSummary,
      exactRuntimeEnabled: [
        'pitcher_walks',
        'pitcher_outs',
        'batter_hits',
        'batter_total_bases',
        'batter_home_runs',
        'batter_strikeouts',
        'batter_walks',
        'pitcher_record_a_win',
      ],
      exactRuntimePending: PENDING_DEFS.map((item) => item.market),
    },
    updated_at: completedAt,
  })
  if (job.error) throw new Error('MLB_APPROVED_PROP_FREEZE_JOB_WRITE_FAILED:' + job.error.message)

  return {
    ...base,
    status: 'APPROVED_PROP_DAILY_FREEZE_PERSISTED',
    jobId,
    writes: rows.length + 1,
    quoteRowsRead: quotes.length,
    ledgerRows: rows.length,
    statusCounts: counts,
    marketSummary,
  }
}

export async function getMlbApprovedPropsDailyBoard(targetDate: string) {
  const result = await supabaseAdmin
    .from('mlb_approved_prop_daily_v1')
    .select('*')
    .eq('tracking_date', targetDate)
    .order('status', { ascending: true })
    .order('market', { ascending: true })
    .order('start_time', { ascending: true })
    .order('player_name', { ascending: true })
  if (result.error) throw new Error('MLB_APPROVED_PROP_BOARD_READ_FAILED:' + result.error.message)
  const rows = result.data ?? []
  return {
    targetDate,
    researchOnly: true,
    productionEligible: false,
    officialPicksEligible: false,
    apostarEnabled: false,
    verifiedQualifiers: rows.filter((row) => row.status === 'QUALIFIES_MARKET_VERIFIED'),
    modelQualifiersMarketUnverified: rows.filter((row) => row.status === 'MODEL_QUALIFIES_MARKET_NOT_VERIFIED'),
    noPlay: rows.filter((row) => row.status === 'NO_PLAY'),
    notEvaluable: rows.filter((row) => String(row.status).startsWith('NO_EVALUABLE_')),
    all: rows,
  }
}
