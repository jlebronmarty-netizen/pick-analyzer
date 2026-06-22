import { supabase } from '@/lib/supabase'

type PredictionHistoryRow = {
  id: string
  game_id: string
  team: string
  opponent: string
  odds: number
  stake: number | null
  status: string | null
}

type GameResultRow = {
  id: string
  game_id: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
}

type SettlementResult = {
  checked: number
  settled: number
  wins: number
  losses: number
  pushes: number
  skipped: number
}

function normalizeTeamName(name: string) {
  return name.trim().toLowerCase()
}

function calculateProfit(
  odds: number,
  stake: number,
  result: 'win' | 'loss' | 'push'
) {
  if (result === 'loss') return -stake
  if (result === 'push') return 0

  if (odds < 0) {
    return stake * (100 / Math.abs(odds))
  }

  return stake * (odds / 100)
}

function getWinner(result: GameResultRow): string | null {
  if (
    result.home_score === null ||
    result.away_score === null ||
    result.home_score === result.away_score
  ) {
    return null
  }

  return result.home_score > result.away_score
    ? result.home_team
    : result.away_team
}

function isCompletedResult(result: GameResultRow) {
  return result.home_score !== null && result.away_score !== null
}

export async function settlePredictions(): Promise<SettlementResult> {
  const summary: SettlementResult = {
    checked: 0,
    settled: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    skipped: 0,
  }

  const { data: pendingPredictions, error: predictionError } = await supabase
    .from('prediction_history')
    .select('id, game_id, team, opponent, odds, stake, status')
    .or('status.is.null,status.eq.pending')
    .limit(500)

  if (predictionError) {
    throw new Error(
      `Failed to load pending predictions: ${predictionError.message}`
    )
  }

  if (!pendingPredictions || pendingPredictions.length === 0) {
    return summary
  }

  summary.checked = pendingPredictions.length

  const gameIds = Array.from(
    new Set(
      pendingPredictions
        .map((prediction) => prediction.game_id)
        .filter(Boolean)
    )
  )

  const { data: results, error: resultError } = await supabase
    .from('game_results')
    .select('id, game_id, home_team, away_team, home_score, away_score')
    .in('game_id', gameIds)

  if (resultError) {
    throw new Error(`Failed to load game results: ${resultError.message}`)
  }

  const resultMap = new Map<string, GameResultRow>()

  for (const result of results ?? []) {
    resultMap.set(result.game_id, result)
  }

  for (const prediction of pendingPredictions as PredictionHistoryRow[]) {
    const result = resultMap.get(prediction.game_id)

    if (!result || !isCompletedResult(result)) {
      summary.skipped += 1
      continue
    }

    const winner = getWinner(result)

    let status: 'win' | 'loss' | 'push'

    if (!winner) {
      status = 'push'
    } else if (normalizeTeamName(prediction.team) === normalizeTeamName(winner)) {
      status = 'win'
    } else {
      status = 'loss'
    }

    const stake = prediction.stake ?? 100
    const profit = calculateProfit(prediction.odds, stake, status)

    const { error: updateError } = await supabase
      .from('prediction_history')
      .update({
        status,
        stake,
        profit: Number(profit.toFixed(2)),
        settled_at: new Date().toISOString(),
        result_id: result.id,
      })
      .eq('id', prediction.id)

    if (updateError) {
      console.error('Failed to settle prediction:', updateError.message)
      summary.skipped += 1
      continue
    }

    summary.settled += 1

    if (status === 'win') summary.wins += 1
    if (status === 'loss') summary.losses += 1
    if (status === 'push') summary.pushes += 1
  }

  return summary
}