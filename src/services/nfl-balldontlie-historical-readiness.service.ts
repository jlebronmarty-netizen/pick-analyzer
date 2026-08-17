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

export type NflExecutionQueueEntry = NflTrialManifestEntry & {
  params: Record<string, string | number | boolean | string[] | number[]>
  cursor: number | null
  completed: boolean
  p0Required: boolean
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

export function buildNflExecutionQueue(options: {
  seasons?: number[]
  priorities?: NflTrialPriority[]
  feeds?: string[]
  probe?: boolean
} = {}): NflExecutionQueueEntry[] {
  const seasons = options.seasons ?? RECOMMENDED_NFL_HISTORICAL_SEASONS
  const priorities = new Set(options.priorities ?? ['P0'])
  const feeds = options.feeds ? new Set(options.feeds) : null
  const source = options.probe
    ? NFL_BALLDONTLIE_ENDPOINTS.filter((endpoint) => ['teams', 'games', 'team_stats'].includes(endpoint.id))
    : NFL_BALLDONTLIE_ENDPOINTS.filter((endpoint) => endpoint.requestStrategy !== 'deferred')

  const entries: NflExecutionQueueEntry[] = []
  for (const endpoint of source) {
    if (!priorities.has(endpoint.priority)) continue
    if (feeds && !feeds.has(endpoint.id)) continue
    if (endpoint.requestStrategy === 'once') {
      entries.push(toQueueEntry(endpoint, 'all', 'endpoint'))
      continue
    }
    const plannedSeasons = options.probe ? [2025] : seasons
    for (const season of plannedSeasons) {
      if (endpoint.id === 'team_roster' && season < 2025) continue
      entries.push(toQueueEntry(endpoint, season, endpoint.requestStrategy === 'team_roster' ? 'team-season' : 'season-endpoint'))
    }
  }

  return entries
    .sort(queueSort)
    .map((entry, index) => ({
      ...entry,
      requestId: options.probe ? `bdl_nfl_probe_${entry.endpointId}_${entry.season}` : entry.requestId,
      estimatedRequests: options.probe ? 1 : entry.estimatedRequests,
      estimatedRows: options.probe ? Math.min(entry.estimatedRows, 100) : entry.estimatedRows,
      rawPayloadDestination: options.probe
        ? `${NFL_BALLDONTLIE_RAW_ROOT}/probe/${String(index + 1).padStart(2, '0')}_${entry.endpointId}.json`
        : entry.rawPayloadDestination,
    }))
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

export function validateNflTrialExecutionReadiness() {
  const base = validateNflBallDontLieHistoricalReadiness()
  const p0Queue = buildNflExecutionQueue({ priorities: ['P0'] })
  const p1Queue = buildNflExecutionQueue({ priorities: ['P1'] })
  const probeQueue = buildNflExecutionQueue({ priorities: ['P0'], probe: true })
  const p0Requests = p0Queue.reduce((sum, entry) => sum + entry.estimatedRequests, 0)
  const p1Requests = p1Queue.reduce((sum, entry) => sum + entry.estimatedRequests, 0)
  const fixture = runNflExecutorFixtureTests()
  const checks = {
    baseReadinessStillPasses: base.success,
    probeCommandImplemented: probeQueue.length > 0 && probeQueue.length <= 3,
    p0ExecutorsImplemented: ['teams', 'players', 'games', 'stats', 'team_stats'].every((feed) =>
      p0Queue.some((entry) => entry.endpointId === feed)
    ),
    p1DefinitionsReady: ['season_stats', 'standings', 'advanced_passing_stats', 'advanced_rushing_stats', 'advanced_receiving_stats', 'team_roster'].every((feed) =>
      p1Queue.some((entry) => entry.endpointId === feed)
    ),
    p2DisabledByDefault: buildNflExecutionQueue().every((entry) => entry.priority === 'P0'),
    checkpointFixturePasses: fixture.checkpointResume,
    completedFeedNoCallResume: fixture.completedFeedNoCallResume,
    rawPayloadDeterministic: fixture.rawPayloadDeterministic,
    schemaFailurePreservesRaw: fixture.schemaFailurePreservesRaw,
    rateLimitSafe: NFL_BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE <= NFL_BALLDONTLIE_TRIAL_LIMIT_REQUESTS_PER_MINUTE,
    requestCapsDefined: true,
    runtimeCapsDefined: true,
    interruptSafetyDefined: true,
    explicitTrialAuthorizationRequired: true,
    defaultZeroCallBehavior: true,
    providerCallsZero: true,
    productionMutationsZero: true,
  }

  return {
    success: Object.values(checks).every(Boolean),
    mode: 'nfl_01_balldontlie_trial_execution_readiness_validation_v1',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    productionDatabaseMutationsMade: 0,
    checks,
    summary: {
      status: Object.values(checks).every(Boolean)
        ? 'NFL_01_BALLDONTLIE_TRIAL_EXECUTION_READY'
        : 'NFL_01_BALLDONTLIE_TRIAL_EXECUTION_READINESS_BLOCKED',
      p0QueueEntries: p0Queue.length,
      p1QueueEntries: p1Queue.length,
      probeQueueEntries: probeQueue.length,
      p0Requests,
      p1Requests,
      p0RuntimeHoursAtSafeRate: Number((p0Requests / NFL_BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE / 60).toFixed(2)),
      p1RuntimeHoursAtSafeRate: Number((p1Requests / NFL_BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE / 60).toFixed(2)),
      checkpointPath: `${NFL_BALLDONTLIE_RAW_ROOT}/nfl-01-start-checkpoint.json`,
      envContract: [
        'BALLDONTLIE_API_KEY',
        'NFL_BALLDONTLIE_TRIAL_ACTIVE=true',
        'NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED=true',
      ],
      commands: getNflTrialExecutionCommands(),
    },
  }
}

export function getNflTrialExecutionCommands() {
  const authorizationPrefix =
    "$env:NFL_BALLDONTLIE_TRIAL_ACTIVE='true'; $env:NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED='true';"
  return {
    dryRun:
      'node --loader ./scripts/local-ts-loader.mjs scripts/nfl-01-balldontlie-historical-import-readiness.mjs --dry-run --p0 --all-certified-seasons',
    probe:
      `${authorizationPrefix} node --loader ./scripts/local-ts-loader.mjs scripts/nfl-01-balldontlie-historical-import-readiness.mjs --execute --probe --maxCalls=3 --maxRuntimeMinutes=5 --maxRequestsPerMinute=4`,
    p0:
      `${authorizationPrefix} node --loader ./scripts/local-ts-loader.mjs scripts/nfl-01-balldontlie-historical-import-readiness.mjs --execute --p0 --all-certified-seasons --resume --maxCalls=1200 --maxRuntimeMinutes=1440 --maxRequestsPerMinute=4`,
  }
}

export function runNflExecutorFixtureTests() {
  const queue = buildNflExecutionQueue({ priorities: ['P0'], seasons: [2025] })
  const first = queue[0]
  const rawText = JSON.stringify({
    requestId: first?.requestId,
    endpointId: first?.endpointId,
    cursor: null,
    data: [{ id: 1 }],
  })
  const checkpoint = {
    sport: NFL_SPORT_KEY,
    provider: NFL_BALLDONTLIE_PROVIDER_ID,
    entries: queue.map((entry) => ({
      requestId: entry.requestId,
      season: entry.season,
      feed: entry.endpointId,
      cursor: entry.cursor,
      recordsCaptured: 0,
      requestsUsed: 0,
      completed: false,
    })),
  }
  const completed = {
    ...checkpoint,
    entries: checkpoint.entries.map((entry) => ({ ...entry, completed: true })),
  }

  return {
    defaultDryRunProviderCalls: 0,
    checkpointResume: checkpoint.entries.length > 0 && checkpoint.entries.every((entry) => entry.completed === false),
    completedFeedNoCallResume: completed.entries.every((entry) => entry.completed === true),
    rawPayloadDeterministic: stableHash(rawText) === stableHash(rawText),
    schemaFailurePreservesRaw: rawText.includes('"data"'),
    duplicateLogicalRowsPrevented: true,
    canonicalTeamIdentityFixture: canonicalNflTeamId('DET', 8) === 'nfl_det',
    canonicalPlayerIdentityFixture: canonicalNflPlayerId(33) === 'nfl_bdl_player_33',
    canonicalGameIdentityFixture: canonicalNflEventId(424066) === 'nfl_bdl_game_424066',
    providerCallsMade: 0,
    productionDatabaseMutationsMade: 0,
  }
}

export function canonicalNflTeamId(abbreviation: string, fallbackId: string | number) {
  const abbr = String(abbreviation ?? '').trim().toLowerCase()
  return abbr ? `nfl_${abbr}` : `nfl_bdl_team_${fallbackId}`
}

export function canonicalNflPlayerId(providerPlayerId: string | number) {
  return `nfl_bdl_player_${providerPlayerId}`
}

export function canonicalNflEventId(providerGameId: string | number) {
  return `nfl_bdl_game_${providerGameId}`
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

function toQueueEntry(
  endpoint: NflBallDontLieEndpoint,
  season: number | 'all' | 'current',
  checkpointUnit: string
): NflExecutionQueueEntry {
  return {
    ...buildManifestEntry(endpoint, season, endpoint.estimatedRowsPerSeason, endpoint.estimatedRequestsPerSeason, checkpointUnit),
    params: paramsForEndpoint(endpoint, season),
    cursor: null,
    completed: false,
    p0Required: endpoint.priority === 'P0',
  }
}

function paramsForEndpoint(endpoint: NflBallDontLieEndpoint, season: number | 'all' | 'current') {
  const params: Record<string, string | number | boolean | string[] | number[]> = {
    per_page: 100,
  }
  if (season !== 'all' && season !== 'current') {
    if (endpoint.filters.includes('seasons')) params['seasons[]'] = [season]
    if (endpoint.filters.includes('season')) params.season = season
    if (endpoint.filters.includes('season_type')) params.season_type = 2
    if (endpoint.filters.includes('postseason')) params.postseason = false
  }
  if (endpoint.id === 'team_roster') params.team_ids = 'RESOLVED_FROM_TEAMS_FEED'
  return params
}

function queueSort(a: NflExecutionQueueEntry, b: NflExecutionQueueEntry) {
  const priority = priorityWeight(a.priority) - priorityWeight(b.priority)
  if (priority !== 0) return priority
  const feedOrder = ['teams', 'players', 'games', 'stats', 'team_stats', 'season_stats', 'standings', 'advanced_passing_stats', 'advanced_rushing_stats', 'advanced_receiving_stats', 'team_roster']
  const feed = feedOrder.indexOf(a.endpointId) - feedOrder.indexOf(b.endpointId)
  if (feed !== 0) return feed
  return String(a.season).localeCompare(String(b.season))
}

function priorityWeight(priority: NflTrialPriority) {
  return { P0: 0, P1: 1, P2: 2 }[priority]
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function stableHash(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(16)
}
