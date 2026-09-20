import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  FROZEN_PITCHER_ER_MODEL,
  getFrozenPitcherErRuntime,
  pitcherErOverProbability,
} from '@/services/mlb-pitcher-er-frozen-runtime.service'
import {
  mapConcurrent,
  readMlbOfficialPitcherGameLog,
  type MlbOfficialPitcherGameLogRow,
} from '@/services/mlb-official-pitcher-gamelog.service'

const SEASON = 2026
const PAGE_SIZE = 1000

export const APPROVED_FIVE_MARKET_PARITY = Object.freeze({
  pitcher_hits_allowed: {
    certified: true,
    contract: 'MLB_PITCHER_HITS_ALLOWED_RUNTIME_PARITY/1.0.0',
    strictPriorDate: true,
    sameDateHistoryAllowed: false,
    minimumPriorStarts: 5,
    rawFeature: 'avg_batters_faced_last_5_starts * cumulative_hits_allowed / cumulative_batters_faced',
    externalRefit2025: {
      n: 3099,
      intercept: 2.97876810879942,
      slope: 0.415326852941172,
    },
    external2026: { eligible: 2568, selected: 1226, correct: 968 },
  },
  batter_singles: {
    certified: true,
    contract: 'MLB_BATTER_SINGLES_RUNTIME_PARITY/1.0.0',
    strictPriorDate: true,
    sameDateHistoryAllowed: false,
    minimumPriorGames: 10,
    externalRefit2025: { n: 42601, intercept: 0.260944252887134, slope: 0.515544560255828 },
    external2026: { eligible: 40648, selected: 13634, correct: 12690 },
  },
  batter_doubles: {
    certified: true,
    contract: 'MLB_BATTER_DOUBLES_RUNTIME_PARITY/1.0.0',
    strictPriorDate: true,
    sameDateHistoryAllowed: false,
    minimumPriorGames: 10,
    externalRefit2025: { n: 42601, intercept: 0.126877618354346, slope: 0.210234641434428 },
    external2026: { eligible: 40648, selected: 20282, correct: 17632 },
  },
  batter_triples: {
    certified: true,
    contract: 'MLB_BATTER_TRIPLES_RUNTIME_PARITY/1.0.0',
    strictPriorDate: true,
    sameDateHistoryAllowed: false,
    minimumPriorGames: 10,
    externalRefit2025: { n: 42601, intercept: 0.00876081897272024, slope: 0.294769143425622 },
    external2026: { eligible: 40648, selected: 30045, correct: 29689 },
    incrementalSignal: 'LOW_INCREMENTAL_SIGNAL_BASELINE_DOMINATED',
  },
})

export type ApprovedFiveMarket =
  | 'pitcher_earned_runs'
  | 'pitcher_hits_allowed'
  | 'batter_singles'
  | 'batter_doubles'
  | 'batter_triples'

export type ApprovedModelTarget = {
  gamePk: number
  playerId: number
  playerName: string
  market: ApprovedFiveMarket
}

export type ApprovedModelEvaluation = {
  market: ApprovedFiveMarket
  gamePk: number
  playerId: number
  playerName: string
  parityCertified: boolean
  parityContract: string
  projection: number | null
  probability: number | null
  qualifies: boolean | null
  evaluable: boolean
  blocker: string | null
  featureSnapshot: Record<string, unknown>
}

type BatterHistoryRow = {
  game_pk: number
  game_date: string
  batter: number
  plate_appearances: number
  singles: number
  doubles: number
  triples: number
}

type PitcherFeatureRow = {
  target_game_pk: number
  mlbam_pitcher_id: number
  k_rate: number | string | null
  as_of_date: string
  source_window: Record<string, unknown> | null
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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
    if (result.error) throw new Error('MLB_APPROVED_FIVE_RUNTIME_READ_FAILED:' + table + ':' + result.error.message)
    rows.push(...((result.data ?? []) as T[]))
    if (!result.data || result.data.length < PAGE_SIZE) break
  }
  return rows
}

async function loadBatterHistory(playerIds: number[], targetDate: string) {
  if (!playerIds.length) return [] as BatterHistoryRow[]
  return pagedRead<BatterHistoryRow>(
    'mlb_statcast_batter_sdt_game_mv',
    'game_pk,game_date,batter,plate_appearances,singles,doubles,triples',
    (query) => query
      .eq('season', SEASON)
      .in('batter', playerIds)
      .lt('game_date', targetDate)
      .gt('plate_appearances', 0)
      .order('game_date', { ascending: true })
      .order('game_pk', { ascending: true }),
  )
}

async function loadPitcherFeatures(targetDate: string, playerIds: number[]) {
  if (!playerIds.length) return new Map<string, PitcherFeatureRow>()
  const result = await supabaseAdmin
    .from('pick2_mlb_pitcher_daily_features')
    .select('target_game_pk,mlbam_pitcher_id,k_rate,as_of_date,source_window')
    .eq('feature_date', targetDate)
    .eq('feature_version', 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1')
    .in('mlbam_pitcher_id', playerIds)
    .order('target_game_pk', { ascending: true })
  if (result.error) throw new Error('MLB_APPROVED_FIVE_PITCHER_FEATURE_READ_FAILED:' + result.error.message)

  const map = new Map<string, PitcherFeatureRow>()
  for (const row of (result.data ?? []) as PitcherFeatureRow[]) {
    map.set(String(row.target_game_pk) + ':' + String(row.mlbam_pitcher_id), row)
  }
  return map
}

function batterProjection(
  historyRows: BatterHistoryRow[],
  playerId: number,
  metric: 'singles' | 'doubles' | 'triples',
  intercept: number,
  slope: number,
) {
  const history = historyRows.filter((row) => Number(row.batter) === playerId)
  if (history.length < 10) return null
  const recent = history.slice(-10)
  const priorPa = history.reduce((sum, row) => sum + Number(row.plate_appearances ?? 0), 0)
  const priorY = history.reduce((sum, row) => sum + Number(row[metric] ?? 0), 0)
  const recentPa = recent.reduce((sum, row) => sum + Number(row.plate_appearances ?? 0), 0)
  if (priorPa <= 0 || recentPa <= 0) return null
  const recentPaPerGame = recentPa / recent.length
  const priorRate = priorY / priorPa
  const raw = recentPaPerGame * priorRate
  return {
    predicted: Math.max(0, intercept + slope * raw),
    raw,
    priorGames: history.length,
    priorPa,
    priorY,
    priorRate,
    recentPaPerGame,
    latestPriorDate: history.at(-1)?.game_date ?? null,
  }
}

function pitcherHitsAllowedProjection(starts: MlbOfficialPitcherGameLogRow[]) {
  const eligible = starts.filter((row) =>
    row.gamesStarted > 0 &&
    row.hits !== null &&
    row.battersFaced !== null &&
    Number(row.battersFaced) > 0
  )
  if (eligible.length < APPROVED_FIVE_MARKET_PARITY.pitcher_hits_allowed.minimumPriorStarts) return null
  const recent = eligible.slice(-5)
  const cumulativeHits = eligible.reduce((sum, row) => sum + Number(row.hits), 0)
  const cumulativeBf = eligible.reduce((sum, row) => sum + Number(row.battersFaced), 0)
  const recentBf = recent.reduce((sum, row) => sum + Number(row.battersFaced), 0)
  if (cumulativeBf <= 0 || recentBf <= 0) return null

  const averageBfLast5 = recentBf / recent.length
  const raw = averageBfLast5 * (cumulativeHits / cumulativeBf)
  const fit = APPROVED_FIVE_MARKET_PARITY.pitcher_hits_allowed.externalRefit2025
  return {
    predicted: fit.intercept + fit.slope * raw,
    raw,
    priorStarts: eligible.length,
    cumulativeHits,
    cumulativeBf,
    averageBfLast5,
    priorHitRatePerBf: cumulativeHits / cumulativeBf,
    latestPriorDate: eligible.at(-1)?.date ?? null,
    latestPriorGamePk: eligible.at(-1)?.gamePk ?? null,
  }
}

function strictPregamePitcherFeature(feature: PitcherFeatureRow | undefined, targetDate: string) {
  if (!feature || feature.as_of_date >= targetDate) return false
  const sourceWindow = feature.source_window && typeof feature.source_window === 'object' && !Array.isArray(feature.source_window)
    ? feature.source_window as Record<string, unknown>
    : {}
  return String(sourceWindow.rule ?? '') === 'source_game_date < target_game_date'
}

export async function evaluateApprovedFiveMarketModels(input: {
  targetDate: string
  targets: ApprovedModelTarget[]
}): Promise<ApprovedModelEvaluation[]> {
  const uniquePitcherIds = [...new Set(
    input.targets
      .filter((target) => target.market === 'pitcher_earned_runs' || target.market === 'pitcher_hits_allowed')
      .map((target) => target.playerId),
  )]
  const uniqueBatterIds = [...new Set(
    input.targets
      .filter((target) => target.market.startsWith('batter_'))
      .map((target) => target.playerId),
  )]

  const [batterHistory, pitcherFeatures, pitcherGameLogs, erRuntime] = await Promise.all([
    loadBatterHistory(uniqueBatterIds, input.targetDate),
    loadPitcherFeatures(input.targetDate, uniquePitcherIds),
    mapConcurrent(uniquePitcherIds, 8, async (pitcherId) => ({
      pitcherId,
      rows: (await readMlbOfficialPitcherGameLog(pitcherId, SEASON))
        .filter((row) => row.date < input.targetDate)
        .sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk),
    })),
    getFrozenPitcherErRuntime(),
  ])
  const gameLogs = new Map(pitcherGameLogs.map((entry) => [entry.pitcherId, entry.rows]))

  const results: ApprovedModelEvaluation[] = []

  for (const target of input.targets) {
    if (target.market === 'batter_singles' || target.market === 'batter_doubles' || target.market === 'batter_triples') {
      const parity = APPROVED_FIVE_MARKET_PARITY[target.market]
      const config = target.market === 'batter_singles'
        ? { metric: 'singles' as const, max: 0.50, accuracy: 0.930761331964207 }
        : target.market === 'batter_doubles'
          ? { metric: 'doubles' as const, max: 0.16, accuracy: 0.869342273937482 }
          : { metric: 'triples' as const, max: 0.015, accuracy: 0.988151106673323 }
      const projection = batterProjection(
        batterHistory,
        target.playerId,
        config.metric,
        parity.externalRefit2025.intercept,
        parity.externalRefit2025.slope,
      )
      results.push({
        market: target.market,
        gamePk: target.gamePk,
        playerId: target.playerId,
        playerName: target.playerName,
        parityCertified: parity.certified,
        parityContract: parity.contract,
        projection: projection?.predicted ?? null,
        probability: null,
        qualifies: projection ? projection.predicted <= config.max : null,
        evaluable: Boolean(projection),
        blocker: projection ? null : 'MINIMUM_10_STRICT_PRIOR_GAMES_NOT_MET',
        featureSnapshot: {
          runtimeParity: parity,
          maxProjection: config.max,
          historicalAccuracy: config.accuracy,
          raw: projection?.raw ?? null,
          priorGames: projection?.priorGames ?? null,
          priorPa: projection?.priorPa ?? null,
          priorMetricTotal: projection?.priorY ?? null,
          priorRate: projection?.priorRate ?? null,
          recentPaPerGame: projection?.recentPaPerGame ?? null,
          latestPriorDate: projection?.latestPriorDate ?? null,
          source: 'mlb_statcast_batter_sdt_game_mv',
          strictPriorDate: true,
          sameDateHistoryAllowed: false,
        },
      })
      continue
    }

    if (target.market === 'pitcher_hits_allowed') {
      const parity = APPROVED_FIVE_MARKET_PARITY.pitcher_hits_allowed
      const projection = pitcherHitsAllowedProjection(gameLogs.get(target.playerId) ?? [])
      results.push({
        market: target.market,
        gamePk: target.gamePk,
        playerId: target.playerId,
        playerName: target.playerName,
        parityCertified: parity.certified,
        parityContract: parity.contract,
        projection: projection?.predicted ?? null,
        probability: null,
        qualifies: projection ? projection.predicted <= 5.0 : null,
        evaluable: Boolean(projection),
        blocker: projection ? null : 'MINIMUM_5_STRICT_PRIOR_STARTS_NOT_MET',
        featureSnapshot: {
          runtimeParity: parity,
          maxProjection: 5.0,
          historicalAccuracy: 0.789559543230016,
          raw: projection?.raw ?? null,
          priorStarts: projection?.priorStarts ?? null,
          cumulativeHits: projection?.cumulativeHits ?? null,
          cumulativeBattersFaced: projection?.cumulativeBf ?? null,
          averageBattersFacedLast5: projection?.averageBfLast5 ?? null,
          priorHitRatePerBf: projection?.priorHitRatePerBf ?? null,
          latestPriorDate: projection?.latestPriorDate ?? null,
          latestPriorGamePk: projection?.latestPriorGamePk ?? null,
          source: 'MLB Official gameLog pitching',
          strictPriorDate: true,
          sameDateHistoryAllowed: false,
        },
      })
      continue
    }

    const erParity = erRuntime.parity
    if (!erParity.certified) {
      results.push({
        market: target.market,
        gamePk: target.gamePk,
        playerId: target.playerId,
        playerName: target.playerName,
        parityCertified: false,
        parityContract: erParity.contract,
        projection: null,
        probability: null,
        qualifies: null,
        evaluable: false,
        blocker: 'PITCHER_ER_RUNTIME_PARITY_NOT_CERTIFIED:' + erParity.failures.join(','),
        featureSnapshot: { runtimeParity: erParity },
      })
      continue
    }

    const starts = (gameLogs.get(target.playerId) ?? []).filter((row) =>
      row.gamesStarted > 0 && row.earnedRuns !== null
    )
    const pitcherFeature = pitcherFeatures.get(String(target.gamePk) + ':' + String(target.playerId))
    const kRate = strictPregamePitcherFeature(pitcherFeature, input.targetDate)
      ? n(pitcherFeature?.k_rate)
      : null
    const priorStarts = starts.length
    const priorErAll = priorStarts
      ? starts.reduce((sum, row) => sum + Number(row.earnedRuns), 0) / priorStarts
      : null
    const eligible = priorStarts >= erParity.minimumPriorStarts && priorErAll !== null && kRate !== null
    const projection = eligible
      ? FROZEN_PITCHER_ER_MODEL.baseIntercept +
        FROZEN_PITCHER_ER_MODEL.baseSlope * priorErAll +
        FROZEN_PITCHER_ER_MODEL.kResidualIntercept +
        FROZEN_PITCHER_ER_MODEL.kResidualSlope * Number(kRate)
      : null
    const probability = projection === null
      ? null
      : pitcherErOverProbability(erRuntime.trainResiduals, projection, FROZEN_PITCHER_ER_MODEL.line)

    results.push({
      market: target.market,
      gamePk: target.gamePk,
      playerId: target.playerId,
      playerName: target.playerName,
      parityCertified: true,
      parityContract: erParity.contract,
      projection,
      probability,
      qualifies: probability === null ? null : probability >= FROZEN_PITCHER_ER_MODEL.minimumOverProbability,
      evaluable: eligible && probability !== null,
      blocker: eligible ? null : priorStarts < erParity.minimumPriorStarts
        ? 'MINIMUM_3_STRICT_PRIOR_STARTS_NOT_MET'
        : 'STRICT_PRIOR_CANONICAL_K_RATE_NOT_AVAILABLE',
      featureSnapshot: {
        runtimeParity: erParity,
        priorStarts,
        priorErAll,
        kRate,
        pitcherFeatureAsOfDate: pitcherFeature?.as_of_date ?? null,
        pitcherFeatureSourceWindow: pitcherFeature?.source_window ?? null,
        latestPriorStartDate: starts.at(-1)?.date ?? null,
        latestPriorStartGamePk: starts.at(-1)?.gamePk ?? null,
        trainResidualN: erRuntime.trainResiduals.length,
        sourceEarnedRuns: 'MLB Official gameLog pitching',
        sourceKRate: 'pick2_mlb_pitcher_daily_features.k_rate',
        strictPriorDate: true,
        sameDateHistoryAllowed: false,
      },
    })
  }

  return results
}
