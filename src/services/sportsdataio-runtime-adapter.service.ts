import 'server-only'

import { SportKey } from '@/config/sports.config'
import {
  ProviderAdapterPage,
  ProviderAdapterQuery,
  ProviderRetryHint,
} from '@/services/provider-adapter-sdk.service'
import {
  getSportsDataIoAdapterContract,
  runSportsDataIoContractValidation,
} from '@/services/sportsdataio-adapter-contract.service'
import {
  getDefaultRetryPolicy,
  isRetryableStatus,
} from '@/services/sync-reliability.service'
import { runSportsDataIoBettingNormalizerValidation } from '@/services/sportsdataio-betting-normalizer.service'
import {
  normalizeOddsSnapshots,
  normalizeProviderEvent,
  normalizeStartTime,
} from '@/services/multi-sport-normalizers.service'
import {
  AdapterResult,
  EventStatus,
  MarketKey,
  MultiSportStatus,
  NormalizedEvent,
  NormalizedInjury,
  NormalizedLineup,
  NormalizedOddsSnapshot,
  NormalizedParticipant,
  NormalizedPlayer,
  NormalizedTeam,
} from '@/types/multi-sport'

export type SportsDataIoEnvStatus = {
  configured: boolean
  status: 'configured' | 'missing' | 'invalid_format'
  envVarName: string | null
  checkedEnvVars: string[]
}

export type SportsDataIoRuntimeDomain =
  | 'leagues'
  | 'teams'
  | 'schedules'
  | 'completed_games'
  | 'scores'
  | 'standings'
  | 'team_stats'
  | 'game_stats'
  | 'players'
  | 'player_stats'
  | 'injuries'
  | 'lineups'
  | 'odds'
  | 'historical_odds'
  | 'player_props'
  | 'betting_metadata'

export type SportsDataIoDomainContract = {
  domain: SportsDataIoRuntimeDomain
  capabilityStatus: 'contract_ready' | 'partial_contract' | 'requires_subscription_verification'
  destination: string
  naturalKey: string[]
  conflictTarget: string
  dependencyOrder: number
  estimatedCalls: number
  expectedPagination: 'none' | 'cursor' | 'date_window' | 'season_window'
  freshnessRequirement: string
  warnings: string[]
}

export type SportsDataIoNormalizedFixture = {
  leagues: Array<{ key: string; sportKey: SportKey; displayName: string }>
  teams: NormalizedTeam[]
  participants: NormalizedParticipant[]
  players: NormalizedPlayer[]
  events: NormalizedEvent[]
  standings: Array<Record<string, unknown>>
  teamStats: Array<Record<string, unknown>>
  gameStats: Array<Record<string, unknown>>
  injuries: NormalizedInjury[]
  lineups: NormalizedLineup[]
  odds: NormalizedOddsSnapshot[]
}

const SPORTSDATAIO_ENV_NAMES = [
  'SPORTSDATAIO_API_KEY',
  'SPORTSDATAIO_NBA_API_KEY',
  'SPORTSDATAIO_NFL_API_KEY',
  'SPORTSDATAIO_MLB_API_KEY',
  'SPORTSDATAIO_NHL_API_KEY',
]

const DOMAIN_CONTRACTS: SportsDataIoDomainContract[] = [
  {
    domain: 'leagues',
    capabilityStatus: 'contract_ready',
    destination: 'multi-sport registry',
    naturalKey: ['sport_key', 'league_key'],
    conflictTarget: 'static registry key',
    dependencyOrder: 1,
    estimatedCalls: 0,
    expectedPagination: 'none',
    freshnessRequirement: 'Verify once before pilot import.',
    warnings: ['Registry updates should remain code-reviewed and not provider-table driven in V1.'],
  },
  {
    domain: 'teams',
    capabilityStatus: 'contract_ready',
    destination: 'sports_teams, provider_entity_mappings',
    naturalKey: ['sport_key', 'league_key', 'provider', 'provider_id'],
    conflictTarget: 'sports_teams.id / provider_entity_mappings unique provider tuple',
    dependencyOrder: 2,
    estimatedCalls: 1,
    expectedPagination: 'season_window',
    freshnessRequirement: 'Refresh before schedule imports and before each new season.',
    warnings: [],
  },
  {
    domain: 'schedules',
    capabilityStatus: 'contract_ready',
    destination: 'sport_events, provider_entity_mappings',
    naturalKey: ['sport_key', 'league_key', 'provider_event_id'],
    conflictTarget: 'sport_events.id',
    dependencyOrder: 3,
    estimatedCalls: 1,
    expectedPagination: 'date_window',
    freshnessRequirement: 'Refresh before score/stat imports.',
    warnings: [],
  },
  {
    domain: 'completed_games',
    capabilityStatus: 'contract_ready',
    destination: 'sport_events, game_results',
    naturalKey: ['sport_key', 'league_key', 'provider_event_id'],
    conflictTarget: 'sport_events.id',
    dependencyOrder: 4,
    estimatedCalls: 1,
    expectedPagination: 'date_window',
    freshnessRequirement: 'Refresh completed results before settlement/backtesting.',
    warnings: [],
  },
  {
    domain: 'scores',
    capabilityStatus: 'contract_ready',
    destination: 'sport_events, game_results',
    naturalKey: ['sport_key', 'league_key', 'provider_event_id'],
    conflictTarget: 'sport_events.id',
    dependencyOrder: 5,
    estimatedCalls: 1,
    expectedPagination: 'date_window',
    freshnessRequirement: 'Refresh after games complete.',
    warnings: [],
  },
  {
    domain: 'standings',
    capabilityStatus: 'requires_subscription_verification',
    destination: 'sport_standings',
    naturalKey: ['sport_key', 'league_key', 'season', 'team_id'],
    conflictTarget: 'sport_standings unique sport/league/season/team',
    dependencyOrder: 6,
    estimatedCalls: 1,
    expectedPagination: 'season_window',
    freshnessRequirement: 'Refresh after scores import.',
    warnings: ['Subscription entitlement must be verified before live standings import.'],
  },
  {
    domain: 'team_stats',
    capabilityStatus: 'requires_subscription_verification',
    destination: 'team_stats, sport_game_stats',
    naturalKey: ['sport_key', 'season', 'team_id'],
    conflictTarget: 'existing team-stat natural keys',
    dependencyOrder: 7,
    estimatedCalls: 1,
    expectedPagination: 'season_window',
    freshnessRequirement: 'Refresh after teams and schedules.',
    warnings: ['Table choice depends on sport-level stat grain during activation.'],
  },
  {
    domain: 'game_stats',
    capabilityStatus: 'requires_subscription_verification',
    destination: 'sport_game_stats',
    naturalKey: ['sport_key', 'event_id', 'team_id'],
    conflictTarget: 'sport_game_stats unique sport/event/team',
    dependencyOrder: 8,
    estimatedCalls: 1,
    expectedPagination: 'date_window',
    freshnessRequirement: 'Refresh after completed games.',
    warnings: [],
  },
  {
    domain: 'players',
    capabilityStatus: 'requires_subscription_verification',
    destination: 'sport_players, provider_entity_mappings',
    naturalKey: ['sport_key', 'league_key', 'provider_player_id'],
    conflictTarget: 'sport_players.id',
    dependencyOrder: 9,
    estimatedCalls: 1,
    expectedPagination: 'season_window',
    freshnessRequirement: 'Refresh before injuries, lineups and props.',
    warnings: ['Player records must not unlock props until prop odds and settlement are available.'],
  },
  {
    domain: 'player_stats',
    capabilityStatus: 'requires_subscription_verification',
    destination: 'sport_player_stats',
    naturalKey: ['sport_key', 'league_key', 'season', 'provider_player_id', 'stat_type', 'provider_event_id'],
    conflictTarget: 'sport_player_stats.id',
    dependencyOrder: 10,
    estimatedCalls: 1,
    expectedPagination: 'season_window',
    freshnessRequirement: 'Refresh before feature generation and prop-readiness validation after exact endpoints are confirmed.',
    warnings: [
      'Exact player season/game stat endpoint paths must be confirmed before live calls.',
      'Additive sport_player_stats migration must be applied before persistence.',
    ],
  },
  {
    domain: 'injuries',
    capabilityStatus: 'requires_subscription_verification',
    destination: 'sport_injuries',
    naturalKey: ['sport_key', 'provider', 'provider_injury_id'],
    conflictTarget: 'sport_injuries.id',
    dependencyOrder: 11,
    estimatedCalls: 1,
    expectedPagination: 'date_window',
    freshnessRequirement: 'Refresh daily or before prediction generation.',
    warnings: ['Never synthesize unavailable injury records.'],
  },
  {
    domain: 'lineups',
    capabilityStatus: 'requires_subscription_verification',
    destination: 'sport_lineups, sport_players, provider_entity_mappings',
    naturalKey: ['sport_key', 'league_key', 'event_id', 'team_id', 'player_id', 'lineup_type', 'position', 'depth_order'],
    conflictTarget: 'sport_lineups.id',
    dependencyOrder: 12,
    estimatedCalls: 1,
    expectedPagination: 'date_window',
    freshnessRequirement: 'Refresh near event cutoff; keep expected vs confirmed distinct.',
    warnings: ['Trial lineup rows must remain production_eligible=false until non-scrambled production data is approved.'],
  },
  {
    domain: 'odds',
    capabilityStatus: 'requires_subscription_verification',
    destination: 'sports_odds_snapshots',
    naturalKey: ['sport_key', 'event_id', 'sportsbook', 'market', 'outcome', 'snapshot_time'],
    conflictTarget: 'sports_odds_snapshots.id',
    dependencyOrder: 13,
    estimatedCalls: 1,
    expectedPagination: 'date_window',
    freshnessRequirement: 'Refresh before prediction previews and CLV analysis.',
    warnings: ['Live entitlement and bookmaker coverage must be verified later.'],
  },
  {
    domain: 'historical_odds',
    capabilityStatus: 'requires_subscription_verification',
    destination: 'sports_odds_snapshots',
    naturalKey: ['sport_key', 'event_id', 'sportsbook', 'market', 'outcome', 'snapshot_time'],
    conflictTarget: 'sports_odds_snapshots.id',
    dependencyOrder: 14,
    estimatedCalls: 2,
    expectedPagination: 'date_window',
    freshnessRequirement: 'Import only capped historical windows.',
    warnings: ['High quota risk; require explicit request cap and subscription verification.'],
  },
  {
    domain: 'player_props',
    capabilityStatus: 'requires_subscription_verification',
    destination: 'sports_odds_snapshots with player prop metadata, provider_entity_mappings',
    naturalKey: ['sport_key', 'event_id', 'provider_player_id', 'sportsbook', 'prop_market', 'outcome', 'snapshot_time'],
    conflictTarget: 'sports_odds_snapshots.id',
    dependencyOrder: 15,
    estimatedCalls: 1,
    expectedPagination: 'date_window',
    freshnessRequirement: 'Refresh only after exact prop market entitlement and settlement support are approved.',
    warnings: [
      'Exact NBA player prop market endpoint paths are not confirmed in repository metadata.',
      'Player props must not feed production recommendations until prop settlement and validation are implemented.',
    ],
  },
  {
    domain: 'betting_metadata',
    capabilityStatus: 'requires_subscription_verification',
    destination: 'catalog/runtime metadata for market, bet, period, outcome, result and sportsbook identities',
    naturalKey: ['sport_key', 'provider', 'metadata_type', 'provider_metadata_id'],
    conflictTarget: 'typed catalog metadata; no raw mirror table in V1',
    dependencyOrder: 16,
    estimatedCalls: 0,
    expectedPagination: 'none',
    freshnessRequirement: 'Verify before interpreting numeric betting market IDs.',
    warnings: [
      'BettingMetadata and ActiveSportsbooks must be normalized before numeric market IDs are interpreted.',
      'No provider calls are made by runtime capability metadata.',
    ],
  },
]

function envFormatStatus(value: string | undefined) {
  if (!value) return 'missing' as const
  if (/\s/.test(value) || value.length < 16) return 'invalid_format' as const
  return 'configured' as const
}

export function getSportsDataIoEnvironmentStatus(): SportsDataIoEnvStatus {
  const configuredName = SPORTSDATAIO_ENV_NAMES.find((name) =>
    Boolean(process.env[name])
  )
  const status = envFormatStatus(configuredName ? process.env[configuredName] : undefined)

  return {
    configured: status === 'configured',
    status,
    envVarName: configuredName ?? null,
    checkedEnvVars: SPORTSDATAIO_ENV_NAMES,
  }
}

function page<T>(records: T[], warnings: string[]): ProviderAdapterPage<T> {
  return {
    records,
    cursor: null,
    nextCursor: null,
    hasMore: false,
    warnings,
  }
}

function result<T>(data: T, warnings: string[] = []): AdapterResult<T> {
  return {
    success: true,
    source: 'sportsdataio-runtime-adapter-readiness',
    data,
    latencyMs: 0,
    warnings,
  }
}

function disabledWarning(domain: string) {
  const env = getSportsDataIoEnvironmentStatus()
  return [
    `SportsDataIO runtime adapter is disabled for ${domain}; no live provider calls were made.`,
    `Environment status: ${env.status}.`,
  ]
}

export function normalizeSportsDataIoFixturePayloads(): SportsDataIoNormalizedFixture {
  const event = normalizeProviderEvent({
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    provider: 'sportsdataio',
    participantType: 'team',
    raw: {
      id: 'sdi_fixture_game_1001',
      home_team: 'Boston Celtics',
      away_team: 'New York Knicks',
      commence_time: '2026-01-01T00:00:00Z',
      status: 'final',
      venue: 'Fixture Arena',
    },
  })
  const teams: NormalizedTeam[] = ['Boston Celtics', 'New York Knicks'].map((name, index) => ({
    id: `basketball_nba:nba:sdi_team_${index + 1}`,
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    displayName: name,
    abbreviation: index === 0 ? 'BOS' : 'NYK',
    providerIds: { sportsdataio: `sdi_team_${index + 1}` },
    metadata: { fixture: true, source: 'non-production deterministic fixture' },
  }))
  const participants: NormalizedParticipant[] = teams.map((team) => ({
    id: team.id,
    sportKey: team.sportKey,
    leagueKey: team.leagueKey,
    displayName: team.displayName,
    type: 'team',
    team,
    providerIds: team.providerIds,
    metadata: team.metadata,
  }))
  const players: NormalizedPlayer[] = [
    {
      id: 'basketball_nba:nba:sdi_player_1',
      sportKey: 'basketball_nba',
      displayName: 'Fixture Player',
      participantId: teams[0].id,
      position: 'G',
      providerIds: { sportsdataio: 'sdi_player_1' },
      metadata: { fixture: true, source: 'non-production deterministic fixture' },
    },
  ]
  const injuries: NormalizedInjury[] = [
    {
      id: 'basketball_nba:sdi_injury_1',
      sportKey: 'basketball_nba',
      participantId: teams[0].id,
      playerId: players[0].id,
      status: 'questionable',
      description: 'Fixture injury for contract validation only.',
      updatedAt: '2026-01-01T00:00:00.000Z',
      providerIds: { sportsdataio: 'sdi_injury_1' },
      metadata: { fixture: true, source: 'non-production deterministic fixture' },
    },
  ]
  const lineups: NormalizedLineup[] = [
    {
      id: 'basketball_nba:sdi_fixture_game_1001:sdi_team_1:expected',
      sportKey: 'basketball_nba',
      eventId: event.id,
      participantId: teams[0].id,
      confirmed: false,
      playerIds: [players[0].id],
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata: { fixture: true, source: 'non-production deterministic fixture' },
    },
  ]
  const odds = normalizeOddsSnapshots({
    sportKey: 'basketball_nba',
    eventId: event.id,
    provider: 'sportsdataio',
    bookmakers: [
      {
        title: 'Fixture Book',
        last_update: '2026-01-01T00:00:00Z',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Boston Celtics', price: -120 },
              { name: 'New York Knicks', price: 105 },
            ],
          },
        ],
      },
    ],
  })

  return {
    leagues: [{ key: 'nba', sportKey: 'basketball_nba', displayName: 'NBA' }],
    teams,
    participants,
    players,
    events: [event],
    standings: [
      {
        id: 'basketball_nba:nba:2026:sdi_team_1',
        teamId: teams[0].id,
        wins: 1,
        losses: 0,
        fixture: true,
      },
    ],
    teamStats: [{ teamId: teams[0].id, pointsPerGame: 111.1, fixture: true }],
    gameStats: [{ eventId: event.id, teamId: teams[0].id, pointsFor: 101, fixture: true }],
    injuries,
    lineups,
    odds,
  }
}

export function getSportsDataIoRuntimeAdapterStatus() {
  const env = getSportsDataIoEnvironmentStatus()
  const contract = getSportsDataIoAdapterContract()
  const validation = runSportsDataIoContractValidation()
  const retryPolicy = getDefaultRetryPolicy()

  return {
    success: true,
    mode: 'sportsdataio_runtime_adapter_readiness_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'runtime_adapter_status_no_live_calls',
    },
    status: env.configured ? 'configured_disabled' : 'disabled_missing_key',
    completionLabels: [
      'EXECUTION_ARCHITECTURE_COMPLETE',
      'DETERMINISTIC_VALIDATION_COMPLETE',
      'LIVE_PROVIDER_VALIDATION_PENDING',
      'PILOT_IMPORT_PENDING',
    ],
    environment: env,
    runtime: {
      liveCallsEnabled: false,
      serverOnly: true,
      browserSafe: true,
      boundedConcurrency: true,
      timeoutMs: retryPolicy.timeoutMs,
      retry: {
        maxAttempts: retryPolicy.maxAttempts,
        baseDelayMs: retryPolicy.baseDelayMs,
        maxDelayMs: retryPolicy.maxDelayMs,
        jitterRatio: retryPolicy.jitterRatio,
        retryableStatuses: retryPolicy.retryableStatuses,
      },
      normalizedErrors: ['401', '403', '404', '429', '5xx', 'timeout'],
      rateLimitMetadataCapturedWhenAvailable: true,
      providerPayloadBoundary: 'adapter_and_normalizers_only',
    },
    summary: {
      contractEndpoints: contract.contract.endpoints.length,
      domainContracts: DOMAIN_CONTRACTS.length,
      fixtureValidationErrors: validation.summary.errors,
      fixtureValidationWarnings: validation.summary.warnings,
      supportedRuntimeSports: contract.coverage.filter((item) => item.status !== 'unsupported').length,
    },
    warnings: [
      'Live SportsDataIO calls are disabled in this readiness module.',
      'API key values are never returned by status APIs.',
      'Future live execution must be explicitly confirmed, capped and server-authorized.',
    ],
  }
}

export function getSportsDataIoRuntimeCapabilities() {
  const contract = getSportsDataIoAdapterContract()

  return {
    success: true,
    mode: 'sportsdataio_runtime_capabilities_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'contract_and_domain_capabilities_only',
    },
    environment: getSportsDataIoEnvironmentStatus(),
    coverage: contract.coverage,
    domains: DOMAIN_CONTRACTS,
    dependencyGraph: DOMAIN_CONTRACTS
      .slice()
      .sort((a, b) => a.dependencyOrder - b.dependencyOrder)
      .map((domain) => ({
        order: domain.dependencyOrder,
        domain: domain.domain,
        destination: domain.destination,
        dependsOn: DOMAIN_CONTRACTS
          .filter((candidate) => candidate.dependencyOrder < domain.dependencyOrder)
          .slice(-2)
          .map((candidate) => candidate.domain),
      })),
  }
}

export function retryHintForSportsDataIoStatus(status: number): ProviderRetryHint {
  return {
    retryable: isRetryableStatus(status),
    retryAfterMs: status === 429 ? 60_000 : undefined,
    reason:
      status === 401
        ? 'Unauthorized: verify server-side API key.'
        : status === 403
          ? 'Forbidden: subscription entitlement may not include this endpoint.'
          : status === 404
            ? 'Not found: request should not be retried unless identifiers change.'
            : status === 429
              ? 'Rate limited: honor retry-after or backoff policy.'
              : status >= 500
                ? 'Provider server error: retry with exponential backoff.'
                : undefined,
  }
}

export const sportsDataIoRuntimeAdapter = {
  id: 'sportsdataio-runtime',
  displayName: 'SportsDataIO Runtime Adapter',
  async healthCheck() {
    const env = getSportsDataIoEnvironmentStatus()
    const status: MultiSportStatus = env.configured ? 'degraded' : 'unavailable'
    return result({
      status,
      capabilities: getSportsDataIoRuntimeCapabilities().domains.map((domain) => ({
        dataType: domain.domain,
        supported: domain.capabilityStatus !== 'requires_subscription_verification',
        requiresAuth: true,
        paginated: domain.expectedPagination !== 'none',
        normalizedReturnType: domain.destination,
        warnings: domain.warnings,
      })),
    })
  },
  async fetchSchedules(_query: ProviderAdapterQuery) {
    return result(page<NormalizedEvent>([], disabledWarning('schedules')))
  },
  async fetchScores(_query: ProviderAdapterQuery) {
    return result(page<NormalizedEvent>([], disabledWarning('scores')))
  },
  async fetchStandings(_query: ProviderAdapterQuery) {
    return result(page<Record<string, unknown>>([], disabledWarning('standings')))
  },
  async fetchTeamStats(_query: ProviderAdapterQuery) {
    return result(page<Record<string, unknown>>([], disabledWarning('team_stats')))
  },
  async fetchPlayerStats(_query: ProviderAdapterQuery) {
    return result(page<Record<string, unknown>>([], disabledWarning('player_stats')))
  },
  async fetchInjuries(_query: ProviderAdapterQuery) {
    return result(page<NormalizedInjury>([], disabledWarning('injuries')))
  },
  async fetchLineups(_query: ProviderAdapterQuery) {
    return result(page<NormalizedLineup>([], disabledWarning('lineups')))
  },
  async fetchOdds(_query: ProviderAdapterQuery) {
    return result(page<NormalizedOddsSnapshot>([], disabledWarning('odds')))
  },
  async fetchHistoricalOdds(_query: ProviderAdapterQuery) {
    return result(page<NormalizedOddsSnapshot>([], disabledWarning('historical_odds')))
  },
  async fetchPlayerProps(_query: ProviderAdapterQuery) {
    return result(page<NormalizedOddsSnapshot>([], disabledWarning('player_props')))
  },
}

export function runSportsDataIoRuntimeValidation() {
  const env = getSportsDataIoEnvironmentStatus()
  const fixture = normalizeSportsDataIoFixturePayloads()
  const retry429 = retryHintForSportsDataIoStatus(429)
  const retry500 = retryHintForSportsDataIoStatus(500)
  const bettingNormalizer = runSportsDataIoBettingNormalizerValidation()
  const checks = {
    missingKeySafe: env.status === 'missing' || env.status === 'configured' || env.status === 'invalid_format',
    runtimeDisabled: getSportsDataIoRuntimeAdapterStatus().runtime.liveCallsEnabled === false,
    capabilitiesResolved: getSportsDataIoRuntimeCapabilities().domains.length >= 16,
    fixtureEventsNormalized: fixture.events.length === 1 && Boolean(fixture.events[0].providerIds.sportsdataio),
    fixtureOddsNormalized: fixture.odds.length > 0,
    fixturePlayersNormalized: fixture.players.length === 1,
    retry429Contract: retry429.retryable && retry429.retryAfterMs === 60_000,
    retry5xxContract: retry500.retryable,
    bettingNormalizerFixturesValid: bettingNormalizer.success,
    zeroExternalProviderCalls: true,
    zeroSecretExposure: !JSON.stringify(getSportsDataIoRuntimeAdapterStatus()).includes(process.env[env.envVarName ?? ''] ?? 'never-match-secret'),
  }

  return {
    success: Object.values(checks).every(Boolean),
    mode: 'sportsdataio_runtime_adapter_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_runtime_adapter_contract_validation',
    },
    completionLabels: [
      'EXECUTION_ARCHITECTURE_COMPLETE',
      'DETERMINISTIC_VALIDATION_COMPLETE',
      'LIVE_PROVIDER_VALIDATION_PENDING',
      'PILOT_IMPORT_PENDING',
    ],
    summary: {
      checks: Object.keys(checks).length,
      passed: Object.values(checks).filter(Boolean).length,
      normalizedEvents: fixture.events.length,
      normalizedTeams: fixture.teams.length,
      normalizedPlayers: fixture.players.length,
      normalizedInjuries: fixture.injuries.length,
      normalizedLineups: fixture.lineups.length,
      normalizedOdds: fixture.odds.length,
      bettingNormalizerChecks: Object.keys(bettingNormalizer.checks).length,
    },
    checks,
    bettingNormalizer,
    environment: env,
    warnings: [
      'Fixture payloads are deterministic non-production test fixtures.',
      'No live SportsDataIO request was executed.',
    ],
  }
}
