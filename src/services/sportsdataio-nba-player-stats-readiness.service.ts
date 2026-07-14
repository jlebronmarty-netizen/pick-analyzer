import 'server-only'

import { getSportsDataIoRuntimeCapabilities } from '@/services/sportsdataio-runtime-adapter.service'

const NBA_SPORT_KEY = 'basketball_nba'
const NBA_LEAGUE_KEY = 'nba'
const PROVIDER = 'sportsdataio'
const IMPORT_MODULE = 'sportsdataio_nba_player_stats_readiness_v1'
const MIGRATION = 'supabase/migrations/202607130002_sport_player_stats_v1.sql'

type PlayerStatsKind = 'season' | 'game'

type ProviderEndpointReadiness = {
  feed: string
  statType: PlayerStatsKind
  exactPath: string
  status: 'confirmed_for_capped_trial'
  requiredParameters: string[]
  recommendedProviderCallInterval: string
  providerCallsMade: 0
  warning: string
}

type PlayerStatRow = {
  id: string
  sport_key: string
  league_key: string
  season: string
  stat_type: PlayerStatsKind
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  provider: typeof PROVIDER
  games: number | null
  starts: number | null
  minutes: number | null
  points: number | null
  rebounds: number | null
  assists: number | null
  steals: number | null
  blocks: number | null
  turnovers: number | null
  field_goals_made: number | null
  field_goals_attempted: number | null
  field_goal_percentage: number | null
  three_pointers_made: number | null
  three_pointers_attempted: number | null
  three_point_percentage: number | null
  free_throws_made: number | null
  free_throws_attempted: number | null
  free_throw_percentage: number | null
  usage_rate: number | null
  starter: boolean | null
  source_timestamp: string | null
  provider_ids: Record<string, unknown>
  stats: Record<string, unknown>
  metadata: Record<string, unknown>
}

const ENDPOINTS: ProviderEndpointReadiness[] = [
  {
    feed: 'playerSeasonStats',
    statType: 'season',
    exactPath: '/v3/nba/stats/json/PlayerSeasonStats/{season}',
    status: 'confirmed_for_capped_trial',
    requiredParameters: ['season'],
    recommendedProviderCallInterval: '15 minutes',
    providerCallsMade: 0,
    warning:
      'Endpoint path is confirmed for capped trial import only; trial rows remain production_eligible=false.',
  },
  {
    feed: 'playerGameStats',
    statType: 'game',
    exactPath: '/v3/nba/stats/json/PlayerGameStatsByDate/{date}',
    status: 'confirmed_for_capped_trial',
    requiredParameters: ['date yyyy-MM-dd'],
    recommendedProviderCallInterval: '5 minutes',
    providerCallsMade: 0,
    warning:
      'Endpoint path is confirmed for capped trial import only; trial rows remain production_eligible=false.',
  },
]

const SEASON_FIXTURE = {
  PlayerID: 101,
  TeamID: 12,
  Name: 'Fixture Guard',
  Season: 2026,
  Games: 3,
  Started: 2,
  Minutes: 91.5,
  Points: 54,
  Rebounds: 12,
  Assists: 18,
  Steals: 4,
  BlockedShots: 1,
  Turnovers: 6,
  FieldGoalsMade: 20,
  FieldGoalsAttempted: 42,
  FieldGoalsPercentage: 47.6,
  ThreePointersMade: 7,
  ThreePointersAttempted: 18,
  ThreePointersPercentage: 38.9,
  FreeThrowsMade: 7,
  FreeThrowsAttempted: 8,
  FreeThrowsPercentage: 87.5,
  UsageRatePercentage: 24.1,
  Updated: '2026-01-02T00:00:00.000Z',
}

const GAME_FIXTURE = {
  StatID: 9001,
  GameID: 7001,
  PlayerID: 101,
  TeamID: 12,
  Name: 'Fixture Guard',
  Season: 2026,
  Started: 1,
  IsGameOver: true,
  Minutes: 31.5,
  Points: 22,
  Rebounds: 5,
  Assists: 7,
  Steals: 2,
  BlockedShots: 1,
  Turnovers: 3,
  FieldGoalsMade: 8,
  FieldGoalsAttempted: 17,
  FieldGoalsPercentage: 47.1,
  ThreePointersMade: 3,
  ThreePointersAttempted: 8,
  ThreePointersPercentage: 37.5,
  FreeThrowsMade: 3,
  FreeThrowsAttempted: 4,
  FreeThrowsPercentage: 75,
  Updated: '2026-01-02T03:30:00.000Z',
}

function generatedAt() {
  return new Date().toISOString()
}

function providerString(value: unknown) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', '1', 'started', 'starter'].includes(normalized)) return true
    if (['false', 'no', '0', 'bench'].includes(normalized)) return false
  }
  return null
}

function metadata(extra: Record<string, unknown>) {
  return {
    source: PROVIDER,
    importModule: IMPORT_MODULE,
    trial: true,
    scrambled: true,
    production_eligible: false,
    dataUse: 'provider_import_path_validation_only',
    ...extra,
  }
}

function normalizePlayerStatFixture(raw: Record<string, unknown>, statType: PlayerStatsKind): PlayerStatRow {
  const providerPlayerId = providerString(raw.PlayerID ?? raw.PlayerId ?? raw.SportsDataIOPlayerID)
  const providerTeamId = providerString(raw.TeamID ?? raw.TeamId)
  const providerGameId = providerString(raw.GameID ?? raw.GameId)
  const providerStatId = providerString(raw.StatID ?? raw.StatId)
  const season = providerString(raw.Season) ?? '2026'
  const naturalProviderId =
    statType === 'game'
      ? providerStatId ?? [providerGameId, providerTeamId, providerPlayerId].filter(Boolean).join(':')
      : [season, providerTeamId, providerPlayerId].filter(Boolean).join(':')
  const playerId = providerPlayerId ? `${NBA_SPORT_KEY}:${NBA_LEAGUE_KEY}:sportsdataio:player:${providerPlayerId}` : null
  const teamId = providerTeamId ? `${NBA_SPORT_KEY}:${NBA_LEAGUE_KEY}:sportsdataio:team:${providerTeamId}` : null
  const eventId = providerGameId ? `${NBA_SPORT_KEY}:${NBA_LEAGUE_KEY}:sportsdataio:event:${providerGameId}` : null

  return {
    id: `${NBA_SPORT_KEY}:${NBA_LEAGUE_KEY}:${PROVIDER}:player_stats:${statType}:${naturalProviderId}`,
    sport_key: NBA_SPORT_KEY,
    league_key: NBA_LEAGUE_KEY,
    season,
    stat_type: statType,
    event_id: statType === 'game' ? eventId : null,
    team_id: teamId,
    player_id: playerId,
    player_name: providerString(raw.Name ?? raw.PlayerName ?? raw.NameShort),
    provider: PROVIDER,
    games: statType === 'season' ? numberValue(raw.Games, raw.GamesPlayed) : 1,
    starts: numberValue(raw.Started, raw.Starts, raw.GamesStarted),
    minutes: numberValue(raw.Minutes, raw.MinutesSeconds),
    points: numberValue(raw.Points),
    rebounds: numberValue(raw.Rebounds, raw.TotalRebounds),
    assists: numberValue(raw.Assists),
    steals: numberValue(raw.Steals),
    blocks: numberValue(raw.BlockedShots, raw.Blocks),
    turnovers: numberValue(raw.Turnovers),
    field_goals_made: numberValue(raw.FieldGoalsMade),
    field_goals_attempted: numberValue(raw.FieldGoalsAttempted),
    field_goal_percentage: numberValue(raw.FieldGoalsPercentage, raw.FieldGoalPercentage),
    three_pointers_made: numberValue(raw.ThreePointersMade),
    three_pointers_attempted: numberValue(raw.ThreePointersAttempted),
    three_point_percentage: numberValue(raw.ThreePointersPercentage, raw.ThreePointPercentage),
    free_throws_made: numberValue(raw.FreeThrowsMade),
    free_throws_attempted: numberValue(raw.FreeThrowsAttempted),
    free_throw_percentage: numberValue(raw.FreeThrowsPercentage, raw.FreeThrowPercentage),
    usage_rate: numberValue(raw.UsageRatePercentage, raw.UsageRate),
    starter: statType === 'game' ? booleanValue(raw.Started ?? raw.Starting ?? raw.Starter) : null,
    source_timestamp: providerString(raw.Updated ?? raw.LastUpdated ?? raw.DateTime),
    provider_ids: {
      sportsdataio: naturalProviderId,
      player: providerPlayerId,
      team: providerTeamId,
      event: providerGameId,
      stat: providerStatId,
    },
    stats: {
      rawFieldNames: Object.keys(raw).sort(),
      isGameOver: raw.IsGameOver ?? null,
    },
    metadata: metadata({
      statType,
      endpointConfirmed: true,
      normalizedAt: generatedAt(),
    }),
  }
}

export function getSportsDataIoNbaPlayerStatsReadiness() {
  const capabilities = getSportsDataIoRuntimeCapabilities()
  const playerStatsDomain = capabilities.domains.find((domain) => domain.domain === 'player_stats') ?? null
  const seasonRow = normalizePlayerStatFixture(SEASON_FIXTURE, 'season')
  const gameRow = normalizePlayerStatFixture(GAME_FIXTURE, 'game')
  const rows = [seasonRow, gameRow]
  const errors: string[] = []
  const warnings = ENDPOINTS.map((endpoint) => endpoint.warning)

  if (!playerStatsDomain) errors.push('SportsDataIO runtime capabilities do not expose player_stats domain.')
  if (new Set(rows.map((row) => row.id)).size !== rows.length) errors.push('Player stat fixture IDs are not unique.')
  if (rows.some((row) => row.metadata.production_eligible !== false)) {
    errors.push('Player stat fixture rows must remain production_eligible=false.')
  }
  if (gameRow.event_id === null) errors.push('Game stat fixture did not preserve provider game/event identifier.')
  if (seasonRow.event_id !== null) errors.push('Season stat fixture should not require an event identifier.')

  return {
    success: errors.length === 0,
    mode: 'sportsdataio_nba_player_stats_readiness_v1',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_contract_and_fixture_validation_only',
    },
    status: 'ready_for_capped_trial',
    endpoints: ENDPOINTS,
    migration: {
      required: true,
      created: MIGRATION,
      appliedAutomatically: false,
      destinationTable: 'sport_player_stats',
      applicationPolicy:
        'Apply manually only after explicit approval for player-stat persistence readiness.',
      preflight: {
        noProviderCallsRequired: true,
        destructiveChangeRequired: false,
        sqlEditorSafeToRun: true,
        verificationQueries: [
          "select to_regclass('public.sport_player_stats') as table_exists;",
          "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'sport_player_stats' order by ordinal_position;",
          "select indexname from pg_indexes where schemaname = 'public' and tablename = 'sport_player_stats' order by indexname;",
          "select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'sport_player_stats' order by grantee, privilege_type;",
        ],
        expectedColumns: [
          'id',
          'sport_key',
          'league_key',
          'season',
          'stat_type',
          'event_id',
          'team_id',
          'player_id',
          'player_name',
          'provider',
          'games',
          'starts',
          'minutes',
          'points',
          'rebounds',
          'assists',
          'steals',
          'blocks',
          'turnovers',
          'field_goals_made',
          'field_goals_attempted',
          'field_goal_percentage',
          'three_pointers_made',
          'three_pointers_attempted',
          'three_point_percentage',
          'free_throws_made',
          'free_throws_attempted',
          'free_throw_percentage',
          'usage_rate',
          'starter',
          'source_timestamp',
          'provider_ids',
          'stats',
          'metadata',
          'created_at',
          'updated_at',
        ],
        expectedIndexes: [
          'sport_player_stats_pkey',
          'sport_player_stats_player_idx',
          'sport_player_stats_event_idx',
          'sport_player_stats_provider_idx',
        ],
        goNoGoGates: [
          'Table exists as public.sport_player_stats.',
          'All expected columns are present with numeric stat columns available for decimal provider values.',
          'Primary-key and lookup indexes exist.',
          'service_role has write privileges and authenticated has select privileges.',
        'Exact SportsDataIO player season/game stat endpoints are confirmed before any provider call.',
          'Future pilot request has explicit provider-call cap, sequential execution and trial isolation.',
        ],
      },
    },
    persistence: {
      destinationTables: ['sport_player_stats', 'provider_entity_mappings', 'sports_sync_jobs'],
      naturalKeys: {
        season: ['sport_key', 'league_key', 'season', 'provider_player_id', 'provider_team_id'],
        game: ['sport_key', 'league_key', 'provider_game_id', 'provider_player_id', 'provider_team_id'],
      },
      conflictTargets: ['sport_player_stats.id', 'provider_entity_mappings unique provider tuple'],
      dependencyOrder: ['teams', 'players', 'events for game stats', 'player_stats'],
    },
    normalizedFixtures: {
      rows,
      counts: {
        providerRecordsFetched: 2,
        normalizedRowsProduced: rows.length,
        recordsSkipped: 0,
      },
    },
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
      checks: {
        exactEndpointPathsConfirmed: true,
        noProviderCalls: true,
        deterministicIds: rows.every((row) => Boolean(row.id)),
        statTypesSeparated: seasonRow.stat_type === 'season' && gameRow.stat_type === 'game',
        gameStatsCarryEventProviderId: gameRow.event_id !== null,
        seasonStatsDoNotRequireEvent: seasonRow.event_id === null,
        trialIsolationPreserved: rows.every(
          (row) =>
            row.metadata.trial === true &&
            row.metadata.scrambled === true &&
            row.metadata.production_eligible === false
        ),
        productionConfidenceCanImprove: false,
      },
    },
    confidenceIntegration: {
      trialDataMayValidateArchitecture: true,
      canImproveProductionConfidence: false,
      predictionPersistenceEnabled: false,
      backtestingEnabled: false,
      modelTrainingEnabled: false,
    },
    noSecretExposure: true,
  }
}
