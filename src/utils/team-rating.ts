export type TeamRatingInput = {
  winPercentage: number
  last10Wins: number
  last10Losses: number
  isHomeTeam: boolean
  streak: string | null
}

export function calculateTeamRating(
  team: TeamRatingInput
): number {
  let score = 50

  score += (team.winPercentage - 0.5) * 40

  const last10Pct =
    team.last10Wins /
    (team.last10Wins + team.last10Losses)

  score += (last10Pct - 0.5) * 20

  if (team.isHomeTeam) {
    score += 3
  }

  if (team.streak?.startsWith('W')) {
    const streakLength = parseInt(
      team.streak.replace('W', '')
    )

    score += streakLength
  }

  if (team.streak?.startsWith('L')) {
    const streakLength = parseInt(
      team.streak.replace('L', '')
    )

    score -= streakLength
  }

  return Math.max(
    0,
    Math.min(score, 100)
  )
}