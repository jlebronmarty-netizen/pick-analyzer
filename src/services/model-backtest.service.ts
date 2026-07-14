import { supabaseAdmin } from '@/lib/supabase-admin'
import { isProductionEligibleRow } from '@/services/production-data-gate.service'

export type BacktestResult = {
  roi: number
  winRate: number
  sample: number
}

type Prediction = {
  confidence: number | null
  edge: number | null
  ev: number | null
  result: string | null
  status: string | null
  profit: number | null
  stake: number | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
}

function getResult(p: Prediction) {
  return p.status ?? p.result ?? 'pending'
}

export async function runHistoricalBacktest() {
  const { data } = await supabaseAdmin
    .from('prediction_history')
    .select(
      'confidence,edge,ev,result,status,profit,stake,production_eligible,trial,scrambled'
    )
    .eq('recommended_pick', true)
    .eq('production_eligible', true)

  const rows = ((data ?? []) as Prediction[]).filter(isProductionEligibleRow)

  const settled = rows.filter(r =>
    ['win', 'loss'].includes(getResult(r))
  )

  const wins = settled.filter(r => getResult(r) === 'win').length

  const stake = settled.reduce(
    (s, r) => s + Number(r.stake ?? 0),
    0
  )

  const profit = settled.reduce(
    (s, r) => s + Number(r.profit ?? 0),
    0
  )

  return {
    sample: settled.length,
    roi: stake ? Number(((profit / stake) * 100).toFixed(2)) : 0,
    winRate: settled.length
      ? Number(((wins / settled.length) * 100).toFixed(2))
      : 0,
  }
}
