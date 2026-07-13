import { SportDefinition, SportKey } from '@/config/sports.config'

export type MultiSportStatus =
  | 'healthy'
  | 'degraded'
  | 'unavailable'

export type EventStatus =
  | 'scheduled'
  | 'live'
  | 'completed'
  | 'postponed'
  | 'cancelled'

export type ProviderFeature =
  | 'leagues'
  | 'teams'
  | 'participants'
  | 'schedule'
  | 'event'
  | 'standings'
  | 'stats'
  | 'injuries'
  | 'lineups'
  | 'odds'
  | 'results'

export type MarketKey =
  | 'moneyline'
  | 'spread'
  | 'total'
  | 'team_total'
  | 'first_half'
  | 'first_quarter'
  | 'player_props'
  | 'game_props'
  | 'futures'
  | 'qualification'
  | 'double_chance'
  | 'draw_no_bet'
  | 'both_teams_to_score'
  | 'round_or_set'
  | 'method_of_victory'

export type NormalizedSport = SportDefinition

export type NormalizedLeague = {
  key: string
  sportKey: SportKey
  displayName: string
  country?: string
  region?: string
  active: boolean
  providerIds: Record<string, string>
  metadata: Record<string, unknown>
}

export type NormalizedTeam = {
  id: string
  sportKey: SportKey
  leagueKey?: string
  displayName: string
  abbreviation?: string
  location?: string
  providerIds: Record<string, string>
  metadata: Record<string, unknown>
}

export type NormalizedParticipant = {
  id: string
  sportKey: SportKey
  leagueKey?: string
  displayName: string
  type: 'team' | 'individual'
  seed?: number
  team?: NormalizedTeam
  providerIds: Record<string, string>
  metadata: Record<string, unknown>
}

export type NormalizedVenue = {
  id?: string
  displayName?: string
  city?: string
  country?: string
  neutralSite: boolean
  metadata: Record<string, unknown>
}

export type NormalizedEvent = {
  id: string
  sportKey: SportKey
  leagueKey?: string
  displayName: string
  startTime: string
  status: EventStatus
  homeParticipant?: NormalizedParticipant
  awayParticipant?: NormalizedParticipant
  participants: NormalizedParticipant[]
  venue: NormalizedVenue
  tournamentRound?: string
  providerIds: Record<string, string>
  rawProvider?: string
  metadata: Record<string, unknown>
}

export type NormalizedOutcome = {
  id: string
  label: string
  participantId?: string
  price?: number
  point?: number
  probability?: number
  metadata: Record<string, unknown>
}

export type NormalizedMarket = {
  key: MarketKey
  displayName: string
  category: 'core' | 'period' | 'prop' | 'future' | 'soccer' | 'combat'
  supportedSportKeys: SportKey[]
  providerKeys: Record<string, string[]>
  metadata: Record<string, unknown>
}

export type NormalizedOddsSnapshot = {
  id: string
  eventId: string
  sportKey: SportKey
  provider: string
  sportsbook: string
  marketKey: MarketKey
  lastUpdated: string
  outcomes: NormalizedOutcome[]
  metadata: Record<string, unknown>
}

export type NormalizedInjury = {
  id: string
  sportKey: SportKey
  participantId?: string
  playerId?: string
  status: string
  impactScore?: number
  description?: string
  updatedAt?: string
  providerIds: Record<string, string>
  metadata: Record<string, unknown>
}

export type NormalizedLineup = {
  id: string
  sportKey: SportKey
  eventId: string
  participantId: string
  confirmed: boolean
  playerIds: string[]
  updatedAt?: string
  metadata: Record<string, unknown>
}

export type NormalizedPlayer = {
  id: string
  sportKey: SportKey
  displayName: string
  participantId?: string
  position?: string
  providerIds: Record<string, string>
  metadata: Record<string, unknown>
}

export type NormalizedPrediction = {
  id: string
  sportKey: SportKey
  eventId: string
  marketKey: MarketKey
  outcomeId?: string
  label: string
  confidence: number
  edge?: number
  expectedValue?: number
  modelVersion?: string
  metadata: Record<string, unknown>
}

export type NormalizedModelOutput = {
  id: string
  sportKey: SportKey
  generatedAt: string
  predictions: NormalizedPrediction[]
  warnings: string[]
  metadata: Record<string, unknown>
}

export type SportsProvider = {
  id: string
  name: string
  sportCoverage: SportKey[]
  requiresAuth: boolean
  rateLimit: {
    requests: number
    interval: 'minute' | 'hour' | 'day'
  }
  features: ProviderFeature[]
  priority: number
  fallbackOrder: number
  health: MultiSportStatus
  lastSuccessfulRequest?: string
  lastError?: string
  responseLatencyMs?: number
  metadata: Record<string, unknown>
}

export type AdapterResult<T> = {
  success: boolean
  source: string
  data: T
  latencyMs: number
  warnings: string[]
  error?: string
}

export type AdapterHealth = {
  adapterId: string
  sportKey: SportKey
  status: MultiSportStatus
  latencyMs: number
  lastSuccess?: string
  lastFailure?: string
  errorMessage?: string
  coverage: ProviderFeature[]
}

export type MultiSportQuery = {
  sportKey: SportKey
  leagueKey?: string
  providerId?: string
  search?: string
  status?: EventStatus
  dateFrom?: string
  dateTo?: string
  limit: number
  page: number
}
