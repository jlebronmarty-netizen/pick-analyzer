export type SportsDataIoCatalogSport = 'nba' | 'mlb' | 'nfl' | 'nhl' | 'soccer'
export type SportsDataIoCatalogDomain =
  | 'teams'
  | 'players'
  | 'schedules'
  | 'results'
  | 'stats'
  | 'injuries'
  | 'lineups'
  | 'odds'
  | 'props'
  | 'settlement'
  | 'competition'
  | 'metadata'

export type SportsDataIoEndpointCatalogEntry = {
  id: string
  sport: SportsDataIoCatalogSport
  apiVersion: 'v3' | 'v4'
  domain: SportsDataIoCatalogDomain
  method: 'GET'
  pathTemplate: string
  parameterFormat: string
  returnType: string
  expectedCallInterval: string
  productionPurpose: string
  historicalPurpose: string
  trialStatus: 'validated_trial' | 'pending_trial' | 'blocked'
  entitlementStatus: 'confirmed_trial' | 'requires_confirmation'
  implementedStatus: 'implemented' | 'planned' | 'blocked'
  normalizedStatus: 'normalized' | 'fixture_only' | 'pending_payload'
  persistenceStatus: 'persisted' | 'existing_table_ready' | 'pending_table' | 'discovery_only'
  lastPilotStatus: string
}

const entry = (
  sport: SportsDataIoCatalogSport,
  apiVersion: 'v3' | 'v4',
  domain: SportsDataIoCatalogDomain,
  pathTemplate: string,
  overrides: Partial<SportsDataIoEndpointCatalogEntry> = {}
): SportsDataIoEndpointCatalogEntry => ({
  id: `${sport}:${domain}:${pathTemplate}`,
  sport,
  apiVersion,
  domain,
  method: 'GET',
  pathTemplate,
  parameterFormat: pathTemplate.includes('{')
    ? 'path parameters use the exact provider token shown in braces'
    : 'no path parameter',
  returnType: 'provider JSON payload normalized before product use',
  expectedCallInterval: 'capped pilot only until production sync approval',
  productionPurpose: 'blocked until entitlement, normalization and production eligibility are approved',
  historicalPurpose: 'trial import path validation only unless explicitly approved',
  trialStatus: 'pending_trial',
  entitlementStatus: 'requires_confirmation',
  implementedStatus: 'planned',
  normalizedStatus: 'pending_payload',
  persistenceStatus: 'pending_table',
  lastPilotStatus: 'not_run',
  ...overrides,
})

const nbaCommon = {
  trialStatus: 'validated_trial' as const,
  entitlementStatus: 'confirmed_trial' as const,
}

export const SPORTSDATAIO_ENDPOINT_CATALOG: SportsDataIoEndpointCatalogEntry[] = [
  entry('nba', 'v3', 'teams', '/v3/nba/scores/json/Teams', {
    ...nbaCommon,
    implementedStatus: 'implemented',
    normalizedStatus: 'normalized',
    persistenceStatus: 'persisted',
    lastPilotStatus: 'completed_2025_DEC_25',
  }),
  entry('nba', 'v3', 'players', '/v3/nba/scores/json/Players', {
    ...nbaCommon,
    implementedStatus: 'implemented',
    normalizedStatus: 'normalized',
    persistenceStatus: 'persisted',
    lastPilotStatus: 'completed_579_players',
  }),
  entry('nba', 'v3', 'injuries', '/v3/nba/projections/json/InjuredPlayers', {
    ...nbaCommon,
    implementedStatus: 'implemented',
    normalizedStatus: 'normalized',
    persistenceStatus: 'persisted',
    lastPilotStatus: 'completed_6_injuries',
  }),
  entry('nba', 'v3', 'lineups', '/v3/nba/scores/json/DepthCharts', {
    ...nbaCommon,
    implementedStatus: 'implemented',
    normalizedStatus: 'normalized',
    persistenceStatus: 'persisted',
    lastPilotStatus: 'completed_440_depth_rows',
  }),
  entry('nba', 'v3', 'lineups', '/v3/nba/projections/json/StartingLineupsByDate/{date}', {
    ...nbaCommon,
    implementedStatus: 'implemented',
    normalizedStatus: 'normalized',
    persistenceStatus: 'persisted',
    lastPilotStatus: 'completed_318_lineup_rows_for_2025_DEC_26',
  }),
  entry('nba', 'v3', 'stats', '/v3/nba/stats/json/PlayerSeasonStats/{season}', {
    ...nbaCommon,
    implementedStatus: 'implemented',
    normalizedStatus: 'normalized',
    persistenceStatus: 'persisted',
    lastPilotStatus: 'completed_602_season_rows',
  }),
  entry('nba', 'v3', 'stats', '/v3/nba/stats/json/PlayerGameStatsByDate/{date}', {
    ...nbaCommon,
    implementedStatus: 'implemented',
    normalizedStatus: 'normalized',
    persistenceStatus: 'persisted',
    lastPilotStatus: 'completed_316_game_rows_for_2025_12_26',
  }),
  entry('nba', 'v3', 'odds', '/v3/nba/odds/json/BettingEventsByDate/{date}', {
    ...nbaCommon,
    implementedStatus: 'implemented',
    normalizedStatus: 'fixture_only',
    persistenceStatus: 'discovery_only',
    lastPilotStatus: 'completed_discovery_only_9_records_for_2025_12_26',
  }),
  entry('nba', 'v3', 'odds', '/v3/nba/odds/json/BettingMarkets/{eventId}', {
    ...nbaCommon,
    implementedStatus: 'implemented',
    normalizedStatus: 'pending_payload',
    persistenceStatus: 'existing_table_ready',
    lastPilotStatus: 'completed_0_records_for_event_22888',
  }),
  entry('nba', 'v3', 'odds', '/v3/nba/odds/json/BettingMarketsByGameID/{gameID}', {
    implementedStatus: 'planned',
    normalizedStatus: 'pending_payload',
    persistenceStatus: 'existing_table_ready',
    lastPilotStatus: 'not_called',
  }),
  entry('nba', 'v3', 'odds', '/v3/nba/odds/json/BettingMarketsByMarketType/{eventId}/{marketTypeID}', {
    implementedStatus: 'planned',
    normalizedStatus: 'pending_payload',
    persistenceStatus: 'existing_table_ready',
    lastPilotStatus: 'not_called',
  }),
  entry('nba', 'v3', 'odds', '/v3/nba/odds/json/BettingMarket/{marketId}', {
    implementedStatus: 'planned',
    normalizedStatus: 'pending_payload',
    persistenceStatus: 'existing_table_ready',
    lastPilotStatus: 'not_called',
  }),
  entry('nba', 'v3', 'settlement', '/v3/nba/odds/json/BettingMarketResults/{marketId}', {
    implementedStatus: 'blocked',
    normalizedStatus: 'pending_payload',
    persistenceStatus: 'pending_table',
    lastPilotStatus: 'not_called_settlement_rules_not_approved',
  }),
  entry('nba', 'v3', 'odds', '/v3/nba/odds/json/GameOddsByDate/{date}', {
    implementedStatus: 'implemented',
    normalizedStatus: 'pending_payload',
    persistenceStatus: 'existing_table_ready',
    lastPilotStatus: 'http_200_priced_payload_partial_trial_persistence_2025_12_26',
  }),
  entry('nba', 'v3', 'odds', '/v3/nba/odds/json/AlternateMarketGameOddsByDate/{date}', {
    trialStatus: 'blocked',
    implementedStatus: 'blocked',
    normalizedStatus: 'pending_payload',
    persistenceStatus: 'existing_table_ready',
    lastPilotStatus: 'not_called_after_betting_events_discovery_classification',
  }),
  entry('nba', 'v3', 'odds', '/v3/nba/odds/json/GameOddsLineMovement/{gameid}', {
    implementedStatus: 'blocked',
    normalizedStatus: 'pending_payload',
    persistenceStatus: 'existing_table_ready',
    lastPilotStatus: 'not_called_line_movement_requires_multiple_snapshots',
  }),
  entry('nba', 'v3', 'odds', '/v3/nba/odds/json/LiveGameOddsByDate/{date}', {
    implementedStatus: 'blocked',
    normalizedStatus: 'pending_payload',
    persistenceStatus: 'existing_table_ready',
    lastPilotStatus: 'not_called_live_odds_not_approved',
  }),
  entry('nba', 'v3', 'props', '/v3/nba/odds/json/BettingPlayerPropsByGameID/{gameId}', {
    implementedStatus: 'blocked',
    normalizedStatus: 'fixture_only',
    persistenceStatus: 'existing_table_ready',
    lastPilotStatus: 'blocked_pending_market_entitlement_and_settlement_confirmation',
  }),
  entry('nba', 'v3', 'metadata', '/v3/nba/odds/json/BettingMetadata', {
    implementedStatus: 'planned',
    normalizedStatus: 'fixture_only',
    persistenceStatus: 'discovery_only',
    lastPilotStatus: 'not_called_metadata_contract_only',
  }),
  entry('nba', 'v3', 'metadata', '/v3/nba/odds/json/ActiveSportsbooks', {
    implementedStatus: 'planned',
    normalizedStatus: 'fixture_only',
    persistenceStatus: 'discovery_only',
    lastPilotStatus: 'not_called_metadata_contract_only',
  }),

  ...[
    '/v3/mlb/scores/json/teams',
    '/v3/mlb/scores/json/Players',
    '/v3/mlb/scores/json/FreeAgents',
  ].map((path) => entry('mlb', 'v3', path.includes('Players') || path.includes('FreeAgents') ? 'players' : 'teams', path)),
  ...[
    '/v3/mlb/scores/json/Games/{season}',
    '/v3/mlb/scores/json/GamesByDate/{date}',
    '/v3/mlb/scores/json/GamesByDateFinal/{date}',
  ].map((path) => entry('mlb', 'v3', 'schedules', path)),
  ...[
    '/v3/mlb/scores/json/TeamSeasonStats/{season}',
    '/v3/mlb/scores/json/TeamGameStatsByDate/{date}',
    '/v3/mlb/stats/json/PlayerSeasonStats/{season}',
    '/v3/mlb/stats/json/PlayerGameStatsByDate/{date}',
    '/v3/mlb/stats/json/HitterVsPitcher/{hitterid}/{pitcherid}',
    '/v3/mlb/stats/json/TeamHittersVsPitcher/{gameid}/{team}',
  ].map((path) => entry('mlb', 'v3', 'stats', path)),
  ...[
    '/v3/mlb/projections/json/InjuredPlayers',
    '/v3/mlb/projections/json/DepthCharts',
    '/v3/mlb/projections/json/StartingLineupsByDate/{date}',
  ].map((path) => entry('mlb', 'v3', path.includes('Injured') ? 'injuries' : 'lineups', path)),
  ...[
    '/v3/mlb/odds/json/GameOddsByDate/{date}',
    '/v3/mlb/odds/json/AlternateMarketGameOddsByDate/{date}',
    '/v3/mlb/odds/json/GameOddsLineMovement/{gameid}',
    '/v3/mlb/odds/json/BettingEventsByDate/{date}',
    '/v3/mlb/odds/json/BettingMarkets/{eventId}',
    '/v3/mlb/odds/json/BettingPlayerPropsByGameID/{gameId}',
    '/v3/mlb/odds/json/BettingMarketResults/{marketId}',
  ].map((path) => entry('mlb', 'v3', path.includes('Props') ? 'props' : path.includes('Results') ? 'settlement' : 'odds', path)),

  ...[
    '/v3/nfl/scores/json/Teams',
    '/v3/nfl/scores/json/Players',
    '/v3/nfl/scores/json/FreeAgents',
    '/v3/nfl/scores/json/DepthCharts',
    '/v3/nfl/scores/json/DepthChartsAll',
    '/v3/nfl/scores/json/Schedules/{season}',
    '/v3/nfl/scores/json/ScoresByDate/{date}',
    '/v3/nfl/scores/json/ScoresByWeek/{season}/{week}',
    '/v3/nfl/scores/json/ScoresByWeekFinal/{season}/{week}',
    '/v3/nfl/scores/json/TeamSeasonStats/{season}',
    '/v3/nfl/scores/json/TeamGameStats/{season}/{week}',
    '/v3/nfl/stats/json/PlayerSeasonStats/{season}',
    '/v3/nfl/stats/json/PlayerGameStatsByWeek/{season}/{week}',
    '/v3/nfl/stats/json/PlayerGameRedZoneStats/{season}/{week}',
    '/v3/nfl/stats/json/PlayerSeasonThirdDownStats/{season}',
    '/v3/nfl/stats/json/Injuries/{season}/{week}',
    '/v3/nfl/projections/json/InjuredPlayers',
    '/v3/nfl/odds/json/GameOddsByWeek/{season}/{week}',
    '/v3/nfl/odds/json/AlternateMarketGameOddsByWeek/{season}/{week}',
    '/v3/nfl/odds/json/GameOddsLineMovement/{scoreid}',
    '/v3/nfl/odds/json/BettingEventsByDate/{date}',
    '/v3/nfl/odds/json/BettingMarkets/{eventId}',
    '/v3/nfl/odds/json/BettingPlayerPropsByScoreID/{scoreid}',
    '/v3/nfl/odds/json/BettingMarketResults/{marketId}',
  ].map((path) => entry('nfl', 'v3', sportsDataIoDomainFromPath(path), path)),

  ...[
    '/v3/nhl/scores/json/teams',
    '/v3/nhl/scores/json/Players',
    '/v3/nhl/scores/json/FreeAgents',
    '/v3/nhl/scores/json/Games/{season}',
    '/v3/nhl/scores/json/GamesByDate/{date}',
    '/v3/nhl/scores/json/GamesByDateFinal/{date}',
    '/v3/nhl/scores/json/TeamSeasonStats/{season}',
    '/v3/nhl/scores/json/TeamGameStatsByDate/{date}',
    '/v3/nhl/stats/json/PlayerSeasonStats/{season}',
    '/v3/nhl/stats/json/PlayerGameStatsByDate/{date}',
    '/v3/nhl/projections/json/InjuredPlayers',
    '/v3/nhl/scores/json/GoalieDepthCharts',
    '/v3/nhl/stats/json/LinesBySeason/{season}',
    '/v3/nhl/projections/json/StartingGoaltendersByDate/{date}',
    '/v3/nhl/odds/json/GameOddsByDate/{date}',
    '/v3/nhl/odds/json/AlternateMarketGameOddsByDate/{date}',
    '/v3/nhl/odds/json/GameOddsLineMovement/{gameid}',
    '/v3/nhl/odds/json/BettingEventsByDate/{date}',
    '/v3/nhl/odds/json/BettingMarkets/{eventId}',
    '/v3/nhl/odds/json/BettingPlayerPropsByGameID/{gameId}',
    '/v3/nhl/odds/json/BettingMarketResults/{marketId}',
  ].map((path) => entry('nhl', 'v3', sportsDataIoDomainFromPath(path), path)),

  ...[
    '/v4/soccer/scores/json/Areas',
    '/v4/soccer/scores/json/Competitions',
    '/v4/soccer/scores/json/Standings/{competition}/{season}',
    '/v4/soccer/scores/json/Teams/{competition}',
    '/v4/soccer/scores/json/SeasonTeams/{competition}/{seasonid}',
    '/v4/soccer/scores/json/Schedule/{competition}/{season}',
    '/v4/soccer/scores/json/GamesByDate/{competition}/{date}',
    '/v4/soccer/scores/json/GamesByDateFinal/{competition}/{date}',
    '/v4/soccer/scores/json/TeamSeasonStats/{competition}/{season}',
    '/v4/soccer/scores/json/TeamGameStatsByDate/{competition}/{date}',
    '/v4/soccer/stats/json/PlayerSeasonStats/{competition}/{season}',
    '/v4/soccer/stats/json/PlayerGameStatsByDate/{competition}/{date}',
    '/v4/soccer/scores/json/ActiveMemberships/{competition}',
    '/v4/soccer/scores/json/PlayersByTeam/{competition}/{teamid}',
    '/v4/soccer/projections/json/InjuredPlayers/{competition}',
    '/v4/soccer/stats/json/LineupsByDate/{competition}/{date}',
    '/v4/soccer/odds/json/GameOddsByDate/{competition}/{date}',
    '/v4/soccer/odds/json/AlternateMarketGameOddsByDate/{competition}/{date}',
    '/v4/soccer/odds/json/GameOddsLineMovement/{competition}/{gameid}',
    '/v4/soccer/odds/json/BettingEventsByDate/{competition}/{date}',
    '/v4/soccer/odds/json/BettingMarkets/{competition}/{eventId}',
    '/v4/soccer/odds/json/BettingPlayerPropsByGameID/{competition}/{gameId}',
    '/v4/soccer/odds/json/BettingMarket/{competition}/{marketId}',
  ].map((path) => entry('soccer', 'v4', sportsDataIoDomainFromPath(path), path, path.includes('{competition}')
    ? {
        parameterFormat:
          'competition-scoped path parameters are required; do not query soccer as one global league',
      }
    : {})),
]

function sportsDataIoDomainFromPath(path: string): SportsDataIoCatalogDomain {
  if (path.includes('BettingMetadata') || path.includes('ActiveSportsbooks')) return 'metadata'
  if (path.includes('Props')) return 'props'
  if (path.includes('Results')) return 'settlement'
  if (path.includes('Odds') || path.includes('BettingEvents') || path.includes('BettingMarkets')) return 'odds'
  if (path.includes('Injur')) return 'injuries'
  if (path.includes('Lineups') || path.includes('Depth') || path.includes('Goaltenders') || path.includes('LinesBySeason')) return 'lineups'
  if (path.includes('Stats') || path.includes('Hitter')) return 'stats'
  if (path.includes('Player') || path.includes('Memberships') || path.includes('FreeAgents')) return 'players'
  if (path.includes('Team') || path.includes('Competitions') || path.includes('Areas') || path.includes('Standings')) return 'teams'
  return 'schedules'
}

export function sportsDataIoCatalogForSport(sport: SportsDataIoCatalogSport) {
  return SPORTSDATAIO_ENDPOINT_CATALOG.filter((endpoint) => endpoint.sport === sport)
}
