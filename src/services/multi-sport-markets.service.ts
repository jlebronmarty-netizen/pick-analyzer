import { SportKey } from '@/config/sports.config'
import { MarketKey, NormalizedMarket } from '@/types/multi-sport'

export const MULTI_SPORT_MARKETS: NormalizedMarket[] = [
  {
    key: 'moneyline',
    displayName: 'Moneyline',
    category: 'core',
    supportedSportKeys: [
      'baseball_mlb',
      'basketball_bsn',
      'basketball_nba',
      'americanfootball_nfl',
      'icehockey_nhl',
      'soccer',
      'tennis',
      'mma_ufc',
    ],
    providerKeys: { 'the-odds-api': ['h2h'] },
    metadata: {},
  },
  {
    key: 'spread',
    displayName: 'Spread',
    category: 'core',
    supportedSportKeys: [
      'baseball_mlb',
      'basketball_bsn',
      'basketball_nba',
      'americanfootball_nfl',
      'icehockey_nhl',
      'soccer',
      'tennis',
    ],
    providerKeys: { 'the-odds-api': ['spreads'] },
    metadata: {},
  },
  {
    key: 'total',
    displayName: 'Total',
    category: 'core',
    supportedSportKeys: [
      'baseball_mlb',
      'basketball_bsn',
      'basketball_nba',
      'americanfootball_nfl',
      'icehockey_nhl',
      'soccer',
      'tennis',
      'mma_ufc',
    ],
    providerKeys: { 'the-odds-api': ['totals'] },
    metadata: {},
  },
  {
    key: 'team_total',
    displayName: 'Team Total',
    category: 'core',
    supportedSportKeys: [
      'baseball_mlb',
      'basketball_bsn',
      'basketball_nba',
      'americanfootball_nfl',
      'icehockey_nhl',
      'soccer',
    ],
    providerKeys: { 'the-odds-api': ['team_totals'] },
    metadata: {},
  },
  {
    key: 'first_half',
    displayName: 'First Half',
    category: 'period',
    supportedSportKeys: [
      'baseball_mlb',
      'basketball_nba',
      'americanfootball_nfl',
      'soccer',
    ],
    providerKeys: { 'the-odds-api': ['h2h_h1', 'spreads_h1', 'totals_h1'] },
    metadata: {},
  },
  {
    key: 'first_quarter',
    displayName: 'First Quarter',
    category: 'period',
    supportedSportKeys: ['basketball_nba', 'americanfootball_nfl'],
    providerKeys: { 'the-odds-api': ['h2h_q1', 'spreads_q1', 'totals_q1'] },
    metadata: {},
  },
  {
    key: 'player_props',
    displayName: 'Player Props',
    category: 'prop',
    supportedSportKeys: [
      'baseball_mlb',
      'basketball_nba',
      'americanfootball_nfl',
      'icehockey_nhl',
      'tennis',
      'mma_ufc',
    ],
    providerKeys: { 'the-odds-api': ['player_props'] },
    metadata: {},
  },
  {
    key: 'game_props',
    displayName: 'Game Props',
    category: 'prop',
    supportedSportKeys: [
      'baseball_mlb',
      'basketball_nba',
      'americanfootball_nfl',
      'icehockey_nhl',
      'soccer',
      'mma_ufc',
    ],
    providerKeys: { 'the-odds-api': ['game_props'] },
    metadata: {},
  },
  {
    key: 'futures',
    displayName: 'Futures',
    category: 'future',
    supportedSportKeys: [
      'baseball_mlb',
      'basketball_nba',
      'americanfootball_nfl',
      'icehockey_nhl',
      'soccer',
      'tennis',
      'mma_ufc',
    ],
    providerKeys: { 'the-odds-api': ['outrights'] },
    metadata: {},
  },
  {
    key: 'qualification',
    displayName: 'Qualification',
    category: 'soccer',
    supportedSportKeys: ['soccer', 'tennis'],
    providerKeys: { 'the-odds-api': ['qualification'] },
    metadata: {},
  },
  {
    key: 'double_chance',
    displayName: 'Double Chance',
    category: 'soccer',
    supportedSportKeys: ['soccer'],
    providerKeys: { 'the-odds-api': ['double_chance'] },
    metadata: {},
  },
  {
    key: 'draw_no_bet',
    displayName: 'Draw No Bet',
    category: 'soccer',
    supportedSportKeys: ['soccer'],
    providerKeys: { 'the-odds-api': ['draw_no_bet'] },
    metadata: {},
  },
  {
    key: 'both_teams_to_score',
    displayName: 'Both Teams To Score',
    category: 'soccer',
    supportedSportKeys: ['soccer'],
    providerKeys: { 'the-odds-api': ['btts'] },
    metadata: {},
  },
  {
    key: 'round_or_set',
    displayName: 'Round Or Set Markets',
    category: 'combat',
    supportedSportKeys: ['tennis', 'mma_ufc'],
    providerKeys: { 'the-odds-api': ['set_betting', 'round_betting'] },
    metadata: {},
  },
  {
    key: 'method_of_victory',
    displayName: 'Method Of Victory',
    category: 'combat',
    supportedSportKeys: ['mma_ufc'],
    providerKeys: { 'the-odds-api': ['method_of_victory'] },
    metadata: {},
  },
]

export function getMarketsForSport(sportKey: SportKey): NormalizedMarket[] {
  return MULTI_SPORT_MARKETS.filter((market) =>
    market.supportedSportKeys.includes(sportKey)
  )
}

export function isMarketSupported(
  sportKey: SportKey,
  marketKey: string
): marketKey is MarketKey {
  return getMarketsForSport(sportKey).some(
    (market) => market.key === marketKey
  )
}
