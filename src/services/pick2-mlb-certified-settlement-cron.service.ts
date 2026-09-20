import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { digestSettlementEvidence, MLB_SETTLEMENT_VERSION, planMlbSettlement } from '@/services/pick2-mlb-settlement'
import { persistMlbSettlementPlan } from '@/services/pick2-mlb-settlement-persistence.service'
import type { StoredRow } from '@/services/pick2-operational-projection'

const MAX_SETTLEMENT_GAMES_PER_RUN = 50
const MAX_OFFICIAL_PICK_ROWS = 1000
const MIN_GAME_AGE_MS = 90 * 60 * 1000

type GameRow = {
  game_pk: number
  scheduled_at: string
}

type SettlementResultRow = {
  prediction_id: string
}

function ensure(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(`MLB_SETTLEMENT_CRON:${code}`)
}

function unique<T>(values: T[]) {
  return [...new Set(values)]
}

function chunks<T>(values: T[], size = 100) {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size))
  return out
}

async function readOfficialPicks() {
  const { data, error } = await supabaseAdmin
    .from('pick2_mlb_official_picks')
    .select('*')
    .eq('decision_status', 'OFFICIAL_PICK')
    .order('decision_at', { ascending: true })
    .limit(MAX_OFFICIAL_PICK_ROWS + 1)

  ensure(!error && Array.isArray(data), 'OFFICIAL_PICK_READ_FAILED')
  ensure(data.length <= MAX_OFFICIAL_PICK_ROWS, 'OFFICIAL_PICK_READ_CAP')
  return data as StoredRow[]
}

async function readExistingSettlements() {
  const { data, error } = await supabaseAdmin
    .from('pick2_prediction_results')
    .select('prediction_id')
    .eq('evaluator_version', MLB_SETTLEMENT_VERSION)
    .limit(MAX_OFFICIAL_PICK_ROWS + 1)

  ensure(!error && Array.isArray(data), 'SETTLEMENT_RESULT_READ_FAILED')
  ensure(data.length <= MAX_OFFICIAL_PICK_ROWS, 'SETTLEMENT_RESULT_READ_CAP')
  return data as SettlementResultRow[]
}

async function readGames(gamePks: number[]) {
  const out: GameRow[] = []
  for (const group of chunks(unique(gamePks), 100)) {
    if (!group.length) continue
    const { data, error } = await supabaseAdmin
      .from('pick2_mlb_games')
      .select('game_pk,scheduled_at')
      .in('game_pk', group)
    ensure(!error && Array.isArray(data), 'GAME_READ_FAILED')
    out.push(...(data as GameRow[]))
  }
  return out
}

async function fetchOfficialFinal(gamePk: number) {
  const url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'pick-analyzer-certified-settlement/1.0',
    },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`MLB_OFFICIAL_HTTP_${response.status}`)
  return response.json()
}

export async function settleMlbOfficialPickBacklog(input: {
  now?: Date
  maxGames?: number
} = {}) {
  const now = input.now ?? new Date()
  const maxGames = Math.min(
    MAX_SETTLEMENT_GAMES_PER_RUN,
    Math.max(1, Number.isInteger(input.maxGames) ? Number(input.maxGames) : MAX_SETTLEMENT_GAMES_PER_RUN),
  )

  const [picks, existingResults] = await Promise.all([
    readOfficialPicks(),
    readExistingSettlements(),
  ])

  const settledPredictionIds = new Set(existingResults.map((row) => String(row.prediction_id)))
  const pendingPicks = picks.filter((pick) => !settledPredictionIds.has(String(pick.prediction_id)))
  if (!pendingPicks.length) {
    return {
      success: true,
      status: 'NO_PENDING_SETTLEMENTS',
      pendingPickRows: 0,
      pendingGames: 0,
      gamesAttempted: 0,
      gamesSettled: 0,
      resultRowsInserted: 0,
      resultRowsReused: 0,
      providerCalls: { MLB_OFFICIAL: 0, sportsbook: 0 },
      providerCreditsConsumed: 0,
      officialPicksModified: false,
      apostarActivated: false,
    }
  }

  const games = await readGames(pendingPicks.map((pick) => Number(pick.game_pk)))
  const gameByPk = new Map(games.map((game) => [Number(game.game_pk), game]))
  const pendingGamePks = unique(pendingPicks.map((pick) => Number(pick.game_pk)))
    .filter((gamePk) => {
      const scheduledAt = gameByPk.get(gamePk)?.scheduled_at
      return Boolean(scheduledAt && Number.isFinite(Date.parse(scheduledAt)) && Date.parse(scheduledAt) <= now.getTime() - MIN_GAME_AGE_MS)
    })
    .sort((a, b) => Date.parse(gameByPk.get(a)!.scheduled_at) - Date.parse(gameByPk.get(b)!.scheduled_at))
    .slice(0, maxGames)

  const attempts: Array<Record<string, unknown>> = []
  let providerCalls = 0
  let resultRowsInserted = 0
  let resultRowsReused = 0
  let gamesSettled = 0

  for (const gamePk of pendingGamePks) {
    const gamePicks = picks.filter((pick) => Number(pick.game_pk) === gamePk)
    ensure(gamePicks.length > 0 && gamePicks.length <= 100, 'GAME_PICK_CAP')

    try {
      providerCalls += 1
      const payload = await fetchOfficialFinal(gamePk)
      const detailedState = String(payload?.gameData?.status?.detailedState ?? '')
      if (detailedState !== 'Final' && detailedState !== 'Cancelled') {
        attempts.push({
          gamePk,
          status: 'NOT_TERMINAL',
          detailedState,
          inserted: 0,
          reused: 0,
        })
        continue
      }

      const acquiredAt = new Date().toISOString()
      const homeScore = payload?.liveData?.linescore?.teams?.home?.runs ?? null
      const awayScore = payload?.liveData?.linescore?.teams?.away?.runs ?? null
      const plan = planMlbSettlement(
        gamePicks,
        {
          gamePk,
          source: 'MLB_OFFICIAL',
          acquiredAt,
          status: detailedState,
          homeScore,
          awayScore,
          sourcePayload: payload,
          sourceDigest: digestSettlementEvidence(payload),
        },
        acquiredAt,
      )
      const result = await persistMlbSettlementPlan(
        supabaseAdmin,
        plan,
        new Set(gamePicks.map((pick) => String(pick.prediction_id))).size,
      )

      gamesSettled += 1
      resultRowsInserted += result.inserted
      resultRowsReused += result.reused
      attempts.push({
        gamePk,
        status: result.status,
        inserted: result.inserted,
        reused: result.reused,
        readback: result.readback,
      })
    } catch (error) {
      attempts.push({
        gamePk,
        status: 'FAILED_FAIL_CLOSED',
        inserted: 0,
        reused: 0,
        error: error instanceof Error ? error.message : 'UNKNOWN_SETTLEMENT_ERROR',
      })
    }
  }

  return {
    success: true,
    status: pendingGamePks.length ? 'SETTLEMENT_BACKLOG_EVALUATED' : 'NO_SETTLEABLE_GAMES_YET',
    pendingPickRows: pendingPicks.length,
    pendingGames: unique(pendingPicks.map((pick) => Number(pick.game_pk))).length,
    gamesAttempted: pendingGamePks.length,
    gamesSettled,
    resultRowsInserted,
    resultRowsReused,
    providerCalls: { MLB_OFFICIAL: providerCalls, sportsbook: 0 },
    providerCreditsConsumed: 0,
    attempts,
    officialPicksModified: false,
    apostarActivated: false,
    writes: {
      pick2_prediction_results: resultRowsInserted,
      pick2_mlb_official_picks: 0,
    },
  }
}
