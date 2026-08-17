export const NFL_SPORT_KEY = 'americanfootball_nfl'
export const NFL_LEAGUE_KEY = 'nfl'
export const NFL_BALLDONTLIE_PROVIDER_ID = 'balldontlie'
export const NFL_BALLDONTLIE_BASE_URL = 'https://api.balldontlie.io'
export const NFL_BALLDONTLIE_RAW_ROOT = 'data/imports/balldontlie/nfl'
export const NFL_BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE = 4
export const NFL_BALLDONTLIE_TRIAL_LIMIT_REQUESTS_PER_MINUTE = 5
export const NFL_BALLDONTLIE_TRIAL_HOURS = 48
export const NFL_BALLDONTLIE_RESERVE_HOURS = 4

export type NflBallDontLieTier = 'FREE' | 'ALL_STAR' | 'GOAT'
export type NflTrialPriority = 'P0' | 'P1' | 'P2'
export type NflComponentState = 'READY' | 'PARTIAL' | 'STALE' | 'UNSAFE' | 'MISSING'
export type LegacyDependencyState = 'LEGACY_UNUSED' | 'SHARED_DO_NOT_TOUCH' | 'SAFE_TO_IGNORE' | 'ACTUAL_DEPENDENCY'

export type NflBallDontLieEndpoint = {
  id: string
  label: string
  path: string
  tier: NflBallDontLieTier
  priority: NflTrialPriority
  requestStrategy: 'once' | 'season_page' | 'team_roster' | 'deferred'
  historicalReplayUse: 'CORE' | 'VALIDATION' | 'RESEARCH' | 'FORWARD_ONLY' | 'NOT_USED'
  forwardUse: 'CORE' | 'OPTIONAL' | 'GOAT_ONLY_BLOCKER' | 'NOT_USED'
  filters: string[]
  estimatedRowsPerSeason: number
  estimatedRequestsPerSeason: number
  rawDestination: string
  normalizedDestination: string
  notes: string
}

export type NflTrialManifestEntry = {
  requestId: string
  endpointId: string
  endpointPath: string
  priority: NflTrialPriority
  season: number | 'all' | 'current'
  estimatedRows: number
  estimatedRequests: number
  checkpointUnit: string
  retryBehavior: string
  rawPayloadDestination: string
  normalizedDestination: string
  providerCallsMade: 0
}

export const RECOMMENDED_NFL_HISTORICAL_SEASONS = [2021, 2022, 2023, 2024, 2025]

const NFL_TEAMS = 32
const REGULAR_SEASON_GAMES_PER_SEASON = 272
const PLAYOFF_GAMES_PER_SEASON = 14
const TOTAL_GAMES_PER_SEASON = REGULAR_SEASON_GAMES_PER_SEASON + PLAYOFF_GAMES_PER_SEASON
const CORE_MARKETS_PER_GAME = 3

export const NFL_BALLDONTLIE_ENDPOINTS: NflBallDontLieEndpoint[] = [
  {
    id: 'teams',
    label: 'Teams',
    path: '/nfl/v1/teams',
    tier: 'FREE',
    priority: 'P0',
    requestStrategy: 'once',
    historicalReplayUse: 'CORE',
    forwardUse: 'CORE',
    filters: ['conference', 'division'],
    estimatedRowsPerSeason: NFL_TEAMS,
    estimatedRequestsPerSeason: 1,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/identity/teams.json`,
    normalizedDestination: 'sports_teams, provider_entity_mappings',
    notes: 'Canonical NFL team identity before schedule, stats and odds crosswalks.',
  },
  {
    id: 'players',
    label: 'Players',
    path: '/nfl/v1/players',
    tier: 'FREE',
    priority: 'P0',
    requestStrategy: 'season_page',
    historicalReplayUse: 'CORE',
    forwardUse: 'CORE',
    filters: ['cursor', 'per_page', 'search', 'first_name', 'last_name', 'team_ids', 'player_ids', 'position'],
    estimatedRowsPerSeason: 7500,
    estimatedRequestsPerSeason: 75,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/players/*.json`,
    normalizedDestination: 'sport_players, provider_entity_mappings',
    notes: 'Player identity and stat ownership. Stored once and reconciled by provider id/team context.',
  },
  {
    id: 'games',
    label: 'Games And Results',
    path: '/nfl/v1/games',
    tier: 'FREE',
    priority: 'P0',
    requestStrategy: 'season_page',
    historicalReplayUse: 'CORE',
    forwardUse: 'CORE',
    filters: ['cursor', 'per_page', 'dates', 'seasons', 'team_ids', 'weeks', 'postseason', 'start_date', 'end_date'],
    estimatedRowsPerSeason: TOTAL_GAMES_PER_SEASON,
    estimatedRequestsPerSeason: 3,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/games/*.json`,
    normalizedDestination: 'sport_events, game_results, provider_entity_mappings',
    notes: 'Schedule, status, week, postseason flag, final scores and quarter/overtime score basis when provided.',
  },
  {
    id: 'stats',
    label: 'Player Game Stats',
    path: '/nfl/v1/stats',
    tier: 'ALL_STAR',
    priority: 'P0',
    requestStrategy: 'season_page',
    historicalReplayUse: 'CORE',
    forwardUse: 'CORE',
    filters: ['cursor', 'per_page', 'dates', 'seasons', 'team_ids', 'player_ids', 'game_ids', 'weeks', 'postseason'],
    estimatedRowsPerSeason: 14000,
    estimatedRequestsPerSeason: 140,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/player-game-stats/*.json`,
    normalizedDestination: 'sport_player_stats',
    notes: 'Core player-game stat foundation. Only prior games may feed historical pregame features.',
  },
  {
    id: 'team_stats',
    label: 'Team Game Stats',
    path: '/nfl/v1/team_stats',
    tier: 'ALL_STAR',
    priority: 'P0',
    requestStrategy: 'season_page',
    historicalReplayUse: 'CORE',
    forwardUse: 'CORE',
    filters: ['cursor', 'per_page', 'team_ids', 'seasons', 'game_ids', 'season_type'],
    estimatedRowsPerSeason: TOTAL_GAMES_PER_SEASON * 2,
    estimatedRequestsPerSeason: 6,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/team-game-stats/*.json`,
    normalizedDestination: 'sport_game_stats',
    notes: 'Team offense/defense, third down, red zone, turnover and yardage basis for rolling features.',
  },
  {
    id: 'season_stats',
    label: 'Season Stats',
    path: '/nfl/v1/season_stats',
    tier: 'ALL_STAR',
    priority: 'P1',
    requestStrategy: 'season_page',
    historicalReplayUse: 'VALIDATION',
    forwardUse: 'OPTIONAL',
    filters: ['cursor', 'per_page', 'season', 'player_ids', 'team_ids', 'postseason'],
    estimatedRowsPerSeason: 2500,
    estimatedRequestsPerSeason: 25,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/season-stats/*.json`,
    normalizedDestination: 'sport_player_season_stats or validation-only staging',
    notes: 'Full-season aggregates are not safe as early-game pregame features without as-of reconstruction.',
  },
  {
    id: 'standings',
    label: 'Standings',
    path: '/nfl/v1/standings',
    tier: 'ALL_STAR',
    priority: 'P1',
    requestStrategy: 'season_page',
    historicalReplayUse: 'VALIDATION',
    forwardUse: 'CORE',
    filters: ['season', 'conference', 'division'],
    estimatedRowsPerSeason: NFL_TEAMS,
    estimatedRequestsPerSeason: 1,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/standings/*.json`,
    normalizedDestination: 'sport_standings or derived validation staging',
    notes: 'Forward standings are useful; final historical standings cannot leak backward into earlier games.',
  },
  {
    id: 'advanced_passing_stats',
    label: 'Advanced Passing Stats',
    path: '/nfl/v1/advanced_passing_stats',
    tier: 'GOAT',
    priority: 'P1',
    requestStrategy: 'season_page',
    historicalReplayUse: 'RESEARCH',
    forwardUse: 'GOAT_ONLY_BLOCKER',
    filters: ['cursor', 'per_page', 'season', 'week', 'player_ids', 'team_ids', 'position'],
    estimatedRowsPerSeason: 1100,
    estimatedRequestsPerSeason: 11,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/advanced-passing/*.json`,
    normalizedDestination: 'nfl_advanced_stats_research_staging',
    notes: 'High research value for QB/pass efficiency; exclude from ALL-STAR day-to-day core unless GOAT retained.',
  },
  {
    id: 'advanced_rushing_stats',
    label: 'Advanced Rushing Stats',
    path: '/nfl/v1/advanced_rushing_stats',
    tier: 'GOAT',
    priority: 'P1',
    requestStrategy: 'season_page',
    historicalReplayUse: 'RESEARCH',
    forwardUse: 'GOAT_ONLY_BLOCKER',
    filters: ['cursor', 'per_page', 'season', 'week', 'player_ids', 'team_ids', 'position'],
    estimatedRowsPerSeason: 1400,
    estimatedRequestsPerSeason: 14,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/advanced-rushing/*.json`,
    normalizedDestination: 'nfl_advanced_stats_research_staging',
    notes: 'Useful challenger feature source, not required for initial ALL-STAR forward operation.',
  },
  {
    id: 'advanced_receiving_stats',
    label: 'Advanced Receiving Stats',
    path: '/nfl/v1/advanced_receiving_stats',
    tier: 'GOAT',
    priority: 'P1',
    requestStrategy: 'season_page',
    historicalReplayUse: 'RESEARCH',
    forwardUse: 'GOAT_ONLY_BLOCKER',
    filters: ['cursor', 'per_page', 'season', 'week', 'player_ids', 'team_ids', 'position'],
    estimatedRowsPerSeason: 1800,
    estimatedRequestsPerSeason: 18,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/advanced-receiving/*.json`,
    normalizedDestination: 'nfl_advanced_stats_research_staging',
    notes: 'Useful for receiving/personnel research; not an initial production dependency.',
  },
  {
    id: 'team_roster',
    label: 'Team Roster And Depth Chart',
    path: '/nfl/v1/teams/{teamId}/roster',
    tier: 'GOAT',
    priority: 'P1',
    requestStrategy: 'team_roster',
    historicalReplayUse: 'RESEARCH',
    forwardUse: 'GOAT_ONLY_BLOCKER',
    filters: ['season'],
    estimatedRowsPerSeason: 2200,
    estimatedRequestsPerSeason: NFL_TEAMS,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/rosters/{teamId}.json`,
    normalizedDestination: 'sport_lineups or nfl_roster_depth_research_staging',
    notes: 'Official docs state roster data starts with 2025; treat earlier seasons as unavailable, not defective.',
  },
  {
    id: 'player_injuries',
    label: 'Player Injuries',
    path: '/nfl/v1/player_injuries',
    tier: 'ALL_STAR',
    priority: 'P2',
    requestStrategy: 'season_page',
    historicalReplayUse: 'FORWARD_ONLY',
    forwardUse: 'OPTIONAL',
    filters: ['cursor', 'per_page', 'player_ids', 'team_ids'],
    estimatedRowsPerSeason: 900,
    estimatedRequestsPerSeason: 9,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/injuries/*.json`,
    normalizedDestination: 'sport_injuries',
    notes: 'Do not use historically unless source timestamps/as-of semantics are proven at trial probe.',
  },
  {
    id: 'plays',
    label: 'Play By Play',
    path: '/nfl/v1/plays',
    tier: 'GOAT',
    priority: 'P2',
    requestStrategy: 'deferred',
    historicalReplayUse: 'RESEARCH',
    forwardUse: 'GOAT_ONLY_BLOCKER',
    filters: ['cursor', 'per_page', 'game_ids', 'dates', 'seasons', 'weeks'],
    estimatedRowsPerSeason: 45000,
    estimatedRequestsPerSeason: 450,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/plays/*.json`,
    normalizedDestination: 'nfl_play_by_play_research_staging',
    notes: 'High storage/request load. Defer unless P0/P1 complete with trial time remaining.',
  },
  {
    id: 'betting_odds',
    label: 'BallDontLie Betting Odds',
    path: '/nfl/v1/odds',
    tier: 'GOAT',
    priority: 'P2',
    requestStrategy: 'deferred',
    historicalReplayUse: 'RESEARCH',
    forwardUse: 'NOT_USED',
    filters: ['cursor', 'per_page', 'season', 'week', 'game_ids'],
    estimatedRowsPerSeason: 12000,
    estimatedRequestsPerSeason: 120,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/provider-odds-validation/*.json`,
    normalizedDestination: 'provider_validation_staging_only',
    notes: 'The Odds API remains betting-market authority. Do not replace it with BallDontLie odds.',
  },
  {
    id: 'player_props',
    label: 'Player Props',
    path: '/nfl/v1/player_props',
    tier: 'GOAT',
    priority: 'P2',
    requestStrategy: 'deferred',
    historicalReplayUse: 'NOT_USED',
    forwardUse: 'NOT_USED',
    filters: ['game_id', 'player_id', 'prop_type', 'vendors'],
    estimatedRowsPerSeason: 50000,
    estimatedRequestsPerSeason: 500,
    rawDestination: `${NFL_BALLDONTLIE_RAW_ROOT}/{season}/player-props/*.json`,
    normalizedDestination: 'deferred',
    notes: 'Player props are out of scope for NFL-01 and must remain disabled.',
  },
]

export function getExistingNflArchitectureInventory() {
  return [
    ['NFL prediction engine', 'src/services/nfl-prediction-engine.service.ts', 'PARTIAL', 'Preview-only deterministic fixture; no persistence or production recommendation activation.'],
    ['NFL feature store integration', 'src/services/nfl-feature-store-integration.service.ts', 'PARTIAL', 'Feature contracts exist; real NFL data, QB, injury, weather and rest context are pending.'],
    ['NFL historical foundation audit', 'src/services/nfl-historical-foundation-v2.service.ts', 'STALE', 'Read-only audit still references older data-foundation assumptions and stored row counts.'],
    ['NFL API routes', 'src/app/api/nfl/*', 'PARTIAL', 'Preview/health/validation surfaces exist, no production scheduler or writes.'],
    ['Shared sport prediction SDK', 'src/services/sport-prediction-engine-sdk.service.ts', 'READY', 'Moneyline/spread/total probability, EV, Kelly and settlement-compatible contracts exist.'],
    ['Shared settlement primitive', 'src/services/settlement-core.service.ts', 'READY', 'NFL moneyline/spread/total fixtures exist including push behavior.'],
    ['The Odds API market registry', 'src/services/multi-sport-markets.service.ts', 'READY', 'americanfootball_nfl maps h2h/spreads/totals.'],
    ['NFL product activation', 'product surfaces / scheduler', 'MISSING', 'No NFL Official Picks, scheduler automation, Current Era Shadow or production exposure is active.'],
  ].map(([component, evidence, state, notes]) => ({ component, evidence, state: state as NflComponentState, notes }))
}

export function getLegacySportsDataIoNflAudit() {
  return [
    {
      evidence: 'docs/providers/sportsdataio/NFL.md and sportsdataio endpoint catalog documentation',
      classification: 'LEGACY_UNUSED' as LegacyDependencyState,
      action: 'Do not depend on it for NFL. Preserve only as historical documentation unless a later cleanup is explicitly authorized.',
    },
    {
      evidence: 'scripts/live-multi-sport-acquisition-v1-checkpoint-c-nba-nfl.mjs imports sportsdataio-historical-import-readiness',
      classification: 'SHARED_DO_NOT_TOUCH' as LegacyDependencyState,
      action: 'Historical checkpoint artifact only; not part of new NFL provider plan.',
    },
    {
      evidence: 'docs/ARCHITECTURE/MULTI_SPORT_HANDOFF_V1.md older handoff row references SportsDataIO catalog/docs for NFL',
      classification: 'SAFE_TO_IGNORE' as LegacyDependencyState,
      action: 'Superseded by BallDontLie + The Odds API NFL authority plan.',
    },
  ]
}

export function getNflProviderAuthorityPlan() {
  return {
    sportsAndStats: {
      primary: NFL_BALLDONTLIE_PROVIDER_ID,
      trialUse: 'GOAT 48-hour trial for historical bulk capture only',
      ongoingUse: 'ALL_STAR for games, teams, players, stats, team stats, season stats, standings and injuries where useful',
      goatOnlyRisk: ['advanced passing/rushing/receiving stats', 'team roster/depth chart', 'plays', 'BallDontLie odds', 'player props'],
    },
    markets: {
      primary: 'the-odds-api',
      sportKey: NFL_SPORT_KEY,
      providerSportKey: 'americanfootball_nfl',
      markets: ['h2h', 'spreads', 'totals'],
      lineIdentity: 'event + market + selection + exact line + sportsbook/source timestamp',
    },
    excluded: {
      sportsdataio: 'not part of new NFL architecture',
      fakeHistoricalOdds: 'never fabricate -110 or line values',
      playerProps: 'deferred',
    },
  }
}

export function buildNflHistoricalVolumeEstimate(seasons = RECOMMENDED_NFL_HISTORICAL_SEASONS) {
  const seasonCount = seasons.length
  const games = seasonCount * TOTAL_GAMES_PER_SEASON
  return {
    seasons,
    estimatesNotProviderExact: true,
    regularSeasonGames: seasonCount * REGULAR_SEASON_GAMES_PER_SEASON,
    playoffGames: seasonCount * PLAYOFF_GAMES_PER_SEASON,
    totalGames: games,
    potentialPredictionCountAtThreeMarketsPerGame: games * CORE_MARKETS_PER_GAME,
    chronologicalSplit: {
      training: [2021, 2022, 2023],
      validationCalibration: [2024],
      holdout: [2025],
    },
  }
}

export function buildNflBallDontLieTrialManifest(seasons = RECOMMENDED_NFL_HISTORICAL_SEASONS): NflTrialManifestEntry[] {
  const entries: NflTrialManifestEntry[] = []
  for (const endpoint of NFL_BALLDONTLIE_ENDPOINTS) {
    if (endpoint.requestStrategy === 'deferred') continue
    if (endpoint.requestStrategy === 'once') {
      entries.push(buildManifestEntry(endpoint, 'all', endpoint.estimatedRowsPerSeason, endpoint.estimatedRequestsPerSeason, 'endpoint'))
      continue
    }
    for (const season of seasons) {
      if (endpoint.id === 'team_roster' && season < 2025) continue
      entries.push(buildManifestEntry(endpoint, season, endpoint.estimatedRowsPerSeason, endpoint.estimatedRequestsPerSeason, endpoint.requestStrategy === 'team_roster' ? 'team-season' : 'season-endpoint'))
    }
  }
  return entries.sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority) || String(a.season).localeCompare(String(b.season)))
}

export function summarizeNflBallDontLieHistoricalReadiness() {
  const manifest = buildNflBallDontLieTrialManifest()
  const p0 = manifest.filter((entry) => entry.priority === 'P0')
  const p1 = manifest.filter((entry) => entry.priority === 'P1')
  const p2 = NFL_BALLDONTLIE_ENDPOINTS.filter((endpoint) => endpoint.priority === 'P2')
  const totalRequests = manifest.reduce((sum, entry) => sum + entry.estimatedRequests, 0)
  const p0Requests = p0.reduce((sum, entry) => sum + entry.estimatedRequests, 0)
  const safeCapacity = NFL_BALLDONTLIE_TRIAL_HOURS * 60 * NFL_BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE
  const hardCapacity = NFL_BALLDONTLIE_TRIAL_HOURS * 60 * NFL_BALLDONTLIE_TRIAL_LIMIT_REQUESTS_PER_MINUTE
  const p0Hours = Number((p0Requests / NFL_BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE / 60).toFixed(2))
  const allPlannedHours = Number((totalRequests / NFL_BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE / 60).toFixed(2))
  const volume = buildNflHistoricalVolumeEstimate()

  return {
    mode: 'nfl_01_balldontlie_historical_import_readiness_v1',
    status: 'NFL_01_BALLDONTLIE_HISTORICAL_IMPORT_READINESS_CERTIFIED_WAITING_FOR_TRIAL',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    productionDatabaseMutationsMade: 0,
    apiKeyRequiredNow: false,
    trialActivationRequiredNow: false,
    provider: {
      id: NFL_BALLDONTLIE_PROVIDER_ID,
      envVar: 'BALLDONTLIE_API_KEY',
      baseUrl: NFL_BALLDONTLIE_BASE_URL,
      rawRoot: NFL_BALLDONTLIE_RAW_ROOT,
      safeRequestsPerMinute: NFL_BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE,
      trialLimitRequestsPerMinute: NFL_BALLDONTLIE_TRIAL_LIMIT_REQUESTS_PER_MINUTE,
      trialHours: NFL_BALLDONTLIE_TRIAL_HOURS,
    },
    architecture: {
      existingNfl: getExistingNflArchitectureInventory(),
      legacySportsDataIo: getLegacySportsDataIoNflAudit(),
      providerAuthority: getNflProviderAuthorityPlan(),
      volume,
    },
    trialPlan: {
      historicalSeasons: RECOMMENDED_NFL_HISTORICAL_SEASONS,
      safeCapacity,
      hardCapacity,
      plannedRequests: totalRequests,
      p0Requests,
      p0Hours,
      allPlannedHours,
      capacityClass: allPlannedHours <= NFL_BALLDONTLIE_TRIAL_HOURS - NFL_BALLDONTLIE_RESERVE_HOURS ? 'FITS_WITH_RESERVE' : 'P0_FIRST_THEN_P1',
      p0Endpoints: unique(p0.map((entry) => entry.endpointId)),
      p1Endpoints: unique(p1.map((entry) => entry.endpointId)),
      p2DeferredEndpoints: p2.map((endpoint) => endpoint.id),
      manifest,
    },
    endpoints: NFL_BALLDONTLIE_ENDPOINTS,
    hardGuard: {
      defaultMode: 'DRY_RUN',
      providerCallsAllowedByDefault: false,
      executionRequires: [
        '--execute',
        'NFL_BALLDONTLIE_TRIAL_ACTIVE=true',
        'NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED=true',
        'BALLDONTLIE_API_KEY present',
        'maxCalls or maxRuntimeMinutes supplied',
      ],
      noScheduler: true,
    },
    leakageContract: {
      cutoffBasis: 'kickoff_time',
      rule: 'Every historical feature must be derived from games or source evidence strictly before kickoff T.',
      bannedInputs: [
        'same-game final stats',
        'future season aggregates',
        'postgame injury status',
        'fabricated odds or lines',
        'retrospective predictions',
      ],
    },
    nextInstruction: 'Authorize NFL BALLDONTLIE TRIAL ACTIVE for one bounded connectivity/schema probe, then immediately run the P0 historical download queue with checkpointing.',
  }
}

export function validateNflBallDontLieHistoricalReadiness() {
  const summary = summarizeNflBallDontLieHistoricalReadiness()
  const p0EndpointIds = new Set(summary.trialPlan.p0Endpoints)
  const allStarForwardEndpoints = NFL_BALLDONTLIE_ENDPOINTS.filter((endpoint) => endpoint.forwardUse === 'CORE')
  const checks = {
    zeroProviderCalls: summary.providerCallsMade === 0,
    zeroProductionMutations: summary.productionDatabaseMutationsMade === 0,
    sportsDataIoExcludedFromAuthority: summary.architecture.providerAuthority.excluded.sportsdataio.includes('not part'),
    oddsApiAuthorityForMarkets: summary.architecture.providerAuthority.markets.providerSportKey === NFL_SPORT_KEY,
    recommendedSeasonsPresent: summary.trialPlan.historicalSeasons.join(',') === '2021,2022,2023,2024,2025',
    p0IncludesGames: p0EndpointIds.has('games'),
    p0IncludesPlayerStats: p0EndpointIds.has('stats'),
    p0IncludesTeamStats: p0EndpointIds.has('team_stats'),
    rawDestinationsDeclared: summary.trialPlan.manifest.every((entry) => entry.rawPayloadDestination.includes(NFL_BALLDONTLIE_RAW_ROOT)),
    dryRunHardGuardPresent: summary.hardGuard.providerCallsAllowedByDefault === false && summary.hardGuard.noScheduler === true,
    allStarDayToDayCoreFeasible: allStarForwardEndpoints.every((endpoint) => endpoint.tier === 'FREE' || endpoint.tier === 'ALL_STAR'),
    goatOnlyRisksIdentified: summary.architecture.providerAuthority.sportsAndStats.goatOnlyRisk.length >= 3,
    leakageContractPresent: summary.leakageContract.bannedInputs.includes('same-game final stats'),
    p0FitsTrial: summary.trialPlan.p0Hours < NFL_BALLDONTLIE_TRIAL_HOURS,
    noPlayerPropsActivated: NFL_BALLDONTLIE_ENDPOINTS.find((endpoint) => endpoint.id === 'player_props')?.requestStrategy === 'deferred',
  }

  return {
    success: Object.values(checks).every(Boolean),
    mode: 'nfl_01_balldontlie_historical_import_readiness_validation_v1',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    productionDatabaseMutationsMade: 0,
    checks,
    summary: {
      status: summary.status,
      checks: Object.keys(checks).length,
      passed: Object.values(checks).filter(Boolean).length,
      plannedRequests: summary.trialPlan.plannedRequests,
      p0Requests: summary.trialPlan.p0Requests,
      p0Hours: summary.trialPlan.p0Hours,
      historicalSeasons: summary.trialPlan.historicalSeasons,
      totalGames: summary.architecture.volume.totalGames,
      potentialPredictions: summary.architecture.volume.potentialPredictionCountAtThreeMarketsPerGame,
    },
  }
}

function buildManifestEntry(
  endpoint: NflBallDontLieEndpoint,
  season: number | 'all' | 'current',
  rows: number,
  requests: number,
  checkpointUnit: string
): NflTrialManifestEntry {
  const seasonPath = String(season)
  return {
    requestId: `bdl_nfl_${endpoint.id}_${seasonPath}`,
    endpointId: endpoint.id,
    endpointPath: endpoint.path,
    priority: endpoint.priority,
    season,
    estimatedRows: rows,
    estimatedRequests: requests,
    checkpointUnit,
    retryBehavior: 'cursor checkpoint, sanitized raw payload write, retry 429 with Retry-After, skip already durable payloads',
    rawPayloadDestination: endpoint.rawDestination.replaceAll('{season}', seasonPath),
    normalizedDestination: endpoint.normalizedDestination,
    providerCallsMade: 0,
  }
}

function priorityWeight(priority: NflTrialPriority) {
  return { P0: 0, P1: 1, P2: 2 }[priority]
}

function unique(values: string[]) {
  return [...new Set(values)]
}
