import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  PRODUCTION_DATA_GATE_V1_POLICY,
  isProductionEligibleRow,
} from '@/services/production-data-gate.service'

type PredictionRow = {
  id: string
  sport_key: string
  market: string | null
  result: string | null
  odds: number | null
  model_probability: number | null
  confidence: number | null
  ev: number | null
  stake: number | null
  profit: number | null
  model_version: string | null
  feature_snapshot: Record<string, unknown> | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
}

type MetricSegment = {
  key: string
  label: string
  samples: number
  wins: number
  losses: number
  pushes: number
  winRate: number
  roi: number
  units: number
  averageProbability: number
  averageConfidence: number
  brierScore: number | null
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function isSettled(row: PredictionRow) {
  return ['win', 'loss', 'push'].includes(String(row.result ?? ''))
}

function outcome(row: PredictionRow) {
  if (row.result === 'win') return 1
  if (row.result === 'loss') return 0
  return null
}

function avg(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value))
  if (!clean.length) return 0
  return round(clean.reduce((sum, value) => sum + value, 0) / clean.length)
}

function brier(rows: PredictionRow[]) {
  const scored = rows
    .map((row) => ({
      probability: Number(row.model_probability ?? row.confidence ?? 0) / 100,
      outcome: outcome(row),
    }))
    .filter((row) => row.outcome !== null && Number.isFinite(row.probability))

  if (!scored.length) return null

  return round(
    scored.reduce(
      (sum, row) => sum + (row.probability - Number(row.outcome)) ** 2,
      0
    ) / scored.length,
    4
  )
}

function segment(key: string, label: string, rows: PredictionRow[]): MetricSegment {
  const settled = rows.filter(isSettled)
  const wins = settled.filter((row) => row.result === 'win').length
  const losses = settled.filter((row) => row.result === 'loss').length
  const pushes = settled.filter((row) => row.result === 'push').length
  const profit = settled.reduce((sum, row) => sum + Number(row.profit ?? 0), 0)
  const stake = settled.reduce((sum, row) => sum + Number(row.stake ?? 0), 0)

  return {
    key,
    label,
    samples: settled.length,
    wins,
    losses,
    pushes,
    winRate: settled.length ? round((wins / settled.length) * 100) : 0,
    roi: stake ? round((profit / stake) * 100) : 0,
    units: round(profit / 100),
    averageProbability: avg(
      settled.map((row) => Number(row.model_probability ?? 0))
    ),
    averageConfidence: avg(settled.map((row) => Number(row.confidence ?? 0))),
    brierScore: brier(settled),
  }
}

function groupBy(rows: PredictionRow[], keyFn: (row: PredictionRow) => string) {
  const groups = new Map<string, PredictionRow[]>()
  for (const row of rows) {
    const key = keyFn(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return Array.from(groups.entries())
}

function confidenceBucket(row: PredictionRow) {
  const confidence = Number(row.confidence ?? row.model_probability ?? 0)
  if (confidence >= 80) return '80_plus'
  if (confidence >= 70) return '70_79'
  if (confidence >= 60) return '60_69'
  if (confidence >= 50) return '50_59'
  return 'under_50'
}

function dataSufficiencyBucket(row: PredictionRow) {
  const score = Number(row.feature_snapshot?.dataSufficiencyScore ?? 0)
  if (score >= 80) return '80_plus'
  if (score >= 60) return '60_79'
  if (score >= 35) return '35_59'
  return 'under_35'
}

async function loadRows() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select(
      'id, sport_key, market, result, odds, model_probability, confidence, ev, stake, profit, model_version, feature_snapshot, production_eligible, trial, scrambled'
    )
    .eq('production_eligible', true)
    .limit(5000)

  if (error) throw error

  return ((data ?? []) as PredictionRow[]).filter(isProductionEligibleRow)
}

export async function getModelMetricsFramework() {
  const rows = await loadRows()
  const settled = rows.filter(isSettled)

  return {
    success: true,
    mode: 'model_metrics_framework_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'prediction_history',
      productionGateMode: PRODUCTION_DATA_GATE_V1_POLICY.mode,
    },
    status:
      settled.length >= 100
        ? 'ready'
        : settled.length > 0
          ? 'limited_sample'
          : 'empty',
    summary: {
      rows: rows.length,
      settled: settled.length,
      pending: rows.length - settled.length,
      brierScore: brier(settled),
      warnings: [
        ...(settled.length < 30
          ? ['Settled sample size is below the preferred minimum of 30.']
          : []),
      ],
    },
    overall: segment('overall', 'Overall', rows),
    bySport: groupBy(rows, (row) => row.sport_key).map(([key, segmentRows]) =>
      segment(key, key, segmentRows)
    ),
    byMarket: groupBy(rows, (row) => row.market ?? 'unknown').map(
      ([key, segmentRows]) => segment(key, key, segmentRows)
    ),
    byConfidence: groupBy(rows, confidenceBucket).map(([key, segmentRows]) =>
      segment(key, key.replace('_', '-'), segmentRows)
    ),
    byDataSufficiency: groupBy(rows, dataSufficiencyBucket).map(
      ([key, segmentRows]) => segment(key, key.replace('_', '-'), segmentRows)
    ),
    byModelVersion: groupBy(rows, (row) => row.model_version ?? 'legacy').map(
      ([key, segmentRows]) => segment(key, key, segmentRows)
    ),
  }
}
