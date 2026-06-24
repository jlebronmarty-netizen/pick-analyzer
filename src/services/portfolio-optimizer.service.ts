type OptimizablePick = {
  recommended_stake?: number
  team: string
  opponent: string
  sport_key?: string
  risk_grade?: string
  smart_score?: number
  confidence?: number
  ev?: number
}

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

function getMatchupKey(pick: OptimizablePick) {
  return [normalizeName(pick.team), normalizeName(pick.opponent)]
    .sort()
    .join('|')
}

export function dedupePortfolioPicks<T extends OptimizablePick>(picks: T[]) {
  const seenMatchups = new Set<string>()
  const seenTeams = new Set<string>()

  return picks.filter((pick) => {
    const matchupKey = getMatchupKey(pick)
    const teamKey = normalizeName(pick.team)

    if (seenMatchups.has(matchupKey)) return false
    if (seenTeams.has(teamKey)) return false

    seenMatchups.add(matchupKey)
    seenTeams.add(teamKey)

    return true
  })
}

export function capStake(stake: number, bankroll = 1000, maxPercent = 5) {
  const maxStake = bankroll * (maxPercent / 100)

  return Number(Math.min(stake, maxStake).toFixed(2))
}

function getMaxPicksPerSport(portfolioName?: string) {
  if (portfolioName === 'Conservative') return 2
  if (portfolioName === 'Balanced') return 3

  return 4
}

export function diversifyBySport<T extends OptimizablePick>(
  picks: T[],
  portfolioName?: string
) {
  const maxPerSport = getMaxPicksPerSport(portfolioName)
  const counts = new Map<string, number>()

  return picks.filter((pick) => {
    const sportKey = pick.sport_key ?? 'unknown'
    const current = counts.get(sportKey) ?? 0

    if (current >= maxPerSport) return false

    counts.set(sportKey, current + 1)

    return true
  })
}

export function optimizePortfolio<T extends OptimizablePick>(
  picks: T[],
  bankroll = 1000,
  portfolioName?: string
) {
  const sorted = [...picks].sort(
    (a, b) =>
      (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
      (b.confidence ?? 0) - (a.confidence ?? 0) ||
      (b.ev ?? 0) - (a.ev ?? 0)
  )

  const unique = dedupePortfolioPicks(sorted)
  const diversified = diversifyBySport(unique, portfolioName)

  return diversified.map((pick) => ({
    ...pick,
    recommended_stake: Number((pick.recommended_stake ?? 0).toFixed(2)),
  }))
}