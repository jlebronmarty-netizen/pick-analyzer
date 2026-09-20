import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import {
  evaluateApprovedFiveMarketModels,
  type ApprovedFiveMarket,
  type ApprovedModelTarget,
} from '@/services/mlb-approved-five-market-runtime.service'

const SOURCE = 'MLB_APPROVED_PROP_MARKET_CAPTURE_V1'
const JOB_TYPE = 'mlb_approved_prop_future_recovery_v1'
const PAGE_SIZE = 1000

type JsonMap = Record<string, unknown>
type GameRow = { game_pk: number; scheduled_at: string; metadata: JsonMap | null }
type Quote = {
  id: string
  sportsbook: string
  market: string
  outcome: string
  price: number | string | null
  line: number | string | null
  snapshot_time: string
  metadata: JsonMap | null
}

const DEFS: Record<ApprovedFiveMarket, {
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

const MARKETS = new Set<ApprovedFiveMarket>(Object.keys(DEFS) as ApprovedFiveMarket[])

function asRecord(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {}
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

function hash(parts: unknown[]) {
  return createHash('sha256')
    .update(parts.map((part) => String(part ?? 'null')).join('|'))
    .digest('hex')
    .slice(0, 30)
}

function quoteGamePk(quote: Quote) {
  return n(asRecord(quote.metadata).canonicalGamePk)
}

function quotePlayerId(quote: Quote) {
  const metadata = asRecord(quote.metadata)
  return n(metadata.playerMlbamId ?? metadata.pitcherMlbamId)
}

function quotePlayerName(quote: Quote) {
  const metadata = asRecord(quote.metadata)
  return String(metadata.canonicalPlayerName ?? metadata.pitcherName ?? metadata.providerPlayerName ?? '').trim()
}

function requiredOutcome(direction: string) {
  return direction === 'UNDER' ? 'under' : 'over'
}

function bestQuote(input: {
  quotes: Quote[]
  gamePk: number
  market: ApprovedFiveMarket
  playerId: number
  direction: 'UNDER' | 'OVER'
  line: number
}) {
  const outcome = requiredOutcome(input.direction)
  return input.quotes
    .filter((quote) =>
      quoteGamePk(quote) === input.gamePk &&
      quote.market === input.market &&
      quotePlayerId(quote) === input.playerId &&
      quote.outcome.toLowerCase() === outcome &&
      n(quote.line) !== null &&
      Math.abs(Number(quote.line) - input.line) < 1e-9
    )
    .sort((a, b) =>
      (n(b.price) ?? -Infinity) - (n(a.price) ?? -Infinity) ||
      b.snapshot_time.localeCompare(a.snapshot_time)
    )[0] ?? null
}

async function pagedRead<T>(
  table: string,
  columns: string,
  configure: (query: any) => any,
): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await configure(supabaseAdmin.from(table).select(columns))
      .range(offset, offset + PAGE_SIZE - 1)
    if (result.error) throw new Error('MLB_APPROVED_PROP_FUTURE_READ_FAILED:' + table + ':' + result.error.message)
    rows.push(...((result.data ?? []) as T[]))
    if (!result.data || result.data.length < PAGE_SIZE) break
  }
  return rows
}

export async function recoverMlbApprovedPropsFutureGames(input: {
  targetDate: string
  now?: Date
}): Promise<Record<string, unknown>> {
  const now = input.now ?? new Date()
  const targetDate = input.targetDate
  const base = {
    success: true,
    targetDate,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    writes: 0,
  }

  const gamesResult = await supabaseAdmin
    .from('pick2_mlb_games')
    .select('game_pk,scheduled_at,metadata')
    .eq('game_date', targetDate)
    .eq('game_type', 'R')
    .gt('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
  if (gamesResult.error) throw new Error('MLB_APPROVED_PROP_FUTURE_GAME_READ_FAILED:' + gamesResult.error.message)

  const games = (gamesResult.data ?? []) as unknown as GameRow[]
  if (!games.length) return { ...base, status: 'NO_FUTURE_GAMES' }

  const gameByPk = new Map(games.map((game) => [Number(game.game_pk), game]))
  const range = puertoRicoUtcRange(targetDate)
  const quotes = (await pagedRead<Quote>(
    'sports_odds_snapshots',
    'id,sportsbook,market,outcome,price,line,snapshot_time,metadata',
    (query) => query
      .eq('provider', 'the-odds-api')
      .gte('snapshot_time', range.utcStart)
      .lt('snapshot_time', range.utcEndExclusive)
      .order('snapshot_time', { ascending: true }),
  )).filter((quote) => asRecord(quote.metadata).source === SOURCE)

  const targets = new Map<string, ApprovedModelTarget>()
  for (const quote of quotes) {
    if (!MARKETS.has(quote.market as ApprovedFiveMarket)) continue
    const gamePk = quoteGamePk(quote)
    const playerId = quotePlayerId(quote)
    const playerName = quotePlayerName(quote)
    if (gamePk === null || playerId === null || !playerName) continue
    const game = gameByPk.get(gamePk)
    if (!game || Date.parse(quote.snapshot_time) >= Date.parse(game.scheduled_at)) continue
    const market = quote.market as ApprovedFiveMarket
    targets.set(market + ':' + gamePk + ':' + playerId, { gamePk, playerId, playerName, market })
  }

  if (!targets.size) {
    return {
      ...base,
      status: 'NO_FUTURE_EXACT_IDENTITY_TARGETS',
      futureGamePks: [...gameByPk.keys()],
    }
  }

  const evaluations = await evaluateApprovedFiveMarketModels({
    targetDate,
    targets: [...targets.values()],
  })

  const existing = await pagedRead<{ id: string }>(
    'mlb_approved_prop_daily_v1',
    'id',
    (query) => query.eq('tracking_date', targetDate),
  )
  const existingIds = new Set(existing.map((row) => String(row.id)))
  const frozenAt = now.toISOString()
  const rows: Array<Record<string, unknown>> = []

  for (const evaluation of evaluations) {
    const game = gameByPk.get(evaluation.gamePk)
    if (!game || Date.parse(game.scheduled_at) <= now.getTime()) continue
    const def = DEFS[evaluation.market]
    const quote = bestQuote({
      quotes,
      gamePk: evaluation.gamePk,
      market: evaluation.market,
      playerId: evaluation.playerId,
      direction: def.direction,
      line: def.line,
    })
    const status = !evaluation.parityCertified
      ? 'RUNTIME_PARITY_NOT_CERTIFIED'
      : !evaluation.evaluable
        ? 'NO_EVALUABLE'
        : !evaluation.qualifies
          ? 'NO_PLAY'
          : quote
            ? 'QUALIFIES_MARKET_VERIFIED'
            : 'MODEL_QUALIFIES_MARKET_NOT_VERIFIED'
    const id = 'approvedprop_' + hash([
      targetDate,
      evaluation.gamePk,
      def.candidateId,
      evaluation.playerId,
      normalizePerson(evaluation.playerName),
    ])
    if (existingIds.has(id)) continue
    rows.push({
      id,
      tracking_date: targetDate,
      game_pk: evaluation.gamePk,
      start_time: game.scheduled_at,
      market: evaluation.market,
      candidate_id: def.candidateId,
      player_mlbam_id: evaluation.playerId,
      player_name: evaluation.playerName,
      direction: def.direction,
      required_line: def.line,
      sportsbook: quote?.sportsbook ?? null,
      observed_line: quote ? n(quote.line) : null,
      price: quote ? n(quote.price) : null,
      odds_snapshot_id: quote?.id ?? null,
      model_projection: evaluation.projection,
      model_probability: evaluation.probability,
      historical_accuracy: def.accuracy,
      model_qualifies: evaluation.qualifies,
      market_verified: Boolean(quote),
      status,
      blocker: evaluation.blocker,
      feature_snapshot: {
        ...evaluation.featureSnapshot,
        futureOnlyRecovery: true,
      },
      market_snapshot: {
        futureOnlyRecovery: true,
        quoteCapturedBeforeTargetFirstPitch: Boolean(quote),
        exactMlbamIdentity: true,
        fuzzyMatchingUsed: false,
      },
      frozen_at: frozenAt,
      research_only: true,
      production_eligible: false,
      official_picks_eligible: false,
      apostar_enabled: false,
      updated_at: frozenAt,
    })
  }

  if (rows.length) {
    const write = await supabaseAdmin.from('mlb_approved_prop_daily_v1').insert(rows)
    if (write.error) throw new Error('MLB_APPROVED_PROP_FUTURE_LEDGER_WRITE_FAILED:' + write.error.message)
  }

  const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const status = String(row.status)
    acc[status] = (acc[status] ?? 0) + 1
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
    records_skipped: evaluations.length - rows.length,
    error_count: 0,
    metadata: {
      targetDate,
      frozenAt,
      futureGamePks: [...gameByPk.keys()],
      exactTargets: targets.size,
      evaluatedTargets: evaluations.length,
      insertedRows: rows.length,
      statusCounts,
      source: 'MLB_APPROVED_PROP_FUTURE_ONLY_RECOVERY_V1',
      quoteRule: 'snapshot_time < target scheduled_at',
      exactIdentityOnly: true,
      fuzzyMatchingUsed: false,
      existingRowsPreserved: true,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
    },
    updated_at: completedAt,
  })
  if (job.error) throw new Error('MLB_APPROVED_PROP_FUTURE_JOB_WRITE_FAILED:' + job.error.message)

  return {
    ...base,
    status: rows.length ? 'APPROVED_PROP_FUTURE_RECOVERY_PERSISTED' : 'REUSE_NO_OP',
    jobId,
    writes: rows.length + 1,
    futureGamePks: [...gameByPk.keys()],
    exactTargets: targets.size,
    evaluatedTargets: evaluations.length,
    insertedRows: rows.length,
    statusCounts,
  }
}
