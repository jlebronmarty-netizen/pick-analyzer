export const SPORTSDATAIO_DISCOVERY_LAB_ORIGIN = 'https://api.sportsdata.io'

export type SportsDataIoDiscoveryLabResolvedUrl = {
  origin: string
  pathname: string
  url: string
}

export type SportsDataIoDiscoveryLabUrlFixture = {
  name: string
  endpoint: string
  expectedOrigin: string
  expectedPathname: string
  passed: boolean
}

export function resolveSportsDataIoDiscoveryLabUrl(endpoint: string): SportsDataIoDiscoveryLabResolvedUrl {
  if (!endpoint.startsWith('/api/mlb/')) {
    throw new Error(`Invalid SportsDataIO Discovery Lab MLB endpoint path: ${endpoint}`)
  }
  if (endpoint.includes('/v3/')) {
    throw new Error(`Enterprise SportsDataIO endpoint cannot be used for Discovery Lab MLB: ${endpoint}`)
  }

  const url = new URL(endpoint, SPORTSDATAIO_DISCOVERY_LAB_ORIGIN)
  return {
    origin: url.origin,
    pathname: url.pathname,
    url: url.toString(),
  }
}

export function validateSportsDataIoDiscoveryLabUrlFixtures(): SportsDataIoDiscoveryLabUrlFixture[] {
  const fixtures = [
    ['CurrentSeason', '/api/mlb/fantasy/json/CurrentSeason'],
    ['Teams', '/api/mlb/fantasy/json/Teams'],
    ['Players', '/api/mlb/fantasy/json/Players'],
    ['Standings', '/api/mlb/fantasy/json/Standings/2025'],
    ['TeamSeasonStats', '/api/mlb/odds/json/TeamSeasonStats/2025'],
    ['Games', '/api/mlb/odds/json/Games/2025'],
    ['GameOddsByDate', '/api/mlb/odds/json/GameOddsByDate/2025-03-27'],
  ] as const

  return fixtures.map(([name, endpoint]) => {
    const resolved = resolveSportsDataIoDiscoveryLabUrl(endpoint)
    return {
      name,
      endpoint,
      expectedOrigin: SPORTSDATAIO_DISCOVERY_LAB_ORIGIN,
      expectedPathname: endpoint,
      passed: resolved.origin === SPORTSDATAIO_DISCOVERY_LAB_ORIGIN && resolved.pathname === endpoint,
    }
  })
}
