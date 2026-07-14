import 'server-only'

import { getSportsDataIoRuntimeCapabilities } from '@/services/sportsdataio-runtime-adapter.service'

const NBA_SPORT_KEY = 'basketball_nba'
const NBA_LEAGUE_KEY = 'nba'
const PROVIDER = 'sportsdataio'
const IMPORT_MODULE = 'sportsdataio_nba_player_props_readiness_v1'

type ProviderEndpointReadiness = {
  feed: string
  exactPath: string | null
  status: 'blocked_pending_market_and_settlement_confirmation'
  requiredParameters: string[]
  providerCallsMade: 0
  warning: string
}

type PlayerPropFixtureRow = {
  id: string
  sport_key: typeof NBA_SPORT_KEY
  league_key: typeof NBA_LEAGUE_KEY
  season: string
  event_id: string | null
  player_id: string | null
  player_name: string | null
  team_id: string | null
  provider: typeof PROVIDER
  sportsbook: string
  market: string
  outcome: string
  price: number | null
  line: number | null
  snapshot_time: string
  provider_ids: Record<string, unknown>
  metadata: Record<string, unknown>
}

const ENDPOINTS: ProviderEndpointReadiness[] = [
  {
    feed: 'playerProps',
    exactPath: null,
    status: 'blocked_pending_market_and_settlement_confirmation',
    requiredParameters: ['date or event identifier', 'market key', 'sportsbook coverage'],
    providerCallsMade: 0,
    warning:
      'Exact authenticated SportsDataIO NBA player prop market endpoint paths are not present in repository contract metadata.',
  },
]

const FIXTURE = {
  GameID: 7001,
  PlayerID: 101,
  TeamID: 12,
  PlayerName: 'Fixture Guard',
  Season: 2026,
  SportsBook: 'Fixture Book',
  Market: 'Points',
  Line: 22.5,
  OverPrice: -110,
  UnderPrice: -115,
  Updated: '2026-01-02T00:00:00.000Z',
}

function generatedAt() {
  return new Date().toISOString()
}

function providerString(value: unknown) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function metadata(extra: Record<string, unknown>) {
  return {
    source: PROVIDER,
    importModule: IMPORT_MODULE,
    trial: true,
    scrambled: true,
    production_eligible: false,
    dataUse: 'provider_import_path_validation_only',
    predictionPersistenceEnabled: false,
    backtestingEnabled: false,
    modelTrainingEnabled: false,
    ...extra,
  }
}

function normalizePlayerPropFixture(raw: Record<string, unknown>): PlayerPropFixtureRow[] {
  const providerEventId = providerString(raw.GameID ?? raw.GameId)
  const providerPlayerId = providerString(raw.PlayerID ?? raw.PlayerId)
  const providerTeamId = providerString(raw.TeamID ?? raw.TeamId)
  const season = providerString(raw.Season) ?? '2026'
  const sportsbook = providerString(raw.SportsBook ?? raw.Book) ?? 'Unknown Sportsbook'
  const marketName = providerString(raw.Market ?? raw.PropMarket) ?? 'Unknown Prop'
  const propMarket = `player_props:${marketName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
  const snapshotTime = providerString(raw.Updated ?? raw.LastUpdated) ?? generatedAt()
  const eventId = providerEventId ? `${NBA_SPORT_KEY}:${NBA_LEAGUE_KEY}:sportsdataio:event:${providerEventId}` : null
  const playerId = providerPlayerId ? `${NBA_SPORT_KEY}:${NBA_LEAGUE_KEY}:sportsdataio:player:${providerPlayerId}` : null
  const teamId = providerTeamId ? `${NBA_SPORT_KEY}:${NBA_LEAGUE_KEY}:sportsdataio:team:${providerTeamId}` : null

  return [
    {
      id: `${NBA_SPORT_KEY}:${NBA_LEAGUE_KEY}:${PROVIDER}:player_props:${providerEventId}:${providerPlayerId}:${sportsbook}:${propMarket}:over:${snapshotTime}`,
      sport_key: NBA_SPORT_KEY,
      league_key: NBA_LEAGUE_KEY,
      season,
      event_id: eventId,
      player_id: playerId,
      player_name: providerString(raw.PlayerName ?? raw.Name),
      team_id: teamId,
      provider: PROVIDER,
      sportsbook,
      market: propMarket,
      outcome: 'over',
      price: numberValue(raw.OverPrice),
      line: numberValue(raw.Line),
      snapshot_time: snapshotTime,
      provider_ids: {
        sportsdataio: [providerEventId, providerPlayerId, sportsbook, propMarket, 'over'].filter(Boolean).join(':'),
        event: providerEventId,
        player: providerPlayerId,
        team: providerTeamId,
      },
      metadata: metadata({ propMarket: marketName, endpointConfirmed: false, normalizedAt: generatedAt() }),
    },
    {
      id: `${NBA_SPORT_KEY}:${NBA_LEAGUE_KEY}:${PROVIDER}:player_props:${providerEventId}:${providerPlayerId}:${sportsbook}:${propMarket}:under:${snapshotTime}`,
      sport_key: NBA_SPORT_KEY,
      league_key: NBA_LEAGUE_KEY,
      season,
      event_id: eventId,
      player_id: playerId,
      player_name: providerString(raw.PlayerName ?? raw.Name),
      team_id: teamId,
      provider: PROVIDER,
      sportsbook,
      market: propMarket,
      outcome: 'under',
      price: numberValue(raw.UnderPrice),
      line: numberValue(raw.Line),
      snapshot_time: snapshotTime,
      provider_ids: {
        sportsdataio: [providerEventId, providerPlayerId, sportsbook, propMarket, 'under'].filter(Boolean).join(':'),
        event: providerEventId,
        player: providerPlayerId,
        team: providerTeamId,
      },
      metadata: metadata({ propMarket: marketName, endpointConfirmed: false, normalizedAt: generatedAt() }),
    },
  ]
}

export function getSportsDataIoNbaPlayerPropsReadiness() {
  const capabilities = getSportsDataIoRuntimeCapabilities()
  const playerPropsDomain = capabilities.domains.find((domain) => domain.domain === 'player_props') ?? null
  const rows = normalizePlayerPropFixture(FIXTURE)
  const errors: string[] = []
  const warnings = ENDPOINTS.map((endpoint) => endpoint.warning)

  if (!playerPropsDomain) errors.push('SportsDataIO runtime capabilities do not expose player_props domain.')
  if (new Set(rows.map((row) => row.id)).size !== rows.length) errors.push('Player prop fixture IDs are not unique.')
  if (rows.some((row) => row.metadata.production_eligible !== false)) {
    errors.push('Player prop fixture rows must remain production_eligible=false.')
  }
  if (rows.some((row) => !row.event_id || !row.player_id || !row.team_id)) {
    errors.push('Player prop fixture rows must preserve provider event, player and team identifiers.')
  }
  if (rows.some((row) => row.market.startsWith('player_props:') === false)) {
    errors.push('Player prop fixture rows must keep player prop market metadata distinct from core odds.')
  }

  return {
    success: errors.length === 0,
    mode: 'sportsdataio_nba_player_props_readiness_v1',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_contract_and_fixture_validation_only',
    },
    status: 'blocked_pending_market_and_settlement_confirmation',
    endpoints: ENDPOINTS,
    migration: {
      required: false,
      created: null,
      appliedAutomatically: false,
      destinationTable: 'sports_odds_snapshots',
      rationale: 'Existing odds snapshot rows can represent prop outcomes with player/event metadata for future pilots.',
    },
    endpointPreflight: {
      noProviderCallsRequired: true,
      exactPathsConfirmed: false,
      entitlementConfirmed: false,
      sportsbookCoverageConfirmed: false,
      settlementRulesImplemented: false,
      requiredConfirmations: [
        'Exact authenticated SportsDataIO NBA player prop endpoint path or paths.',
        'Supported player prop market keys and provider market names.',
        'Sportsbook/bookmaker identifiers and coverage expectations.',
        'Player, team and event identifier fields for mapping into normalized tables.',
        'Line, price, over/under outcome and timestamp semantics.',
        'Settlement source fields and grading rules for every supported prop market.',
      ],
      cappedPilotRequirements: {
        maximumRequests: 1,
        concurrency: 1,
        automaticRetries: false,
        dryRunDefault: true,
        trial: true,
        scrambled: true,
        productionEligible: false,
        stopOnNon200: true,
      },
      goNoGoGates: [
        'Do not call SportsDataIO player prop endpoints until exact paths and entitlement are confirmed.',
        'Do not persist production-eligible prop rows from trial/scrambled responses.',
        'Do not enable prop predictions until settlement and validation rules are implemented.',
        'Do not use prop rows for backtesting, model training or confidence improvement while trial-only.',
        'Do not run parallel provider requests during the first capped player-props pilot.',
      ],
    },
    persistence: {
      destinationTables: ['sports_odds_snapshots', 'provider_entity_mappings', 'sports_sync_jobs'],
      naturalKeys: [
        'sport_key',
        'event_id',
        'provider_player_id',
        'sportsbook',
        'prop_market',
        'outcome',
        'snapshot_time',
      ],
      conflictTargets: ['sports_odds_snapshots.id', 'provider_entity_mappings unique provider tuple'],
      dependencyOrder: ['teams', 'events', 'players', 'player_stats optional for feature context', 'player_props'],
    },
    normalizedFixtures: {
      rows,
      counts: {
        providerRecordsFetched: 1,
        normalizedRowsProduced: rows.length,
        recordsSkipped: 0,
      },
    },
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
      checks: {
        exactEndpointPathsConfirmed: false,
        propSettlementImplemented: false,
        noProviderCalls: true,
        deterministicIds: rows.every((row) => Boolean(row.id)),
        overUnderOutcomesSeparated: new Set(rows.map((row) => row.outcome)).size === rows.length,
        eventPlayerTeamIdsPreserved: rows.every((row) => Boolean(row.event_id && row.player_id && row.team_id)),
        trialIsolationPreserved: rows.every(
          (row) =>
            row.metadata.trial === true &&
            row.metadata.scrambled === true &&
            row.metadata.production_eligible === false
        ),
        productionPredictionUseEnabled: false,
      },
    },
    confidenceIntegration: {
      trialDataMayValidateArchitecture: true,
      canImproveProductionConfidence: false,
      predictionPersistenceEnabled: false,
      backtestingEnabled: false,
      modelTrainingEnabled: false,
      settlementEnabled: false,
    },
    noSecretExposure: true,
  }
}
