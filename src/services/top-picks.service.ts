import { supabaseAdmin } from '@/lib/supabase-admin'
import { getRiskGrade } from '@/services/risk-grade.service'
import { calculateQuarterKellyStake } from '@/services/kelly.service'
import { calculateSmartScore } from '@/services/smart-ranking.service'
import { calculateAdaptiveScore } from '@/services/adaptive-scoring.service'
import { getAdaptiveWeightRecommendations } from '@/services/adaptive-weight-engine.service'
import {
  PRODUCTION_DATA_GATE_V1_POLICY,
  isProductionEligibleRow,
} from '@/services/production-data-gate.service'

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string
  home_team: string
  away_team: string
  team: string
  opponent: string
  market: string
  sportsbook: string
  odds: number
  implied_probability: number
  model_probability: number
  edge: number
  ev: number
  confidence: number
  recommended_pick: boolean | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
  status: string | null
  result: string | null
  created_at?: string | null
  risk_grade?: string
  risk_stars?: number
  risk_label?: string
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
  adaptive_score?: number
  adaptive_adjustment?: unknown
}

function getStatus(row: PredictionRow) {
  return row.status ?? row.result ?? 'pending'
}

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

function getGameDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function isTodayOrFuture(value: string) {
  const gameDate = new Date(value)

  if (Number.isNaN(gameDate.getTime())) {
    return false
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  return gameDate >= startOfToday
}

function getCreatedTime(row: PredictionRow) {
  const createdAt = row.created_at
    ? new Date(row.created_at).getTime()
    : 0

  return Number.isFinite(createdAt) ? createdAt : 0
}

function getMatchupKey(row: PredictionRow) {
  const teams = [
    normalizeName(row.team),
    normalizeName(row.opponent),
  ].sort()

  return `${row.sport_key}:${getGameDate(
    row.commence_time
  )}:${teams.join(':')}`
}

function dedupeByLatestMatchup(rows: PredictionRow[]) {
  const map = new Map<string, PredictionRow>()

  for (const row of rows) {
    const key = getMatchupKey(row)
    const existing = map.get(key)

    if (!existing || getCreatedTime(row) > getCreatedTime(existing)) {
      map.set(key, row)
    }
  }

  return [...map.values()]
}

function passesSafetyFilter(row: PredictionRow) {
  if (row.odds >= 3000) return row.model_probability <= 7
  if (row.odds >= 2000) return row.model_probability <= 10
  if (row.odds >= 1500) return row.model_probability <= 12
  if (row.odds >= 1000) return row.model_probability <= 15
  if (row.odds >= 700) return row.model_probability <= 20
  if (row.odds >= 500) return row.model_probability <= 25

  return true
}

function passesBestBetFilter(row: PredictionRow) {
  return (
    row.recommended_pick === true &&
    row.odds < 300 &&
    row.ev >= 5 &&
    row.edge >= 5 &&
    row.confidence >= 65 &&
    passesSafetyFilter(row)
  )
}

function sortByAdaptiveScore(a: PredictionRow, b: PredictionRow) {
  return (
    (b.adaptive_score ?? 0) - (a.adaptive_score ?? 0) ||
    (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
    b.confidence - a.confidence ||
    b.ev - a.ev ||
    b.edge - a.edge
  )
}

function capStake(stake: number, maxStake = 50) {
  return Number(Math.min(stake, maxStake).toFixed(2))
}

function enrichRow(
  row: PredictionRow,
  adaptiveWeights: Awaited<
    ReturnType<typeof getAdaptiveWeightRecommendations>
  > | null
): PredictionRow {
  const risk = getRiskGrade(row.confidence, row.ev, row.edge)

  const kelly = calculateQuarterKellyStake(
    1000,
    row.model_probability,
    row.odds
  )

  const smartScore = calculateSmartScore({
    confidence: row.confidence,
    ev: row.ev,
    edge: row.edge,
    risk_stars: risk.stars,
    kelly_percent: kelly.kellyPercent,
  })

  const adaptive = calculateAdaptiveScore({
    odds: row.odds,
    confidence: row.confidence,
    ev: row.ev,
    edge: row.edge,
    smartScore,
    adaptiveWeights,
  })

  return {
    ...row,
    risk_grade: risk.grade,
    risk_stars: risk.stars,
    risk_label: risk.label,
    kelly_percent: kelly.kellyPercent,
    recommended_stake: capStake(kelly.stake),
    smart_score: smartScore,
    adaptive_score: adaptive.adjusted.adaptiveScore,
    adaptive_adjustment: adaptive,
  }
}

export async function getTopPicks(sportKey = 'baseball_mlb') {
  const query = supabaseAdmin
    .from('prediction_history')
    .select(
      'id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, edge, ev, confidence, recommended_pick, production_eligible, trial, scrambled, status, result, created_at'
    )
    .or('status.is.null,status.eq.pending')
    .eq('production_eligible', true)
    .order('created_at', { ascending: false })
    .limit(1500)

  if (sportKey !== 'all') {
    query.eq('sport_key', sportKey)
  }

  const adaptiveSport =
    sportKey === 'all' ? 'baseball_mlb' : sportKey

  const [{ data, error }, adaptiveWeights] = await Promise.all([
    query,

    getAdaptiveWeightRecommendations(adaptiveSport).catch((error) => {
      console.error(
        `Adaptive weights failed in top picks for ${adaptiveSport}:`,
        error
      )

      return null
    }),
  ])

  if (error) {
    throw new Error(error.message)
  }

  const pendingRows = ((data ?? []) as PredictionRow[]).filter(
    (row) =>
      isProductionEligibleRow(row) &&
      getStatus(row) === 'pending' &&
      isTodayOrFuture(row.commence_time)
  )

  const rows = dedupeByLatestMatchup(pendingRows)
  const safeRows = rows.filter(passesSafetyFilter)

  const enrichedRows = safeRows.map((row) =>
    enrichRow(row, adaptiveWeights)
  )

  const topEv = [...enrichedRows]
    .filter(
      (row) =>
        row.ev >= 3 &&
        row.edge >= 4 &&
        row.odds < 500
    )
    .sort(sortByAdaptiveScore)
    .slice(0, 10)

  const topConfidence = [...enrichedRows]
    .filter(
      (row) =>
        row.confidence >= 60 &&
        row.edge >= 2 &&
        row.odds < 300
    )
    .sort(sortByAdaptiveScore)
    .slice(0, 10)

  const bestBets = [...enrichedRows]
    .filter(passesBestBetFilter)
    .sort(sortByAdaptiveScore)
    .slice(0, 10)

  const recommended = enrichedRows.filter(
    (row) =>
      row.recommended_pick === true &&
      row.odds < 500
  )

  const sportsAvailable = [
    ...new Set(rows.map((row) => row.sport_key)),
  ].sort()

  return {
    success: true,
    sportKey,
    adaptiveWeightsAvailable: Boolean(adaptiveWeights),

    summary: {
      productionGateMode: PRODUCTION_DATA_GATE_V1_POLICY.mode,
      pendingPicks: rows.length,
      safePendingPicks: safeRows.length,
      recommendedPicks: recommended.length,
      topEvCount: topEv.length,
      topConfidenceCount: topConfidence.length,
      bestBetsCount: bestBets.length,
      sportsAvailable,
    },

    topEv,
    topConfidence,
    bestBets,
  }
}
