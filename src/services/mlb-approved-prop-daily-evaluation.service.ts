import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { getMlbPitcherBbShadowProjection } from '@/services/mlb-pitcher-bb-shadow.service'
import {
  evaluateApprovedFiveMarketModels,
  type ApprovedFiveMarket,
  type ApprovedModelTarget,
} from '@/services/mlb-approved-five-market-runtime.service'
import {
  ADDITIONAL_PROP_RUNTIME_PARITY,
  getPitcherWalksRuntimeParity,
  loadStrictBatterTargetFeatureKeys,
} from '@/services/mlb-approved-additional-prop-parity.service'
import {
  APPROVED_PROP_LINE_CONTRACT_VERSION,
  assertApprovedPropLineContract,
} from '@/services/mlb-approved-prop-line-contract'
import {
  evaluateNewApprovedPropModels,
  newApprovedPropDefinition,
  type NewApprovedPropMarket,
  type NewApprovedPropTarget,
} from '@/services/mlb-approved-new-prop-runtime.service'

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

const FIVE_MARKET_DEFS: Record<ApprovedFiveMarket, {
  candidateId: string
  direction: 'UNDER' | 'OVER'
  line: number
  accuracy: number
}> = {
  pitcher_earned_runs: {
    candidateId: 'pitcher_er_over_1p5_p70_v1',
    direction: 'OVER',
    line: 1.5,
    accuracy: 0.802197802197802,
  },
  pitcher_hits_allowed: {
    candidateId: 'pitcher_hits_allowed_under_6p5_proj_5p0_v1',
    direction: 'UNDER',
    line: 6.5,
    accuracy: 0.789559543230016,
  },
  batter_singles: {
    candidateId: 'batter_singles_under_1p5_proj_0p50_v1',
    direction: 'UNDER',
    line: 1.5,
    accuracy: 0.930761331964207,
  },
  batter_doubles: {
    candidateId: 'batter_doubles_under_0p5_proj_0p16_v1',
    direction: 'UNDER',
    line: 0.5,
    accuracy: 0.869342273937482,
  },
  batter_triples: {
    candidateId: 'batter_triples_under_0p5_proj_0p015_v1',
    direction: 'UNDER',
    line: 0.5,
    accuracy: 0.988151106673323,
  },
}

const FIVE_MARKETS = new Set<ApprovedFiveMarket>(Object.keys(FIVE_MARKET_DEFS) as ApprovedFiveMarket[])

function asRecord(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {}
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

function positiveInteger(value: unknown) {
  const parsed = n(value)
  return parsed !== null && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function quoteGamePk(quote: Quote) {
  return positiveInteger(asRecord(quote.metadata).canonicalGamePk)
}

function quotePlayer(quote: Quote) {
  return String(asRecord(quote.metadata).providerPlayerName ?? '').trim()
}

function quoteCanonicalPlayerName(quote: Quote) {
  const metadata = asRecord(quote.metadata)
  return String(metadata.canonicalPlayerName ?? metadata.pitcherName ?? metadata.providerPlayerName ?? '').trim()
}

function quotePlayerId(quote: Quote) {
  const metadata = asRecord(quote.metadata)
  return positiveInteger(metadata.playerMlbamId ?? metadata.pitcherMlbamId)
}

function strictPregameQuote(quote: Quote) {
  const metadata = asRecord(quote.metadata)
  const targetStart = String(metadata.targetStart ?? '')
  const quoteAt = Date.parse(quote.snapshot_time)
  const startAt = Date.parse(targetStart)
  const sportsbook = String(quote.sportsbook ?? '').trim()
  const price = n(quote.price)
  return Number.isFinite(quoteAt) && Number.isFinite(startAt) && quoteAt < startAt &&
    Boolean(sportsbook) && price !== null && price !== 0
}

type MarketState = {
  identityRows: Quote[]
  pregameRows: Quote[]
  sideRows: Quote[]
  exactLineRows: Quote[]
  observedLines: number[]
  marketAvailable: boolean
  pregameLineageVerified: boolean
  requiredLineAvailable: boolean
}

function marketState(input: {
  quotes: Quote[]
  gamePk: number
  market: string
  playerName: string
  playerId?: number | null
  direction: string
  line: number | null
}): MarketState {
  const playerKey = normalizePerson(input.playerName)
  const outcome = requiredOutcome(input.direction)
  const identityRows = input.quotes.filter((quote) => {
    if (quoteGamePk(quote) !== input.gamePk || quote.market !== input.market) return false
    return input.playerId !== undefined && input.playerId !== null
      ? quotePlayerId(quote) === input.playerId
      : normalizePerson(quotePlayer(quote)) === playerKey
  })
  const pregameRows = identityRows.filter(strictPregameQuote)
  const sideRows = pregameRows.filter((quote) => quote.outcome.toLowerCase() === outcome)
  const exactLineRows = input.line === null
    ? sideRows
    : sideRows.filter((quote) => {
        const line = n(quote.line)
        return line !== null && Math.abs(line - input.line!) < 1e-9
      })
  const observedLines = Array.from(new Set(
    pregameRows.map((quote) => n(quote.line)).filter((line): line is number => line !== null),
  )).sort((a, b) => a - b)
  return {
    identityRows,
    pregameRows,
    sideRows,
    exactLineRows,
    observedLines,
    marketAvailable: pregameRows.length > 0,
    pregameLineageVerified: identityRows.length === 0 || pregameRows.length > 0,
    requiredLineAvailable: input.line === null ? sideRows.length > 0 : pregameRows.some((quote) => {
      const line = n(quote.line)
      return line !== null && Math.abs(line - input.line!) < 1e-9
    }),
  }
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
  playerId?: number | null
  direction: string
  line: number | null
}) {
  const state = marketState(input)
  const candidates = [...state.exactLineRows]
  candidates.sort((a, b) => (n(b.price) ?? -Infinity) - (n(a.price) ?? -Infinity) || b.snapshot_time.localeCompare(a.snapshot_time))
  return candidates[0] ?? null
}

function observedLines(quotes: Quote[], gamePk: number, market: string, playerName: string, playerId?: number | null) {
  return marketState({
    quotes,
    gamePk,
    market,
    playerName,
    playerId,
    direction: 'UNDER',
    line: null,
  }).observedLines
}

function statusFor(modelQualifies: boolean, marketVerified: boolean, state?: MarketState, requiredLine: number | null = null) {
  if (!modelQualifies) return 'NO_PLAY'
  if (marketVerified) return 'QUALIFIES_MARKET_VERIFIED'
  if (state && state.identityRows.length > 0 && state.pregameRows.length === 0) return 'NO_EVALUABLE_PREGAME_LINEAGE'
  if (!state || !state.marketAvailable) return 'MODEL_QUALIFIES_MARKET_NOT_AVAILABLE'
  if (requiredLine !== null && !state.requiredLineAvailable) return 'MARKET_AVAILABLE_REQUIRED_LINE_NOT_AVAILABLE'
  return 'MODEL_QUALIFIES_MARKET_NOT_AVAILABLE'
}

function marketSnapshotFromState(state: MarketState, extra: JsonMap = {}) {
  return {
    ...extra,
    observedLines: state.observedLines,
    marketAvailable: state.marketAvailable,
    pregameLineageVerified: state.pregameLineageVerified,
    requiredLineAvailable: state.requiredLineAvailable,
    exactLineQuoteCount: state.exactLineRows.length,
  }
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
  const lineContract = assertApprovedPropLineContract({
    candidateId: input.candidateId,
    market: input.market,
    direction: input.direction,
    requiredLine: input.line,
  })
  const quoteMetadata = quote ? asRecord(quote.metadata) : {}
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
    market_verified: Boolean(quote) && input.playerId !== null,
    status: input.status,
    blocker: input.blocker ?? null,
    feature_snapshot: input.featureSnapshot ?? {},
    market_snapshot: {
      ...(input.marketSnapshot ?? {}),
      lineContractVersion: APPROVED_PROP_LINE_CONTRACT_VERSION,
      lineScope: lineContract.lineScope,
      multipleLinesCertified: lineContract.multipleLinesCertified,
      runtimeEligible: lineContract.runtimeEligible,
      lineContractBlocker: lineContract.blocker,
      actualQuote: quote ? {
        oddsSnapshotId: quote.id,
        sportsbook: quote.sportsbook,
        line: n(quote.line),
        price: n(quote.price),
        quoteTimestamp: quote.snapshot_time,
        providerTimestamp: String(quoteMetadata.providerTimestamp ?? quote.snapshot_time),
      } : null,
    },
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
  const normalFreezeWindow = clock.hour === 10 && clock.minute >= 45
  const recoveryFreezeWindow =
    (clock.hour === 11) ||
    (clock.hour === 12 && clock.minute <= 10)
  if (!normalFreezeWindow && !recoveryFreezeWindow) return { ...base, status: 'NOT_IN_FREEZE_WINDOW' }
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
  const [quotes, features, pitcherWalksParity] = await Promise.all([
    loadQuotes(targetDate),
    loadPitcherFeatures(targetDate),
    getPitcherWalksRuntimeParity(),
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
        status: 'NO_EVALUABLE_IDENTITY', blocker: 'PROBABLE_PITCHER_IDENTITY_MISSING', frozenAt,
      }))
      continue
    }

    const walkQuote = bestQuote({
      quotes,
      gamePk: game.game_pk,
      market: 'pitcher_walks',
      playerName: pitcher.name,
      playerId: pitcher.id,
      direction: 'UNDER',
      line: 2.5,
    })
    const walkMarketState = marketState({
      quotes,
      gamePk: game.game_pk,
      market: 'pitcher_walks',
      playerName: pitcher.name,
      playerId: pitcher.id,
      direction: 'UNDER',
      line: 2.5,
    })

    if (!pitcherWalksParity.certified) {
      rows.push(ledgerRow({
        date: targetDate,
        game,
        market: 'pitcher_walks',
        candidateId: 'pitcher_bb_under_2p5_p85_v1',
        playerId: pitcher.id,
        playerName: pitcher.name,
        direction: 'UNDER',
        line: 2.5,
        accuracy: 0.912408759124088,
        quote: walkQuote,
        status: 'RUNTIME_PARITY_NOT_CERTIFIED',
        blocker: 'PITCHER_WALKS_RUNTIME_PARITY_CHECK_FAILED',
        featureSnapshot: {
          parityContract: pitcherWalksParity.contract,
          parityFailures: pitcherWalksParity.failures,
        },
        marketSnapshot: marketSnapshotFromState(walkMarketState, {
          exactMlbamIdentity: true,
          fuzzyMatchingUsed: false,
        }),
        frozenAt,
      }))
    } else {
      const walk = await getMlbPitcherBbShadowProjection({ targetGamePk: game.game_pk, pitcherId: pitcher.id, line: 2.5 })
      if (walk.status !== 'READY' || walk.probability.status !== 'READY') {
        rows.push(ledgerRow({
          date: targetDate,
          game,
          market: 'pitcher_walks',
          candidateId: 'pitcher_bb_under_2p5_p85_v1',
          playerId: pitcher.id,
          playerName: pitcher.name,
          direction: 'UNDER',
          line: 2.5,
          accuracy: 0.912408759124088,
          projection: walk.status === 'READY' ? walk.projection.expectedWalks : null,
          quote: walkQuote,
          status: 'NO_EVALUABLE',
          blocker: walk.status === 'READY' ? walk.probability.status : walk.status,
          featureSnapshot: { parityContract: pitcherWalksParity.contract },
          marketSnapshot: {
            observedLines: observedLines(quotes, game.game_pk, 'pitcher_walks', pitcher.name, pitcher.id),
            exactMlbamIdentity: true,
            fuzzyMatchingUsed: false,
          },
          frozenAt,
        }))
      } else {
        const qualifies = walk.probability.underProbability >= 0.85
        rows.push(ledgerRow({
          date: targetDate,
          game,
          market: 'pitcher_walks',
          candidateId: 'pitcher_bb_under_2p5_p85_v1',
          playerId: pitcher.id,
          playerName: pitcher.name,
          direction: 'UNDER',
          line: 2.5,
          accuracy: 0.912408759124088,
          projection: walk.projection.expectedWalks,
          probability: walk.probability.underProbability,
          qualifies,
          quote: walkQuote,
          status: statusFor(qualifies, Boolean(walkQuote), walkMarketState, 2.5),
          featureSnapshot: {
            parityContract: pitcherWalksParity.contract,
            priorAppearances: walk.featureState.priorAppearances,
            priorPlateAppearances: walk.featureState.priorPlateAppearances,
            expectedBattersFaced: walk.featureState.expectedBattersFaced,
            predictionBin: walk.probability.predictionBin,
            calibrationSample: walk.probability.sampleSize,
          },
          marketSnapshot: {
            observedLines: observedLines(quotes, game.game_pk, 'pitcher_walks', pitcher.name, pitcher.id),
            exactMlbamIdentity: true,
            fuzzyMatchingUsed: false,
          },
          frozenAt,
        }))
      }
    }

    const outsQuote = bestQuote({
      quotes,
      gamePk: game.game_pk,
      market: 'pitcher_outs',
      playerName: pitcher.name,
      playerId: pitcher.id,
      direction: 'UNDER',
      line: 18.5,
    })
    const outsMarketState = marketState({
      quotes,
      gamePk: game.game_pk,
      market: 'pitcher_outs',
      playerName: pitcher.name,
      playerId: pitcher.id,
      direction: 'UNDER',
      line: 18.5,
    })
    rows.push(ledgerRow({
      date: targetDate,
      game,
      market: 'pitcher_outs',
      candidateId: ADDITIONAL_PROP_RUNTIME_PARITY.pitcher_outs.candidateId,
      playerId: pitcher.id,
      playerName: pitcher.name,
      direction: 'UNDER',
      line: 18.5,
      accuracy: ADDITIONAL_PROP_RUNTIME_PARITY.pitcher_outs.frozenAccuracy,
      quote: outsQuote,
      status: 'RUNTIME_PARITY_NOT_CERTIFIED',
      blocker: ADDITIONAL_PROP_RUNTIME_PARITY.pitcher_outs.blocker,
      featureSnapshot: {
        parityContract: ADDITIONAL_PROP_RUNTIME_PARITY.pitcher_outs.contract,
        frozenExternal2026: ADDITIONAL_PROP_RUNTIME_PARITY.pitcher_outs.frozenExternal2026,
        parityNote: ADDITIONAL_PROP_RUNTIME_PARITY.pitcher_outs.note,
      },
      marketSnapshot: marketSnapshotFromState(outsMarketState, {
        exactMlbamIdentity: true,
        fuzzyMatchingUsed: false,
      }),
      frozenAt,
    }))

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
  const batterIds = Array.from(new Set(
    quotes
      .filter((quote) => exactBatterMarkets.has(quote.market as any))
      .map((quote) => quotePlayerId(quote))
      .filter((value): value is number => value !== null),
  ))
  const [statcastBatterLogs, tbLogs, batterTargetFeatureKeys] = await Promise.all([
    loadBatterHits(batterIds, targetDate),
    loadBatterTb(batterIds, targetDate),
    loadStrictBatterTargetFeatureKeys(targetDate, batterIds),
  ])

  for (const def of exactBatterDefs) {
    const targets = new Map<string, { gamePk: number; playerId: number | null; playerName: string }>()
    for (const quoteRow of quotes) {
      if (quoteRow.market !== def.market) continue
      const gamePk = quoteGamePk(quoteRow)
      const playerId = quotePlayerId(quoteRow)
      const playerName = quoteCanonicalPlayerName(quoteRow) || quotePlayer(quoteRow)
      if (gamePk === null || !playerName) continue
      const key = String(gamePk) + ':' + String(playerId ?? 'UNRESOLVED') + ':' + normalizePerson(playerName)
      targets.set(key, { gamePk, playerId, playerName })
    }

    for (const target of targets.values()) {
      const game = gameByPk.get(target.gamePk)
      if (!game) continue

      if (target.playerId === null) {
        const nameQuote = bestQuote({
          quotes,
          gamePk: target.gamePk,
          market: def.market,
          playerName: target.playerName,
          direction: 'UNDER',
          line: def.line,
        })
        rows.push(ledgerRow({
          date: targetDate,
          game,
          market: def.market,
          candidateId: def.candidateId,
          playerId: null,
          playerName: target.playerName,
          direction: 'UNDER',
          line: def.line,
          accuracy: def.accuracy,
          quote: nameQuote,
          status: 'NO_EVALUABLE_IDENTITY',
          blocker: 'EXACT_MLBAM_IDENTITY_NOT_PERSISTED_IN_PREGAME_SNAPSHOT',
          marketSnapshot: {
            observedLines: observedLines(quotes, target.gamePk, def.market, target.playerName),
            exactMlbamIdentity: false,
            fuzzyMatchingUsed: false,
          },
          frozenAt,
        }))
        continue
      }

      const batterMarketState = marketState({
        quotes,
        gamePk: target.gamePk,
        market: def.market,
        playerName: target.playerName,
        playerId: target.playerId,
        direction: 'UNDER',
        line: def.line,
      })
      const quote = bestQuote({
        quotes,
        gamePk: target.gamePk,
        market: def.market,
        playerName: target.playerName,
        playerId: target.playerId,
        direction: 'UNDER',
        line: def.line,
      })

      const parity = ADDITIONAL_PROP_RUNTIME_PARITY[def.market]
      if (!parity.certified) {
        rows.push(ledgerRow({
          date: targetDate,
          game,
          market: def.market,
          candidateId: def.candidateId,
          playerId: target.playerId,
          playerName: target.playerName,
          direction: 'UNDER',
          line: def.line,
          accuracy: def.accuracy,
          status: 'RUNTIME_PARITY_NOT_CERTIFIED',
          blocker: 'ADDITIONAL_BATTER_RUNTIME_PARITY_NOT_CERTIFIED',
          featureSnapshot: { parityContract: parity.contract },
          marketSnapshot: marketSnapshotFromState(batterMarketState, {
            exactMlbamIdentity: true,
            fuzzyMatchingUsed: false,
          }),
          frozenAt,
        }))
        continue
      }

      if (!batterTargetFeatureKeys.has(String(target.gamePk) + ':' + String(target.playerId))) {
        rows.push(ledgerRow({
          date: targetDate,
          game,
          market: def.market,
          candidateId: def.candidateId,
          playerId: target.playerId,
          playerName: target.playerName,
          direction: 'UNDER',
          line: def.line,
          accuracy: def.accuracy,
          quote,
          status: 'NO_EVALUABLE',
          blocker: 'STRICT_PREGAME_BATTER_FEATURE_NOT_AVAILABLE',
          featureSnapshot: {
            parityContract: parity.contract,
            requiredFeatureVersion: 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1',
            requiredSourceRule: 'source_game_date < target_game_date',
          },
          marketSnapshot: marketSnapshotFromState(batterMarketState, {
            exactMlbamIdentity: true,
            fuzzyMatchingUsed: false,
          }),
          frozenAt,
        }))
        continue
      }

      const sourceRows = def.source === 'total_bases' ? tbLogs : statcastBatterLogs
      const projection = batterLinearProjection(
        sourceRows,
        target.playerId,
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
          playerId: target.playerId,
          playerName: target.playerName,
          direction: 'UNDER',
          line: def.line,
          accuracy: def.accuracy,
          quote,
          status: 'NO_EVALUABLE',
          blocker: 'MINIMUM_10_PRIOR_GAMES_NOT_MET',
          featureSnapshot: { parityContract: parity.contract, strictTargetFeature: true },
          marketSnapshot: marketSnapshotFromState(batterMarketState, {
            exactMlbamIdentity: true,
            fuzzyMatchingUsed: false,
          }),
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
        playerId: target.playerId,
        playerName: target.playerName,
        direction: 'UNDER',
        line: def.line,
        accuracy: def.accuracy,
        projection: projection.predicted,
        qualifies,
        quote,
        status: statusFor(qualifies, Boolean(quote), batterMarketState, def.line),
        featureSnapshot: {
          parityContract: parity.contract,
          strictTargetFeature: true,
          requiredSourceRule: 'source_game_date < target_game_date',
          rawFormulaAlpha: 0,
          priorGames: projection.priorGames,
          priorPa: projection.priorPa,
          priorRate: projection.priorRate,
          recentPaPerGame: projection.recentPaPerGame,
          latestPriorDate: projection.latestPriorDate,
        },
        marketSnapshot: marketSnapshotFromState(batterMarketState, {
          exactMlbamIdentity: true,
          fuzzyMatchingUsed: false,
        }),
        frozenAt,
      }))
    }
  }

  const newRuntimeMarkets = new Set<NewApprovedPropMarket>([
    'pitcher_strikeouts',
    'batter_rbis',
    'batter_hits_runs_rbis',
  ])
  const newTargetsByKey = new Map<string, NewApprovedPropTarget>()
  const unresolvedNewTargets = new Map<string, {
    gamePk: number
    market: NewApprovedPropMarket
    playerName: string
  }>()

  for (const quoteRow of quotes) {
    if (!newRuntimeMarkets.has(quoteRow.market as NewApprovedPropMarket)) continue
    const market = quoteRow.market as NewApprovedPropMarket
    const gamePk = quoteGamePk(quoteRow)
    const playerId = quotePlayerId(quoteRow)
    const playerName = quoteCanonicalPlayerName(quoteRow) || quotePlayer(quoteRow)
    if (gamePk === null || !playerName) continue
    if (playerId === null) {
      unresolvedNewTargets.set(
        market + ':' + gamePk + ':' + normalizePerson(playerName),
        { gamePk, market, playerName },
      )
      continue
    }
    newTargetsByKey.set(
      market + ':' + gamePk + ':' + playerId,
      { gamePk, market, playerId, playerName },
    )
  }

  for (const unresolved of unresolvedNewTargets.values()) {
    const game = gameByPk.get(unresolved.gamePk)
    if (!game) continue
    const def = newApprovedPropDefinition(unresolved.market)
    rows.push(ledgerRow({
      date: targetDate,
      game,
      market: unresolved.market,
      candidateId: def.candidateId,
      playerId: null,
      playerName: unresolved.playerName,
      direction: def.direction,
      line: def.line,
      accuracy: def.accuracy,
      status: 'NO_EVALUABLE_IDENTITY',
      blocker: 'EXACT_MLBAM_IDENTITY_NOT_PERSISTED_IN_PREGAME_SNAPSHOT',
      marketSnapshot: {
        observedLines: observedLines(quotes, unresolved.gamePk, unresolved.market, unresolved.playerName),
        exactMlbamIdentity: false,
        fuzzyMatchingUsed: false,
      },
      frozenAt,
    }))
  }

  const newEvaluations = await evaluateNewApprovedPropModels({
    targetDate,
    targets: [...newTargetsByKey.values()],
  })
  for (const evaluation of newEvaluations) {
    const game = gameByPk.get(evaluation.gamePk)
    if (!game) continue
    const def = newApprovedPropDefinition(evaluation.market)
    const newMarketState = marketState({
      quotes,
      gamePk: evaluation.gamePk,
      market: evaluation.market,
      playerName: evaluation.playerName,
      playerId: evaluation.playerId,
      direction: def.direction,
      line: def.line,
    })
    const quote = bestQuote({
      quotes,
      gamePk: evaluation.gamePk,
      market: evaluation.market,
      playerName: evaluation.playerName,
      playerId: evaluation.playerId,
      direction: def.direction,
      line: def.line,
    })
    const status = !evaluation.parityCertified
      ? 'RUNTIME_PARITY_NOT_CERTIFIED'
      : !evaluation.evaluable
        ? 'NO_EVALUABLE'
        : statusFor(Boolean(evaluation.qualifies), Boolean(quote), newMarketState, def.line)

    rows.push(ledgerRow({
      date: targetDate,
      game,
      market: evaluation.market,
      candidateId: def.candidateId,
      playerId: evaluation.playerId,
      playerName: evaluation.playerName,
      direction: def.direction,
      line: def.line,
      accuracy: def.accuracy,
      projection: evaluation.projection,
      qualifies: evaluation.qualifies,
      quote,
      status,
      blocker: evaluation.blocker,
      featureSnapshot: evaluation.featureSnapshot,
      marketSnapshot: marketSnapshotFromState(newMarketState, {
        exactMlbamIdentity: true,
        fuzzyMatchingUsed: false,
      }),
      frozenAt,
    }))
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
    const pitcherId = positiveInteger(item.starter_mlbam_id)
    if (pitcherId === null) {
      rows.push(ledgerRow({
        date: targetDate, game, market: 'pitcher_record_a_win', candidateId: 'pitcher_win_forward_numeric_p015_v1',
        playerId: null, playerName: name, direction: 'NO', line: null,
        accuracy: 0.870748299319728, status: 'NO_EVALUABLE_IDENTITY',
        blocker: 'EXACT_MLBAM_IDENTITY_NOT_AVAILABLE', frozenAt,
      }))
      continue
    }
    const winMarketState = marketState({
      quotes, gamePk: game.game_pk, market: 'pitcher_record_a_win',
      playerName: name, playerId: pitcherId, direction: 'NO', line: null,
    })
    const quote = bestQuote({
      quotes, gamePk: game.game_pk, market: 'pitcher_record_a_win',
      playerName: name, playerId: pitcherId, direction: 'NO', line: null,
    })
    const qualifies = item.selected_no === true
    const pWin = n(item.p_win)
    rows.push(ledgerRow({
      date: targetDate, game, market: 'pitcher_record_a_win', candidateId: 'pitcher_win_forward_numeric_p015_v1',
      playerId: pitcherId, playerName: name, direction: 'NO', line: null,
      accuracy: 0.870748299319728, projection: pWin, probability: pWin === null ? null : 1 - pWin,
      qualifies, quote, status: statusFor(qualifies, Boolean(quote), winMarketState, null),
      featureSnapshot: { pWin, threshold: n(item.threshold) },
      marketSnapshot: marketSnapshotFromState(winMarketState, {
        exactMlbamIdentity: true,
        fuzzyMatchingUsed: false,
      }),
      frozenAt,
    }))
  }

  const unresolvedFiveMarketByKey = new Map<string, {
    gamePk: number
    market: ApprovedFiveMarket
    playerName: string
  }>()
  const fiveTargetsByKey = new Map<string, ApprovedModelTarget>()

  for (const quote of quotes) {
    if (!FIVE_MARKETS.has(quote.market as ApprovedFiveMarket)) continue
    const market = quote.market as ApprovedFiveMarket
    const gamePk = quoteGamePk(quote)
    const playerId = quotePlayerId(quote)
    const playerName = quoteCanonicalPlayerName(quote) || quotePlayer(quote)
    if (gamePk === null || !playerName) continue
    if (playerId === null) {
      unresolvedFiveMarketByKey.set(market + ':' + gamePk + ':' + normalizePerson(playerName), { gamePk, market, playerName })
      continue
    }
    fiveTargetsByKey.set(
      market + ':' + gamePk + ':' + playerId,
      { gamePk, market, playerId, playerName },
    )
  }

  for (const unresolved of unresolvedFiveMarketByKey.values()) {
    const game = gameByPk.get(unresolved.gamePk)
    if (!game) continue
    const def = FIVE_MARKET_DEFS[unresolved.market]
    rows.push(ledgerRow({
      date: targetDate,
      game,
      market: unresolved.market,
      candidateId: def.candidateId,
      playerId: null,
      playerName: unresolved.playerName,
      direction: def.direction,
      line: def.line,
      accuracy: def.accuracy,
      status: 'NO_EVALUABLE_IDENTITY',
      blocker: 'EXACT_MLBAM_IDENTITY_NOT_PERSISTED_IN_PREGAME_SNAPSHOT',
      marketSnapshot: {
        observedLines: observedLines(quotes, unresolved.gamePk, unresolved.market, unresolved.playerName),
        fuzzyMatchingUsed: false,
      },
      frozenAt,
    }))
  }

  const fiveTargets = [...fiveTargetsByKey.values()]
  const fiveEvaluations = await evaluateApprovedFiveMarketModels({ targetDate, targets: fiveTargets })
  for (const evaluation of fiveEvaluations) {
    const game = gameByPk.get(evaluation.gamePk)
    if (!game) continue
    const def = FIVE_MARKET_DEFS[evaluation.market]
    const quote = bestQuote({
      quotes,
      gamePk: evaluation.gamePk,
      market: evaluation.market,
      playerName: evaluation.playerName,
      playerId: evaluation.playerId,
      direction: def.direction,
      line: def.line,
    })
    const fiveMarketState = marketState({
      quotes,
      gamePk: evaluation.gamePk,
      market: evaluation.market,
      playerName: evaluation.playerName,
      playerId: evaluation.playerId,
      direction: def.direction,
      line: def.line,
    })

    const status = !evaluation.parityCertified
      ? 'RUNTIME_PARITY_NOT_CERTIFIED'
      : !evaluation.evaluable
        ? 'NO_EVALUABLE'
        : statusFor(Boolean(evaluation.qualifies), Boolean(quote), fiveMarketState, def.line)

    rows.push(ledgerRow({
      date: targetDate,
      game,
      market: evaluation.market,
      candidateId: def.candidateId,
      playerId: evaluation.playerId,
      playerName: evaluation.playerName,
      direction: def.direction,
      line: def.line,
      accuracy: def.accuracy,
      projection: evaluation.projection,
      probability: evaluation.probability,
      qualifies: evaluation.qualifies,
      quote,
      status,
      blocker: evaluation.blocker,
      featureSnapshot: evaluation.featureSnapshot,
      marketSnapshot: marketSnapshotFromState(fiveMarketState, {
        exactMlbamIdentity: true,
        fuzzyMatchingUsed: false,
      }),
      frozenAt,
    }))
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
      lineContractVersion: APPROVED_PROP_LINE_CONTRACT_VERSION,
      realLineRule: 'MODEL_QUALIFIES + REAL_LINE_EXISTS + EXACT_IDENTITY + PREGAME_QUOTE',
      multipleLineExtrapolationAuthorized: false,
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
        'pitcher_strikeouts',
        'batter_rbis',
        'batter_hits_runs_rbis',
        'batter_hits',
        'batter_total_bases',
        'batter_home_runs',
        'batter_strikeouts',
        'batter_walks',
        'pitcher_record_a_win',
        'pitcher_earned_runs',
        'pitcher_hits_allowed',
        'batter_singles',
        'batter_doubles',
        'batter_triples',
      ],
      exactRuntimePending: ['pitcher_outs'],
      exactRuntimeBlocked: [{
        market: 'pitcher_outs',
        status: 'RUNTIME_PARITY_NOT_CERTIFIED',
        blocker: ADDITIONAL_PROP_RUNTIME_PARITY.pitcher_outs.blocker,
      }],
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
  const marketBoard = rows.map((row) => {
    const marketSnapshot = asRecord(row.market_snapshot)
    const actualQuote = asRecord(marketSnapshot.actualQuote)
    return {
      gamePk: Number(row.game_pk),
      startTime: row.start_time,
      playerOrTeam: row.player_name,
      playerMlbamId: row.player_mlbam_id,
      market: row.market,
      model: row.candidate_id,
      modelProjection: row.model_projection,
      modelProbability: row.model_probability,
      historicalCertifiedAccuracy: row.historical_accuracy,
      requiredModelLine: row.required_line,
      actualAvailableLine: row.observed_line,
      observedLines: Array.isArray(marketSnapshot.observedLines) ? marketSnapshot.observedLines : [],
      side: row.direction,
      sportsbook: row.sportsbook,
      price: row.price,
      quoteTimestamp: actualQuote.quoteTimestamp ?? null,
      providerTimestamp: actualQuote.providerTimestamp ?? null,
      modelQualifies: row.model_qualifies,
      marketVerified: row.market_verified,
      lineScope: marketSnapshot.lineScope ?? null,
      multipleLinesCertified: marketSnapshot.multipleLinesCertified ?? false,
      finalStatus: row.status,
      blocker: row.blocker,
      researchOnly: true,
      productionEligible: false,
      officialPicksEligible: false,
      apostarEnabled: false,
    }
  })
  return {
    targetDate,
    contract: APPROVED_PROP_LINE_CONTRACT_VERSION,
    researchOnly: true,
    productionEligible: false,
    officialPicksEligible: false,
    apostarEnabled: false,
    playable: marketBoard.filter((row) => row.finalStatus === 'QUALIFIES_MARKET_VERIFIED'),
    verifiedQualifiers: marketBoard.filter((row) => row.finalStatus === 'QUALIFIES_MARKET_VERIFIED'),
    modelQualifiersMarketUnavailable: marketBoard.filter((row) => row.finalStatus === 'MODEL_QUALIFIES_MARKET_NOT_AVAILABLE'),
    requiredLineUnavailable: marketBoard.filter((row) => row.finalStatus === 'MARKET_AVAILABLE_REQUIRED_LINE_NOT_AVAILABLE'),
    noEvaluableIdentity: marketBoard.filter((row) => row.finalStatus === 'NO_EVALUABLE_IDENTITY'),
    noEvaluablePregameLineage: marketBoard.filter((row) => row.finalStatus === 'NO_EVALUABLE_PREGAME_LINEAGE'),
    noPlay: marketBoard.filter((row) => row.finalStatus === 'NO_PLAY'),
    notEvaluable: marketBoard.filter((row) => ['NO_EVALUABLE','NO_EVALUABLE_IDENTITY','NO_EVALUABLE_PREGAME_LINEAGE','RUNTIME_PARITY_NOT_CERTIFIED'].includes(String(row.finalStatus))),
    marketBoard,
    all: rows,
  }
}
