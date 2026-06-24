type CorrelationPick = {
  id: string
  team: string
  opponent: string
  sport_key: string
  game_id?: string
  market?: string
  recommended_stake?: number
}

export type CorrelationResult = {
  correlationScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  warnings: string[]
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export function analyzeCorrelation(picks: CorrelationPick[]): CorrelationResult {
  const warnings: string[] = []
  const teamCounts = new Map<string, number>()
  const sportCounts = new Map<string, number>()
  const gameCounts = new Map<string, number>()

  for (const pick of picks) {
    const team = normalize(pick.team)
    const sport = pick.sport_key
    const game = pick.game_id ?? `${pick.team}-${pick.opponent}`

    teamCounts.set(team, (teamCounts.get(team) ?? 0) + 1)
    sportCounts.set(sport, (sportCounts.get(sport) ?? 0) + 1)
    gameCounts.set(game, (gameCounts.get(game) ?? 0) + 1)
  }

  let score = 0

  for (const [team, count] of teamCounts.entries()) {
    if (count >= 2) {
      score += count * 18
      warnings.push(`Repeated team exposure: ${team} appears ${count} times.`)
    }
  }

  for (const [sport, count] of sportCounts.entries()) {
    if (count >= 4) {
      score += count * 10
      warnings.push(`High sport correlation: ${sport} has ${count} picks.`)
    }
  }

  for (const [game, count] of gameCounts.entries()) {
    if (count >= 2) {
      score += count * 25
      warnings.push(`Multiple picks from same game: ${game}.`)
    }
  }

  const correlationScore = Math.min(100, Number(score.toFixed(2)))

  const riskLevel =
    correlationScore >= 65
      ? 'HIGH'
      : correlationScore >= 30
        ? 'MEDIUM'
        : 'LOW'

  return {
    correlationScore,
    riskLevel,
    warnings,
  }
}

export function removeHighlyCorrelatedPicks<T extends CorrelationPick>(
  picks: T[],
  maxPerTeam = 1,
  maxPerSport = 3
) {
  const teamCounts = new Map<string, number>()
  const sportCounts = new Map<string, number>()
  const gameIds = new Set<string>()

  return picks.filter((pick) => {
    const team = normalize(pick.team)
    const sport = pick.sport_key
    const game = pick.game_id ?? `${pick.team}-${pick.opponent}`

    const teamCount = teamCounts.get(team) ?? 0
    const sportCount = sportCounts.get(sport) ?? 0

    if (teamCount >= maxPerTeam) return false
    if (sportCount >= maxPerSport) return false
    if (gameIds.has(game)) return false

    teamCounts.set(team, teamCount + 1)
    sportCounts.set(sport, sportCount + 1)
    gameIds.add(game)

    return true
  })
}