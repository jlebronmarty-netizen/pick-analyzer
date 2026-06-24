export function dedupePortfolioPicks<T extends {
  team: string
  opponent: string
}>(
  picks: T[]
) {
  const seen = new Set<string>()

  return picks.filter((pick) => {
    const key = [
      pick.team,
      pick.opponent,
    ]
      .sort()
      .join('|')

    if (seen.has(key)) {
      return false
    }

    seen.add(key)

    return true
  })
}

export function capStake(
  stake: number,
  bankroll = 1000,
  maxPercent = 5
) {
  const maxStake =
    bankroll * (maxPercent / 100)

  return Math.min(stake, maxStake)
}

export function optimizePortfolio<
  T extends {
    recommended_stake?: number
    team: string
    opponent: string
  }
>(
  picks: T[],
  bankroll = 1000
) {
  const unique =
    dedupePortfolioPicks(picks)

  return unique.map((pick) => ({
    ...pick,
    recommended_stake: capStake(
      pick.recommended_stake ?? 0,
      bankroll,
      5
    ),
  }))
}