import { getSportsRegistry } from '@/services/multi-sport-registry.service'
import { getMarketsForSport } from '@/services/multi-sport-markets.service'
import { getProvidersForSport } from '@/services/multi-sport-providers.service'

export function validateMultiSportEngine() {
  const findings: string[] = []

  for (const sport of getSportsRegistry()) {
    if (!sport.adapterId) {
      findings.push(`${sport.key} is missing an adapter identifier.`)
    }

    if (sport.leagueKeys.length === 0) {
      findings.push(`${sport.key} has no registered leagues.`)
    }

    if (getMarketsForSport(sport.key).length === 0) {
      findings.push(`${sport.key} has no normalized markets.`)
    }

    if (getProvidersForSport(sport.key).length === 0) {
      findings.push(`${sport.key} has no provider coverage.`)
    }
  }

  return {
    success: findings.length === 0,
    checkedSports: getSportsRegistry().length,
    findings,
  }
}
