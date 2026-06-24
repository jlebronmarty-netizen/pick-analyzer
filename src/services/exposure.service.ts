type ExposurePick = {
  team: string
  opponent: string
  sport_key: string
  recommended_stake?: number
}

export type ExposureSummary = {
  totalStake: number
  teamExposure: Record<string, number>
  sportExposure: Record<string, number>
  teamCounts: Record<string, number>
  sportCounts: Record<string, number>
  warnings: string[]
}

function round(value: number) {
  return Number(value.toFixed(2))
}

export function calculateExposure(picks: ExposurePick[]): ExposureSummary {
  const teamExposure: Record<string, number> = {}
  const sportExposure: Record<string, number> = {}
  const teamCounts: Record<string, number> = {}
  const sportCounts: Record<string, number> = {}
  const warnings: string[] = []

  const totalStake = round(
    picks.reduce((sum, pick) => sum + (pick.recommended_stake ?? 0), 0)
  )

  for (const pick of picks) {
    const stake = pick.recommended_stake ?? 0

    teamExposure[pick.team] = round((teamExposure[pick.team] ?? 0) + stake)
    sportExposure[pick.sport_key] = round(
      (sportExposure[pick.sport_key] ?? 0) + stake
    )

    teamCounts[pick.team] = (teamCounts[pick.team] ?? 0) + 1
    sportCounts[pick.sport_key] = (sportCounts[pick.sport_key] ?? 0) + 1
  }

  for (const [team, count] of Object.entries(teamCounts)) {
    if (count >= 2) {
      warnings.push(`High team exposure: ${team} appears ${count} times.`)
    }
  }

  for (const [sport, count] of Object.entries(sportCounts)) {
    if (count >= 4) {
      warnings.push(`High sport exposure: ${sport} has ${count} picks.`)
    }
  }

  for (const [team, stake] of Object.entries(teamExposure)) {
    if (totalStake > 0 && stake / totalStake >= 0.4) {
      warnings.push(`High stake concentration on ${team}.`)
    }
  }

  for (const [sport, stake] of Object.entries(sportExposure)) {
    if (totalStake > 0 && stake / totalStake >= 0.65) {
      warnings.push(`Portfolio is heavily concentrated in ${sport}.`)
    }
  }

  return {
    totalStake,
    teamExposure,
    sportExposure,
    teamCounts,
    sportCounts,
    warnings,
  }
}