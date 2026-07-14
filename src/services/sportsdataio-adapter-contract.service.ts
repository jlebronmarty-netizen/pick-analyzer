import {
  ProviderAdapterCapability,
  ProviderAdapterContract,
  ProviderAdapterEndpointContract,
  ProviderAdapterValidationSeverity,
} from '@/services/provider-adapter-sdk.service'
import {
  normalizeOddsSnapshots,
  normalizeProviderEvent,
} from '@/services/multi-sport-normalizers.service'
import {
  MarketKey,
  NormalizedEvent,
  NormalizedOddsSnapshot,
} from '@/types/multi-sport'

type SportsDataIoSportCoverage = {
  sportKey: string
  leagueKey: string
  status: 'contract_ready' | 'partial_contract' | 'unsupported'
  supportedDataTypes: string[]
  warnings: string[]
}

type SportsDataIoMapping = {
  sportsDataIoConcept: string
  normalizedModel: string
  keyFields: string[]
  notes: string[]
}

type ContractIssue = {
  id: string
  severity: ProviderAdapterValidationSeverity
  message: string
  recommendation: string
}

const SPORTSDATAIO_ENV_NAMES = [
  'SPORTSDATAIO_API_KEY',
  'SPORTSDATAIO_NBA_API_KEY',
  'SPORTSDATAIO_NFL_API_KEY',
  'SPORTSDATAIO_MLB_API_KEY',
  'SPORTSDATAIO_NHL_API_KEY',
]

const ENDPOINTS: ProviderAdapterEndpointContract[] = [
  {
    name: 'gamesByDate',
    dataType: 'schedules',
    required: true,
    paginated: false,
    normalizedReturnType: 'NormalizedEvent[]',
    queryFields: ['sportKey', 'leagueKey', 'dateFrom', 'dateTo', 'season'],
    executionModes: ['fixture', 'dry_run'],
    retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty NormalizedEvent[] and a capability warning.',
  },
  {
    name: 'scoresByDate',
    dataType: 'scores',
    required: true,
    paginated: false,
    normalizedReturnType: 'NormalizedEvent[]',
    queryFields: ['sportKey', 'leagueKey', 'dateFrom', 'dateTo', 'season'],
    executionModes: ['fixture', 'dry_run'],
    retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty completed-event results and a capability warning.',
  },
  {
    name: 'standingsBySeason',
    dataType: 'standings',
    required: false,
    paginated: false,
    normalizedReturnType: 'unknown[]',
    queryFields: ['sportKey', 'leagueKey', 'season'],
    executionModes: ['fixture', 'dry_run'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty standings and a provider warning.',
  },
  {
    name: 'teamSeasonStats',
    dataType: 'team_stats',
    required: false,
    paginated: true,
    normalizedReturnType: 'unknown[]',
    queryFields: ['sportKey', 'leagueKey', 'season', 'participantId', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty team stats and a provider warning.',
  },
  {
    name: 'playerSeasonStats',
    dataType: 'player_stats',
    required: false,
    paginated: true,
    normalizedReturnType: 'unknown[]',
    queryFields: ['sportKey', 'leagueKey', 'season', 'participantId', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty player season stats and a provider warning.',
  },
  {
    name: 'playerGameStats',
    dataType: 'player_stats',
    required: false,
    paginated: true,
    normalizedReturnType: 'unknown[]',
    queryFields: ['sportKey', 'leagueKey', 'season', 'eventId', 'dateFrom', 'dateTo', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty player game stats and a provider warning.',
  },
  {
    name: 'injuries',
    dataType: 'injuries',
    required: false,
    paginated: true,
    normalizedReturnType: 'NormalizedInjury[]',
    queryFields: ['sportKey', 'leagueKey', 'season', 'participantId', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty injuries and a provider warning; never synthesize injury status.',
  },
  {
    name: 'projectedLineups',
    dataType: 'lineups',
    required: false,
    paginated: true,
    normalizedReturnType: 'NormalizedLineup[]',
    queryFields: ['sportKey', 'leagueKey', 'eventId', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run'],
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty lineups and a provider warning; never synthesize starters.',
  },
  {
    name: 'gameOddsByDate',
    dataType: 'odds',
    required: true,
    paginated: true,
    normalizedReturnType: 'NormalizedOddsSnapshot[]',
    queryFields: ['sportKey', 'leagueKey', 'eventId', 'marketKeys', 'dateFrom', 'dateTo', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run'],
    retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty odds and a provider warning.',
  },
  {
    name: 'historicalGameOdds',
    dataType: 'historical_odds',
    required: false,
    paginated: true,
    normalizedReturnType: 'NormalizedOddsSnapshot[]',
    queryFields: ['sportKey', 'leagueKey', 'eventId', 'marketKeys', 'dateFrom', 'dateTo', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run'],
    retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
    unsupportedBehavior: 'Return empty historical odds and quota warning until approved.',
  },
  {
    name: 'playerProps',
    dataType: 'player_props',
    required: false,
    paginated: true,
    normalizedReturnType: 'NormalizedOddsSnapshot[]',
    queryFields: ['sportKey', 'leagueKey', 'eventId', 'marketKeys', 'dateFrom', 'dateTo', 'cursor', 'limit'],
    executionModes: ['fixture', 'dry_run'],
    retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
    unsupportedBehavior:
      'Return empty player props with warnings until exact markets, entitlement, persistence and settlement are approved.',
  },
]

const COVERAGE: SportsDataIoSportCoverage[] = [
  {
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    status: 'contract_ready',
    supportedDataTypes: [
      'schedules',
      'scores',
      'standings',
      'team_stats',
      'players',
      'player_stats',
      'injuries',
      'lineups',
      'odds',
      'historical_odds',
      'player_props',
    ],
    warnings: ['Contract only; live NBA calls are disabled.', 'Player props remain readiness-only until market entitlement and settlement are approved.'],
  },
  {
    sportKey: 'americanfootball_nfl',
    leagueKey: 'nfl',
    status: 'partial_contract',
    supportedDataTypes: ['schedules', 'scores', 'standings', 'team_stats', 'players', 'injuries', 'odds'],
    warnings: ['Lineup concepts differ by sport and require sport-specific normalization review.'],
  },
  {
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    status: 'partial_contract',
    supportedDataTypes: ['schedules', 'scores', 'standings', 'team_stats', 'players', 'injuries', 'odds'],
    warnings: ['Probable pitchers and lineups require a later sport-specific contract extension.'],
  },
  {
    sportKey: 'icehockey_nhl',
    leagueKey: 'nhl',
    status: 'partial_contract',
    supportedDataTypes: ['schedules', 'scores', 'standings', 'team_stats', 'players', 'injuries', 'odds'],
    warnings: ['Goalie-specific normalization belongs to a later NHL feature contract.'],
  },
  {
    sportKey: 'soccer',
    leagueKey: 'generic',
    status: 'unsupported',
    supportedDataTypes: [],
    warnings: ['SportsDataIO soccer coverage is not represented in this contract.'],
  },
]

const MAPPINGS: SportsDataIoMapping[] = [
  {
    sportsDataIoConcept: 'Game',
    normalizedModel: 'NormalizedEvent',
    keyFields: ['GameID', 'DateTimeUTC', 'HomeTeam', 'AwayTeam', 'Status'],
    notes: ['Map GameID into providerIds.sportsdataio.', 'Normalize DateTimeUTC into startTime.', 'Map provider status into EventStatus.'],
  },
  {
    sportsDataIoConcept: 'Team',
    normalizedModel: 'NormalizedParticipant',
    keyFields: ['TeamID', 'Key', 'City', 'Name'],
    notes: ['Use stable provider IDs and league-aware display names.'],
  },
  {
    sportsDataIoConcept: 'GameOdd',
    normalizedModel: 'NormalizedOddsSnapshot',
    keyFields: ['GameID', 'SportsBook', 'Market', 'Price', 'Point', 'Updated'],
    notes: ['Map h2h/spread/total style concepts into normalized market keys.', 'Preserve sportsbook and timestamp provenance.'],
  },
  {
    sportsDataIoConcept: 'Injury',
    normalizedModel: 'NormalizedInjury',
    keyFields: ['PlayerID', 'TeamID', 'Status', 'BodyPart', 'Updated'],
    notes: ['Unavailable injuries must return warnings, not fabricated statuses.'],
  },
  {
    sportsDataIoConcept: 'PlayerStat',
    normalizedModel: 'unknown',
    keyFields: ['Season', 'GameID', 'PlayerID', 'TeamID', 'StatID'],
    notes: [
      'Persist player season and game stat rows into sport_player_stats after exact endpoint paths are confirmed.',
      'Keep provider payload fields out of prediction engines; feature services consume normalized rows only.',
    ],
  },
  {
    sportsDataIoConcept: 'ProjectedLineup',
    normalizedModel: 'NormalizedLineup',
    keyFields: ['GameID', 'TeamID', 'PlayerID', 'Confirmed'],
    notes: ['Expected and confirmed lineups must be distinguished before prediction features consume them.'],
  },
  {
    sportsDataIoConcept: 'PlayerProp',
    normalizedModel: 'NormalizedOddsSnapshot',
    keyFields: ['GameID', 'PlayerID', 'SportsBook', 'Market', 'Line', 'OverPrice', 'UnderPrice', 'Updated'],
    notes: [
      'Persist only after exact prop market paths and entitlement are confirmed.',
      'Keep player prop rows out of production predictions until player-prop settlement and validation exist.',
    ],
  },
]

function capability(endpoint: ProviderAdapterEndpointContract): ProviderAdapterCapability {
  return {
    dataType: endpoint.dataType,
    supported: true,
    requiresAuth: true,
    paginated: endpoint.paginated,
    normalizedReturnType: endpoint.normalizedReturnType,
    warnings: ['SportsDataIO contract is not activated for live execution.'],
  }
}

function statusMap(status: string) {
  const normalized = status.toLowerCase()
  if (['final', 'f'].includes(normalized)) return 'completed'
  if (['inprogress', 'in progress', 'live'].includes(normalized)) return 'live'
  if (['postponed', 'delayed'].includes(normalized)) return 'postponed'
  if (['canceled', 'cancelled'].includes(normalized)) return 'cancelled'
  return 'scheduled'
}

function normalizeSportsDataIoGame(raw: Record<string, unknown>): NormalizedEvent {
  const gameId = String(raw.GameID ?? 'sportsdataio_fixture_game')
  const home = String(raw.HomeTeamName ?? raw.HomeTeam ?? 'Fixture Home')
  const away = String(raw.AwayTeamName ?? raw.AwayTeam ?? 'Fixture Away')

  return normalizeProviderEvent({
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    provider: 'sportsdataio',
    participantType: 'team',
    raw: {
      id: gameId,
      home_team: home,
      away_team: away,
      commence_time: raw.DateTimeUTC,
      status: statusMap(String(raw.Status ?? 'scheduled')),
      venue: raw.Stadium ?? raw.Arena,
    },
  })
}

function normalizeSportsDataIoOdds(raw: Record<string, unknown>): NormalizedOddsSnapshot[] {
  const eventId = String(raw.GameID ?? 'sportsdataio_fixture_game')
  const sportsbook = String(raw.SportsBook ?? 'Fixture SportsDataIO Book')
  const marketKey = String(raw.Market ?? 'h2h')
  const homeTeam = String(raw.HomeTeamName ?? raw.HomeTeam ?? 'Fixture Home')
  const awayTeam = String(raw.AwayTeamName ?? raw.AwayTeam ?? 'Fixture Away')

  return normalizeOddsSnapshots({
    sportKey: 'basketball_nba',
    eventId,
    provider: 'sportsdataio',
    bookmakers: [
      {
        title: sportsbook,
        last_update: raw.Updated,
        markets: [
          {
            key: marketKey,
            outcomes: [
              { name: homeTeam, price: raw.HomeMoneyLine, point: raw.HomePointSpread },
              { name: awayTeam, price: raw.AwayMoneyLine, point: raw.AwayPointSpread },
            ],
          },
        ],
      },
    ],
  })
}

export function getSportsDataIoAdapterContract() {
  const contract: ProviderAdapterContract = {
    id: 'sportsdataio-contract',
    version: 'provider_adapter_sdk_v1',
    displayName: 'SportsDataIO Adapter Contract',
    auth: {
      type: 'api_key',
      envVarNames: SPORTSDATAIO_ENV_NAMES,
      headerNames: ['Ocp-Apim-Subscription-Key', 'x-api-key'],
      requiredForLiveMode: true,
      notes: [
        'Environment variable names are placeholders only.',
        'No real SportsDataIO key is required for this contract.',
        'Live mode is disabled until credentials and quota caps are explicitly approved.',
      ],
    },
    capabilities: ENDPOINTS.map(capability),
    endpoints: ENDPOINTS,
    normalization: MAPPINGS.map((mapping) => ({
      input: 'provider_specific_payload',
      output:
        mapping.normalizedModel === 'NormalizedEvent'
          ? 'NormalizedEvent'
          : mapping.normalizedModel === 'NormalizedOddsSnapshot'
            ? 'NormalizedOddsSnapshot'
            : mapping.normalizedModel === 'NormalizedInjury'
              ? 'NormalizedInjury'
              : mapping.normalizedModel === 'NormalizedLineup'
                ? 'NormalizedLineup'
                : mapping.normalizedModel === 'NormalizedParticipant'
                  ? 'NormalizedParticipant'
                  : 'unknown',
      rule: `${mapping.sportsDataIoConcept}: ${mapping.notes.join(' ')}`,
    })),
    safety: {
      providerCallsInSdkValidation: 0,
      noSecretsInContract: true,
      normalizedModelsOnly: true,
      unsupportedDataReturnsWarnings: true,
    },
  }

  return {
    success: true,
    mode: 'sportsdataio_adapter_contract_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'contract_only_no_live_calls',
    },
    status: 'contract_ready',
    activation: {
      liveCallsEnabled: false,
      credentialsRequiredNow: false,
      requiredBeforeActivation: [
        'Explicit provider approval',
        'Credential configuration',
        'Quota cap',
        'Execution route review',
        'Fixture-to-live smoke test plan',
      ],
    },
    contract,
    coverage: COVERAGE,
    mappings: MAPPINGS,
  }
}

function issue(
  id: string,
  severity: ProviderAdapterValidationSeverity,
  message: string,
  recommendation: string
): ContractIssue {
  return { id, severity, message, recommendation }
}

export function runSportsDataIoContractValidation() {
  const game = normalizeSportsDataIoGame({
    GameID: 1001,
    DateTimeUTC: '2026-01-01T00:00:00Z',
    HomeTeam: 'BOS',
    HomeTeamName: 'Boston Celtics',
    AwayTeam: 'NY',
    AwayTeamName: 'New York Knicks',
    Status: 'Scheduled',
    Arena: 'Fixture Arena',
  })
  const odds = normalizeSportsDataIoOdds({
    GameID: 1001,
    SportsBook: 'Fixture Book',
    Market: 'h2h',
    HomeTeamName: 'Boston Celtics',
    AwayTeamName: 'New York Knicks',
    HomeMoneyLine: -120,
    AwayMoneyLine: 105,
    Updated: '2026-01-01T00:00:00Z',
  })
  const issues: ContractIssue[] = []

  if (!game.providerIds.sportsdataio) {
    issues.push(
      issue(
        'missing-event-provider-id',
        'error',
        'SportsDataIO game fixture did not normalize providerIds.sportsdataio.',
        'Map GameID into providerIds.sportsdataio before persistence.'
      )
    )
  }

  if (!game.homeParticipant || !game.awayParticipant) {
    issues.push(
      issue(
        'missing-participants',
        'error',
        'SportsDataIO game fixture did not normalize home and away participants.',
        'Map HomeTeam/HomeTeamName and AwayTeam/AwayTeamName into normalized participants.'
      )
    )
  }

  if (odds.length === 0) {
    issues.push(
      issue(
        'missing-odds',
        'error',
        'SportsDataIO odds fixture did not normalize into snapshots.',
        'Map GameOdd sportsbook, market, outcomes, prices and timestamp into NormalizedOddsSnapshot.'
      )
    )
  }

  for (const snapshot of odds) {
    if (snapshot.marketKey !== ('moneyline' as MarketKey)) {
      issues.push(
        issue(
          `unexpected-market-${snapshot.id}`,
          'warning',
          `Expected h2h fixture to normalize to moneyline, received ${snapshot.marketKey}.`,
          'Review SportsDataIO market key mapping before live activation.'
        )
      )
    }
  }

  const errors = issues.filter((item) => item.severity === 'error')
  const warnings = issues.filter((item) => item.severity === 'warning')

  return {
    success: errors.length === 0,
    mode: 'sportsdataio_adapter_contract_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_sportsdataio_fixtures_only',
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
      game,
      odds,
    },
  }
}

export function getSportsDataIoAdapterStatus() {
  const contract = getSportsDataIoAdapterContract()
  const validation = runSportsDataIoContractValidation()

  return {
    ...contract,
    validation,
    summary: {
      endpoints: contract.contract.endpoints.length,
      capabilities: contract.contract.capabilities.length,
      sportCoverage: contract.coverage.length,
      contractReadySports: contract.coverage.filter(
        (item) => item.status === 'contract_ready'
      ).length,
      partialSports: contract.coverage.filter(
        (item) => item.status === 'partial_contract'
      ).length,
      unsupportedSports: contract.coverage.filter(
        (item) => item.status === 'unsupported'
      ).length,
      validationErrors: validation.summary.errors,
      validationWarnings: validation.summary.warnings,
    },
  }
}
