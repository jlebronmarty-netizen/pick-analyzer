import { supabase } from '@/lib/supabase'

type PredictionHistoryRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  team: string
  opponent: string
  odds: number
  stake: number | null
  status: string | null
}

type GameResultRow = {
  id: string
  game_id: string
  sport_key: string | null
  commence_time: string | null
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
  matchedByGameId: number
  matchedByTeamsAndDate: number
}

function normalizeTeamName(name: string | null | undefined) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
}

function getDateKey(value: string | null | undefined) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function buildTeamDateKey(
  sportKey: string | null | undefined,
  homeTeam: string | null | undefined,
  awayTeam: string | null | undefined,
  commenceTime: string | null | undefined
) {
  return [
    normalizeTeamName(sportKey),
    normalizeTeamName(homeTeam),
    normalizeTeamName(awayTeam),
    getDateKey(commenceTime),
  ].join('|')
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

function findResultForPrediction(
  prediction: PredictionHistoryRow,
  resultsByGameId: Map<string, GameResultRow>,
  resultsByTeamDate: Map<string, GameResultRow>
): { result: GameResultRow | null; matchType: 'game_id' | 'team_date' | null } {
  const exact = resultsByGameId.get(prediction.game_id)

  if (exact) {
    return {
      result: exact,
      matchType: 'game_id',
    }
  }

  const teamDateKey = buildTeamDateKey(
    prediction.sport_key,
    prediction.home_team,
    prediction.away_team,
    prediction.commence_time
  )

  const teamDateMatch = resultsByTeamDate.get(teamDateKey)

  if (teamDateMatch) {
    return {
      result: teamDateMatch,
      matchType: 'team_date',
    }
  }

  return {
    result: null,
    matchType: null,
  }
}

export async function settlePredictions(): Promise<SettlementResult> {
  const summary: SettlementResult = {
    checked: 0,
    settled: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    skipped: 0,
    matchedByGameId: 0,
    matchedByTeamsAndDate: 0,
  }

  const { data: pendingPredictions, error: predictionError } = await supabase
    .from('prediction_history')
    .select(
      'id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, odds, stake, status'
    )
    .or('status.is.null,status.eq.pending')
    .limit(1000)

  if (predictionError) {
    throw new Error(
      `Failed to load pending predictions: ${predictionError.message}`
    )
  }

  if (!pendingPredictions || pendingPredictions.length === 0) {
    return summary
  }

  summary.checked = pendingPredictions.length

  const earliestPredictionDate = pendingPredictions
    .map((prediction) => prediction.commence_time)
    .filter(Boolean)
    .sort()[0]

  let resultsQuery = supabase
    .from('game_results')
    .select(
      'id, game_id, sport_key, commence_time, home_team, away_team, home_score, away_score'
    )

  if (earliestPredictionDate) {
    resultsQuery = resultsQuery.gte('commence_time', earliestPredictionDate)
  }

  const { data: results, error: resultError } = await resultsQuery.limit(5000)

  if (resultError) {
    throw new Error(`Failed to load game results: ${resultError.message}`)
  }

  const completedResults = ((results ?? []) as GameResultRow[]).filter(
    isCompletedResult
  )

  const resultsByGameId = new Map<string, GameResultRow>()
  const resultsByTeamDate = new Map<string, GameResultRow>()

  for (const result of completedResults) {
    if (result.game_id) {
      resultsByGameId.set(result.game_id, result)
    }

    resultsByTeamDate.set(
      buildTeamDateKey(
        result.sport_key,
        result.home_team,
        result.away_team,
        result.commence_time
      ),
      result
    )
  }

  for (const prediction of pendingPredictions as PredictionHistoryRow[]) {
    const { result, matchType } = findResultForPrediction(
      prediction,
      resultsByGameId,
      resultsByTeamDate
    )

    if (!result) {
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

    if (matchType === 'game_id') summary.matchedByGameId += 1
    if (matchType === 'team_date') summary.matchedByTeamsAndDate += 1

    if (status === 'win') summary.wins += 1
    if (status === 'loss') summary.losses += 1
    if (status === 'push') summary.pushes += 1
  }

  return summary
}