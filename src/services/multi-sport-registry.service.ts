import {
  getSportDefinition,
  getSupportedSport,
  SPORTS,
  SportKey,
} from '@/config/sports.config'
import { getMarketsForSport } from '@/services/multi-sport-markets.service'
import { NormalizedLeague, NormalizedSport } from '@/types/multi-sport'

export const MULTI_SPORT_LEAGUES: NormalizedLeague[] = [
  {
    key: 'mlb',
    sportKey: 'baseball_mlb',
    displayName: 'Major League Baseball',
    country: 'US',
    region: 'North America',
    active: true,
    providerIds: { 'the-odds-api': 'baseball_mlb' },
    metadata: { season: 'regular_and_postseason' },
  },
  {
    key: 'bsn_pr',
    sportKey: 'basketball_bsn',
    displayName: 'Baloncesto Superior Nacional',
    country: 'PR',
    region: 'Puerto Rico',
    active: true,
    providerIds: { supabase: 'basketball_bsn' },
    metadata: { localIntegration: true },
  },
  {
    key: 'nba',
    sportKey: 'basketball_nba',
    displayName: 'National Basketball Association',
    country: 'US',
    region: 'North America',
    active: true,
    providerIds: { 'the-odds-api': 'basketball_nba' },
    metadata: { adapter: 'nba-adapter-wrapper' },
  },
  {
    key: 'nfl',
    sportKey: 'americanfootball_nfl',
    displayName: 'National Football League',
    country: 'US',
    region: 'North America',
    active: true,
    providerIds: { 'the-odds-api': 'americanfootball_nfl' },
    metadata: {},
  },
  {
    key: 'nhl',
    sportKey: 'icehockey_nhl',
    displayName: 'National Hockey League',
    country: 'US',
    region: 'North America',
    active: true,
    providerIds: { 'the-odds-api': 'icehockey_nhl' },
    metadata: {},
  },
  {
    key: 'soccer_generic',
    sportKey: 'soccer',
    displayName: 'Soccer',
    region: 'Global',
    active: true,
    providerIds: { 'the-odds-api': 'soccer' },
    metadata: { requiresProviderLeague: true },
  },
  {
    key: 'atp',
    sportKey: 'tennis',
    displayName: 'ATP Tennis',
    region: 'Global',
    active: true,
    providerIds: { 'the-odds-api': 'tennis_atp' },
    metadata: { tour: 'ATP' },
  },
  {
    key: 'wta',
    sportKey: 'tennis',
    displayName: 'WTA Tennis',
    region: 'Global',
    active: true,
    providerIds: { 'the-odds-api': 'tennis_wta' },
    metadata: { tour: 'WTA' },
  },
  {
    key: 'ufc',
    sportKey: 'mma_ufc',
    displayName: 'Ultimate Fighting Championship',
    region: 'Global',
    active: true,
    providerIds: { 'the-odds-api': 'mma_mixed_martial_arts' },
    metadata: { eventBased: true },
  },
]

export function getSportsRegistry(): NormalizedSport[] {
  return SPORTS.filter((sport) => sport.key !== 'all')
}

export function resolveSport(sportKey: string): NormalizedSport | null {
  return getSupportedSport(sportKey)
}

export function requireSport(sportKey: string): NormalizedSport {
  const sport = resolveSport(sportKey)

  if (!sport) {
    throw new Error(`Unsupported sport key: ${sportKey}`)
  }

  return sport
}

export function getLeaguesForSport(sportKey: SportKey): NormalizedLeague[] {
  return MULTI_SPORT_LEAGUES.filter(
    (league) => league.sportKey === sportKey && league.active
  )
}

export function resolveLeague(
  sportKey: SportKey,
  leagueKey?: string | null
): NormalizedLeague | null {
  const leagues = getLeaguesForSport(sportKey)

  if (!leagueKey) {
    return leagues[0] ?? null
  }

  return leagues.find((league) => league.key === leagueKey) ?? null
}

export function getSportRegistryDetail(sportKey: SportKey) {
  const sport = getSportDefinition(sportKey)

  return {
    ...sport,
    leagues: getLeaguesForSport(sportKey),
    markets: getMarketsForSport(sportKey),
  }
}
