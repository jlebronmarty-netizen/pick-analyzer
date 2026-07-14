import { supabaseAdmin } from '@/lib/supabase-admin'

export type PredictionHistoryInput = {
  sport_key: string
  game_id: string
  commence_time: string
  home_team: string
  away_team: string
  team: string
  opponent: string
  market?: string
  sportsbook?: string
  odds: number | null
  implied_probability: number | null
  model_probability: number
  edge: number
  ev: number
  confidence: number
  recommended_pick: boolean
  selection?: string | null
  line?: number | null
  projected_line?: number | null
  odds_timestamp?: string | null
  generated_at?: string
  cutoff_at?: string | null
  model_version?: string | null
  feature_snapshot?: Record<string, unknown>
  feature_snapshot_id?: string | null
  feature_snapshot_key?: string | null
  feature_set_version?: string | null
  feature_snapshot_generated_at?: string | null
  production_eligible?: boolean
  trial?: boolean
  scrambled?: boolean
  validation_warnings?: string[]
  validation_status?: string
  lifecycle_status?: string
  skip_reason?: string | null
  settlement_market?: string | null
  status?: string
  result?: string
  stake?: number
  profit?: number | null
}

export async function savePredictionHistory(rows: PredictionHistoryInput[]) {
  if (!rows.length) {
    return {
      success: true,
      saved: 0,
    }
  }

  const { error } = await supabaseAdmin
    .from('prediction_history')
    .upsert(rows, {
      onConflict: 'sport_key,game_id,team,market,sportsbook',
    })

  if (error) {
    throw new Error(error.message)
  }

  return {
    success: true,
    saved: rows.length,
  }
}

export async function settlePredictionHistory(sportKey: string) {
  const { data: predictions, error } = await supabaseAdmin
    .from('prediction_history')
    .select('*')
    .eq('sport_key', sportKey)
    .eq('result', 'pending')

  if (error) throw new Error(error.message)

  let settled = 0

  for (const pick of predictions ?? []) {
    const { data: result } = await supabaseAdmin
      .from('game_results')
      .select('*')
      .eq('sport_key', pick.sport_key)
      .eq('game_id', pick.game_id)
      .maybeSingle()

    if (!result?.winner) continue

    const pickResult =
      result.winner === pick.team
        ? 'win'
        : result.home_score === result.away_score
          ? 'push'
          : 'loss'

    const odds = Number(pick.odds)
    const stake = Number(pick.stake ?? 100)

    let profit = 0

    if (pickResult === 'win') {
      profit = odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds))
    }

    if (pickResult === 'loss') {
      profit = -stake
    }

    const { error: updateError } = await supabaseAdmin
      .from('prediction_history')
      .update({
        result: pickResult,
        profit,
        settled_at: new Date().toISOString(),
      })
      .eq('id', pick.id)

    if (updateError) throw new Error(updateError.message)

    settled++
  }

  return {
    success: true,
    settled,
  }
}

export async function getPredictionPerformance(sportKey?: string) {
  let query = supabaseAdmin
    .from('prediction_history')
    .select('*')
    .neq('result', 'pending')

  if (sportKey) {
    query = query.eq('sport_key', sportKey)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const wins = rows.filter((row) => row.result === 'win').length
  const losses = rows.filter((row) => row.result === 'loss').length
  const pushes = rows.filter((row) => row.result === 'push').length
  const totalProfit = rows.reduce((sum, row) => sum + Number(row.profit ?? 0), 0)
  const totalStake = rows.reduce((sum, row) => sum + Number(row.stake ?? 0), 0)

  return {
    success: true,
    picks: rows.length,
    wins,
    losses,
    pushes,
    winRate: rows.length ? Number(((wins / rows.length) * 100).toFixed(2)) : 0,
    profit: Number(totalProfit.toFixed(2)),
    roi: totalStake ? Number(((totalProfit / totalStake) * 100).toFixed(2)) : 0,
  }
}
