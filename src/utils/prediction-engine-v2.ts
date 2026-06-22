export type TeamStatsInput = {
  team_name: string
  sport_key: string
  season: number
  wins: number | null
  losses: number | null
  ties?: number | null
  home_wins?: number | null
  home_losses?: number | null
  away_wins?: number | null
  away_losses?: number | null
  last_5_wins?: number | null
  last_5_losses?: number | null
  last_10_wins?: number | null
  last_10_losses?: number | null
  streak?: number | null
  win_percentage?: number | null
}

export type PredictionInput = {
  teamName: string
  opponentName: string
  americanOdds: number
  opponentAmericanOdds: number
  teamRating: number
  opponentRating: number
  teamStats?: TeamStatsInput | null
  opponentStats?: TeamStatsInput | null
  isHomeTeam?: boolean
}

export type PredictionResult = {
  team: string
  opponent: string
  odds: number
  impliedProbability: number
  modelProbability: number
  edge: number
  ev: number
  confidence: number
  recommendedPick: boolean
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  const safe = safeNumber(value, min)
  return Math.min(Math.max(safe, min), max)
}

function round(value: number, decimals = 2): number {
  const safe = safeNumber(value, 0)
  return Number(safe.toFixed(decimals))
}

export function americanOddsToImpliedProbability(odds: number): number {
  const safeOdds = safeNumber(odds, 100)

  if (safeOdds < 0) {
    return Math.abs(safeOdds) / (Math.abs(safeOdds) + 100)
  }

  return 100 / (safeOdds + 100)
}

export function americanOddsToDecimal(odds: number): number {
  const safeOdds = safeNumber(odds, 100)

  if (safeOdds < 0) {
    return 1 + 100 / Math.abs(safeOdds)
  }

  return 1 + safeOdds / 100
}

function getWinPercentage(stats?: TeamStatsInput | null): number {
  if (!stats) return 0.5

  const explicit = safeNumber(stats.win_percentage, NaN)

  if (Number.isFinite(explicit)) {
    return explicit > 1 ? explicit / 100 : explicit
  }

  const wins = safeNumber(stats.wins, 0)
  const losses = safeNumber(stats.losses, 0)
  const ties = safeNumber(stats.ties, 0)
  const total = wins + losses + ties

  if (total <= 0) return 0.5

  return wins / total
}

function getRecentForm(stats?: TeamStatsInput | null): number {
  if (!stats) return 0.5

  const wins = safeNumber(stats.last_10_wins, 0)
  const losses = safeNumber(stats.last_10_losses, 0)
  const total = wins + losses

  if (total <= 0) return 0.5

  return wins / total
}

function getStreakScore(stats?: TeamStatsInput | null): number {
  if (!stats) return 0.5

  const streak = safeNumber(stats.streak, 0)
  const normalized = 0.5 + clamp(streak, -5, 5) * 0.05

  return clamp(normalized, 0.25, 0.75)
}

function probabilityFromDifference(
  teamValue: number,
  opponentValue: number,
  multiplier: number
): number {
  const team = safeNumber(teamValue, 0.5)
  const opponent = safeNumber(opponentValue, 0.5)
  const diff = team - opponent

  return clamp(0.5 + diff * multiplier, 0.05, 0.95)
}

export function calculatePredictionV2(
  input: PredictionInput
): PredictionResult {
  const americanOdds = safeNumber(input.americanOdds, 100)
  const opponentAmericanOdds = safeNumber(input.opponentAmericanOdds, 100)

  const implied = americanOddsToImpliedProbability(americanOdds)
  const opponentImplied =
    americanOddsToImpliedProbability(opponentAmericanOdds)

  const impliedTotal = Math.max(implied + opponentImplied, 0.01)

  const vegasProbability = clamp(implied / impliedTotal, 0.03, 0.97)

  const teamRating = safeNumber(input.teamRating, 50)
  const opponentRating = safeNumber(input.opponentRating, 50)

  const ratingProbability = probabilityFromDifference(
    teamRating,
    opponentRating,
    0.015
  )

  const winPercentageProbability = probabilityFromDifference(
    getWinPercentage(input.teamStats),
    getWinPercentage(input.opponentStats),
    0.9
  )

  const recentFormProbability = probabilityFromDifference(
    getRecentForm(input.teamStats),
    getRecentForm(input.opponentStats),
    0.8
  )

  const streakProbability = probabilityFromDifference(
    getStreakScore(input.teamStats),
    getStreakScore(input.opponentStats),
    0.7
  )

  const homeBonus = input.isHomeTeam ? 0.015 : 0

  const modelProbability = clamp(
    vegasProbability * 0.45 +
      ratingProbability * 0.25 +
      winPercentageProbability * 0.12 +
      recentFormProbability * 0.12 +
      streakProbability * 0.06 +
      homeBonus,
    0.03,
    0.97
  )

  const decimalOdds = americanOddsToDecimal(americanOdds)
  const ev = modelProbability * decimalOdds - 1
  const edge = modelProbability - implied

  const confidence = clamp(
    50 +
      edge * 100 +
      Math.abs(teamRating - opponentRating) * 0.25 +
      (getRecentForm(input.teamStats) - 0.5) * 20,
    1,
    99
  )

  return {
    team: input.teamName,
    opponent: input.opponentName,
    odds: americanOdds,
    impliedProbability: round(implied * 100),
    modelProbability: round(modelProbability * 100),
    edge: round(edge * 100),
    ev: round(ev * 100),
    confidence: round(confidence),
    recommendedPick:
      ev > 0 &&
      edge > 0.015 &&
      confidence >= 55 &&
      modelProbability > implied,
  }
}