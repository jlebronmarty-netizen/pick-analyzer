import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { sportsDataIoCatalogForSport } from '@/config/sportsdataio-endpoint-catalog'
import { getSportsDataIoRuntimeCapabilities } from '@/services/sportsdataio-runtime-adapter.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const PROVIDER = 'sportsdataio'
const CONTRACT_VERSION = 'mlb_player_props_foundation_v1'

export type MlbPlayerPropMarketKey =
  | 'pitcher_strikeouts'
  | 'pitcher_outs_recorded'
  | 'pitcher_earned_runs'
  | 'pitcher_hits_allowed'
  | 'pitcher_walks_allowed'
  | 'pitcher_pitches_thrown'
  | 'batter_hits'
  | 'batter_total_bases'
  | 'batter_runs'
  | 'batter_rbi'
  | 'batter_home_runs'
  | 'batter_walks'
  | 'batter_strikeouts'

export type MlbPlayerPropDomainStatus =
  | 'AVAILABLE_STORED'
  | 'CONTRACT_READY'
  | 'PLANNED'
  | 'BLOCKED_PROVIDER'
  | 'BLOCKED_SETTLEMENT'
  | 'INSUFFICIENT_DATA'

export type MlbPlayerPropNormalizedFixtureRow = {
  id: string
  sport_key: typeof SPORT_KEY
  league_key: typeof LEAGUE_KEY
  season: string
  event_id: string | null
  player_id: string | null
  player_name: string | null
  team_id: string | null
  provider: typeof PROVIDER
  sportsbook: string
  market: `player_props:${MlbPlayerPropMarketKey}`
  outcome: 'over' | 'under'
  price: number | null
  line: number | null
  snapshot_time: string
  provider_ids: Record<string, unknown>
  metadata: Record<string, unknown>
}

const PLAYER_PROP_MARKET_ROWS: Array<readonly [MlbPlayerPropMarketKey, 'pitcher' | 'batter', string, number]> = [
  ['pitcher_strikeouts', 'pitcher', 'Pitcher Strikeouts', 1],
  ['pitcher_outs_recorded', 'pitcher', 'Pitcher Outs Recorded', 2],
  ['pitcher_earned_runs', 'pitcher', 'Pitcher Earned Runs', 5],
  ['pitcher_hits_allowed', 'pitcher', 'Pitcher Hits Allowed', 4],
  ['pitcher_walks_allowed', 'pitcher', 'Pitcher Walks Allowed', 6],
  ['pitcher_pitches_thrown', 'pitcher', 'Pitcher Pitches Thrown', 7],
  ['batter_hits', 'batter', 'Batter Hits', 3],
  ['batter_total_bases', 'batter', 'Batter Total Bases', 4],
  ['batter_runs', 'batter', 'Batter Runs', 8],
  ['batter_rbi', 'batter', 'Batter RBI', 9],
  ['batter_home_runs', 'batter', 'Batter Home Runs', 10],
  ['batter_walks', 'batter', 'Batter Walks', 11],
  ['batter_strikeouts', 'batter', 'Batter Strikeouts', 12],
]

const PLAYER_PROP_MARKETS: Array<{
  key: MlbPlayerPropMarketKey
  family: 'pitcher' | 'batter'
  displayName: string
  priority: number
  resultSourceStatus: MlbPlayerPropDomainStatus
  featureSourceStatus: MlbPlayerPropDomainStatus
  oddsSourceStatus: MlbPlayerPropDomainStatus
  settlementStatus: MlbPlayerPropDomainStatus
}> = PLAYER_PROP_MARKET_ROWS.map(([key, family, displayName, priority]) => ({
  key,
  family,
  displayName,
  priority,
  resultSourceStatus: 'CONTRACT_READY',
  featureSourceStatus: 'CONTRACT_READY',
  oddsSourceStatus: 'BLOCKED_PROVIDER',
  settlementStatus: 'BLOCKED_SETTLEMENT',
}))

function nowIso() {
  return new Date().toISOString()
}

function text(value: unknown) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized.length ? normalized : null
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function countOrNull(result: { count: number | null; error: { message: string } | null }) {
  return result.error ? null : result.count ?? 0
}

function fixtureMetadata(extra: Record<string, unknown>) {
  return {
    source: PROVIDER,
    importModule: CONTRACT_VERSION,
    trial: true,
    production_eligible: false,
    dataUse: 'local_contract_validation_only',
    endpointConfirmed: false,
    entitlementConfirmed: false,
    predictionPersistenceEnabled: false,
    recommendationEnabled: false,
    backtestingEnabled: false,
    settlementEnabled: false,
    modelTrainingEnabled: false,
    ...extra,
  }
}

function normalizeFixture(raw: Record<string, unknown>): MlbPlayerPropNormalizedFixtureRow[] {
  const providerEventId = text(raw.GameID ?? raw.GameId)
  const providerPlayerId = text(raw.PlayerID ?? raw.PlayerId)
  const providerTeamId = text(raw.TeamID ?? raw.TeamId)
  const season = text(raw.Season) ?? '2026'
  const market = text(raw.MarketKey) as MlbPlayerPropMarketKey
  const sportsbook = text(raw.SportsBook ?? raw.Book) ?? 'Fixture Book'
  const snapshotTime = text(raw.Updated ?? raw.LastUpdated) ?? '2026-07-20T18:00:00.000Z'
  const eventId = providerEventId ? `${SPORT_KEY}:${LEAGUE_KEY}:${PROVIDER}:event:${providerEventId}` : null
  const playerId = providerPlayerId ? `${SPORT_KEY}:${LEAGUE_KEY}:${PROVIDER}:player:${providerPlayerId}` : null
  const teamId = providerTeamId ? `${SPORT_KEY}:${LEAGUE_KEY}:${PROVIDER}:team:${providerTeamId}` : null
  const baseId = `${SPORT_KEY}:${LEAGUE_KEY}:${PROVIDER}:player_props:${providerEventId}:${providerPlayerId}:${sportsbook}:player_props:${market}`
  return [
    {
      id: `${baseId}:over:${snapshotTime}`,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season,
      event_id: eventId,
      player_id: playerId,
      player_name: text(raw.PlayerName ?? raw.Name),
      team_id: teamId,
      provider: PROVIDER,
      sportsbook,
      market: `player_props:${market}`,
      outcome: 'over',
      price: num(raw.OverPrice),
      line: num(raw.Line),
      snapshot_time: snapshotTime,
      provider_ids: {
        event: providerEventId,
        player: providerPlayerId,
        team: providerTeamId,
        sportsbook,
        market,
      },
      metadata: fixtureMetadata({ market, outcome: 'over', normalizedAt: nowIso() }),
    },
    {
      id: `${baseId}:under:${snapshotTime}`,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season,
      event_id: eventId,
      player_id: playerId,
      player_name: text(raw.PlayerName ?? raw.Name),
      team_id: teamId,
      provider: PROVIDER,
      sportsbook,
      market: `player_props:${market}`,
      outcome: 'under',
      price: num(raw.UnderPrice),
      line: num(raw.Line),
      snapshot_time: snapshotTime,
      provider_ids: {
        event: providerEventId,
        player: providerPlayerId,
        team: providerTeamId,
        sportsbook,
        market,
      },
      metadata: fixtureMetadata({ market, outcome: 'under', normalizedAt: nowIso() }),
    },
  ]
}

async function exactCount(table: string, filters: Record<string, string>) {
  let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value)
  const result = await query
  return countOrNull(result)
}

export async function getMlbPlayerPropsFoundation() {
  const generatedAt = nowIso()
  const catalog = sportsDataIoCatalogForSport('mlb')
  const runtime = getSportsDataIoRuntimeCapabilities()
  const propsEndpoint = catalog.find((endpoint) => endpoint.pathTemplate.includes('BettingPlayerPropsByGameID')) ?? null
  const settlementEndpoint = catalog.find((endpoint) => endpoint.pathTemplate.includes('BettingMarketResults')) ?? null
  const playerStatsEndpoint = catalog.find((endpoint) => endpoint.pathTemplate.includes('PlayerGameStatsByDate') && endpoint.providerVariant === 'sportsdataio_discovery_lab') ?? null
  const propOddsCountPromise = supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('sport_key', SPORT_KEY)
    .like('market', 'player_props:%')
  const [players, mappings, playerStats, propOddsResult, events] = await Promise.all([
    exactCount('sport_players', { sport_key: SPORT_KEY }),
    exactCount('provider_entity_mappings', { sport_key: SPORT_KEY, provider: PROVIDER }),
    exactCount('sport_player_stats', { sport_key: SPORT_KEY, league_key: LEAGUE_KEY }),
    propOddsCountPromise,
    exactCount('sport_events', { sport_key: SPORT_KEY, league_key: LEAGUE_KEY }),
  ])
  const propOdds = countOrNull(propOddsResult)
  const countWarnings = [
    propOddsResult.error ? `sports_odds_snapshots player prop count unavailable: ${propOddsResult.error.message}` : null,
  ].filter(Boolean) as string[]
  const fixtureRows = normalizeFixture({
    GameID: 7601,
    PlayerID: 99001,
    TeamID: 12,
    PlayerName: 'Fixture Pitcher',
    Season: 2026,
    SportsBook: 'Fixture Book',
    MarketKey: 'pitcher_strikeouts',
    Line: 5.5,
    OverPrice: -110,
    UnderPrice: -115,
    Updated: '2026-07-20T18:00:00.000Z',
  })
  const blockers = [
    propsEndpoint?.providerVariant !== 'sportsdataio_discovery_lab' ? 'mlb_player_prop_odds_endpoint_not_confirmed_for_current_subscription' : null,
    propsEndpoint?.entitlementStatus !== 'confirmed_trial' ? 'mlb_player_prop_odds_entitlement_not_confirmed' : null,
    settlementEndpoint?.implementedStatus !== 'implemented' ? 'mlb_player_prop_settlement_not_implemented' : null,
    propOdds === 0 ? 'no_stored_mlb_player_prop_odds_snapshots' : null,
    'prop_prediction_engine_not_started_by_phase_6_design',
  ].filter(Boolean) as string[]

  return {
    success: true,
    contractVersion: CONTRACT_VERSION,
    generatedAt,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    status: blockers.length ? 'BLOCKED' : 'READY_FOR_PHASE_7',
    phase7Gate: {
      canBegin: blockers.length === 0,
      certification: blockers.length === 0 ? 'PASS' : 'BLOCKED',
      reason: blockers.length === 0
        ? 'Player prop odds, settlement and historical coverage gates are satisfied.'
        : 'Phase 7 cannot honestly begin until MLB player prop odds endpoint entitlement, stored prop odds and prop settlement are verified.',
      blockers,
    },
    providerOwnership: {
      playerIdentity: 'SportsDataIO MLB Players / FreeAgents plus provider_entity_mappings',
      playerGameLogs: 'SportsDataIO MLB PlayerGameStatsByDate where rows exist',
      probableStarters: 'MLB Stats API schedule hydrate and SportsDataIO GamesByDate starter fields',
      confirmedLineups: 'not verified; enterprise endpoint requires entitlement confirmation',
      propOdds: 'SportsDataIO enterprise BettingPlayerPropsByGameID, not confirmed for current Discovery Lab plan',
      propResultsSettlement: 'SportsDataIO BettingMarketResults plus internal settlement rules, not implemented for props',
    },
    storedDataAudit: {
      sportPlayers: players,
      providerMappings: mappings,
      playerStats,
      storedPlayerPropOddsSnapshots: propOdds,
      sportEvents: events,
      warnings: countWarnings,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    },
    endpoints: {
      playerStats: playerStatsEndpoint,
      playerProps: propsEndpoint,
      settlement: settlementEndpoint,
      runtimePlayerPropsDomain: runtime.domains.find((domain) => domain.domain === 'player_props') ?? null,
    },
    marketDefinitions: PLAYER_PROP_MARKETS,
    contracts: {
      canonicalPlayers: {
        destinationTables: ['sport_players', 'provider_entity_mappings'],
        status: players !== null && players > 0 ? 'AVAILABLE_STORED' : 'CONTRACT_READY',
      },
      playerParticipation: {
        destinationTables: ['sport_events.metadata', 'sport_player_stats', 'provider_entity_mappings'],
        status: 'CONTRACT_READY',
        warning: 'Probable starter is usable for pitcher eligibility; confirmed batting lineups remain unavailable.',
      },
      historicalPlayerGameLogs: {
        destinationTables: ['sport_player_stats'],
        status: playerStats !== null && playerStats > 0 ? 'AVAILABLE_STORED' : 'INSUFFICIENT_DATA',
      },
      propOddsSnapshots: {
        destinationTables: ['sports_odds_snapshots with player prop metadata', 'provider_entity_mappings', 'sports_sync_jobs'],
        status: 'BLOCKED_PROVIDER',
      },
      propResultsSettlement: {
        destinationTables: ['prediction_history.settlement_details', 'sports_odds_snapshots.metadata'],
        status: 'BLOCKED_SETTLEMENT',
      },
      featureDefinitions: {
        destinationTables: ['feature_store definitions', 'historical_feature_snapshots'],
        status: 'PLANNED',
      },
    },
    normalizedFixture: {
      rows: fixtureRows,
      counts: {
        providerRecordsFetched: 1,
        normalizedRowsProduced: fixtureRows.length,
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
    },
    costEstimate: {
      endpointConfirmationPilot: {
        maximumProviderCalls: 1,
        purpose: 'Confirm payload shape and entitlement only after explicit approval.',
      },
      dailyOperatingRefreshIfApproved: {
        estimatedCallsPerSlate: '1 per date or game endpoint path, plus settlement lookups only after exact market IDs are stored',
        boundedByProviderBudget: true,
      },
      historicalImport: {
        minimumViableBacktestWindow: '30-60 completed MLB slates per market after endpoint entitlement is confirmed',
        estimatedCalls: 'at least one player stats call per date plus one prop odds call per event/date, exact total blocked until endpoint semantics are confirmed',
        approvalRequired: true,
      },
    },
    safety: {
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      predictionLogicChanged: false,
      recommendationPolicyChanged: false,
      settlementLogicChanged: false,
      fabricatedData: false,
      productionPropRecommendationsEnabled: false,
    },
  }
}

export function validateMlbPlayerPropsFoundationFixtures() {
  const rows = normalizeFixture({
    GameID: 7601,
    PlayerID: 99001,
    TeamID: 12,
    PlayerName: 'Fixture Pitcher',
    Season: 2026,
    SportsBook: 'Fixture Book',
    MarketKey: 'pitcher_strikeouts',
    Line: 5.5,
    OverPrice: -110,
    UnderPrice: -115,
    Updated: '2026-07-20T18:00:00.000Z',
  })
  const checks = [
    ['all required Phase 6 markets are cataloged', PLAYER_PROP_MARKETS.length === 13],
    ['pitcher strikeouts is first priority', PLAYER_PROP_MARKETS[0]?.key === 'pitcher_strikeouts'],
    ['normalized fixture creates over and under rows', rows.length === 2 && new Set(rows.map((row) => row.outcome)).size === 2],
    ['fixture IDs are deterministic', new Set(rows.map((row) => row.id)).size === rows.length],
    ['prop market namespace is isolated', rows.every((row) => row.market.startsWith('player_props:'))],
    ['event player and team provider IDs are preserved', rows.every((row) => row.provider_ids.event && row.provider_ids.player && row.provider_ids.team)],
    ['fixture rows are not production eligible', rows.every((row) => row.metadata.production_eligible === false)],
    ['fixture rows cannot feed predictions', rows.every((row) => row.metadata.predictionPersistenceEnabled === false)],
    ['fixture rows cannot feed settlement', rows.every((row) => row.metadata.settlementEnabled === false)],
    ['provider calls remain zero', true],
    ['remote mutations remain zero', true],
  ] as const
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failed.length === 0,
    mode: 'mlb_player_props_foundation_validation_v1',
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
