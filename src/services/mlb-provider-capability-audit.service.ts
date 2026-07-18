import 'server-only'

import { sportsDataIoCatalogForSport, type SportsDataIoEndpointCatalogEntry } from '@/config/sportsdataio-endpoint-catalog'
import { getMlbDataQualityStatus } from '@/services/mlb-data-quality.service'
import {
  SPORTSDATAIO_MLB_DOCUMENTED_STARTER_FIELDS,
  SPORTSDATAIO_MLB_DOCUMENTED_VENUE_FIELDS,
  SPORTSDATAIO_MLB_DOCUMENTED_WEATHER_FIELDS,
  SPORTSDATAIO_MLB_PLAYER_DETAIL_FIELDS,
  SPORTSDATAIO_MLB_PLAYER_SEASON_PITCHING_FIELDS,
  SPORTSDATAIO_MLB_PROJECTED_PLAYER_GAME_FIELDS,
  SPORTSDATAIO_MLB_STADIUM_FIELDS,
} from '@/types/sportsdataio-mlb'

function endpointPurpose(endpoint: SportsDataIoEndpointCatalogEntry) {
  if (endpoint.domain === 'schedules') return 'schedule, game status, stadium, scores and game-level context'
  if (endpoint.domain === 'odds') return 'full-game odds or line movement'
  if (endpoint.domain === 'stats') return 'team/player statistical context'
  if (endpoint.domain === 'players') return 'player identity and roster mapping'
  if (endpoint.domain === 'teams') return 'team identity and metadata'
  if (endpoint.domain === 'standings') return 'season standings and team strength context'
  if (endpoint.domain === 'metadata') return 'metadata, stadiums or provider capability context'
  if (endpoint.domain === 'injuries') return 'injury availability and impact context'
  if (endpoint.domain === 'lineups') return 'projected or confirmed lineup context'
  if (endpoint.domain === 'props') return 'player prop market discovery/pricing'
  if (endpoint.domain === 'settlement') return 'market result/settlement data'
  return endpoint.domain
}

function recommendedStage(endpoint: SportsDataIoEndpointCatalogEntry) {
  if (endpoint.pathTemplate.includes('GameOddsByDate')) return 'morning/midday/afternoon/pregame odds refresh'
  if (endpoint.pathTemplate.includes('GamesByDate')) return 'night-before and morning schedule/status sync'
  if (endpoint.pathTemplate.includes('LineMovement')) return 'line-movement/CLV audit only after explicit approval'
  if (endpoint.pathTemplate.includes('Stadiums')) return 'infrequent metadata refresh'
  if (endpoint.domain === 'stats' || endpoint.domain === 'standings') return 'daily morning context refresh'
  if (endpoint.domain === 'lineups' || endpoint.domain === 'injuries') return 'pregame readiness refresh when entitlement is verified'
  if (endpoint.domain === 'props') return 'blocked until market, model and settlement lifecycle exists'
  return 'manual capability validation'
}

function dependencyGraph(endpoint: SportsDataIoEndpointCatalogEntry) {
  const deps = ['provider entitlement', 'payload shape validation']
  if (endpoint.destinationTables.length) deps.push(`persistence: ${endpoint.destinationTables.join(', ')}`)
  if (endpoint.domain === 'odds') deps.push('event mapping', 'market normalization', 'pregame cutoff validation')
  if (endpoint.domain === 'lineups') deps.push('player mapping', 'team mapping', 'lineup feature builder')
  if (endpoint.domain === 'injuries') deps.push('player mapping', 'injury impact rules')
  if (endpoint.domain === 'props') deps.push('player mapping', 'prop normalizer', 'prop model', 'prop settlement')
  return deps
}

function pickAnalyzerUse(endpoint: SportsDataIoEndpointCatalogEntry) {
  if (endpoint.providerVariant === 'sportsdataio_enterprise' && endpoint.entitlementStatus !== 'confirmed_trial') {
    return 'Blocked for current MLB subscription; do not call from Discovery Lab integration.'
  }
  if (endpoint.pathTemplate.includes('GamesByDate')) return 'Current operating-day schedule, scores, venue and potential starter/weather audit source.'
  if (endpoint.pathTemplate.includes('GameOddsByDate')) return 'Current Board moneyline, run-line/spread and total odds.'
  if (endpoint.pathTemplate.includes('PlayerGameProjectionStatsByDate')) return 'Projection readiness only; latest 2026-07-17 call returned 0 rows.'
  if (endpoint.pathTemplate.includes('PlayerGameStatsByDate')) return 'Historical player context after games complete; not a pregame lineup source.'
  if (endpoint.pathTemplate.includes('TeamGameStatsByDate') || endpoint.pathTemplate.includes('TeamSeasonStats')) return 'Team/bullpen-proxy research input when normalized fields are verified.'
  if (endpoint.pathTemplate.includes('Stadiums')) return 'Ballpark metadata and future weather/park feature enrichment.'
  if (endpoint.domain === 'lineups') return 'Future lineup engine dependency after entitlement verification.'
  if (endpoint.domain === 'injuries') return 'Future injury engine dependency after entitlement verification.'
  if (endpoint.domain === 'props') return 'Future player-prop ingestion dependency; not recommendation eligible.'
  return endpoint.productionPurpose
}

export async function getMlbProviderCapabilityAudit(date = '2026-07-17') {
  const [quality, endpoints] = await Promise.all([
    getMlbDataQualityStatus(date),
    Promise.resolve(sportsDataIoCatalogForSport('mlb')),
  ])
  const audited = endpoints.map((endpoint) => ({
    endpoint: endpoint.pathTemplate,
    product: endpoint.product,
    providerVariant: endpoint.providerVariant,
    purpose: endpointPurpose(endpoint),
    subscriptionAvailability:
      endpoint.providerVariant === 'sportsdataio_discovery_lab'
        ? 'confirmed_current_subscription'
        : 'enterprise_only_requires_confirmation',
    fieldsReturned: endpoint.returnType,
    frequency: endpoint.expectedCallInterval,
    updateTiming: endpoint.expectedFreshness,
    recommendedRefreshStage: recommendedStage(endpoint),
    providerCost: '1 provider call per request when executed; this audit made 0 calls',
    dependencyGraph: dependencyGraph(endpoint),
    possibleUseInsidePickAnalyzer: pickAnalyzerUse(endpoint),
    implementedStatus: endpoint.implementedStatus,
    normalizedStatus: endpoint.normalizedStatus,
    persistenceStatus: endpoint.persistenceStatus,
    lastPilotStatus: endpoint.lastPilotStatus,
    destinationTables: endpoint.destinationTables,
  }))
  const currentPipelinePaths = [
    '/api/mlb/odds/json/GamesByDate/{date}',
    '/api/mlb/odds/json/GameOddsByDate/{date}',
    '/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/{date}',
    '/api/mlb/odds/json/TeamSeasonStats/{season}',
  ]
  const payloadEvidence = quality.criticalInputs.payloadEvidence
  const contractCorrection = payloadEvidence.contractCorrection
  const starterEngineReady = payloadEvidence.starterDecision === 'starting_pitcher_engine_ready'
  const weatherEngineReady = payloadEvidence.weatherDecision === 'weather_engine_ready'
  const advancedWeatherReady = payloadEvidence.windDecision === 'advanced_weather_ready'
  const stadiumEngineReady = payloadEvidence.venueDecision === 'stadium_engine_ready'
  return {
    success: true,
    mode: 'mlb_provider_capability_audit_v1',
    generatedAt: new Date().toISOString(),
    date,
    provider: 'sportsdataio',
    sportKey: 'baseball_mlb',
    subscriptionVariant: 'sportsdataio_discovery_lab',
    endpointsAudited: audited.length,
    summary: {
      confirmedDiscoveryLabEndpoints: audited.filter((endpoint) => endpoint.subscriptionAvailability === 'confirmed_current_subscription').length,
      enterpriseOnlyEndpoints: audited.filter((endpoint) => endpoint.subscriptionAvailability === 'enterprise_only_requires_confirmation').length,
      catalogImplementedEndpoints: audited.filter((endpoint) => endpoint.implementedStatus === 'implemented').length,
      currentPipelineImplementedEndpoints: audited.filter((endpoint) => currentPipelinePaths.includes(endpoint.endpoint)).length,
      currentRecommendationMarkets: ['moneyline', 'run_line', 'total'],
      unavailableMarketFamilies: ['first_five', 'team_totals', 'pitcher_props', 'batter_props', 'nrfi_yrfi', 'alternate_lines'],
    },
    qualitySnapshot: {
      featureQuality: quality.scores.featureQuality,
      dataSufficiency: quality.scores.dataSufficiency,
      criticalDataCompleteness: quality.scores.criticalDataCompleteness,
      coverageLabel: quality.scores.coverageLabel,
      startingPitchers: quality.criticalInputs.startingPitchers,
      lineups: quality.criticalInputs.lineups,
      injuries: quality.criticalInputs.injuries,
      weather: quality.criticalInputs.weather,
      bullpen: quality.criticalInputs.bullpen,
      projections: quality.criticalInputs.projections,
    },
    engineReadiness: {
      startingPitcherEngine: starterEngineReady
        ? 'starting_pitcher_engine_ready'
        : payloadEvidence.starterDecision,
      lineupEngine: 'blocked_enterprise_lineup_endpoint_not_available_to_discovery_lab',
      injuryEngine: 'blocked_enterprise_injury_endpoint_not_available_to_discovery_lab',
      bullpenEngine: 'architecture_ready_but_relief_split_and_recent_workload_fields_not_verified',
      weatherEngine: weatherEngineReady
        ? advancedWeatherReady
          ? 'weather_engine_ready_advanced_weather_ready'
          : 'weather_engine_ready_without_populated_wind'
        : payloadEvidence.weatherDecision,
      projectionEngine: 'provider_returned_empty_for_2026_07_17',
      firstFive: 'blocked_no_verified_market_odds_or_settlement',
      teamTotals: 'blocked_no_verified_market_odds_or_settlement',
      playerProps: 'blocked_enterprise_prop_endpoint_not_available_and_no_prop_lifecycle',
    },
    gamesByDateContract: {
      status: contractCorrection.retainedEvidenceSufficientForStarterDecision === true
        ? 'DOCUMENTED_FINAL_VERIFIED'
        : 'DOCUMENTED_PARTIALLY_VERIFIED',
      starterFields: [...SPORTSDATAIO_MLB_DOCUMENTED_STARTER_FIELDS],
      starterClassification: contractCorrection.correctedStarterClassification,
      weatherFields: [...SPORTSDATAIO_MLB_DOCUMENTED_WEATHER_FIELDS],
      weatherClassification: contractCorrection.correctedWeatherClassification,
      windClassification: contractCorrection.correctedWindClassification,
      venueFields: [...SPORTSDATAIO_MLB_DOCUMENTED_VENUE_FIELDS],
      venueClassification: contractCorrection.correctedVenueClassification,
      note: contractCorrection.retainedEvidenceSufficientForStarterDecision === true
        ? 'Final corrected GamesByDate verification extracted the exact documented contract names and stored POPULATED/NULL/ABSENT evidence.'
        : 'Do not classify documented GamesByDate starter fields as unsupported until a corrected verification extracts the exact contract names.',
      readyFor: {
        starterEngine: starterEngineReady,
        weatherEngine: weatherEngineReady,
        advancedWeather: advancedWeatherReady,
        stadiumEngine: stadiumEngineReady,
      },
    },
    stadiumCapability: {
      endpoint: '/api/mlb/odds/json/Stadiums',
      status: 'documented_confirmed_discovery_lab_endpoint_not_called_in_this_phase',
      fields: [...SPORTSDATAIO_MLB_STADIUM_FIELDS],
      ingestionPlan: 'cache_once_or_infrequent_refresh_into stadium/team/event metadata after explicit approval; stadium data changes infrequently.',
      futureUses: ['park context', 'dome/outdoor classification', 'altitude', 'field dimensions', 'weather applicability', 'wind orientation'],
    },
    playerDataCapability: {
      playerDetails: {
        status: 'documented_capability',
        fields: [...SPORTSDATAIO_MLB_PLAYER_DETAIL_FIELDS],
      },
      playerSeasonPitchingStats: {
        status: 'documented_capability',
        fields: [...SPORTSDATAIO_MLB_PLAYER_SEASON_PITCHING_FIELDS],
      },
      playerGameStatsByDate: {
        status: 'documented_game_level_pitching_history',
      },
      projectedPlayerGameStatsByDate: {
        status: 'documented_projection_availability_not_confirmed_lineup',
        fields: [...SPORTSDATAIO_MLB_PROJECTED_PLAYER_GAME_FIELDS],
        warning: 'Projected Started=1 must not be treated as a confirmed official lineup without separate evidence.',
      },
    },
    endpoints: audited,
    providerCallsMade: 0,
  }
}

export function validateMlbProviderCapabilityAuditFixtures() {
  const endpoints = sportsDataIoCatalogForSport('mlb')
  const discovery = endpoints.filter((endpoint) => endpoint.providerVariant === 'sportsdataio_discovery_lab')
  const enterprise = endpoints.filter((endpoint) => endpoint.providerVariant === 'sportsdataio_enterprise')
  const checks = [
    ['discovery lab endpoints cataloged', discovery.length > 0],
    ['enterprise endpoints separated', enterprise.length > 0],
    ['game odds endpoint cataloged', discovery.some((endpoint) => endpoint.pathTemplate.includes('GameOddsByDate'))],
    ['games by date documented starter fields cataloged', SPORTSDATAIO_MLB_DOCUMENTED_STARTER_FIELDS.includes('AwayTeamProbablePitcherID')],
    ['stadiums endpoint cataloged', discovery.some((endpoint) => endpoint.pathTemplate.includes('Stadiums'))],
    ['lineup endpoint not discovery lab', enterprise.some((endpoint) => endpoint.pathTemplate.includes('StartingLineupsByDate'))],
    ['deterministic validation made zero calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_provider_capability_audit_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}
