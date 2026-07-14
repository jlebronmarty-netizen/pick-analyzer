import { supabaseAdmin } from '@/lib/supabase-admin'
import { isProductionEligibleRow } from '@/services/production-data-gate.service'

type PredictionRow = {
  sport_key: string
  sportsbook: string
  odds: number | null
  confidence: number | null
  ev: number | null
  profit: number | null
  stake: number | null
  status: string | null
  result: string | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
}

function getResult(row: PredictionRow) {
  return row.status ?? row.result ?? 'pending'
}

function roi(rows: PredictionRow[]) {
  const profit = rows.reduce((s, r) => s + Number(r.profit ?? 0), 0)
  const stake = rows.reduce((s, r) => s + Number(r.stake ?? 0), 0)

  return stake ? Number(((profit / stake) * 100).toFixed(2)) : 0
}

function winRate(rows: PredictionRow[]) {
  const graded = rows.filter(r => ['win', 'loss'].includes(getResult(r)))

  if (!graded.length) return 0

  const wins = graded.filter(r => getResult(r) === 'win').length

  return Number(((wins / graded.length) * 100).toFixed(2))
}

function bucketOdds(odds: number) {
  if (odds <= -200) return 'Heavy Favorite'
  if (odds <= -110) return 'Favorite'
  if (odds < 100) return 'Near Even'
  if (odds <= 200) return 'Underdog'
  return 'Longshot'
}

function bucketConfidence(value: number) {
  if (value >= 90) return '90-100'
  if (value >= 80) return '80-89'
  if (value >= 70) return '70-79'
  if (value >= 60) return '60-69'
  return '<60'
}

function bucketEV(value: number) {
  if (value >= 20) return '20+'
  if (value >= 15) return '15-19'
  if (value >= 10) return '10-14'
  if (value >= 5) return '5-9'
  return '<5'
}

function groupBy<T extends string>(
  rows: PredictionRow[],
  keyFn: (row: PredictionRow) => T
) {
  const map = new Map<T, PredictionRow[]>()

  rows.forEach(row => {
    const key = keyFn(row)

    if (!map.has(key)) map.set(key, [])

    map.get(key)!.push(row)
  })

  return [...map.entries()].map(([key, items]) => ({
    key,
    sample: items.length,
    roi: roi(items),
    winRate: winRate(items),
  }))
}

export async function discoverPatterns() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select(`
      sport_key,
      sportsbook,
      odds,
      confidence,
      ev,
      profit,
      stake,
      status,
      result,
      production_eligible,
      trial,
      scrambled
    `)
    .eq('production_eligible', true)

  if (error) {
    throw new Error(error.message)
  }

  const rows = ((data ?? []) as PredictionRow[])
    .filter(r => isProductionEligibleRow(r) && ['win', 'loss'].includes(getResult(r)))

  const sports = groupBy(rows, r => r.sport_key)
  const books = groupBy(rows, r => r.sportsbook)
  const odds = groupBy(rows, r => bucketOdds(Number(r.odds ?? 0)))
  const confidence = groupBy(rows, r => bucketConfidence(Number(r.confidence ?? 0)))
  const ev = groupBy(rows, r => bucketEV(Number(r.ev ?? 0)))

  return {
    success: true,

    sports,

    sportsbooks: books,

    odds,

    confidence,

    ev,

    bestSport:
      [...sports].sort((a, b) => b.roi - a.roi)[0] ?? null,

    worstSport:
      [...sports].sort((a, b) => a.roi - b.roi)[0] ?? null,

    bestSportsbook:
      [...books].sort((a, b) => b.roi - a.roi)[0] ?? null,

    bestOddsRange:
      [...odds].sort((a, b) => b.roi - a.roi)[0] ?? null,

    bestConfidenceRange:
      [...confidence].sort((a, b) => b.roi - a.roi)[0] ?? null,

    bestEVRange:
      [...ev].sort((a, b) => b.roi - a.roi)[0] ?? null,
  }
}
