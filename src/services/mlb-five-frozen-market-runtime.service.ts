import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { mapConcurrent, readMlbOfficialPitcherGameLog } from '@/services/mlb-official-pitcher-gamelog.service'
import {
  FROZEN_PITCHER_ER_MODEL,
  getFrozenPitcherErRuntime,
  pitcherErOverProbability,
} from '@/services/mlb-pitcher-er-frozen-runtime.service'

const SEASON = 2026
const PAGE_SIZE = 1000
const FEATURE_VERSION = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'

export const FIVE_MARKET_PARITY_CERTIFICATE = Object.freeze({
  contract: 'MLB_FIVE_APPROVED_MARKETS_RUNTIME_PARITY/1.0.0',
  certifiedAt: '2026-09-19',
  pitcher_hits_allowed: {
    certified: true,
    strictPriorDate: true,
    minimumPriorStarts: 5,
    historical2025: {
      refitN: 3099,
      intercept: 2.97876810879942,
      slope: 0.415326852941172,
    },
    external2026: { eligibleRows: 2568, selectedN: 1226, correct: 968 },
  },
  batter_singles: {
    certified: true,
    strictPriorDate: true,
    minimumPriorGames: 10,
    historical2025: {
      refitN: 42601,
      intercept: 0.260944252887134,
      slope: 0.515544560255828,
    },
    external2026: { eligibleRows: 40648, selectedN: 13634, correct: 12690 },
  },
  batter_doubles: {
    certified: true,
    strictPriorDate: true,
    minimumPriorGames: 10,
    historical2025: {
      refitN: 42601,
      intercept: 0.126877618354346,
      slope: 0.210234641434428,
    },
    external2026: { eligibleRows: 40648, selectedN: 20282, correct: 17632 },
  },
  batter_triples: {
    certified: true,
    strictPriorDate: true,
    minimumPriorGames: 10,
    historical2025: {
      refitN: 42601,
      intercept: 0.00876081897272024,
      slope: 0.294769143425622,
    },
    external2026: { eligibleRows: 40648, selectedN: 30045, correct: 29689 },
    incrementalSignal: 'LOW_INCREMENTAL_SIGNAL_BASELINE_DOMINATED',
  },
})

export type FiveMarketIdentity = {
  market: 'pitcher_earned_runs' | 'pitcher_hits_allowed' | 'batter_singles' | 'batter_doubles' | 'batter_triples'
  gamePk: number
  playerMlbamId: number | null
  playerName: string
}

export type FiveMarketDecision = {
  market: FiveMarketIdentity['market']
  gamePk: number
  playerMlbamId: number | null
  playerName: string
  candidateId: string
  direction: 'OVER' | 'UNDER'
  requiredLine: number
  historicalAccuracy: number
  projection: number | null
  probability: number | null
  modelQualifies: boolean | null
  runtimeStatus: 'READY' | 'NO_EVALUABLE' | 'RUNTIME_PARITY_NOT_CERTIFIED'
  blocker: string | null
  featureSnapshot: Record<string, unknown>
}

type PitcherFeatureRow = {
  target_game_pk: number
  mlbam_pitcher_id: number
  k_rate: number | string | null
  feature_date: string
  as_of_date: string
  source_window: Record<string, unknown> | null
}

type RawBatterEvent = {
  game_pk: number
  game_date: string
  mlbam_batter_id: number | string | null
  at_bat_number: number | string | null
  events: string | null
}

type BatterGame = {
  gamePk: number
  gameDate: string
  batter: number
  pa: number
  singles: number
  doubles: number
  triples: number
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

async function pagedRead<T>(table: string, columns: string, configure: (query: any) => any): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await configure(supabaseAdmin.from(table).select(columns))
      .range(offset, offset + PAGE_SIZE - 1)
    if (result.error) throw new Error('MLB_FIVE_MARKET_READ_FAILED:' + table + ':' + result.error.message)
    rows.push(...((result.data ?? []) as T[]))
    if (!result.data || result.data.length < PAGE_SIZE) break
  }
  return rows
}

async function loadPitcherFeatures(targetDate: string) {
  const result = await supabaseAdmin
    .from('pick2_mlb_pitcher_daily_features')
    .select('target_game_pk,mlbam_pitcher_id,k_rate,feature_date,as_of_date,source_window')
    .eq('feature_date', targetDate)
    .eq('feature_version', FEATURE_VERSION)
    .order('target_game_pk', { ascending: true })
  if (result.error) throw new Error('MLB_FIVE_MARKET_PITCHER_FEATURE_READ_FAILED:' + result.error.message)

  const map = new Map<string, PitcherFeatureRow>()
  for (const row of (result.data ?? []) as PitcherFeatureRow[]) {
    map.set(String(row.target_game_pk) + ':' + String(row.mlbam_pitcher_id), row)
  }
  return map
}

async function loadBatterEventHistory(ids: number[], targetDate: string) {
  if (!ids.length) return [] as BatterGame[]
  const rows = await pagedRead<RawBatterEvent>(
    'pick2_raw_mlb_statcast_pitches',
    'game_pk,game_date,mlbam_batter_id,at_bat_number,events',
    (query) => query
      .eq('game_year', SEASON)
      .eq('game_type', 'R')
      .in('mlbam_batter_id', ids)
      .lt('game_date', targetDate)
      .not('events', 'is', null)
      .order('game_date', { ascending: true })
      .order('game_pk', { ascending: true })
      .order('at_bat_number', { ascending: true }),
  )

  const games = new Map<string, BatterGame & { seenPa: Set<string> }>()
  for (const row of rows) {
    const batter = n(row.mlbam_batter_id)
    const gamePk = n(row.game_pk)
    const atBat = n(row.at_bat_number)
    const gameDate = String(row.game_date ?? '').slice(0, 10)
    if (!batter || !gamePk || atBat === null || !gameDate || !row.events) continue
    const key = String(batter) + ':' + String(gamePk)
    const game = games.get(key) ?? {
      gamePk,
      gameDate,
      batter,
      pa: 0,
      singles: 0,
      doubles: 0,
      triples: 0,
      seenPa: new Set<string>(),
    }
    const paKey = String(atBat)
    if (!game.seenPa.has(paKey)) {
      game.seenPa.add(paKey)
      game.pa += 1
      if (row.events === 'single') game.singles += 1
      if (row.events === 'double') game.doubles += 1
      if (row.events === 'triple') game.triples += 1
    }
    games.set(key, game)
  }

  return Array.from(games.values())
    .map(({ seenPa: _seenPa, ...row }) => row)
    .filter((row) => row.pa >= 1)
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
}

function batterProjection(input: {
  history: BatterGame[]
  playerId: number
  metric: 'singles' | 'doubles' | 'triples'
  intercept: number
  slope: number
}) {
  const history = input.history.filter((row) => row.batter === input.playerId)
  if (history.length < 10) return null
  const recent = history.slice(-10)
  const priorPa = history.reduce((sum, row) => sum + row.pa, 0)
  const priorY = history.reduce((sum, row) => sum + row[input.metric], 0)
  const recentPa = recent.reduce((sum, row) => sum + row.pa, 0)
  if (priorPa <= 0 || recentPa <= 0) return null
  const recentPaPerGame = recentPa / 10
  const priorRate = priorY / priorPa
  const raw = recentPaPerGame * priorRate
  return {
    projection: Math.max(0, input.intercept + input.slope * raw),
    priorGames: history.length,
    priorPa,
    priorY,
    priorRate,
    recentPaPerGame,
    latestPriorDate: history.at(-1)?.gameDate ?? null,
    raw,
  }
}

function exactSourceRule(feature: PitcherFeatureRow, targetDate: string) {
  const sourceWindow = asRecord(feature.source_window)
  return feature.as_of_date < targetDate &&
    String(sourceWindow.rule ?? '') === 'source_game_date < target_game_date'
}

function uniqueIdentities(input: FiveMarketIdentity[]) {
  const map = new Map<string, FiveMarketIdentity>()
  for (const item of input) {
    const key = item.market + ':' + item.gamePk + ':' + String(item.playerMlbamId ?? 'null')
    if (!map.has(key)) map.set(key, item)
  }
  return Array.from(map.values())
}

export async function evaluateFrozenFiveMarkets(input: {
  targetDate: string
  identities: FiveMarketIdentity[]
}): Promise<FiveMarketDecision[]> {
  const identities = uniqueIdentities(input.identities)
  const pitcherIds = Array.from(new Set(
    identities
      .filter((item) => item.market === 'pitcher_earned_runs' || item.market === 'pitcher_hits_allowed')
      .flatMap((item) => item.playerMlbamId ? [item.playerMlbamId] : []),
  ))
  const batterIds = Array.from(new Set(
    identities
      .filter((item) => item.market.startsWith('batter_'))
      .flatMap((item) => item.playerMlbamId ? [item.playerMlbamId] : []),
  ))

  const [pitcherFeatures, officialLogs, batterHistory, erRuntime] = await Promise.all([
    loadPitcherFeatures(input.targetDate),
    mapConcurrent(pitcherIds, 8, async (pitcherId) => ({
      pitcherId,
      rows: await readMlbOfficialPitcherGameLog(pitcherId, SEASON),
    })),
    loadBatterEventHistory(batterIds, input.targetDate),
    getFrozenPitcherErRuntime(),
  ])
  const officialByPitcher = new Map(officialLogs.map((row) => [row.pitcherId, row.rows]))

  const decisions: FiveMarketDecision[] = []
  for (const item of identities) {
    if (!item.playerMlbamId) {
      decisions.push({
        market: item.market,
        gamePk: item.gamePk,
        playerMlbamId: null,
        playerName: item.playerName,
        candidateId: item.market,
        direction: item.market === 'pitcher_earned_runs' ? 'OVER' : 'UNDER',
        requiredLine: item.market === 'pitcher_earned_runs' ? 1.5 : item.market === 'pitcher_hits_allowed' ? 6.5 : item.market === 'batter_singles' ? 1.5 : 0.5,
        historicalAccuracy: item.market === 'pitcher_earned_runs' ? 0.802197802197802 : item.market === 'pitcher_hits_allowed' ? 0.789559543230016 : item.market === 'batter_singles' ? 0.930761331964207 : item.market === 'batter_doubles' ? 0.869342273937482 : 0.988151106673323,
        projection: null,
        probability: null,
        modelQualifies: null,
        runtimeStatus: 'NO_EVALUABLE',
        blocker: 'EXACT_MLBAM_IDENTITY_MISSING_FROM_MARKET_SNAPSHOT',
        featureSnapshot: { fuzzyMatchingUsed: false },
      })
      continue
    }

    if (item.market === 'pitcher_earned_runs') {
      const feature = pitcherFeatures.get(String(item.gamePk) + ':' + String(item.playerMlbamId))
      if (!erRuntime.parity.certified) {
        decisions.push({
          market: item.market, gamePk: item.gamePk, playerMlbamId: item.playerMlbamId, playerName: item.playerName,
          candidateId: FROZEN_PITCHER_ER_MODEL.candidateId, direction: 'OVER', requiredLine: 1.5,
          historicalAccuracy: 0.802197802197802, projection: null, probability: null, modelQualifies: null,
          runtimeStatus: 'RUNTIME_PARITY_NOT_CERTIFIED',
          blocker: erRuntime.parity.failures.join('|') || 'PITCHER_ER_RUNTIME_PARITY_NOT_CERTIFIED',
          featureSnapshot: { parity: erRuntime.parity },
        })
        continue
      }
      if (!feature || !exactSourceRule(feature, input.targetDate)) {
        decisions.push({
          market: item.market, gamePk: item.gamePk, playerMlbamId: item.playerMlbamId, playerName: item.playerName,
          candidateId: FROZEN_PITCHER_ER_MODEL.candidateId, direction: 'OVER', requiredLine: 1.5,
          historicalAccuracy: 0.802197802197802, projection: null, probability: null, modelQualifies: null,
          runtimeStatus: 'NO_EVALUABLE', blocker: 'CANONICAL_PREGAME_K_RATE_FEATURE_MISSING_OR_NON_STRICT',
          featureSnapshot: { featureVersion: FEATURE_VERSION },
        })
        continue
      }
      const starts = (officialByPitcher.get(item.playerMlbamId) ?? [])
        .filter((row) => row.date < input.targetDate && row.gamesStarted > 0 && row.earnedRuns !== null)
        .sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)
      const kRate = n(feature.k_rate)
      if (starts.length < 3 || kRate === null) {
        decisions.push({
          market: item.market, gamePk: item.gamePk, playerMlbamId: item.playerMlbamId, playerName: item.playerName,
          candidateId: FROZEN_PITCHER_ER_MODEL.candidateId, direction: 'OVER', requiredLine: 1.5,
          historicalAccuracy: 0.802197802197802, projection: null, probability: null, modelQualifies: null,
          runtimeStatus: 'NO_EVALUABLE',
          blocker: starts.length < 3 ? 'MINIMUM_3_PRIOR_OFFICIAL_STARTS_NOT_MET' : 'CANONICAL_K_RATE_MISSING',
          featureSnapshot: { priorStarts: starts.length, featureAsOfDate: feature.as_of_date },
        })
        continue
      }
      const priorErAll = starts.reduce((sum, row) => sum + Number(row.earnedRuns), 0) / starts.length
      const projection =
        FROZEN_PITCHER_ER_MODEL.baseIntercept +
        FROZEN_PITCHER_ER_MODEL.baseSlope * priorErAll +
        FROZEN_PITCHER_ER_MODEL.kResidualIntercept +
        FROZEN_PITCHER_ER_MODEL.kResidualSlope * kRate
      const probability = pitcherErOverProbability(erRuntime.trainResiduals, projection, 1.5)
      decisions.push({
        market: item.market, gamePk: item.gamePk, playerMlbamId: item.playerMlbamId, playerName: item.playerName,
        candidateId: FROZEN_PITCHER_ER_MODEL.candidateId, direction: 'OVER', requiredLine: 1.5,
        historicalAccuracy: 0.802197802197802, projection, probability,
        modelQualifies: probability >= FROZEN_PITCHER_ER_MODEL.minimumOverProbability,
        runtimeStatus: 'READY', blocker: null,
        featureSnapshot: {
          parityContract: erRuntime.parity.contract,
          featureVersion: FEATURE_VERSION,
          featureAsOfDate: feature.as_of_date,
          strictPriorDate: true,
          sameDateHistoryAllowed: false,
          priorStarts: starts.length,
          priorErAll,
          pitcherKRate: kRate,
          maxPriorStartDate: starts.at(-1)?.date ?? null,
          trainResidualN: erRuntime.trainResiduals.length,
          earnedRunsSource: 'MLB_OFFICIAL_STATSAPI_GAMELOG',
          runsAllowedSubstitutionUsed: false,
        },
      })
      continue
    }

    if (item.market === 'pitcher_hits_allowed') {
      const parity = FIVE_MARKET_PARITY_CERTIFICATE.pitcher_hits_allowed
      if (!parity.certified) {
        decisions.push({
          market: item.market, gamePk: item.gamePk, playerMlbamId: item.playerMlbamId, playerName: item.playerName,
          candidateId: 'pitcher_hits_allowed_under_6p5_proj_5p0_v1', direction: 'UNDER', requiredLine: 6.5,
          historicalAccuracy: 0.789559543230016, projection: null, probability: null, modelQualifies: null,
          runtimeStatus: 'RUNTIME_PARITY_NOT_CERTIFIED', blocker: 'PITCHER_HITS_ALLOWED_PARITY_NOT_CERTIFIED',
          featureSnapshot: { parity },
        })
        continue
      }
      const starts = (officialByPitcher.get(item.playerMlbamId) ?? [])
        .filter((row) => row.date < input.targetDate && row.gamesStarted > 0 && row.hits !== null && row.battersFaced !== null && row.battersFaced > 0)
        .sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)
      if (starts.length < 5) {
        decisions.push({
          market: item.market, gamePk: item.gamePk, playerMlbamId: item.playerMlbamId, playerName: item.playerName,
          candidateId: 'pitcher_hits_allowed_under_6p5_proj_5p0_v1', direction: 'UNDER', requiredLine: 6.5,
          historicalAccuracy: 0.789559543230016, projection: null, probability: null, modelQualifies: null,
          runtimeStatus: 'NO_EVALUABLE', blocker: 'MINIMUM_5_PRIOR_OFFICIAL_STARTS_NOT_MET',
          featureSnapshot: { priorStarts: starts.length, strictPriorDate: true },
        })
        continue
      }
      const recent = starts.slice(-5)
      const priorHits = starts.reduce((sum, row) => sum + Number(row.hits), 0)
      const priorBf = starts.reduce((sum, row) => sum + Number(row.battersFaced), 0)
      const recentBfAvg = recent.reduce((sum, row) => sum + Number(row.battersFaced), 0) / 5
      const raw = recentBfAvg * (priorHits / priorBf)
      const projection = parity.historical2025.intercept + parity.historical2025.slope * raw
      decisions.push({
        market: item.market, gamePk: item.gamePk, playerMlbamId: item.playerMlbamId, playerName: item.playerName,
        candidateId: 'pitcher_hits_allowed_under_6p5_proj_5p0_v1', direction: 'UNDER', requiredLine: 6.5,
        historicalAccuracy: 0.789559543230016, projection, probability: null,
        modelQualifies: projection <= 5.0, runtimeStatus: 'READY', blocker: null,
        featureSnapshot: {
          parity,
          strictPriorDate: true,
          sameDateHistoryAllowed: false,
          priorStarts: starts.length,
          priorHits,
          priorBattersFaced: priorBf,
          recentBattersFacedPerStart: recentBfAvg,
          priorHitRatePerBatterFaced: priorHits / priorBf,
          raw,
          maxPriorStartDate: starts.at(-1)?.date ?? null,
          source: 'MLB_OFFICIAL_STATSAPI_GAMELOG',
        },
      })
      continue
    }

    const def = item.market === 'batter_singles'
      ? {
          candidateId: 'batter_singles_under_1p5_proj_0p50_v1',
          line: 1.5, maxProjection: 0.50, accuracy: 0.930761331964207,
          metric: 'singles' as const, parity: FIVE_MARKET_PARITY_CERTIFICATE.batter_singles,
        }
      : item.market === 'batter_doubles'
        ? {
            candidateId: 'batter_doubles_under_0p5_proj_0p16_v1',
            line: 0.5, maxProjection: 0.16, accuracy: 0.869342273937482,
            metric: 'doubles' as const, parity: FIVE_MARKET_PARITY_CERTIFICATE.batter_doubles,
          }
        : {
            candidateId: 'batter_triples_under_0p5_proj_0p015_v1',
            line: 0.5, maxProjection: 0.015, accuracy: 0.988151106673323,
            metric: 'triples' as const, parity: FIVE_MARKET_PARITY_CERTIFICATE.batter_triples,
          }

    if (!def.parity.certified) {
      decisions.push({
        market: item.market, gamePk: item.gamePk, playerMlbamId: item.playerMlbamId, playerName: item.playerName,
        candidateId: def.candidateId, direction: 'UNDER', requiredLine: def.line,
        historicalAccuracy: def.accuracy, projection: null, probability: null, modelQualifies: null,
        runtimeStatus: 'RUNTIME_PARITY_NOT_CERTIFIED', blocker: 'BATTER_RUNTIME_PARITY_NOT_CERTIFIED',
        featureSnapshot: { parity: def.parity },
      })
      continue
    }

    const projection = batterProjection({
      history: batterHistory,
      playerId: item.playerMlbamId,
      metric: def.metric,
      intercept: def.parity.historical2025.intercept,
      slope: def.parity.historical2025.slope,
    })
    if (!projection) {
      decisions.push({
        market: item.market, gamePk: item.gamePk, playerMlbamId: item.playerMlbamId, playerName: item.playerName,
        candidateId: def.candidateId, direction: 'UNDER', requiredLine: def.line,
        historicalAccuracy: def.accuracy, projection: null, probability: null, modelQualifies: null,
        runtimeStatus: 'NO_EVALUABLE', blocker: 'MINIMUM_10_STRICT_PRIOR_BATTER_GAMES_NOT_MET',
        featureSnapshot: { parity: def.parity, strictPriorDate: true, sameDateHistoryAllowed: false },
      })
      continue
    }

    decisions.push({
      market: item.market, gamePk: item.gamePk, playerMlbamId: item.playerMlbamId, playerName: item.playerName,
      candidateId: def.candidateId, direction: 'UNDER', requiredLine: def.line,
      historicalAccuracy: def.accuracy, projection: projection.projection, probability: null,
      modelQualifies: projection.projection <= def.maxProjection, runtimeStatus: 'READY', blocker: null,
      featureSnapshot: {
        parity: def.parity,
        strictPriorDate: true,
        sameDateHistoryAllowed: false,
        sourceGameDateRule: 'source_game_date < target_game_date',
        priorGames: projection.priorGames,
        priorPa: projection.priorPa,
        priorRate: projection.priorRate,
        recentPaPerGame: projection.recentPaPerGame,
        latestPriorDate: projection.latestPriorDate,
        raw: projection.raw,
        source: 'PICK2_RAW_MLB_STATCAST_TERMINAL_EVENTS',
      },
    })
  }

  return decisions
}
