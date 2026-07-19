import type { SportKey } from '@/config/sports.config'

export type BasketballPlatformLeagueKey =
  | 'bsn_pr'
  | 'nba'
  | 'wnba'
  | 'ncaa_mbb'
  | 'euroleague'
  | 'fiba'
  | (string & {})

export type BasketballSourcePriority =
  | 'official_licensed_provider'
  | 'official_league_source'
  | 'commercial_provider'
  | 'csv_import'
  | 'manual_import'
  | 'compatible_connector'

export type BasketballCapability =
  | 'teams'
  | 'players'
  | 'schedule'
  | 'results'
  | 'standings'
  | 'game_statistics'
  | 'quarter_scores'
  | 'boxscores'
  | 'play_by_play'
  | 'officials'
  | 'attendance'
  | 'arena'
  | 'season_totals'
  | 'advanced_metrics'
  | 'odds'
  | 'availability'

export type BasketballCapabilityStatus =
  | 'supported'
  | 'partial'
  | 'not_supported'
  | 'entitlement_blocked'
  | 'not_configured'
  | 'unknown'

export type BasketballConnectorCapabilityResult = {
  capability: BasketballCapability
  status: BasketballCapabilityStatus
  sourcePriority: BasketballSourcePriority
  ttlSeconds: number | null
  requiresProviderCall: boolean
  supportsIncrementalSync: boolean
  supportsHistoricalBackfill: boolean
  warnings: string[]
}

export type BasketballPlatformScope = {
  sportKey: SportKey
  leagueKey: BasketballPlatformLeagueKey
  season: string | null
  dateFrom: string | null
  dateTo: string | null
}

export const BASKETBALL_SOURCE_PRIORITY_ORDER: BasketballSourcePriority[] = [
  'official_licensed_provider',
  'official_league_source',
  'commercial_provider',
  'csv_import',
  'manual_import',
  'compatible_connector',
]

export const BASKETBALL_CAPABILITIES: BasketballCapability[] = [
  'teams',
  'players',
  'schedule',
  'results',
  'standings',
  'game_statistics',
  'quarter_scores',
  'boxscores',
  'play_by_play',
  'officials',
  'attendance',
  'arena',
  'season_totals',
  'advanced_metrics',
  'odds',
  'availability',
]

export function notSupportedCapability(
  capability: BasketballCapability,
  sourcePriority: BasketballSourcePriority = 'compatible_connector',
  warning = 'Connector does not declare this capability.'
): BasketballConnectorCapabilityResult {
  return {
    capability,
    status: 'not_supported',
    sourcePriority,
    ttlSeconds: null,
    requiresProviderCall: false,
    supportsIncrementalSync: false,
    supportsHistoricalBackfill: false,
    warnings: [warning],
  }
}
