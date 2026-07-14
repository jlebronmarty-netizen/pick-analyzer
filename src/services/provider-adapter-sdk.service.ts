import { SportKey } from '@/config/sports.config'
import {
  getProviderCapabilityRegistry,
  ProviderDataType,
} from '@/services/provider-intelligence.service'
import {
  normalizeOddsSnapshots,
  normalizeProviderEvent,
} from '@/services/multi-sport-normalizers.service'
import {
  AdapterResult,
  EventStatus,
  MarketKey,
  MultiSportStatus,
  NormalizedEvent,
  NormalizedInjury,
  NormalizedLeague,
  NormalizedLineup,
  NormalizedOddsSnapshot,
  NormalizedParticipant,
  NormalizedPlayer,
} from '@/types/multi-sport'

export type ProviderAdapterExecutionMode = 'fixture' | 'dry_run' | 'live'
export type ProviderAdapterAuthType = 'api_key' | 'bearer_token' | 'basic' | 'none'
export type ProviderAdapterValidationSeverity = 'info' | 'warning' | 'error'

export type ProviderAdapterQuery = {
  sportKey: SportKey
  leagueKey?: string | null
  season?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  eventId?: string | null
  participantId?: string | null
  marketKeys?: MarketKey[]
  cursor?: string | null
  limit?: number
}

export type ProviderAdapterPage<T> = {
  records: T[]
  cursor: string | null
  nextCursor: string | null
  hasMore: boolean
  rateLimit?: ProviderRateLimitHint
  warnings: string[]
}

export type ProviderRateLimitHint = {
  requestsRemaining?: number
  resetAt?: string
  retryAfterMs?: number
}

export type ProviderRetryHint = {
  retryable: boolean
  retryAfterMs?: number
  reason?: string
}

export type ProviderAdapterCapability = {
  dataType: ProviderDataType
  supported: boolean
  requiresAuth: boolean
  paginated: boolean
  normalizedReturnType: string
  warnings: string[]
}

export type ProviderAdapterAuthContract = {
  type: ProviderAdapterAuthType
  envVarNames: string[]
  headerNames: string[]
  requiredForLiveMode: boolean
  notes: string[]
}

export type ProviderAdapterEndpointContract = {
  name: string
  dataType: ProviderDataType
  required: boolean
  paginated: boolean
  normalizedReturnType: string
  queryFields: Array<keyof ProviderAdapterQuery>
  executionModes: ProviderAdapterExecutionMode[]
  retryableStatuses: number[]
  unsupportedBehavior: string
}

export type ProviderAdapterContract = {
  id: string
  version: 'provider_adapter_sdk_v1'
  displayName: string
  auth: ProviderAdapterAuthContract
  capabilities: ProviderAdapterCapability[]
  endpoints: ProviderAdapterEndpointContract[]
  normalization: {
    input: 'provider_specific_payload'
    output:
      | 'NormalizedLeague'
      | 'NormalizedParticipant'
      | 'NormalizedEvent'
      | 'NormalizedOddsSnapshot'
      | 'NormalizedInjury'
      | 'NormalizedLineup'
      | 'NormalizedPlayer'
      | 'unknown'
    rule: string
  }[]
  safety: {
    providerCallsInSdkValidation: 0
    noSecretsInContract: boolean
    normalizedModelsOnly: boolean
    unsupportedDataReturnsWarnings: boolean
  }
}

export interface ProviderAdapterSdk {
  id: string
  displayName: string
  contract: ProviderAdapterContract
  healthCheck(mode: ProviderAdapterExecutionMode): Promise<AdapterResult<{
    status: MultiSportStatus
    capabilities: ProviderAdapterCapability[]
  }>>
  fetchSchedules(
    query: ProviderAdapterQuery
  ): Promise<AdapterResult<ProviderAdapterPage<NormalizedEvent>>>
  fetchScores(
    query: ProviderAdapterQuery
  ): Promise<AdapterResult<ProviderAdapterPage<NormalizedEvent>>>
  fetchStandings(query: ProviderAdapterQuery): Promise<AdapterResult<ProviderAdapterPage<unknown>>>
  fetchTeamStats(query: ProviderAdapterQuery): Promise<AdapterResult<ProviderAdapterPage<unknown>>>
  fetchPlayerStats(query: ProviderAdapterQuery): Promise<AdapterResult<ProviderAdapterPage<unknown>>>
  fetchInjuries(
    query: ProviderAdapterQuery
  ): Promise<AdapterResult<ProviderAdapterPage<NormalizedInjury>>>
  fetchLineups(
    query: ProviderAdapterQuery
  ): Promise<AdapterResult<ProviderAdapterPage<NormalizedLineup>>>
  fetchOdds(
    query: ProviderAdapterQuery
  ): Promise<AdapterResult<ProviderAdapterPage<NormalizedOddsSnapshot>>>
  fetchHistoricalOdds(
    query: ProviderAdapterQuery
  ): Promise<AdapterResult<ProviderAdapterPage<NormalizedOddsSnapshot>>>
  fetchPlayerProps(
    query: ProviderAdapterQuery
  ): Promise<AdapterResult<ProviderAdapterPage<NormalizedOddsSnapshot>>>
  normalizeProviderPayload(dataType: ProviderDataType, payload: unknown): AdapterResult<unknown>
  retryHint(status: number): ProviderRetryHint
}

type ValidationIssue = {
  id: string
  severity: ProviderAdapterValidationSeverity
  message: string
  recommendation: string
}

const ENDPOINTS: ProviderAdapterEndpointContract[] = [
  {
    name: 'fetchSchedules',
    dataType: 'schedules',
    required: true,
    paginated: true,
    normalizedReturnType: 'NormalizedEvent[]',
    queryFields: ['sportKey', 'leagueKey', 'season', 'dateFrom', 'dateTo', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run', 'live'],
    retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return success=true with empty records and warnings when unsupported.',
  },
  {
    name: 'fetchScores',
    dataType: 'scores',
    required: true,
    paginated: true,
    normalizedReturnType: 'NormalizedEvent[]',
    queryFields: ['sportKey', 'leagueKey', 'season', 'dateFrom', 'dateTo', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run', 'live'],
    retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return completed NormalizedEvent records when available, otherwise typed warnings.',
  },
  {
    name: 'fetchStandings',
    dataType: 'standings',
    required: false,
    paginated: true,
    normalizedReturnType: 'unknown[]',
    queryFields: ['sportKey', 'leagueKey', 'season', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run', 'live'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty standings and provider capability warning.',
  },
  {
    name: 'fetchTeamStats',
    dataType: 'team_stats',
    required: false,
    paginated: true,
    normalizedReturnType: 'unknown[]',
    queryFields: ['sportKey', 'leagueKey', 'season', 'participantId', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run', 'live'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty stats and provider capability warning.',
  },
  {
    name: 'fetchPlayerStats',
    dataType: 'player_stats',
    required: false,
    paginated: true,
    normalizedReturnType: 'unknown[]',
    queryFields: ['sportKey', 'leagueKey', 'season', 'participantId', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run', 'live'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty player stats and provider capability warning.',
  },
  {
    name: 'fetchInjuries',
    dataType: 'injuries',
    required: false,
    paginated: true,
    normalizedReturnType: 'NormalizedInjury[]',
    queryFields: ['sportKey', 'leagueKey', 'season', 'participantId', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run', 'live'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty injuries and warning; never fabricate injury records.',
  },
  {
    name: 'fetchLineups',
    dataType: 'lineups',
    required: false,
    paginated: true,
    normalizedReturnType: 'NormalizedLineup[]',
    queryFields: ['sportKey', 'leagueKey', 'eventId', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run', 'live'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty lineups and warning; never fabricate expected starters.',
  },
  {
    name: 'fetchOdds',
    dataType: 'odds',
    required: true,
    paginated: true,
    normalizedReturnType: 'NormalizedOddsSnapshot[]',
    queryFields: ['sportKey', 'leagueKey', 'eventId', 'marketKeys', 'dateFrom', 'dateTo', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run', 'live'],
    retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty odds snapshots and warning when unavailable.',
  },
  {
    name: 'fetchHistoricalOdds',
    dataType: 'historical_odds',
    required: false,
    paginated: true,
    normalizedReturnType: 'NormalizedOddsSnapshot[]',
    queryFields: ['sportKey', 'leagueKey', 'eventId', 'marketKeys', 'dateFrom', 'dateTo', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run', 'live'],
    retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty historical odds and quota warning unless explicitly approved.',
  },
  {
    name: 'fetchPlayerProps',
    dataType: 'player_props',
    required: false,
    paginated: true,
    normalizedReturnType: 'NormalizedOddsSnapshot[]',
    queryFields: ['sportKey', 'leagueKey', 'eventId', 'marketKeys', 'dateFrom', 'dateTo', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run', 'live'],
    retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty player props and settlement-readiness warnings unless explicitly approved.',
  },
]

function capabilityFromEndpoint(endpoint: ProviderAdapterEndpointContract): ProviderAdapterCapability {
  return {
    dataType: endpoint.dataType,
    supported: endpoint.required,
    requiresAuth: endpoint.executionModes.includes('live'),
    paginated: endpoint.paginated,
    normalizedReturnType: endpoint.normalizedReturnType,
    warnings: endpoint.required
      ? []
      : ['Optional capability; providers must return typed empty responses when unavailable.'],
  }
}

export function getProviderAdapterSdkContract(): ProviderAdapterContract {
  return {
    id: 'provider-adapter-sdk',
    version: 'provider_adapter_sdk_v1',
    displayName: 'Provider Adapter SDK',
    auth: {
      type: 'api_key',
      envVarNames: ['PROVIDER_API_KEY'],
      headerNames: ['Authorization', 'x-api-key'],
      requiredForLiveMode: true,
      notes: [
        'Use provider-specific environment variable names in concrete adapters.',
        'Never persist secrets in docs, source code or client components.',
        'Fixture and dry-run modes must not require credentials.',
      ],
    },
    capabilities: ENDPOINTS.map(capabilityFromEndpoint),
    endpoints: ENDPOINTS,
    normalization: [
      {
        input: 'provider_specific_payload',
        output: 'NormalizedLeague',
        rule: 'Provider league IDs must be mapped to registered sport/league keys before persistence.',
      },
      {
        input: 'provider_specific_payload',
        output: 'NormalizedParticipant',
        rule: 'Teams, players and individual participants must carry providerIds and stable display names.',
      },
      {
        input: 'provider_specific_payload',
        output: 'NormalizedEvent',
        rule: 'Schedules and scores must normalize start time, status, venue, participants and providerIds.',
      },
      {
        input: 'provider_specific_payload',
        output: 'NormalizedOddsSnapshot',
        rule: 'Odds and props must normalize sportsbook, market, outcomes, prices, lines, snapshot timestamps and player/event references where applicable.',
      },
      {
        input: 'provider_specific_payload',
        output: 'NormalizedInjury',
        rule: 'Injuries must include source status and update time; unavailable injuries must not be fabricated.',
      },
      {
        input: 'provider_specific_payload',
        output: 'NormalizedLineup',
        rule: 'Lineups must distinguish expected and confirmed data; unavailable lineups must not be fabricated.',
      },
      {
        input: 'provider_specific_payload',
        output: 'NormalizedPlayer',
        rule: 'Player records must be provider-mapped before player prop or lineup engines consume them.',
      },
    ],
    safety: {
      providerCallsInSdkValidation: 0,
      noSecretsInContract: true,
      normalizedModelsOnly: true,
      unsupportedDataReturnsWarnings: true,
    },
  }
}

function fixtureEvent() {
  return normalizeProviderEvent({
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    provider: 'fixture-provider',
    participantType: 'team',
    raw: {
      id: 'fixture_game_1',
      home_team: 'Boston Celtics',
      away_team: 'New York Knicks',
      commence_time: '2026-01-01T00:00:00Z',
      status: 'scheduled',
      venue: 'Fixture Arena',
    },
  })
}

function fixtureOdds() {
  return normalizeOddsSnapshots({
    sportKey: 'basketball_nba',
    eventId: 'fixture_game_1',
    provider: 'fixture-provider',
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
}

function validateEvent(event: NormalizedEvent): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!event.id) {
    issues.push({
      id: 'event-id',
      severity: 'error',
      message: 'NormalizedEvent.id is required.',
      recommendation: 'Map provider event IDs into stable normalized IDs.',
    })
  }

  if (!event.providerIds['fixture-provider']) {
    issues.push({
      id: 'event-provider-id',
      severity: 'error',
      message: 'NormalizedEvent.providerIds is missing provider mapping.',
      recommendation: 'Attach provider IDs before persistence or reconciliation.',
    })
  }

  if (!['scheduled', 'live', 'completed', 'postponed', 'cancelled'].includes(event.status)) {
    issues.push({
      id: 'event-status',
      severity: 'error',
      message: `Invalid normalized event status: ${event.status as EventStatus}.`,
      recommendation: 'Normalize provider statuses into the shared EventStatus enum.',
    })
  }

  if (!event.participants.length) {
    issues.push({
      id: 'event-participants',
      severity: 'error',
      message: 'NormalizedEvent.participants cannot be empty for team events.',
      recommendation: 'Normalize home/away or participant arrays before returning schedules.',
    })
  }

  return issues
}

function validateOdds(snapshots: NormalizedOddsSnapshot[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (snapshots.length === 0) {
    return [
      {
        id: 'odds-empty',
        severity: 'error',
        message: 'Fixture odds normalization returned no snapshots.',
        recommendation: 'Map provider bookmaker/market/outcome payloads into NormalizedOddsSnapshot.',
      },
    ]
  }

  for (const snapshot of snapshots) {
    if (!snapshot.id || !snapshot.eventId || !snapshot.sportsbook) {
      issues.push({
        id: `odds-identity-${snapshot.id || 'missing'}`,
        severity: 'error',
        message: 'Odds snapshot identity fields are incomplete.',
        recommendation: 'Include stable id, eventId and sportsbook for every snapshot.',
      })
    }

    if (snapshot.outcomes.length < 2) {
      issues.push({
        id: `odds-outcomes-${snapshot.id}`,
        severity: 'warning',
        message: 'Odds snapshot has fewer than two outcomes.',
        recommendation: 'Confirm the provider market is complete before persistence.',
      })
    }
  }

  return issues
}

export function runProviderAdapterFixtureValidation() {
  const event = fixtureEvent()
  const odds = fixtureOdds()
  const issues = [...validateEvent(event), ...validateOdds(odds)]
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')

  return {
    success: errors.length === 0,
    mode: 'provider_adapter_sdk_fixture_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_fixtures_only',
    },
    summary: {
      fixtures: 2,
      normalizedEvents: 1,
      normalizedOddsSnapshots: odds.length,
      errors: errors.length,
      warnings: warnings.length,
    },
    issues,
    samples: {
      event,
      odds,
    },
  }
}

export function getProviderAdapterSdkStatus() {
  const contract = getProviderAdapterSdkContract()
  const capabilities = getProviderCapabilityRegistry()
  const validation = runProviderAdapterFixtureValidation()
  const requiredEndpoints = contract.endpoints.filter((endpoint) => endpoint.required)
  const optionalEndpoints = contract.endpoints.filter((endpoint) => !endpoint.required)

  return {
    success: true,
    mode: 'provider_adapter_sdk_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'contract_and_fixture_validation_only',
    },
    status: validation.success ? 'ready' : 'degraded',
    contract,
    summary: {
      endpoints: contract.endpoints.length,
      requiredEndpoints: requiredEndpoints.length,
      optionalEndpoints: optionalEndpoints.length,
      capabilities: contract.capabilities.length,
      configuredProviderCapabilities: capabilities.summary.capabilities,
      fixtureValidationErrors: validation.summary.errors,
      fixtureValidationWarnings: validation.summary.warnings,
    },
    guardrails: [
      'Sport engines must consume normalized domain models, not provider payload fields.',
      'SDK fixture validation must not perform external provider calls.',
      'Unsupported data must return typed empty results with warnings.',
      'Concrete adapters must keep credentials server-side and out of documentation.',
    ],
    validation,
  }
}

export type {
  NormalizedEvent,
  NormalizedInjury,
  NormalizedLeague,
  NormalizedLineup,
  NormalizedOddsSnapshot,
  NormalizedParticipant,
  NormalizedPlayer,
}
