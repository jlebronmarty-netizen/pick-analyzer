import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { readMlbOfficialBatterGameLog, type MlbOfficialBatterGameLogRow } from '@/services/mlb-official-batter-gamelog.service'
import { mapConcurrent } from '@/services/mlb-official-pitcher-gamelog.service'

export type NewApprovedPropMarket =
  | 'pitcher_strikeouts'
  | 'batter_rbis'
  | 'batter_hits_runs_rbis'

export type NewApprovedPropTarget = {
  gamePk: number
  market: NewApprovedPropMarket
  playerId: number
  playerName: string
}

export type NewApprovedPropEvaluation = {
  gamePk: number
  market: NewApprovedPropMarket
  playerId: number
  playerName: string
  projection: number | null
  qualifies: boolean | null
  evaluable: boolean
  parityCertified: boolean
  blocker: string | null
  featureSnapshot: Record<string, unknown>
}

const CANDIDATES = {
  pitcher_strikeouts: {
    candidateId: 'pitcher_k_under_6p5_proj_4p5_v1',
    line: 6.5,
    direction: 'UNDER',
    accuracy: 0.8899398108340498,
  },
  batter_rbis: {
    candidateId: 'batter_rbi_under_0p5_proj_0p10_v1',
    line: 0.5,
    direction: 'UNDER',
    accuracy: 0.8288222384784198,
  },
  batter_hits_runs_rbis: {
    candidateId: 'batter_hrrbi_under_2p5_proj_0p70_v1',
    line: 2.5,
    direction: 'UNDER',
    accuracy: 0.8549800796812749,
  },
} as const

export function newApprovedPropDefinition(market: NewApprovedPropMarket) {
  return CANDIDATES[market]
}

function pitcherKProjection(rows: Array<{
  game_date: string
  game_pk: number
  strikeouts: number
  batters_faced: number
}>) {
  if (rows.length < 5) return null
  const recent = rows.slice(-5)
  const totalBf = rows.reduce((sum, row) => sum + Number(row.batters_faced ?? 0), 0)
  const totalK = rows.reduce((sum, row) => sum + Number(row.strikeouts ?? 0), 0)
  if (totalBf <= 0) return null
  const l5Bf = recent.reduce((sum, row) => sum + Number(row.batters_faced ?? 0), 0) / recent.length
  const l5K = recent.reduce((sum, row) => sum + Number(row.strikeouts ?? 0), 0) / recent.length
  const priorKPerBf = totalK / totalBf
  const predicted = Math.max(0, 0.60 * (priorKPerBf * l5Bf) + 0.40 * l5K)
  return {
    predicted,
    priorStarts: rows.length,
    priorBattersFaced: totalBf,
    priorStrikeouts: totalK,
    priorKPerBf,
    l5BattersFacedPerStart: l5Bf,
    l5StrikeoutsPerStart: l5K,
    latestPriorDate: rows[rows.length - 1].game_date,
  }
}

function batterProjection(rows: MlbOfficialBatterGameLogRow[], market: 'batter_rbis' | 'batter_hits_runs_rbis') {
  if (rows.length < 10) return null
  const recent = rows.slice(-10)
  const priorPa = rows.reduce((sum, row) => sum + row.plateAppearances, 0)
  if (priorPa <= 0 || !recent.length) return null
  const recentPaPerGame = recent.reduce((sum, row) => sum + row.plateAppearances, 0) / recent.length

  const component = (key: 'hits' | 'runs' | 'rbi') => {
    const priorY = rows.reduce((sum, row) => sum + row[key], 0)
    const recentY = recent.reduce((sum, row) => sum + row[key], 0) / recent.length
    const priorRate = priorY / priorPa
    const projected = 0.50 * (priorRate * recentPaPerGame) + 0.50 * recentY
    return { priorY, priorRate, recentPerGame: recentY, projected }
  }

  const hits = component('hits')
  const runs = component('runs')
  const rbi = component('rbi')
  const predicted = market === 'batter_rbis'
    ? rbi.projected
    : hits.projected + runs.projected + rbi.projected

  return {
    predicted,
    priorGames: rows.length,
    priorPa,
    recentPaPerGame,
    latestPriorDate: rows[rows.length - 1].date,
    hits,
    runs,
    rbi,
  }
}

async function evaluatePitcherK(
  targetDate: string,
  targets: NewApprovedPropTarget[],
): Promise<NewApprovedPropEvaluation[]> {
  const relevant = targets.filter((target) => target.market === 'pitcher_strikeouts')
  if (!relevant.length) return []
  const ids = Array.from(new Set(relevant.map((target) => target.playerId)))
  const result = await supabaseAdmin
    .from('mlb_ml_xyear_pitcher_game_v1')
    .select('game_date,game_pk,pitcher,starter,strikeouts,batters_faced')
    .eq('season', 2026)
    .eq('starter', true)
    .in('pitcher', ids)
    .lt('game_date', targetDate)
    .order('game_date', { ascending: true })
    .order('game_pk', { ascending: true })
  if (result.error) throw new Error('MLB_APPROVED_PROP_PITCHER_K_HISTORY_READ_FAILED:' + result.error.message)

  return relevant.map((target) => {
    const rows = (result.data ?? [])
      .filter((row) => Number(row.pitcher) === target.playerId)
      .map((row) => ({
        game_date: String(row.game_date),
        game_pk: Number(row.game_pk),
        strikeouts: Number(row.strikeouts ?? 0),
        batters_faced: Number(row.batters_faced ?? 0),
      }))
    const projection = pitcherKProjection(rows)
    if (!projection) {
      return {
        ...target,
        projection: null,
        qualifies: null,
        evaluable: false,
        parityCertified: true,
        blocker: 'MINIMUM_5_PRIOR_STARTS_NOT_MET',
        featureSnapshot: {
          parityContract: 'PITCHER_K_XYEAR_RUNTIME_PARITY_V1',
          requiredSourceRule: 'game_date < target_date',
          source: 'mlb_ml_xyear_pitcher_game_v1',
          priorStarts: rows.length,
        },
      }
    }
    return {
      ...target,
      projection: projection.predicted,
      qualifies: projection.predicted <= 4.5,
      evaluable: true,
      parityCertified: true,
      blocker: null,
      featureSnapshot: {
        parityContract: 'PITCHER_K_XYEAR_RUNTIME_PARITY_V1',
        formula: '0.60*(prior_K_per_BF*L5_BF_per_start)+0.40*L5_K_per_start',
        threshold: 4.5,
        requiredLine: 6.5,
        requiredSourceRule: 'game_date < target_date',
        source: 'mlb_ml_xyear_pitcher_game_v1',
        ...projection,
      },
    }
  })
}

async function evaluateBatterOfficial(
  targetDate: string,
  targets: NewApprovedPropTarget[],
): Promise<NewApprovedPropEvaluation[]> {
  const relevant = targets.filter((target) =>
    target.market === 'batter_rbis' || target.market === 'batter_hits_runs_rbis'
  )
  if (!relevant.length) return []

  const ids = Array.from(new Set(relevant.map((target) => target.playerId)))
  const logs = await mapConcurrent(ids, 6, async (playerId) => ({
    playerId,
    rows: (await readMlbOfficialBatterGameLog(playerId, 2026))
      .filter((row) => row.date < targetDate),
  }))
  const byPlayer = new Map(logs.map((item) => [item.playerId, item.rows]))

  return relevant.map((target) => {
    const market = target.market as 'batter_rbis' | 'batter_hits_runs_rbis'
    const rows = byPlayer.get(target.playerId) ?? []
    const projection = batterProjection(rows, market)
    if (!projection) {
      return {
        ...target,
        projection: null,
        qualifies: null,
        evaluable: false,
        parityCertified: true,
        blocker: 'MINIMUM_10_PRIOR_GAMES_NOT_MET',
        featureSnapshot: {
          parityContract: 'MLB_OFFICIAL_BATTER_GAMELOG_RUNTIME_PARITY_V1',
          requiredSourceRule: 'game_date < target_date',
          source: 'MLB Official StatsAPI gameLog hitting',
          priorGames: rows.length,
        },
      }
    }
    const threshold = market === 'batter_rbis' ? 0.10 : 0.70
    return {
      ...target,
      projection: projection.predicted,
      qualifies: projection.predicted <= threshold,
      evaluable: true,
      parityCertified: true,
      blocker: null,
      featureSnapshot: {
        parityContract: 'MLB_OFFICIAL_BATTER_GAMELOG_RUNTIME_PARITY_V1',
        formula: 'component=0.50*(prior_event_per_PA*L10_PA_per_game)+0.50*L10_event_per_game',
        threshold,
        requiredSourceRule: 'game_date < target_date',
        source: 'MLB Official StatsAPI gameLog hitting',
        ...projection,
      },
    }
  })
}

export async function evaluateNewApprovedPropModels(input: {
  targetDate: string
  targets: NewApprovedPropTarget[]
}): Promise<NewApprovedPropEvaluation[]> {
  const unique = new Map<string, NewApprovedPropTarget>()
  for (const target of input.targets) {
    unique.set(
      [target.market, target.gamePk, target.playerId].join(':'),
      target,
    )
  }
  const targets = [...unique.values()]
  const [pitcherK, batters] = await Promise.all([
    evaluatePitcherK(input.targetDate, targets),
    evaluateBatterOfficial(input.targetDate, targets),
  ])
  return [...pitcherK, ...batters]
}
