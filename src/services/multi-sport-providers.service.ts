import { SportKey } from '@/config/sports.config'
import { SportsProvider } from '@/types/multi-sport'

function hasEnv(name: string) {
  return Boolean(process.env[name])
}

export function getSportsProviders(): SportsProvider[] {
  const oddsConfigured = hasEnv('ODDS_API_KEY')
  const apiSportsConfigured = hasEnv('API_SPORTS_KEY')
  const sportsDataIoMlbConfigured = hasEnv('SPORTSDATAIO_MLB_API_KEY')

  return [
    {
      id: 'the-odds-api',
      name: 'The Odds API',
      sportCoverage: [
        'baseball_mlb',
        'basketball_nba',
        'americanfootball_nfl',
        'icehockey_nhl',
        'soccer',
        'tennis',
        'mma_ufc',
      ],
      requiresAuth: true,
      rateLimit: { requests: 500, interval: 'day' },
      features: ['schedule', 'event', 'odds', 'results'],
      priority: 1,
      fallbackOrder: 1,
      health: oddsConfigured ? 'healthy' : 'unavailable',
      lastError: oddsConfigured ? undefined : 'Missing ODDS_API_KEY',
      metadata: {
        baseUrl: 'https://api.the-odds-api.com/v4',
      },
    },
    {
      id: 'api-sports',
      name: 'API-Sports',
      sportCoverage: ['baseball_mlb', 'soccer'],
      requiresAuth: true,
      rateLimit: { requests: 100, interval: 'day' },
      features: ['leagues', 'teams', 'schedule', 'standings', 'stats'],
      priority: 2,
      fallbackOrder: 2,
      health: apiSportsConfigured ? 'degraded' : 'unavailable',
      lastError: apiSportsConfigured
        ? 'Provider adapters are only wired for targeted sync services.'
        : 'Missing API_SPORTS_KEY',
      metadata: {
        baseballBaseUrl: 'https://v1.baseball.api-sports.io',
        footballBaseUrl: 'https://v3.football.api-sports.io',
      },
    },
    {
      id: 'sportsdataio-discovery-lab',
      name: 'SportsDataIO Discovery Lab',
      sportCoverage: ['baseball_mlb'],
      requiresAuth: true,
      rateLimit: { requests: 100, interval: 'day' },
      features: ['leagues'],
      priority: 2,
      fallbackOrder: 2,
      health: sportsDataIoMlbConfigured ? 'degraded' : 'unavailable',
      lastError: sportsDataIoMlbConfigured
        ? 'MLB Discovery Lab key is configured; confirmed Fantasy/Odds endpoints are quarantined validation only until normalization, persistence and production gates pass.'
        : 'Missing SPORTSDATAIO_MLB_API_KEY',
      metadata: {
        providerVariant: 'sportsdataio_discovery_lab',
        baseOrigin: 'https://api.sportsdata.io',
        pathTemplate: '/api/mlb/{product}/json/{endpoint}',
        products: ['fantasy', 'odds'],
        confirmedEndpoints: [
          '/api/mlb/fantasy/json/CurrentSeason',
          '/api/mlb/fantasy/json/Players',
          '/api/mlb/fantasy/json/FreeAgents',
          '/api/mlb/fantasy/json/Standings/{season}',
          '/api/mlb/fantasy/json/Teams',
          '/api/mlb/fantasy/json/DfsSlatesByDate/{date}',
          '/api/mlb/fantasy/json/PlayerGameStatsByDate/{date}',
          '/api/mlb/fantasy/json/PlayerSeasonStats/{season}',
          '/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/{date}',
          '/api/mlb/fantasy/json/PlayerSeasonProjectionStats/{season}',
          '/api/mlb/odds/json/GamesByDate/{date}',
          '/api/mlb/odds/json/GameOddsByDate/{date}',
          '/api/mlb/odds/json/GameOddsLineMovement/{gameid}',
          '/api/mlb/odds/json/Games/{season}',
          '/api/mlb/odds/json/Stadiums',
          '/api/mlb/odds/json/TeamGameStatsByDate/{date}',
          '/api/mlb/odds/json/TeamSeasonStats/{season}',
        ],
        enterpriseFallback: false,
        productionEligibility: 'quarantined_only',
      },
    },
    {
      id: 'supabase-bsn',
      name: 'Supabase BSN Dataset',
      sportCoverage: ['basketball_bsn'],
      requiresAuth: true,
      rateLimit: { requests: 1000, interval: 'minute' },
      features: ['teams', 'schedule', 'event', 'results'],
      priority: 1,
      fallbackOrder: 1,
      health:
        hasEnv('NEXT_PUBLIC_SUPABASE_URL') &&
        hasEnv('SUPABASE_SERVICE_ROLE_KEY')
          ? 'healthy'
          : 'unavailable',
      lastError:
        hasEnv('NEXT_PUBLIC_SUPABASE_URL') &&
        hasEnv('SUPABASE_SERVICE_ROLE_KEY')
          ? undefined
          : 'Missing Supabase server credentials',
      metadata: {
        tables: ['bsn_teams', 'bsn_games', 'bsn_results'],
      },
    },
    {
      id: 'supabase-model-store',
      name: 'Supabase Model Store',
      sportCoverage: [
        'baseball_mlb',
        'basketball_bsn',
        'basketball_nba',
        'americanfootball_nfl',
        'icehockey_nhl',
        'soccer',
        'tennis',
        'mma_ufc',
      ],
      requiresAuth: true,
      rateLimit: { requests: 1000, interval: 'minute' },
      features: ['stats', 'standings', 'results'],
      priority: 3,
      fallbackOrder: 3,
      health:
        hasEnv('NEXT_PUBLIC_SUPABASE_URL') &&
        hasEnv('SUPABASE_SERVICE_ROLE_KEY')
          ? 'healthy'
          : 'unavailable',
      metadata: {
        tables: ['team_stats', 'team_matchups', 'prediction_history'],
      },
    },
  ]
}

export function getProvidersForSport(sportKey: SportKey): SportsProvider[] {
  return getSportsProviders()
    .filter((provider) => provider.sportCoverage.includes(sportKey))
    .sort(
      (a, b) =>
        a.fallbackOrder - b.fallbackOrder || a.priority - b.priority
    )
}
