import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  PRODUCTION_DATA_GATE_V1_POLICY,
  isProductionEligibleRow,
} from '@/services/production-data-gate.service'

type ClvRow = {
  id: string
  sport_key: string
  sportsbook: string
  odds: number
  confidence: number
  clv_percent: number | null
  clv_status: string | null
  clv_quality: string | null
  opening_odds: number | null
  closing_odds: number | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function average(values: number[]) {
  if (!values.length) return 0

  return round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function rate(count: number, total: number) {
  if (!total) return 0

  return round((count / total) * 100)
}

function getConfidenceBucket(confidence: number) {
  if (confidence >= 85) return '85+'
  if (confidence >= 75) return '75-84'
  if (confidence >= 65) return '65-74'
  if (confidence >= 55) return '55-64'

  return 'Below 55'
}

function summarizeGroup(rows: ClvRow[]) {
  const validRows = rows.filter((row) => typeof row.clv_percent === 'number')
  const total = validRows.length

  const positive = validRows.filter((row) => (row.clv_percent ?? 0) > 0).length
  const negative = validRows.filter((row) => (row.clv_percent ?? 0) < 0).length
  const neutral = validRows.filter((row) => (row.clv_percent ?? 0) === 0).length

  const strongPositive = validRows.filter(
    (row) => row.clv_quality === 'strong_positive'
  ).length

  const strongNegative = validRows.filter(
    (row) => row.clv_quality === 'strong_negative'
  ).length

  return {
    total,
    averageClv: average(validRows.map((row) => row.clv_percent ?? 0)),
    positiveRate: rate(positive, total),
    negativeRate: rate(negative, total),
    neutralRate: rate(neutral, total),
    strongPositiveRate: rate(strongPositive, total),
    strongNegativeRate: rate(strongNegative, total),
    averageOpeningOdds: average(
      validRows
        .map((row) => row.opening_odds)
        .filter((value): value is number => typeof value === 'number')
    ),
    averageClosingOdds: average(
      validRows
        .map((row) => row.closing_odds)
        .filter((value): value is number => typeof value === 'number')
    ),
  }
}

function groupBy<T extends string | number>(
  rows: ClvRow[],
  getKey: (row: ClvRow) => T
) {
  const groups = new Map<T, ClvRow[]>()

  for (const row of rows) {
    const key = getKey(row)
    const current = groups.get(key) ?? []

    current.push(row)
    groups.set(key, current)
  }

  return [...groups.entries()].map(([key, groupRows]) => ({
    key,
    ...summarizeGroup(groupRows),
  }))
}

export async function getClvAnalytics() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select(
      'id, sport_key, sportsbook, odds, confidence, clv_percent, clv_status, clv_quality, opening_odds, closing_odds, production_eligible, trial, scrambled'
    )
    .not('clv_percent', 'is', null)
    .eq('production_eligible', true)
    .limit(5000)

  if (error) {
    throw new Error(error.message)
  }

  const rows = ((data ?? []) as ClvRow[]).filter(isProductionEligibleRow)
  const overall = summarizeGroup(rows)

  const bySport = groupBy(rows, (row) => row.sport_key).sort(
    (a, b) => b.averageClv - a.averageClv
  )

  const bySportsbook = groupBy(rows, (row) => row.sportsbook).sort(
    (a, b) => b.averageClv - a.averageClv
  )

  const byConfidence = groupBy(rows, (row) =>
    getConfidenceBucket(Number(row.confidence ?? 0))
  ).sort((a, b) => String(b.key).localeCompare(String(a.key)))

  const bestSportsbooks = [...bySportsbook].slice(0, 5)

  const worstSportsbooks = [...bySportsbook]
    .sort((a, b) => a.averageClv - b.averageClv)
    .slice(0, 5)

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    summary: {
      productionGateMode: PRODUCTION_DATA_GATE_V1_POLICY.mode,
      trackedPicks: rows.length,
      ...overall,
    },
    bySport,
    bySportsbook,
    byConfidence,
    bestSportsbooks,
    worstSportsbooks,
  }
}
