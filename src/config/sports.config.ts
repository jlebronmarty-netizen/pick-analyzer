export type SportKey =
  | 'all'
  | 'baseball_mlb'
  | 'basketball_nba'
  | 'americanfootball_nfl'
  | 'icehockey_nhl'
  | 'soccer'
  | 'tennis'
  | 'mma_ufc'
  | 'basketball_bsn'

export type SportCategory =
  | 'baseball'
  | 'basketball'
  | 'football'
  | 'hockey'
  | 'soccer'
  | 'tennis'
  | 'combat'
  | 'aggregate'

export type SportFormat = 'team' | 'individual'

export type SportDefinition = {
  key: SportKey
  label: string
  shortLabel: string
  icon: string
  enabled: boolean
  productionReady: boolean
  description: string
  category: SportCategory
  format: SportFormat
  seasonFormat: 'annual' | 'split' | 'tournament' | 'event_based'
  supportedMarkets: string[]
  supportedPredictionTypes: string[]
  adapterId: string
  active: boolean
  leagueKeys: string[]
  metadata: Record<string, string | number | boolean | string[]>

  /**
   * Maximum recommended historical score-backfill window.
   * This preserves compatibility with existing sync/backfill services.
   */
  scoresDaysFrom: number
}

export const SPORTS: SportDefinition[] = [
  {
    key: 'all',
    label: 'All Sports',
    shortLabel: 'All',
    icon: '◉',
    enabled: true,
    productionReady: true,
    description: 'View all sports with available prediction data.',
    category: 'aggregate',
    format: 'team',
    seasonFormat: 'annual',
    supportedMarkets: ['moneyline'],
    supportedPredictionTypes: ['aggregate_rankings'],
    adapterId: 'aggregate-adapter',
    active: true,
    leagueKeys: [],
    metadata: {
      isAggregate: true,
    },
    scoresDaysFrom: 3,
  },
  {
    key: 'baseball_mlb',
    label: 'MLB Baseball',
    shortLabel: 'MLB',
    icon: '⚾',
    enabled: true,
    productionReady: true,
    description:
      'Full prediction, learning and advanced-factor coverage.',
    category: 'baseball',
    format: 'team',
    seasonFormat: 'annual',
    supportedMarkets: [
      'moneyline',
      'spread',
      'total',
      'team_total',
      'first_half',
      'player_props',
      'game_props',
      'futures',
    ],
    supportedPredictionTypes: [
      'moneyline',
      'model_edge',
      'ev',
      'sharp_money',
      'closing_line',
    ],
    adapterId: 'odds-api-team-adapter',
    active: true,
    leagueKeys: ['mlb'],
    metadata: {
      providerSportKey: 'baseball_mlb',
      primaryProvider: 'the-odds-api',
    },
    scoresDaysFrom: 3,
  },
  {
    key: 'basketball_nba',
    label: 'NBA Basketball',
    shortLabel: 'NBA',
    icon: '🏀',
    enabled: true,
    productionReady: false,
    description:
      'Framework ready; team data and adapter synchronization pending.',
    category: 'basketball',
    format: 'team',
    seasonFormat: 'annual',
    supportedMarkets: [
      'moneyline',
      'spread',
      'total',
      'team_total',
      'first_half',
      'first_quarter',
      'player_props',
      'game_props',
      'futures',
    ],
    supportedPredictionTypes: [
      'moneyline',
      'model_edge',
      'ev',
      'adapter_readiness',
    ],
    adapterId: 'nba-adapter-wrapper',
    active: true,
    leagueKeys: ['nba'],
    metadata: {
      providerSportKey: 'basketball_nba',
      primaryProvider: 'the-odds-api',
    },
    scoresDaysFrom: 3,
  },
  {
    key: 'americanfootball_nfl',
    label: 'NFL Football',
    shortLabel: 'NFL',
    icon: '🏈',
    enabled: true,
    productionReady: false,
    description:
      'Framework ready; NFL-specific factors pending.',
    category: 'football',
    format: 'team',
    seasonFormat: 'annual',
    supportedMarkets: [
      'moneyline',
      'spread',
      'total',
      'team_total',
      'first_half',
      'first_quarter',
      'player_props',
      'game_props',
      'futures',
    ],
    supportedPredictionTypes: ['moneyline', 'model_edge', 'ev'],
    adapterId: 'odds-api-team-adapter',
    active: true,
    leagueKeys: ['nfl'],
    metadata: {
      providerSportKey: 'americanfootball_nfl',
      primaryProvider: 'the-odds-api',
    },
    scoresDaysFrom: 7,
  },
  {
    key: 'icehockey_nhl',
    label: 'NHL Hockey',
    shortLabel: 'NHL',
    icon: '🏒',
    enabled: true,
    productionReady: false,
    description:
      'Framework ready; goalie and hockey factors pending.',
    category: 'hockey',
    format: 'team',
    seasonFormat: 'annual',
    supportedMarkets: [
      'moneyline',
      'spread',
      'total',
      'team_total',
      'player_props',
      'game_props',
      'futures',
    ],
    supportedPredictionTypes: ['moneyline', 'model_edge', 'ev'],
    adapterId: 'odds-api-team-adapter',
    active: true,
    leagueKeys: ['nhl'],
    metadata: {
      providerSportKey: 'icehockey_nhl',
      primaryProvider: 'the-odds-api',
    },
    scoresDaysFrom: 3,
  },
  {
    key: 'soccer',
    label: 'Soccer',
    shortLabel: 'Soccer',
    icon: '⚽',
    enabled: true,
    productionReady: false,
    description:
      'Framework ready; league adapters and xG data pending.',
    category: 'soccer',
    format: 'team',
    seasonFormat: 'split',
    supportedMarkets: [
      'moneyline',
      'spread',
      'total',
      'team_total',
      'first_half',
      'player_props',
      'game_props',
      'futures',
      'qualification',
      'double_chance',
      'draw_no_bet',
      'both_teams_to_score',
    ],
    supportedPredictionTypes: ['moneyline', 'draw', 'model_edge', 'ev'],
    adapterId: 'odds-api-team-adapter',
    active: true,
    leagueKeys: ['soccer_generic'],
    metadata: {
      providerSportKey: 'soccer',
      primaryProvider: 'the-odds-api',
      requiresLeagueSelection: true,
    },
    scoresDaysFrom: 5,
  },
  {
    key: 'tennis',
    label: 'Tennis',
    shortLabel: 'Tennis',
    icon: '🎾',
    enabled: true,
    productionReady: false,
    description:
      'Framework ready; player-form adapter pending.',
    category: 'tennis',
    format: 'individual',
    seasonFormat: 'tournament',
    supportedMarkets: [
      'moneyline',
      'spread',
      'total',
      'player_props',
      'futures',
      'qualification',
      'round_or_set',
    ],
    supportedPredictionTypes: ['match_winner', 'set_winner', 'model_edge', 'ev'],
    adapterId: 'odds-api-individual-adapter',
    active: true,
    leagueKeys: ['atp', 'wta'],
    metadata: {
      providerSportKey: 'tennis',
      primaryProvider: 'the-odds-api',
    },
    scoresDaysFrom: 3,
  },
  {
    key: 'mma_ufc',
    label: 'UFC',
    shortLabel: 'UFC',
    icon: 'UFC',
    enabled: true,
    productionReady: false,
    description:
      'Framework ready; fighter records, camp data and method markets pending.',
    category: 'combat',
    format: 'individual',
    seasonFormat: 'event_based',
    supportedMarkets: [
      'moneyline',
      'total',
      'player_props',
      'game_props',
      'futures',
      'method_of_victory',
      'round_or_set',
    ],
    supportedPredictionTypes: [
      'fight_winner',
      'method_projection',
      'model_edge',
      'ev',
    ],
    adapterId: 'odds-api-individual-adapter',
    active: true,
    leagueKeys: ['ufc'],
    metadata: {
      providerSportKey: 'mma_mixed_martial_arts',
      primaryProvider: 'the-odds-api',
    },
    scoresDaysFrom: 3,
  },
  {
    key: 'basketball_bsn',
    label: 'BSN Puerto Rico',
    shortLabel: 'BSN',
    icon: '🏀',
    enabled: true,
    productionReady: false,
    description:
      'BSN architecture is registered; production recommendations require approved data and odds sources.',
    category: 'basketball',
    format: 'team',
    seasonFormat: 'annual',
    supportedMarkets: ['moneyline', 'spread', 'total', 'team_total'],
    supportedPredictionTypes: ['moneyline', 'v7_challenger', 'confidence_v2', 'model_edge', 'ev'],
    adapterId: 'bsn-adapter-wrapper',
    active: true,
    leagueKeys: ['bsn_pr'],
    metadata: {
      providerSportKey: 'basketball_bsn',
      primaryProvider: 'approved-bsn-source-pending',
    },
    scoresDaysFrom: 5,
  },
]

export const DEFAULT_SPORT: SportKey = 'baseball_mlb'

/**
 * Returns the requested sport, or MLB as a safe UI fallback.
 */
export function getSportDefinition(sportKey: string): SportDefinition {
  return (
    SPORTS.find((sport) => sport.key === sportKey) ??
    SPORTS.find((sport) => sport.key === DEFAULT_SPORT)!
  )
}

/**
 * Strict lookup used by API, sync and backfill services.
 * Returns null when the requested sport is unsupported.
 */
export function getSupportedSport(
  sportKey: string | null | undefined
): SportDefinition | null {
  if (!sportKey) return null

  return SPORTS.find((sport) => sport.key === sportKey) ?? null
}

/**
 * Returns sports that can participate in automated pipelines.
 * "all" is a UI aggregate and must never be synchronized as a real league.
 */
export function getEnabledSports(): SportDefinition[] {
  return SPORTS.filter(
    (sport) => sport.enabled && sport.key !== 'all'
  )
}

export function isSupportedSport(value: string): value is SportKey {
  return SPORTS.some((sport) => sport.key === value)
}

/**
 * Safely limits score backfill days.
 *
 * Compatible usages:
 * clampScoresDaysFrom(value)
 * clampScoresDaysFrom(value, sport)
 * clampScoresDaysFrom(value, fallbackNumber)
 */
export function clampScoresDaysFrom(
  value: unknown,
  sportOrFallback?: SportDefinition | SportKey | number | null
): number {
  let fallback = 3

  if (typeof sportOrFallback === 'number') {
    fallback = sportOrFallback
  } else if (typeof sportOrFallback === 'string') {
    fallback =
      getSupportedSport(sportOrFallback)?.scoresDaysFrom ?? fallback
  } else if (
    sportOrFallback &&
    typeof sportOrFallback === 'object'
  ) {
    fallback = sportOrFallback.scoresDaysFrom
  }

  const parsed = Number(value)
  const requested = Number.isFinite(parsed) ? Math.round(parsed) : fallback

  return Math.min(Math.max(requested, 1), 30)
}
