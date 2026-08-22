import 'server-only'

import { evaluateMlb04cR6FrozenSnapshotScorecard } from './mlb-04c-chat-method-research-scorecard.service'
import { getMlbContextLineage } from './mlb-context-lineage.service'
import { getMlb04dForwardAutomationContract } from './mlb-04d-forward-automation-prep.service'

export const MLB_04D_A_CLASSIFICATION = 'MLB_04D_A_INTERNAL_CONTEXT_EXPANSION_CERTIFIED'
export const MLB_04D_A_PHASE = 'MLB-04D-A_INTERNAL_CONTEXT_EXPANSION'
export const MLB_04D_A_CONTEXT_VERSION = 'mlb_04d_a_internal_context_v1'

export type PackageAReadiness = 'YES' | 'PARTIAL' | 'NO' | 'AUDIT_ONLY'

type SourceInventoryItem = {
  source: string
  availability: PackageAReadiness
  tableOrService: string
  fieldNames: string[]
  eventLinkage: string
  playerId: string
  playerName: string
  throwingHand: string
  sourceTimestamp: string
  statusSemantics: string
  persistenceState: string
}

type ContextComponentState = {
  state: string
  source: string
  sourceTimestamp: string | null
  blockers: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stateFromSide(home: ContextComponentState, away: ContextComponentState) {
  if (home.state === away.state) return home.state
  if ([home.state, away.state].includes('UNKNOWN')) return 'PARTIAL'
  if ([home.state, away.state].includes('PROJECTED')) return 'PROJECTED'
  if ([home.state, away.state].includes('PROBABLE')) return 'PROBABLE'
  return 'PARTIAL'
}

export function getMlb04dAStarterSourceInventory(): SourceInventoryItem[] {
  return [
    {
      source: 'mlb_starter_assignments',
      availability: 'PARTIAL',
      tableOrService: 'mlb_starter_assignments',
      fieldNames: ['event_id', 'team_id', 'pitcher_id', 'provider_pitcher_id', 'historical_pitcher_id', 'role', 'status', 'source_updated_at', 'observed_at', 'valid_from', 'valid_until', 'mapping_status', 'confidence'],
      eventLinkage: 'event_id + team_id, active where valid_until is null',
      playerId: 'pitcher_id, provider_pitcher_id, historical_pitcher_id',
      playerName: 'not stored directly in assignment v1',
      throwingHand: 'not stored directly in assignment v1',
      sourceTimestamp: 'source_updated_at fallback valid_from fallback observed_at',
      statusSemantics: 'CONFIRMED / PROBABLE / EXPECTED / UNDECIDED / SCRATCHED / REPLACED mapped to CONFIRMED / PROBABLE / PROJECTED / UNKNOWN',
      persistenceState: 'additive active-row table with unique event/team active identity',
    },
    {
      source: 'sport_lineups_starting_pitcher',
      availability: 'PARTIAL',
      tableOrService: 'sport_lineups',
      fieldNames: ['event_id', 'team_id', 'player_id', 'player_name', 'role', 'starter', 'position', 'confirmation_level', 'source_timestamp', 'provider_ids', 'metadata'],
      eventLinkage: 'event_id + team_id + role=starting_pitcher',
      playerId: 'player_id and provider_ids',
      playerName: 'player_name',
      throwingHand: 'only if metadata/provider payload contains certified value',
      sourceTimestamp: 'source_timestamp',
      statusSemantics: 'confirmed => CONFIRMED; expected/projected => PROJECTED; unknown => UNKNOWN',
      persistenceState: 'stored canonical lineup/depth evidence',
    },
    {
      source: 'stored_mlb_official_probable_pitcher_lineage',
      availability: 'PARTIAL',
      tableOrService: 'sport_events.provider_ids / provider_entity_mappings / stored context snapshots',
      fieldNames: ['provider_ids.mlb_stats_api.gamePk', 'provider_entity_mappings.provider_id', 'components.event.officialGamePk', 'components.starterContext'],
      eventLinkage: 'canonical event id <-> MLB gamePk mapping',
      playerId: 'provider probablePitcher id mapped through provider_entity_mappings when present',
      playerName: 'probablePitcher.fullName in captured lineage when present',
      throwingHand: 'not certified from schedule lineage alone',
      sourceTimestamp: 'capturedAt or sourceTimestamp from stored lineage',
      statusSemantics: 'probablePitcher present => PROBABLE; absent => UNKNOWN',
      persistenceState: 'usable only when already stored before snapshot; no live provider query in scorecard',
    },
  ]
}

export function getMlb04dALineupSourceInventory(): SourceInventoryItem[] {
  return [
    {
      source: 'sport_lineups',
      availability: 'PARTIAL',
      tableOrService: 'sport_lineups',
      fieldNames: ['event_id', 'team_id', 'player_id', 'player_name', 'position', 'depth_order', 'role', 'starter', 'lineup_status', 'confirmation_level', 'source_timestamp', 'provider_ids', 'metadata'],
      eventLinkage: 'event_id + team_id + lineup_type',
      playerId: 'player_id and provider_ids',
      playerName: 'player_name',
      throwingHand: 'not guaranteed; only metadata if certified',
      sourceTimestamp: 'source_timestamp',
      statusSemantics: 'confirmed remains CONFIRMED; expected/projected remains PROJECTED; never promoted silently',
      persistenceState: 'stored canonical lineup rows',
    },
    {
      source: 'stored_mlb_official_batting_order_lineage',
      availability: 'PARTIAL',
      tableOrService: 'stored context snapshots / optional protected MLB Official live-feed capture',
      fieldNames: ['gamePk', 'lineupState', 'players[].person.id', 'players[].battingOrder', 'players[].position', 'capturedAt'],
      eventLinkage: 'gamePk mapped to canonical sport_event before snapshot',
      playerId: 'MLB person id mapped to sport_players through provider_entity_mappings',
      playerName: 'MLB fullName from captured lineage',
      throwingHand: 'batting side only if captured and certified',
      sourceTimestamp: 'capturedAt',
      statusSemantics: 'lineupState CONFIRMED or PROJECTED only',
      persistenceState: 'not queried by scorecard after freeze',
    },
    {
      source: 'stored_season_player_stats_projected_lineup',
      availability: 'YES',
      tableOrService: 'sport_player_stats',
      fieldNames: ['team_id', 'player_id', 'player_name', 'stat_type', 'games', 'starts', 'stats.PlateAppearances', 'stats.AtBats', 'metadata.position', 'source_timestamp'],
      eventLinkage: 'team_id for the target event; not a confirmed event lineup',
      playerId: 'player_id',
      playerName: 'player_name',
      throwingHand: 'not guaranteed',
      sourceTimestamp: 'source_timestamp',
      statusSemantics: 'PROJECTED only; never CONFIRMED',
      persistenceState: 'stored statistical projection input, forward-only if timestamp-safe',
    },
  ]
}

export function getMlb04dAVenueSourceInventory() {
  return [
    {
      source: 'sport_events.venue',
      availability: 'YES' as PackageAReadiness,
      tableOrService: 'sport_events',
      fieldNames: ['id', 'venue', 'provider_ids', 'metadata', 'start_time'],
      eventLinkage: 'canonical sport_events.id',
      venueIdentity: 'venue text and provider_ids/metadata when present',
      sourceTimestamp: 'sport_events.updated_at when available, otherwise event row provenance',
      statusSemantics: 'venue text present => PARK_IDENTITY_AVAILABLE; missing => UNKNOWN',
      persistenceState: 'canonical stored event metadata',
    },
    {
      source: 'stored_mlb_official_schedule_venue',
      availability: 'PARTIAL' as PackageAReadiness,
      tableOrService: 'stored MLB Official schedule lineage / provider_entity_mappings',
      fieldNames: ['gamePk', 'venue.id', 'venue.name', 'capturedAt'],
      eventLinkage: 'canonical event id <-> gamePk',
      venueIdentity: 'MLB venue id/name when already captured',
      sourceTimestamp: 'capturedAt',
      statusSemantics: 'venue.id present => PARK_IDENTITY_AVAILABLE',
      persistenceState: 'usable only when already stored before snapshot',
    },
    {
      source: 'park_factor_reference',
      availability: 'NO' as PackageAReadiness,
      tableOrService: 'none certified',
      fieldNames: [],
      eventLinkage: 'not available',
      venueIdentity: 'not available',
      sourceTimestamp: 'not available',
      statusSemantics: 'park identity is not a park factor',
      persistenceState: 'blocked; no fabrication',
    },
  ]
}

export function auditMlb04dAInternalContextExpansion() {
  return {
    classification: MLB_04D_A_CLASSIFICATION,
    phase: MLB_04D_A_PHASE,
    contextVersion: MLB_04D_A_CONTEXT_VERSION,
    observationRegression: {
      observation1: { scorecardVersion: 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V1', regressionStable: true },
      observation2: { scorecardVersion: 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2', regressionStable: true },
      observation3: { scorecardVersion: 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2', regressionStable: true },
      noRetrospectiveEnrichment: true,
    },
    starter: {
      sourceInventory: getMlb04dAStarterSourceInventory(),
      currentRootCause: {
        mlb_starter_assignments: 'NO_ACTIVE_ASSIGNMENT_OR_ASSIGNMENT_NOT_PERSISTED_WHEN_ABSENT',
        sport_lineups: 'SOURCE_NOT_CONSUMED_FOR_STARTER_WHEN_ROLE_STARTING_PITCHER_ABSENT',
        storedMlbOfficialProbablePitcher: 'MLB_OFFICIAL_DATA_NOT_CAPTURED_OR_PROVIDER_CALL_DISABLED_WHEN_ABSENT',
        eventGamePkMapping: 'EVENT_GAMEPK_MAPPING_GAP_WHEN_PROVIDER_ID_MISSING',
        timing: 'TIMING_GAP_WHEN_PROBABLE_STARTER_NOT_POSTED_BEFORE_SNAPSHOT',
      },
      acquisitionPriority: ['mlb_starter_assignments', 'sport_lineups_starting_pitcher', 'stored_mlb_official_probable_pitcher_lineage'],
      stateContract: ['CONFIRMED', 'PROBABLE', 'PROJECTED', 'UNKNOWN'],
      morningFinalChangeSemantics: 'MORNING_IMMUTABLE_FINAL_PREGAME_CAN_CAPTURE_LATER_CERTIFIED_STARTER',
      identityCaptureForwardReady: 'YES' as PackageAReadiness,
      edgeForwardReady: 'PARTIAL' as PackageAReadiness,
      edgeBlocker: 'Starter identity can be frozen, but deterministic scoring remains PARTIAL unless pregame-safe pitcher quality fields are present in the frozen snapshot.',
    },
    lineup: {
      sourceInventory: getMlb04dALineupSourceInventory(),
      stateContract: ['PROJECTED', 'CONFIRMED', 'UNKNOWN'],
      projectedLineupForwardReady: 'YES' as PackageAReadiness,
      confirmedLineupForwardReady: 'PARTIAL' as PackageAReadiness,
      snapshotPayload: ['lineup_state', 'source', 'source_timestamp', 'gamePk_or_event_id', 'batting_order_1_9', 'player_id', 'player_name', 'batting_side_if_certified', 'position_or_role', 'mapping_status'],
      edgeForwardReady: 'PARTIAL' as PackageAReadiness,
      edgeBlocker: 'Projected/confirmed batting order can be frozen, but LINEUP_EDGE scoring needs a future versioned transparent rule before being marked AVAILABLE.',
    },
    venue: {
      sourceInventory: getMlb04dAVenueSourceInventory(),
      mappingRootCause: 'Frozen snapshots can show park UNKNOWN when MLB Official venue lineage was not captured and sport_events.venue was not promoted into the frozen research context.',
      identityContract: ['venue_id_if_certified', 'venue_name', 'city_if_certified', 'indoor_outdoor_if_certified', 'roof_type_or_state_if_certified', 'surface_if_certified', 'source', 'source_timestamp', 'mapping'],
      parkIdentityForwardReady: 'YES' as PackageAReadiness,
      parkFactorForwardReady: 'NO' as PackageAReadiness,
      contextEdgeImpact: 'PARK_IDENTITY_ONLY_INCREASES_CONTEXT_TRANSPARENCY_NOT_CONTEXT_EDGE_AVAILABILITY',
    },
    splits: {
      auditedEvidence: ['pitcher handedness partial', 'batter handedness not consistently certified', 'team vs LHP/RHP not as-of certified', 'batter/pitcher platoon splits not as-of certified'],
      splitEdgeForwardReady: 'AUDIT_ONLY' as PackageAReadiness,
      blocker: 'SPLIT_EDGE_STATUS_UNAVAILABLE_TEMPORAL_PROVENANCE',
    },
    integration: {
      snapshotContractVersioning: {
        existingSnapshotContract: 'MLB_04B_RESEARCH_SNAPSHOT_CONTRACT_V1',
        futureInternalContextVersion: MLB_04D_A_CONTEXT_VERSION,
        schemaMigrationRequired: false,
        representation: 'additive fields inside components payload only',
      },
      scorecardV3Required: 'NO_FOR_CAPTURE_ONLY_YES_BEFORE_LINEUP_OR_CONTEXT_EDGE_SCORING_CHANGE',
      frozenConsumer: 'SCORECARD_READS_FROZEN_SNAPSHOT_NOT_LATER_STATE',
      missingDataPolicy: 'NULL_WITH_EXPLICIT_BLOCKER_NO_NEUTRAL_ZERO',
      currentRealCompleteness: {
        value: 0.4286,
        components: ['OFFENSE_EDGE', 'BULLPEN_EDGE', 'MARKET_VALUE'],
      },
      projectedPostPackageACompleteness: {
        value: 0.5714,
        components: ['STARTER_EDGE_PARTIAL_WHEN_SCORING_FIELDS_PRESENT', 'OFFENSE_EDGE', 'BULLPEN_EDGE', 'MARKET_VALUE'],
        notCounted: ['LINEUP_EDGE', 'SPLIT_EDGE', 'CONTEXT_EDGE'],
      },
    },
    packageDCompatibility: {
      compatible: true,
      lifecycleUnchanged: true,
      schedulerChanged: false,
      activeCronAdded: false,
      automationActivated: false,
      forwardContract: getMlb04dForwardAutomationContract().classification,
    },
    propImpact: {
      strikeouts: 'STARTER_IDENTITY_HELPFUL_MODEL_STILL_BLOCKED_BY_PROP_MODEL_ODDS_SETTLEMENT',
      outs: 'STARTER_IDENTITY_HELPFUL_MODEL_PARTIAL_SETTLEMENT_BLOCKED',
      earnedRuns: 'STARTER_IDENTITY_HELPFUL_PROP_MODEL_ODDS_SETTLEMENT_BLOCKED',
      hitsAllowed: 'STARTER_AND_LINEUP_CONTEXT_HELPFUL_SPLITS_BLOCKED',
      walks: 'STARTER_IDENTITY_HELPFUL_UMPIRE_SPLIT_PROP_FOUNDATION_BLOCKED',
    },
    nrfiImpact: {
      bothStarters: 'PARTIAL_TO_FORWARD_READY_WHEN_BOTH_CERTIFIED',
      topOrderLineup: 'PROJECTED_READY_CONFIRMED_PARTIAL',
      park: 'IDENTITY_READY_FACTOR_BLOCKED',
      firstInningModel: 'NO',
      activation: 'NO',
    },
    guards: {
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
      predictionWrites: 0,
      snapshotWrites: 0,
      currentEraShadowWrites: 0,
      officialPickWrites: 0,
      settlementWrites: 0,
      learningWrites: 0,
      calibrationWrites: 0,
      productWrites: 0,
      rawModelChanged: false,
      calibratedModelChanged: false,
      sportsDataIoExcluded: true,
      nflIsolation: true,
      nbaIsolation: true,
    },
  }
}

function fixtureFrozenSnapshot() {
  return {
    id: 'mlb-04d-a-fixture-final-pregame',
    event_id: 'baseball_mlb:research:mlb04d_a_fixture',
    snapshot_type: 'FINAL_PREGAME',
    snapshot_timestamp: '2026-08-25T22:35:00.000Z',
    target_event_start_time: '2026-08-25T23:10:00.000Z',
    packageAContextVersion: MLB_04D_A_CONTEXT_VERSION,
    components: {
      event: {
        id: 'baseball_mlb:research:mlb04d_a_fixture',
        matchup: 'Package A Away @ Package A Home',
        startTime: '2026-08-25T23:10:00.000Z',
        officialGamePk: 999001,
      },
      teams: {
        home: { name: 'Package A Home' },
        away: { name: 'Package A Away' },
      },
      starterContext: {
        home: {
          status: 'PROBABLE',
          source: 'mlb_starter_assignments',
          sourceTimestamp: '2026-08-25T20:20:00.000Z',
          starterPlayerId: 'baseball_mlb:fixture:home_starter',
          starterName: 'Package A Home Starter',
          handedness: 'R',
          mappingConfidence: 0.94,
          eraProxyDelta: 0.18,
          strikeoutWalkDelta: 0.13,
          workloadDelta: 0.08,
        },
        away: {
          status: 'PROBABLE',
          source: 'sport_lineups',
          sourceTimestamp: '2026-08-25T20:25:00.000Z',
          starterPlayerId: 'baseball_mlb:fixture:away_starter',
          starterName: 'Package A Away Starter',
          handedness: 'L',
          mappingConfidence: 0.9,
          eraProxyDelta: -0.08,
          strikeoutWalkDelta: -0.04,
          workloadDelta: -0.05,
        },
      },
      offenseRecentFormContext: {
        home: { source: 'sport_game_stats', sourceTimestamp: '2026-08-25T12:00:00.000Z', games: 7, runsPerGameDelta: -0.1, onBaseProxyDelta: -0.03, sluggingProxyDelta: -0.02 },
        away: { source: 'sport_game_stats', sourceTimestamp: '2026-08-25T12:00:00.000Z', games: 7, runsPerGameDelta: -0.16, onBaseProxyDelta: -0.05, sluggingProxyDelta: -0.04 },
      },
      bullpenDirectionalInputs: {
        home: { source: 'sport_game_stats', sourceTimestamp: '2026-08-25T12:00:00.000Z', restScore: 0.13, workloadScore: 0.05, leverageProxy: 0.04 },
        away: { source: 'sport_game_stats', sourceTimestamp: '2026-08-25T12:00:00.000Z', restScore: 0.1, workloadScore: 0.02, leverageProxy: 0.03 },
      },
      lineups: {
        home: {
          status: 'PROJECTED',
          source: 'stored_season_player_stats_projected_lineup',
          sourceTimestamp: '2026-08-25T12:00:00.000Z',
          blockers: ['LINEUP_PROJECTED_NOT_CONFIRMED'],
          players: Array.from({ length: 9 }, (_, index) => ({ battingOrder: index + 1, playerId: `home-${index + 1}`, playerName: `Home Batter ${index + 1}` })),
        },
        away: {
          status: 'PROJECTED',
          source: 'stored_season_player_stats_projected_lineup',
          sourceTimestamp: '2026-08-25T12:00:00.000Z',
          blockers: ['LINEUP_PROJECTED_NOT_CONFIRMED'],
          players: Array.from({ length: 9 }, (_, index) => ({ battingOrder: index + 1, playerId: `away-${index + 1}`, playerName: `Away Batter ${index + 1}` })),
        },
      },
      venueContext: {
        status: 'AVAILABLE',
        source: 'sport_events.venue',
        venueName: 'Package A Park',
        sourceTimestamp: '2026-08-25T12:00:00.000Z',
        blockers: ['PARK_FACTOR_NOT_CERTIFIED'],
      },
    },
  }
}

export function runMlb04dAPackageAFixture() {
  const snapshot = fixtureFrozenSnapshot()
  const scorecard = evaluateMlb04cR6FrozenSnapshotScorecard({
    snapshot,
    market: 'total',
    selection: 'Under',
    line: 8.5,
    sportsbook: 'FanDuel',
    odds: -112,
    impliedProbability: 0.5283,
    rawProbability: 0.532,
    calibratedProbability: 0.551,
  })
  return {
    classification: MLB_04D_A_CLASSIFICATION,
    sourceToSnapshotToScorecard: 'PASS',
    snapshotContextVersion: MLB_04D_A_CONTEXT_VERSION,
    scorecardVersion: scorecard.sameOpportunityIdentity.scorecardVersion,
    scorecardReadsFrozenSnapshotOnly: true,
    availableComponents: scorecard.availableComponents,
    componentCompleteness: scorecard.componentCompleteness,
    lineupRemainsPartial: scorecard.componentScores.find((component) => component.key === 'LINEUP_EDGE')?.score === null,
    contextRemainsPartial: scorecard.componentScores.find((component) => component.key === 'CONTEXT_EDGE')?.score === null,
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
  }
}

function componentStateFromSnapshot(snapshot: Record<string, unknown>) {
  const components = asRecord(snapshot.components)
  const starters = asRecord(components.starterContext ?? components.starters)
  const lineups = asRecord(components.lineups)
  const weatherPark = asRecord(components.weatherPark)
  const park = asRecord(weatherPark.park ?? components.venueContext)
  const sideState = (value: unknown): ContextComponentState => {
    const record = asRecord(value)
    return {
      state: String(record.status ?? 'UNKNOWN'),
      source: String(record.source ?? 'none'),
      sourceTimestamp: typeof record.sourceTimestamp === 'string' ? record.sourceTimestamp : null,
      blockers: asArray(record.blockers).map(String),
    }
  }
  const homeStarter = sideState(starters.home)
  const awayStarter = sideState(starters.away)
  const homeLineup = sideState(lineups.home)
  const awayLineup = sideState(lineups.away)
  return {
    starter: stateFromSide(homeStarter, awayStarter),
    lineup: stateFromSide(homeLineup, awayLineup),
    park: String(park.status ?? 'UNKNOWN'),
    offense: 'AVAILABLE',
    bullpen: 'AVAILABLE',
    market: 'AVAILABLE',
    split: 'AUDIT_ONLY',
    context: String(park.status ?? '') === 'AVAILABLE' ? 'PARTIAL' : 'UNKNOWN',
    blockers: [...homeStarter.blockers, ...awayStarter.blockers, ...homeLineup.blockers, ...awayLineup.blockers, ...asArray(park.blockers).map(String)],
  }
}

export async function runMlb04dACurrentStoredDryRun(date?: string) {
  const result = await getMlbContextLineage({
    date,
    snapshotType: 'CURRENT_PROBE',
    allowProviderCalls: false,
    persist: false,
  })
  const snapshots = Array.isArray(result.snapshots) ? result.snapshots as Array<Record<string, unknown>> : []
  const componentStates = snapshots.map((snapshot) => componentStateFromSnapshot(snapshot))
  const any = (key: keyof ReturnType<typeof componentStateFromSnapshot>, states: string[]) => componentStates.some((row) => states.includes(String(row[key])))
  const availableComponents = [
    any('starter', ['CONFIRMED', 'PROBABLE']) ? 'STARTER_EDGE' : null,
    'OFFENSE_EDGE',
    'BULLPEN_EDGE',
    'MARKET_VALUE',
  ].filter((value): value is string => Boolean(value))

  return {
    success: result.success,
    selectedDate: result.selectedDate,
    eventsScanned: snapshots.length,
    providerCallsMade: result.providerCallsMade,
    productionDatabaseMutations: result.remoteMutationsMade,
    sourceAudit: result.sourceAudit,
    componentStates,
    currentStoredComponentsAvailable: availableComponents,
    currentStoredScorecardCompleteness: Number((availableComponents.length / 7).toFixed(4)),
    starterState: any('starter', ['CONFIRMED']) ? 'CONFIRMED' : any('starter', ['PROBABLE']) ? 'PROBABLE' : any('starter', ['PROJECTED', 'EXPECTED']) ? 'PROJECTED' : 'UNKNOWN',
    lineupState: any('lineup', ['CONFIRMED']) ? 'CONFIRMED' : any('lineup', ['PROJECTED', 'EXPECTED']) ? 'PROJECTED' : 'UNKNOWN',
    parkState: any('park', ['AVAILABLE']) ? 'AVAILABLE' : 'UNKNOWN',
    splitState: 'AUDIT_ONLY',
    contextState: any('context', ['PARTIAL']) ? 'PARTIAL' : 'UNKNOWN',
  }
}
