export const MLB_ML_HIGH_CONF_MODEL = 'pregame_high_conf_home_v2' as const

export type MoneylineComponentInputs = {
  teamPrior2025: number | null
  starter: number | null
  recentForm: number | null
  history: number | null
  lineupMatchup: number | null
}

export type MoneylineGateDecision = {
  pickStatus: 'PICK' | 'NO_PICK'
  recommendedSide: 'HOME' | null
  routeId: string | null
  reason: string
  failClosed: boolean
  missingComponents: string[]
}

type Route = {
  id: string
  teamPriorMin: number
  starterMin: number
  recentFormMin?: number
  historyMin?: number
  lineupMatchupMin?: number
}

export const MLB_ML_HIGH_CONF_ROUTES: readonly Route[] = [
  {
    id: 'HC_HOME_R1_STARTER_TEAMPRIOR_LINEUP',
    teamPriorMin: 1.2,
    starterMin: 0.6,
    lineupMatchupMin: 0,
  },
  {
    id: 'HC_HOME_R2_STARTER_TEAMPRIOR_RECENT',
    teamPriorMin: 1.2,
    starterMin: 0.3,
    recentFormMin: 0.75,
  },
  {
    id: 'HC_HOME_R3_STARTER_TEAMPRIOR_HISTORY',
    teamPriorMin: 1.4,
    starterMin: 0.6,
    historyMin: -0.25,
  },
  {
    id: 'HC_HOME_R4_STARTER_TEAMPRIOR_HISTORY_STRICT',
    teamPriorMin: 1.45,
    starterMin: 0.25,
    historyMin: 0.25,
  },
] as const

const finite = (value: number | null): value is number => typeof value === 'number' && Number.isFinite(value)

function routeNeedsMissingComponent(route: Route, input: MoneylineComponentInputs) {
  if (!finite(input.teamPrior2025) || !finite(input.starter)) return []
  if (input.teamPrior2025 < route.teamPriorMin || input.starter < route.starterMin) return []
  const missing: string[] = []
  if (route.recentFormMin !== undefined && !finite(input.recentForm)) missing.push('recent_form')
  if (route.historyMin !== undefined && !finite(input.history)) missing.push('history')
  if (route.lineupMatchupMin !== undefined && !finite(input.lineupMatchup)) missing.push('lineup_matchup')
  return missing
}

function routeMatches(route: Route, input: MoneylineComponentInputs) {
  if (!finite(input.teamPrior2025) || !finite(input.starter)) return false
  if (input.teamPrior2025 < route.teamPriorMin || input.starter < route.starterMin) return false
  if (route.recentFormMin !== undefined && (!finite(input.recentForm) || input.recentForm < route.recentFormMin)) return false
  if (route.historyMin !== undefined && (!finite(input.history) || input.history < route.historyMin)) return false
  if (route.lineupMatchupMin !== undefined && (!finite(input.lineupMatchup) || input.lineupMatchup < route.lineupMatchupMin)) return false
  return true
}

export function evaluateMoneylineHighConfidenceHomeV2(input: MoneylineComponentInputs): MoneylineGateDecision {
  if (!finite(input.teamPrior2025)) {
    return {
      pickStatus: 'NO_PICK',
      recommendedSide: null,
      routeId: null,
      reason: 'TEAM_PRIOR_MISSING_FAIL_CLOSED',
      failClosed: true,
      missingComponents: ['team_prior_2025'],
    }
  }

  const minimumPrior = Math.min(...MLB_ML_HIGH_CONF_ROUTES.map((route) => route.teamPriorMin))
  if (input.teamPrior2025 < minimumPrior) {
    return {
      pickStatus: 'NO_PICK',
      recommendedSide: null,
      routeId: null,
      reason: 'TEAM_PRIOR_BELOW_ALL_ROUTE_MIN',
      failClosed: false,
      missingComponents: [],
    }
  }

  if (!finite(input.starter)) {
    return {
      pickStatus: 'NO_PICK',
      recommendedSide: null,
      routeId: null,
      reason: 'STARTER_MISSING_FAIL_CLOSED',
      failClosed: true,
      missingComponents: ['starter'],
    }
  }

  const minimumStarter = Math.min(...MLB_ML_HIGH_CONF_ROUTES.map((route) => route.starterMin))
  if (input.starter < minimumStarter) {
    return {
      pickStatus: 'NO_PICK',
      recommendedSide: null,
      routeId: null,
      reason: 'STARTER_BELOW_ALL_ROUTE_MIN',
      failClosed: false,
      missingComponents: [],
    }
  }

  for (const route of MLB_ML_HIGH_CONF_ROUTES) {
    if (routeMatches(route, input)) {
      return {
        pickStatus: 'PICK',
        recommendedSide: 'HOME',
        routeId: route.id,
        reason: 'ROUTE_MATCH',
        failClosed: false,
        missingComponents: [],
      }
    }
  }

  const missing = [...new Set(MLB_ML_HIGH_CONF_ROUTES.flatMap((route) => routeNeedsMissingComponent(route, input)))]
  if (missing.length) {
    return {
      pickStatus: 'NO_PICK',
      recommendedSide: null,
      routeId: null,
      reason: 'REQUIRED_COMPONENT_UNAVAILABLE_FAIL_CLOSED',
      failClosed: true,
      missingComponents: missing,
    }
  }

  return {
    pickStatus: 'NO_PICK',
    recommendedSide: null,
    routeId: null,
    reason: 'NO_FROZEN_ROUTE_MATCH',
    failClosed: false,
    missingComponents: [],
  }
}

export type NormalizationStat = { mean: number; sd: number }
export type FeatureValue = { featureName: string; direction: number; value: number | null }

export function normalizedComponentScore(
  values: FeatureValue[],
  featureStats: Map<string, NormalizationStat>,
  componentStat: NormalizationStat | null,
) {
  if (!componentStat || !Number.isFinite(componentStat.sd) || componentStat.sd === 0) return null
  const zValues: number[] = []
  for (const item of values) {
    if (!finite(item.value)) continue
    const stat = featureStats.get(item.featureName)
    if (!stat || !Number.isFinite(stat.sd) || stat.sd === 0) continue
    const z = ((item.direction * item.value) - stat.mean) / stat.sd
    if (Number.isFinite(z)) zValues.push(z)
  }
  if (!zValues.length) return null
  const raw = zValues.reduce((sum, value) => sum + value, 0) / zValues.length
  const score = (raw - componentStat.mean) / componentStat.sd
  return Number.isFinite(score) ? score : null
}

export function normalizeMlbModelTeam(team: string) {
  if (team === 'CHW') return 'CWS'
  if (team === 'ARI') return 'AZ'
  return team
}
