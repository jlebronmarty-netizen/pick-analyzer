import 'server-only'

import { SPORTS, type SportKey } from '@/config/sports.config'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'
import { getLeaguesForSport } from '@/services/multi-sport-registry.service'
import { getProvidersForSport } from '@/services/multi-sport-providers.service'

type ReadinessState =
  | 'DATA_READY'
  | 'DATA_PARTIAL'
  | 'DATA_FOUNDATION'
  | 'PROVIDER_BLOCKED'
  | 'SUBSCRIPTION_BLOCKED'
  | 'MAPPING_BLOCKED'
  | 'HISTORICAL_ONLY'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN'

type DomainState =
  | 'READY'
  | 'PARTIAL'
  | 'INSUFFICIENT'
  | 'BLOCKED'
  | 'UNKNOWN'
  | 'NOT_REQUIRED'

type CountResult = {
  count: number | null
  error: string | null
}

type SportCounts = {
  teams: CountResult
  players: CountResult
  events: CountResult
  currentEvents: CountResult
  completedEvents: CountResult
  providerMappings: CountResult
  standings: CountResult
  gameStats: CountResult
  odds: CountResult
  results: CountResult
  injuries: CountResult
  lineups: CountResult
  predictions: CountResult
}

type CountQuery = PromiseLike<{
  count: number | null
  error: { message: string } | null
}> & {
  eq: (column: string, value: unknown) => CountQuery
  gte: (column: string, value: unknown) => CountQuery
}

type CountTable = {
  select: (
    columns: string,
    options: { count: 'exact'; head: true }
  ) => CountQuery
}

type SportReadinessContract = {
  sportKey: string
  displayName: string
  configured: boolean
  enabled: boolean
  primaryProvider: string
  fallbackProvider: string | null
  providerEvidence: string[]
  providerBudgetPool: string
  scheduleState: DomainState
  teamState: DomainState
  playerState: DomainState
  eventState: DomainState
  oddsState: DomainState
  resultState: DomainState
  statsState: DomainState
  injuryState: DomainState
  lineupState: DomainState
  featureInputState: DomainState
  mappingState: DomainState
  dataQualityState: DomainState
  historicalCoverage: string
  currentCoverage: string
  readinessState: ReadinessState
  readinessReasonCodes: string[]
  blockers: string[]
  warnings: string[]
  providerCallsRequired: boolean
  estimatedProviderCost: number | null
  nextMission: string
  humanInterventionRequired: boolean
  counts: SportCounts
  evidence: string[]
  observedAt: string
}

const TARGET_SPORT_KEYS: SportKey[] = [
  'baseball_mlb',
  'basketball_nba',
  'americanfootball_nfl',
  'icehockey_nhl',
  'soccer',
  'tennis',
  'mma_ufc',
  'basketball_bsn',
]

const DOC_EVIDENCE: Record<string, string[]> = {
  baseball_mlb: [
    'docs/CERTIFICATION/oe-003e-canonical-acquisition-active-execution.json',
    'docs/MLB_EVENT_RESULT_COMPLETION_V3.md',
    'docs/MLB_MARKET_DATA_FOUNDATION_V2.md',
  ],
  basketball_nba: [
    'docs/nba-data-sync-v1.md',
    'docs/nba-feature-store-integration-v1.md',
    'docs/sportsdataio-nba-integration-readiness-v1.md',
  ],
  americanfootball_nfl: [
    'docs/nfl-feature-store-integration-v1.md',
    'docs/live-multi-sport-acquisition-v1-final-certification.json',
  ],
  icehockey_nhl: [
    'docs/nhl-feature-store-integration-v1.md',
    'docs/live-multi-sport-acquisition-v1-final-certification.json',
  ],
  soccer: [
    'docs/soccer-feature-store-integration-v1.md',
    'docs/providers/sportsdataio/SOCCER.md',
  ],
  tennis: [
    'docs/tennis-feature-store-integration-v1.md',
  ],
  mma_ufc: [
    'docs/ufc-feature-store-integration-v1.md',
    'docs/multi-sport-results-crosswalk-foundation-v1.json',
  ],
  basketball_bsn: [
    'docs/PRODUCT/PRODUCT_INVENTORY_V2.md',
    'docs/live-multi-sport-acquisition-v1-final-certification.json',
  ],
}

function emptyCount(error: string | null = null): CountResult {
  return { count: error ? null : 0, error }
}

async function countTable(
  table: string,
  sportKey: string,
  apply: (query: CountQuery) => CountQuery = (query) => query
): Promise<CountResult> {
  try {
    const tableQuery = supabaseAdmin.from(table) as unknown as CountTable
    const query = apply(
      tableQuery
        .select('id', { count: 'exact', head: true })
        .eq('sport_key', sportKey) as CountQuery
    )
    const { count, error } = await query
    if (error) return emptyCount(error.message)
    return { count: count ?? 0, error: null }
  } catch (error) {
    return emptyCount(error instanceof Error ? error.message : 'unknown count error')
  }
}

async function countsForSport(sportKey: SportKey): Promise<SportCounts> {
  const now = new Date().toISOString()
  const [
    teams,
    players,
    events,
    currentEvents,
    completedEvents,
    providerMappings,
    standings,
    gameStats,
    odds,
    results,
    injuries,
    lineups,
    predictions,
  ] = await Promise.all([
    countTable('sports_teams', sportKey),
    countTable('sport_players', sportKey),
    countTable('sport_events', sportKey),
    countTable('sport_events', sportKey, (query) => query.gte('start_time', now)),
    countTable('sport_events', sportKey, (query) => query.eq('status', 'completed')),
    countTable('provider_entity_mappings', sportKey),
    countTable('sport_standings', sportKey),
    countTable('sport_game_stats', sportKey),
    countTable('sports_odds_snapshots', sportKey),
    countTable('game_results', sportKey),
    countTable('sport_injuries', sportKey),
    countTable('sport_lineups', sportKey),
    countTable('prediction_history', sportKey),
  ])
  return {
    teams,
    players,
    events,
    currentEvents,
    completedEvents,
    providerMappings,
    standings,
    gameStats,
    odds,
    results,
    injuries,
    lineups,
    predictions,
  }
}

function count(counts: SportCounts, key: keyof SportCounts) {
  return counts[key].count ?? 0
}

function hasError(counts: SportCounts) {
  return Object.values(counts).some((item) => item.error)
}

function domainFromCount(value: CountResult, zeroState: DomainState = 'INSUFFICIENT'): DomainState {
  if (value.error) return 'UNKNOWN'
  return (value.count ?? 0) > 0 ? 'READY' : zeroState
}

function classifySport(sportKey: SportKey, counts: SportCounts): {
  readinessState: ReadinessState
  reasonCodes: string[]
  blockers: string[]
  warnings: string[]
  nextMission: string
} {
  const reasonCodes: string[] = []
  const blockers: string[] = []
  const warnings: string[] = []

  if (hasError(counts)) {
    reasonCodes.push('COUNT_READ_PARTIAL')
    warnings.push('One or more aggregate count reads failed; affected domains remain UNKNOWN.')
  }

  if (sportKey === 'baseball_mlb') {
    reasonCodes.push('MLB_CERTIFIED_DATA_PIPELINE', 'SPORTSDATAIO_ACTIVE_SCOPE_CERTIFIED')
    if (count(counts, 'events') === 0 || count(counts, 'odds') === 0 || count(counts, 'results') === 0) {
      blockers.push('MLB_EXPECTED_CORE_DATA_MISSING')
      return { readinessState: 'DATA_PARTIAL', reasonCodes, blockers, warnings, nextMission: 'MC-03_BLOCKED_UNTIL_CORE_MLB_DATA_RECOVERS' }
    }
    return { readinessState: 'DATA_READY', reasonCodes, blockers, warnings, nextMission: 'MC-03_MLB_ONLY_PREDICTION_MAINTENANCE_ELIGIBLE' }
  }

  if (sportKey === 'basketball_nba') {
    reasonCodes.push('NBA_STORED_FOUNDATION_EXISTS', 'NBA_NOT_PRODUCTION_RECOMMENDATION_READY')
    if (count(counts, 'results') === 0) blockers.push('NBA_AUTHORITATIVE_RESULTS_NOT_READY')
    if (count(counts, 'odds') === 0) blockers.push('NBA_ODDS_NOT_READY')
    return { readinessState: 'DATA_PARTIAL', reasonCodes, blockers, warnings, nextMission: 'MC-03_REQUIRES_HUMAN_APPROVAL_AND_NBA_RESULT_ODDS_GATE' }
  }

  if (sportKey === 'americanfootball_nfl' || sportKey === 'icehockey_nhl') {
    reasonCodes.push('THE_ODDS_API_MARKET_EVIDENCE_HISTORICAL_ONLY', 'CANONICAL_EVENT_CROSSWALK_NOT_COMPLETE')
    if (count(counts, 'events') === 0) blockers.push('CANONICAL_EVENTS_EMPTY')
    if (count(counts, 'teams') === 0) blockers.push('CANONICAL_TEAMS_EMPTY')
    if (count(counts, 'results') === 0) blockers.push('AUTHORITATIVE_RESULTS_EMPTY')
    return { readinessState: 'DATA_PARTIAL', reasonCodes, blockers, warnings, nextMission: 'MC-02_FOLLOWUP_CANONICAL_EVENT_RESULT_MAPPING' }
  }

  if (sportKey === 'soccer') {
    reasonCodes.push('SOCCER_REQUIRES_COMPETITION_SCOPING', 'AGGREGATE_SOCCER_NOT_CERTIFIED')
    blockers.push('COMPETITION_SPECIFIC_SOURCE_REQUIRED')
    return { readinessState: 'DATA_PARTIAL', reasonCodes, blockers, warnings, nextMission: 'MC-02_FOLLOWUP_SOCCER_COMPETITION_SELECTION' }
  }

  if (sportKey === 'tennis') {
    reasonCodes.push('FEATURE_ARCHITECTURE_ONLY', 'REAL_EVENT_SOURCE_PENDING')
    blockers.push('TOUR_EVENT_RESULT_SOURCE_NOT_CERTIFIED')
    return { readinessState: 'DATA_FOUNDATION', reasonCodes, blockers, warnings, nextMission: 'MC-02_FOLLOWUP_TENNIS_EVENT_SOURCE_CERTIFICATION' }
  }

  if (sportKey === 'mma_ufc') {
    reasonCodes.push('EVENT_DRIVEN_FOUNDATION', 'CANONICAL_BOUT_CROSSWALK_PENDING')
    blockers.push('FIGHT_CARD_AND_RESULT_SOURCE_NOT_CERTIFIED')
    return { readinessState: 'DATA_FOUNDATION', reasonCodes, blockers, warnings, nextMission: 'MC-02_FOLLOWUP_UFC_BOUT_SOURCE_CERTIFICATION' }
  }

  if (sportKey === 'basketball_bsn') {
    reasonCodes.push('BSN_SOURCE_SPECIFIC', 'NOT_THE_ODDS_API_CERTIFIED')
    blockers.push('APPROVED_BSN_ODDS_PROVIDER_NOT_CERTIFIED')
    return { readinessState: 'PROVIDER_BLOCKED', reasonCodes, blockers, warnings, nextMission: 'MC-02_FOLLOWUP_BSN_SOURCE_PROVENANCE' }
  }

  reasonCodes.push('SPORT_NOT_CLASSIFIED')
  return { readinessState: 'UNKNOWN', reasonCodes, blockers, warnings, nextMission: 'MC-02_FOLLOWUP_CLASSIFICATION_REQUIRED' }
}

function contractForSport(sportKey: SportKey, counts: SportCounts, observedAt: string): SportReadinessContract {
  const sport = SPORTS.find((item) => item.key === sportKey)
  const providers = getProvidersForSport(sportKey)
  const providerOverrides: Partial<Record<SportKey, string>> = {
    baseball_mlb: 'sportsdataio',
    basketball_nba: 'sportsdataio-gated',
    basketball_bsn: 'bsn-source-specific',
  }
  const primaryProvider = providerOverrides[sportKey] ?? String(sport?.metadata.primaryProvider ?? providers[0]?.id ?? 'unknown')
  const fallbackProvider = providers.find((provider) => provider.id !== primaryProvider)?.id ?? null
  const classification = classifySport(sportKey, counts)
  const individual = sport?.format === 'individual'
  const eventDriven = sport?.seasonFormat === 'event_based' || sport?.seasonFormat === 'tournament'

  return {
    sportKey,
    displayName: sport?.shortLabel ?? sportKey,
    configured: Boolean(sport),
    enabled: Boolean(sport?.enabled),
    primaryProvider,
    fallbackProvider,
    providerEvidence: providers.map((provider) => `${provider.id}:${provider.health}`),
    providerBudgetPool:
      primaryProvider === 'the-odds-api'
        ? 'the-odds-api-shadow'
        : primaryProvider.includes('sportsdataio') || sportKey === 'baseball_mlb'
          ? 'sportsdataio-isolated'
          : sportKey === 'basketball_bsn'
            ? 'bsn-source-specific'
            : 'unknown',
    scheduleState: domainFromCount(counts.events),
    teamState: individual ? 'NOT_REQUIRED' : domainFromCount(counts.teams),
    playerState: domainFromCount(counts.players, individual ? 'PARTIAL' : 'INSUFFICIENT'),
    eventState: domainFromCount(counts.events),
    oddsState: domainFromCount(counts.odds),
    resultState: domainFromCount(counts.results),
    statsState: count(counts, 'gameStats') > 0 || count(counts, 'standings') > 0 ? 'READY' : 'INSUFFICIENT',
    injuryState: count(counts, 'injuries') > 0 ? 'PARTIAL' : eventDriven ? 'UNKNOWN' : 'INSUFFICIENT',
    lineupState: count(counts, 'lineups') > 0 ? 'PARTIAL' : individual ? 'NOT_REQUIRED' : 'INSUFFICIENT',
    featureInputState:
      sportKey === 'baseball_mlb'
        ? 'READY'
        : ['basketball_nba', 'tennis', 'mma_ufc'].includes(sportKey)
          ? 'PARTIAL'
          : 'INSUFFICIENT',
    mappingState: domainFromCount(counts.providerMappings),
    dataQualityState:
      classification.readinessState === 'DATA_READY'
        ? 'READY'
        : classification.readinessState === 'DATA_PARTIAL'
          ? 'PARTIAL'
          : classification.readinessState === 'DATA_FOUNDATION'
            ? 'INSUFFICIENT'
            : 'BLOCKED',
    historicalCoverage:
      sportKey === 'baseball_mlb'
        ? 'current_and_prior_season_available'
        : sportKey === 'basketball_nba'
          ? 'partial_current_and_prior_foundation'
          : count(counts, 'events') > 0 || count(counts, 'odds') > 0
            ? 'stored_partial'
            : 'not_proven',
    currentCoverage:
      count(counts, 'currentEvents') > 0
        ? `${count(counts, 'currentEvents')} future/current events stored`
        : 'no current canonical event coverage proven',
    readinessState: classification.readinessState,
    readinessReasonCodes: classification.reasonCodes,
    blockers: classification.blockers,
    warnings: classification.warnings,
    providerCallsRequired: classification.readinessState !== 'DATA_READY',
    estimatedProviderCost:
      primaryProvider === 'the-odds-api'
        ? null
        : sportKey === 'baseball_mlb'
          ? 1
          : null,
    nextMission: classification.nextMission,
    humanInterventionRequired: classification.readinessState !== 'DATA_READY',
    counts,
    evidence: [
      'src/config/sports.config.ts',
      'src/services/multi-sport-registry.service.ts',
      ...getLeaguesForSport(sportKey).map((league) => `league:${league.key}`),
      ...(DOC_EVIDENCE[sportKey] ?? []),
    ],
    observedAt,
  }
}

function providerCoverage(sports: SportReadinessContract[]) {
  return [
    {
      provider: 'SportsDataIO',
      sports: ['baseball_mlb', 'basketball_nba'],
      productionUsageStatus: 'MLB_ACTIVE_NBA_GATED',
      schedule: 'MLB certified; NBA foundation routes present',
      teams: 'MLB/NBA entitlement evidence exists',
      players: 'MLB certified, NBA partial',
      standings: 'MLB/NBA stored evidence exists',
      stats: 'MLB certified, NBA partial',
      odds: 'MLB active; NBA gated',
      results: 'MLB certified; NBA result readiness partial',
      injuries: 'MLB roster status only; NBA partial',
      lineups: 'MLB starter/lineup partial; NBA partial',
      historicalData: 'MLB certified partial completion; NBA foundation',
      requestGranularity: 'date/season endpoint families',
      costUnit: 'HTTP_REQUEST',
      budgetEvidence: 'provider-budget.service isolated SportsDataIO pool',
      resetSemantics: 'CONFIGURED_ONLY_LOCAL_DAY',
      credentialsConfigured: 'runtime-dependent, not exposed',
      blocker: 'Non-MLB SportsDataIO activation remains gated.',
    },
    {
      provider: 'The Odds API',
      sports: ['baseball_mlb', 'basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'soccer', 'tennis', 'mma_ufc'],
      productionUsageStatus: 'SHADOW_OR_PRIOR_BOUNDED_AUDIT',
      schedule: 'events/scores supported for specific provider sport keys; soccer aggregate is not a valid universal sport',
      teams: 'not a canonical team source for all sports',
      players: 'not a player identity source for current production',
      standings: 'not covered',
      stats: 'not covered',
      odds: 'prior bounded current odds acquisition evidence exists for several sports',
      results: 'scores/results evidence partial and not settlement-certified for non-MLB',
      injuries: 'not covered',
      lineups: 'not covered',
      historicalData: 'historical endpoints audited but not globally activated',
      requestGranularity: 'sport/event/market/region/bookmaker',
      costUnit: 'CREDIT',
      budgetEvidence: 'current balance/reset unknown in normal reads',
      resetSemantics: 'UNKNOWN_NOT_RECHECKED',
      credentialsConfigured: 'runtime-dependent, not exposed',
      blocker: 'Current quota/reset/cost must be proven before active acquisition.',
    },
    {
      provider: 'BSN Sources',
      sports: ['basketball_bsn'],
      productionUsageStatus: 'SOURCE_SPECIFIC_OBSERVATIONAL',
      schedule: 'stored partial source evidence',
      teams: 'stored partial source evidence',
      players: 'stored partial source evidence',
      standings: 'stored partial source evidence',
      stats: 'not proven',
      odds: 'not certified',
      results: 'partial source evidence, not recommendation-ready',
      injuries: 'not covered',
      lineups: 'not covered',
      historicalData: 'source-provenance dependent',
      requestGranularity: 'official page/CSV/manual/future provider',
      costUnit: 'UNKNOWN',
      budgetEvidence: 'not combined with The Odds API or SportsDataIO',
      resetSemantics: 'SOURCE_SPECIFIC',
      credentialsConfigured: 'not applicable to The Odds API',
      blocker: 'Approved source provenance and odds provider remain blocked.',
    },
    {
      provider: 'Official league/team/manual sources',
      sports: sports.map((sport) => sport.sportKey),
      productionUsageStatus: 'SUPPLEMENTAL_OR_PLANNED',
      schedule: 'source-specific',
      teams: 'source-specific',
      players: 'source-specific',
      standings: 'source-specific',
      stats: 'source-specific',
      odds: 'not a betting market provider unless separately certified',
      results: 'eligible only when canonical mapping and timestamp rules are proven',
      injuries: 'source-specific',
      lineups: 'source-specific',
      historicalData: 'source-specific',
      requestGranularity: 'varies',
      costUnit: 'UNKNOWN',
      budgetEvidence: 'no shared budget pool',
      resetSemantics: 'UNKNOWN',
      credentialsConfigured: 'not exposed',
      blocker: 'Must be certified per sport before production use.',
    },
  ]
}

function applyFilters({
  sports,
  sportKey,
  readinessState,
  provider,
  limit,
}: {
  sports: SportReadinessContract[]
  sportKey?: string | null
  readinessState?: string | null
  provider?: string | null
  limit?: number | null
}) {
  const normalizedProvider = provider?.trim().toLowerCase()
  const filtered = sports.filter((sport) => {
    if (sportKey && sport.sportKey !== sportKey) return false
    if (readinessState && sport.readinessState !== readinessState) return false
    if (normalizedProvider && !sport.primaryProvider.toLowerCase().includes(normalizedProvider) && !sport.providerBudgetPool.toLowerCase().includes(normalizedProvider)) return false
    return true
  })
  return filtered.slice(0, Math.min(Math.max(Number(limit ?? 100), 1), 100))
}

export async function getMultiSportDataReadiness(input: {
  sportKey?: string | null
  readinessState?: string | null
  provider?: string | null
  limit?: number | null
} = {}) {
  const observedAt = new Date().toISOString()
  const enabledSports = SPORTS.filter((sport) => TARGET_SPORT_KEYS.includes(sport.key))
  const sports = await Promise.all(
    enabledSports.map(async (sport) => contractForSport(sport.key, await countsForSport(sport.key), observedAt))
  )
  const filteredSports = applyFilters({
    sports,
    sportKey: input.sportKey,
    readinessState: input.readinessState,
    provider: input.provider,
    limit: input.limit,
  })
  const sportsDataIoBudget = await getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: 'baseball_mlb' })
  const blockers = sports.flatMap((sport) => sport.blockers.map((blocker) => ({ sportKey: sport.sportKey, blocker })))
  const nextActions = sports.map((sport) => ({
    sportKey: sport.sportKey,
    readinessState: sport.readinessState,
    nextMission: sport.nextMission,
    humanInterventionRequired: sport.humanInterventionRequired,
  }))

  return {
    success: true,
    mode: 'mc02_multi_sport_data_readiness_v1',
    generatedAt: observedAt,
    summary: {
      totalTargetSports: sports.length,
      returnedSports: filteredSports.length,
      dataReady: sports.filter((sport) => sport.readinessState === 'DATA_READY').length,
      dataPartial: sports.filter((sport) => sport.readinessState === 'DATA_PARTIAL').length,
      dataFoundation: sports.filter((sport) => sport.readinessState === 'DATA_FOUNDATION').length,
      providerBlocked: sports.filter((sport) => sport.readinessState === 'PROVIDER_BLOCKED').length,
      unknown: sports.filter((sport) => sport.readinessState === 'UNKNOWN').length,
      independentBlockedSportsDoNotBlockGlobalAudit: true,
      normalReadProviderCallsMade: 0,
      normalReadRemoteMutationsMade: 0,
    },
    sports: filteredSports,
    providerCoverage: providerCoverage(sports),
    providerBudgets: {
      sportsdataio: {
        status: sportsDataIoBudget.canonicalBudget.status,
        evidenceLevel: sportsDataIoBudget.canonicalBudget.evidenceLevel,
        used: sportsDataIoBudget.canonicalBudget.used,
        usableRemaining: sportsDataIoBudget.canonicalBudget.usableRemaining,
        protectedReserve: sportsDataIoBudget.canonicalBudget.protectedReserve,
        unitType: sportsDataIoBudget.canonicalBudget.unitType,
      },
      theOddsApi: {
        status: 'UNKNOWN',
        evidenceLevel: 'UNKNOWN',
        protectedReserve: 2000,
        unitType: 'CREDIT',
        reason: 'Normal MC-02 reads do not perform live quota calls.',
      },
      bsn: {
        status: 'SOURCE_SPECIFIC',
        evidenceLevel: 'UNKNOWN',
        unitType: 'UNKNOWN',
        reason: 'BSN is not treated as The Odds API-covered.',
      },
    },
    blockers,
    nextActions,
    evidenceTimestamps: {
      observedAt,
      source: 'bounded aggregate database reads and repository certification artifacts',
    },
    guarantees: {
      readOnly: true,
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      remoteMutationsMade: 0,
      predictionGenerationActivated: false,
      settlementActivated: false,
      learningActivated: false,
      modelMathChanged: false,
      schedulerCadenceChanged: false,
      secretsExposed: false,
      payloadBounded: true,
    },
  }
}
