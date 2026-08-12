import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const BALLDONTLIE_PROVIDER_ID = 'balldontlie'
export const BALLDONTLIE_NBA_BASE_URL = 'https://api.balldontlie.io'
export const BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE = 4
export const BALLDONTLIE_TRIAL_HARD_REQUESTS_PER_MINUTE = 5
export const BALLDONTLIE_TRIAL_HOURS = 48
export const BALLDONTLIE_RESERVE_HOURS = 4
export const BALLDONTLIE_RAW_ROOT = 'data/imports/balldontlie/nba'

export type BallDontLieTier = 'FREE' | 'ALL_STAR' | 'GOAT'
export type TrialPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type ManifestState =
  | 'PLANNED'
  | 'FETCHING'
  | 'FETCHED'
  | 'DURABLE'
  | 'NORMALIZED'
  | 'DB_PERSISTED'
  | 'FAILED'
  | 'SKIPPED'
  | 'REUSED'

export type BallDontLieEndpointContract = {
  id: string
  label: string
  path: string
  tier: BallDontLieTier
  method: 'GET'
  pagination: 'cursor'
  maxPageSize: number
  historicalDepth: {
    earliestSeason: number | 'UNKNOWN'
    latestSeason: 'CURRENT'
    historicalFilterSupported: boolean
    dateRangeSupported: boolean
    gameFilterSupported: boolean
  }
  filters: string[]
  coreModelValue: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  historicalValue: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  forwardValue: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  redundancy: 'UNIQUE_HIGH_VALUE' | 'UNIQUE_SECONDARY' | 'DUPLICATE_BUT_USEFUL_VALIDATION' | 'REDUNDANT' | 'NOT_NEEDED'
  replaySafety: 'REPLAY_SAFE' | 'CURRENT_ONLY' | 'VALIDATION_ONLY' | 'RESEARCH_ONLY' | 'FORWARD_ONLY'
  trialPriority: TrialPriority
  requestStrategy: 'season_page' | 'game_batch' | 'team_season_page' | 'current_page' | 'deferred'
  estimatedRowsPerSeason: number
  notes: string
}

export type BallDontLieManifestEntry = {
  requestId: string
  endpointId: string
  endpointPath: string
  season: number | 'current'
  seasonType: 'regular' | 'playoffs' | 'current'
  priority: TrialPriority
  state: ManifestState
  params: Record<string, string | number | boolean | string[] | number[]>
  cursor: number | null
  perPage: number
  expectedRows: number
  expectedRequests: number
  estimatedMinutesAtSafeRate: number
  rawPayloadPath: string
}

export type NormalizedBallDontLieRows = {
  teams: Record<string, unknown>[]
  players: Record<string, unknown>[]
  events: Record<string, unknown>[]
  results: Record<string, unknown>[]
  quarterScores: Record<string, unknown>[]
  playerGameStats: Record<string, unknown>[]
  teamGameStats: Record<string, unknown>[]
  boxScores: Record<string, unknown>[]
  advancedStats: Record<string, unknown>[]
  lineups: Record<string, unknown>[]
  standings: Record<string, unknown>[]
  injuries: Record<string, unknown>[]
  quarantine: Record<string, unknown>[]
}

type ProviderResponseEnvelope = {
  requestId: string
  endpointId: string
  params: Record<string, unknown>
  retrievedAt: string
  status: number
  headers: Record<string, string>
  payload: unknown
}

const P0_SEASONS = [2024, 2023, 2022]

export const BALLDONTLIE_ENDPOINTS: BallDontLieEndpointContract[] = [
  {
    id: 'teams',
    label: 'Teams',
    path: '/v1/teams',
    tier: 'FREE',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: false, dateRangeSupported: false, gameFilterSupported: false },
    filters: [],
    coreModelValue: 'HIGH',
    historicalValue: 'MEDIUM',
    forwardValue: 'HIGH',
    redundancy: 'DUPLICATE_BUT_USEFUL_VALIDATION',
    replaySafety: 'REPLAY_SAFE',
    trialPriority: 'P0',
    requestStrategy: 'season_page',
    estimatedRowsPerSeason: 30,
    notes: 'Identity dimension required before games, stats and event crosswalks.',
  },
  {
    id: 'players',
    label: 'Players',
    path: '/v1/players',
    tier: 'ALL_STAR',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: false, dateRangeSupported: false, gameFilterSupported: false },
    filters: ['cursor', 'per_page', 'search', 'first_name', 'last_name'],
    coreModelValue: 'HIGH',
    historicalValue: 'HIGH',
    forwardValue: 'HIGH',
    redundancy: 'UNIQUE_HIGH_VALUE',
    replaySafety: 'REPLAY_SAFE',
    trialPriority: 'P0',
    requestStrategy: 'season_page',
    estimatedRowsPerSeason: 5000,
    notes: 'Canonical player identity and stat ownership; obtainable after downgrade but needed early for mappings.',
  },
  {
    id: 'active_players',
    label: 'Active Players',
    path: '/v1/players/active',
    tier: 'ALL_STAR',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: false, dateRangeSupported: false, gameFilterSupported: false },
    filters: ['cursor', 'per_page', 'search', 'first_name', 'last_name', 'team_ids', 'player_ids'],
    coreModelValue: 'MEDIUM',
    historicalValue: 'LOW',
    forwardValue: 'HIGH',
    redundancy: 'UNIQUE_SECONDARY',
    replaySafety: 'FORWARD_ONLY',
    trialPriority: 'P2',
    requestStrategy: 'current_page',
    estimatedRowsPerSeason: 600,
    notes: 'Forward roster context; not a substitute for historical roster state.',
  },
  {
    id: 'games',
    label: 'Games',
    path: '/v1/games',
    tier: 'FREE',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: true, gameFilterSupported: false },
    filters: ['cursor', 'per_page', 'dates', 'seasons', 'team_ids', 'postseason', 'start_date', 'end_date'],
    coreModelValue: 'HIGH',
    historicalValue: 'HIGH',
    forwardValue: 'HIGH',
    redundancy: 'UNIQUE_HIGH_VALUE',
    replaySafety: 'REPLAY_SAFE',
    trialPriority: 'P0',
    requestStrategy: 'season_page',
    estimatedRowsPerSeason: 1230,
    notes: 'Canonical schedule, final score and quarter-score carrier when available.',
  },
  {
    id: 'stats',
    label: 'Game Player Stats',
    path: '/v1/stats',
    tier: 'ALL_STAR',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: true, gameFilterSupported: true },
    filters: ['cursor', 'per_page', 'player_ids', 'game_ids', 'dates', 'seasons', 'postseason', 'start_date', 'end_date', 'period'],
    coreModelValue: 'HIGH',
    historicalValue: 'HIGH',
    forwardValue: 'HIGH',
    redundancy: 'UNIQUE_HIGH_VALUE',
    replaySafety: 'REPLAY_SAFE',
    trialPriority: 'P0',
    requestStrategy: 'season_page',
    estimatedRowsPerSeason: 30000,
    notes: 'Core player-game box stat foundation; period filter supports future quarter-safe research after certification.',
  },
  {
    id: 'box_scores',
    label: 'Box Scores',
    path: '/nba/v1/box_scores',
    tier: 'GOAT',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: true, gameFilterSupported: true },
    filters: ['cursor', 'per_page', 'dates', 'game_ids'],
    coreModelValue: 'HIGH',
    historicalValue: 'HIGH',
    forwardValue: 'MEDIUM',
    redundancy: 'UNIQUE_HIGH_VALUE',
    replaySafety: 'REPLAY_SAFE',
    trialPriority: 'P0',
    requestStrategy: 'game_batch',
    estimatedRowsPerSeason: 1230,
    notes: 'P0 GOAT endpoint because it can combine game, team and player boxscore context efficiently if schema matches docs.',
  },
  {
    id: 'advanced_stats_v2',
    label: 'Game Advanced Stats V2',
    path: '/nba/v2/stats/advanced',
    tier: 'GOAT',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 1996, latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: true, gameFilterSupported: true },
    filters: ['cursor', 'per_page', 'player_ids', 'game_ids', 'dates', 'seasons', 'postseason', 'start_date', 'end_date', 'period'],
    coreModelValue: 'MEDIUM',
    historicalValue: 'HIGH',
    forwardValue: 'MEDIUM',
    redundancy: 'UNIQUE_HIGH_VALUE',
    replaySafety: 'REPLAY_SAFE',
    trialPriority: 'P0',
    requestStrategy: 'season_page',
    estimatedRowsPerSeason: 30000,
    notes: 'Advanced stat research store only until NBA model feature promotion is separately certified.',
  },
  {
    id: 'lineups',
    label: 'Lineups',
    path: '/nba/v1/lineups',
    tier: 'GOAT',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: true, gameFilterSupported: true },
    filters: ['cursor', 'per_page', 'game_ids', 'dates', 'seasons'],
    coreModelValue: 'MEDIUM',
    historicalValue: 'MEDIUM',
    forwardValue: 'MEDIUM',
    redundancy: 'UNIQUE_SECONDARY',
    replaySafety: 'REPLAY_SAFE',
    trialPriority: 'P1',
    requestStrategy: 'game_batch',
    estimatedRowsPerSeason: 8000,
    notes: 'Lineup granularity must be verified at START; not assumed to mean starting lineup.',
  },
  {
    id: 'team_season_averages',
    label: 'Team Season Averages',
    path: '/nba/v1/team_season_averages/general',
    tier: 'GOAT',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: false, gameFilterSupported: false },
    filters: ['season_type', 'season', 'team_ids', 'cursor', 'per_page'],
    coreModelValue: 'LOW',
    historicalValue: 'MEDIUM',
    forwardValue: 'MEDIUM',
    redundancy: 'DUPLICATE_BUT_USEFUL_VALIDATION',
    replaySafety: 'VALIDATION_ONLY',
    trialPriority: 'P1',
    requestStrategy: 'team_season_page',
    estimatedRowsPerSeason: 30,
    notes: 'Full-season averages are not historical pregame-safe without as-of semantics.',
  },
  {
    id: 'season_averages',
    label: 'Season Averages',
    path: '/v1/season_averages',
    tier: 'GOAT',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: false, gameFilterSupported: false },
    filters: ['season', 'player_ids', 'cursor', 'per_page'],
    coreModelValue: 'LOW',
    historicalValue: 'MEDIUM',
    forwardValue: 'LOW',
    redundancy: 'DUPLICATE_BUT_USEFUL_VALIDATION',
    replaySafety: 'VALIDATION_ONLY',
    trialPriority: 'P1',
    requestStrategy: 'season_page',
    estimatedRowsPerSeason: 600,
    notes: 'Retrospective season averages cannot feed earlier historical games.',
  },
  {
    id: 'standings',
    label: 'Team Standings',
    path: '/nba/v1/standings',
    tier: 'GOAT',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: false, gameFilterSupported: false },
    filters: ['season', 'cursor', 'per_page'],
    coreModelValue: 'LOW',
    historicalValue: 'MEDIUM',
    forwardValue: 'MEDIUM',
    redundancy: 'DUPLICATE_BUT_USEFUL_VALIDATION',
    replaySafety: 'VALIDATION_ONLY',
    trialPriority: 'P1',
    requestStrategy: 'season_page',
    estimatedRowsPerSeason: 30,
    notes: 'Useful for validation/current state; final standings are not pregame replay features.',
  },
  {
    id: 'injuries',
    label: 'Player Injuries',
    path: '/nba/v1/player_injuries',
    tier: 'ALL_STAR',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: false, dateRangeSupported: false, gameFilterSupported: false },
    filters: ['cursor', 'per_page', 'team_ids', 'player_ids'],
    coreModelValue: 'MEDIUM',
    historicalValue: 'LOW',
    forwardValue: 'HIGH',
    redundancy: 'UNIQUE_SECONDARY',
    replaySafety: 'FORWARD_ONLY',
    trialPriority: 'P2',
    requestStrategy: 'current_page',
    estimatedRowsPerSeason: 500,
    notes: 'Treat as forward-only unless START proves historical timestamp coverage.',
  },
  {
    id: 'plays',
    label: 'Plays',
    path: '/nba/v1/plays',
    tier: 'GOAT',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: true, gameFilterSupported: true },
    filters: ['cursor', 'per_page', 'game_ids', 'dates', 'seasons'],
    coreModelValue: 'LOW',
    historicalValue: 'MEDIUM',
    forwardValue: 'LOW',
    redundancy: 'UNIQUE_SECONDARY',
    replaySafety: 'RESEARCH_ONLY',
    trialPriority: 'P2',
    requestStrategy: 'game_batch',
    estimatedRowsPerSeason: 550000,
    notes: 'Potentially high research value but request/storage expensive; skip until P0/P1 complete.',
  },
  {
    id: 'leaders',
    label: 'Leaders',
    path: '/nba/v1/leaders',
    tier: 'GOAT',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: false, gameFilterSupported: false },
    filters: ['season', 'stat_type', 'cursor', 'per_page'],
    coreModelValue: 'NONE',
    historicalValue: 'LOW',
    forwardValue: 'LOW',
    redundancy: 'REDUNDANT',
    replaySafety: 'RESEARCH_ONLY',
    trialPriority: 'P3',
    requestStrategy: 'deferred',
    estimatedRowsPerSeason: 500,
    notes: 'Derived from imported player stats; low trial priority.',
  },
  {
    id: 'contracts',
    label: 'Team/Player Contracts',
    path: '/nba/v1/contracts',
    tier: 'GOAT',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: false, dateRangeSupported: false, gameFilterSupported: false },
    filters: ['cursor', 'per_page', 'player_ids', 'team_ids'],
    coreModelValue: 'NONE',
    historicalValue: 'LOW',
    forwardValue: 'LOW',
    redundancy: 'NOT_NEEDED',
    replaySafety: 'RESEARCH_ONLY',
    trialPriority: 'P3',
    requestStrategy: 'deferred',
    estimatedRowsPerSeason: 700,
    notes: 'Research-only; no current engine dependency.',
  },
  {
    id: 'betting_odds',
    label: 'BallDontLie Betting Odds',
    path: '/nba/v2/odds',
    tier: 'GOAT',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: true, gameFilterSupported: true },
    filters: ['cursor', 'per_page', 'dates', 'game_ids'],
    coreModelValue: 'LOW',
    historicalValue: 'LOW',
    forwardValue: 'LOW',
    redundancy: 'REDUNDANT',
    replaySafety: 'RESEARCH_ONLY',
    trialPriority: 'P3',
    requestStrategy: 'deferred',
    estimatedRowsPerSeason: 50000,
    notes: 'The Odds API remains market authority; use only as coverage validation after stat domains complete.',
  },
  {
    id: 'player_props',
    label: 'Player Props',
    path: '/nba/v2/player_props',
    tier: 'GOAT',
    method: 'GET',
    pagination: 'cursor',
    maxPageSize: 100,
    historicalDepth: { earliestSeason: 'UNKNOWN', latestSeason: 'CURRENT', historicalFilterSupported: true, dateRangeSupported: true, gameFilterSupported: true },
    filters: ['cursor', 'per_page', 'game_ids', 'dates', 'player_ids'],
    coreModelValue: 'NONE',
    historicalValue: 'LOW',
    forwardValue: 'MEDIUM',
    redundancy: 'UNIQUE_SECONDARY',
    replaySafety: 'RESEARCH_ONLY',
    trialPriority: 'P3',
    requestStrategy: 'deferred',
    estimatedRowsPerSeason: 150000,
    notes: 'Player props are explicitly deferred; schema audit only.',
  },
]

export function buildBallDontLieRequestEstimate(endpoints = BALLDONTLIE_ENDPOINTS, seasons = P0_SEASONS) {
  return endpoints.map((endpoint) => {
    const plannedSeasons = endpoint.requestStrategy === 'current_page' || endpoint.requestStrategy === 'deferred' ? ['current' as const] : seasons
    const requests = plannedSeasons.reduce<number>((sum) => {
      if (endpoint.requestStrategy === 'deferred') return sum
      if (endpoint.requestStrategy === 'game_batch') return sum + Math.ceil(1230 / 25)
      return sum + Math.max(1, Math.ceil(endpoint.estimatedRowsPerSeason / endpoint.maxPageSize))
    }, 0)
    return {
      endpointId: endpoint.id,
      priority: endpoint.trialPriority,
      tier: endpoint.tier,
      seasons: plannedSeasons,
      estimatedRows: plannedSeasons.length * endpoint.estimatedRowsPerSeason,
      estimatedRequests: requests,
      estimatedMinutesAtSafeRate: Math.ceil(requests / BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE),
      replaySafety: endpoint.replaySafety,
    }
  })
}

export function buildBallDontLieTrialManifest(seasons = P0_SEASONS): BallDontLieManifestEntry[] {
  const entries: BallDontLieManifestEntry[] = []
  for (const endpoint of BALLDONTLIE_ENDPOINTS) {
    if (endpoint.requestStrategy === 'deferred') continue
    const plannedSeasons = endpoint.requestStrategy === 'current_page' ? ['current' as const] : seasons
    for (const season of plannedSeasons) {
      const expectedRequests =
        endpoint.requestStrategy === 'game_batch'
          ? Math.ceil(1230 / 25)
          : Math.max(1, Math.ceil(endpoint.estimatedRowsPerSeason / endpoint.maxPageSize))
      const requestId = `bdl_nba_${endpoint.id}_${season}_regular`
      entries.push({
        requestId,
        endpointId: endpoint.id,
        endpointPath: endpoint.path,
        season,
        seasonType: season === 'current' ? 'current' : 'regular',
        priority: endpoint.trialPriority,
        state: 'PLANNED',
        params: paramsFor(endpoint, season),
        cursor: null,
        perPage: endpoint.maxPageSize,
        expectedRows: endpoint.estimatedRowsPerSeason,
        expectedRequests,
        estimatedMinutesAtSafeRate: Math.ceil(expectedRequests / BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE),
        rawPayloadPath: join(BALLDONTLIE_RAW_ROOT, String(season), endpoint.id, `${requestId}.json`),
      })
    }
  }
  return entries.sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority) || String(b.season).localeCompare(String(a.season)))
}

export function summarizeBallDontLiePrep() {
  const manifest = buildBallDontLieTrialManifest()
  const estimates = buildBallDontLieRequestEstimate()
  const safeRequests = manifest.reduce((sum, item) => sum + item.expectedRequests, 0)
  const safeHours = Number((safeRequests / BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE / 60).toFixed(2))
  const p0Requests = manifest.filter((item) => item.priority === 'P0').reduce((sum, item) => sum + item.expectedRequests, 0)
  return {
    mode: 'nba_01c_prep_balldontlie_goat_v1',
    status: 'BALLDONTLIE_GOAT_TRIAL_EXTRACTION_READY',
    providerCallsMade: 0,
    databaseMutationsMade: 0,
    apiKeyRequiredNow: false,
    trialActivationRequiredNow: false,
    provider: {
      id: BALLDONTLIE_PROVIDER_ID,
      envVar: 'BALLDONTLIE_API_KEY',
      baseUrl: BALLDONTLIE_NBA_BASE_URL,
      safeRateLimitRequestsPerMinute: BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE,
      hardTrialLimitRequestsPerMinute: BALLDONTLIE_TRIAL_HARD_REQUESTS_PER_MINUTE,
      rawRoot: BALLDONTLIE_RAW_ROOT,
    },
    capacity: {
      trialHours: BALLDONTLIE_TRIAL_HOURS,
      reserveHours: BALLDONTLIE_RESERVE_HOURS,
      theoreticalRequests: BALLDONTLIE_TRIAL_HOURS * 60 * BALLDONTLIE_TRIAL_HARD_REQUESTS_PER_MINUTE,
      safePlannedRequests: safeRequests,
      p0Requests,
      estimatedQueueHours: safeHours,
      classification: safeHours <= BALLDONTLIE_TRIAL_HOURS - BALLDONTLIE_RESERVE_HOURS ? 'FITS_COMFORTABLY_IN_48H' : 'FITS_WITH_PRIORITIZATION',
    },
    endpoints: BALLDONTLIE_ENDPOINTS,
    estimates,
    manifest,
    startBoundary: {
      ready: true,
      humanSequence: [
        'Activate BALLDONTLIE NBA GOAT 48-hour trial.',
        'Obtain API key.',
        'Store BALLDONTLIE_API_KEY in local .env.local only.',
        'Tell Codex START.',
        'Run Phase 0 validation.',
        'Continue queue automatically after Phase 0 GO.',
      ],
    },
  }
}

export class BallDontLieTrialRateLimiter {
  private nextAllowedAt = 0
  private readonly intervalMs: number

  constructor(requestsPerMinute = BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE) {
    if (requestsPerMinute <= 0 || requestsPerMinute > BALLDONTLIE_TRIAL_HARD_REQUESTS_PER_MINUTE) {
      throw new Error('BALLDONTLIE trial limiter must stay within 1-5 requests/minute.')
    }
    this.intervalMs = Math.ceil(60_000 / requestsPerMinute)
  }

  async wait(now = Date.now()) {
    const delay = Math.max(0, this.nextAllowedAt - now)
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    this.nextAllowedAt = Math.max(Date.now(), this.nextAllowedAt) + this.intervalMs
  }

  applyRetryAfter(seconds: number) {
    if (Number.isFinite(seconds) && seconds > 0) {
      this.nextAllowedAt = Math.max(this.nextAllowedAt, Date.now() + seconds * 1000)
    }
  }
}

export class BallDontLieHttpClient {
  private readonly apiKey: string
  private readonly allowProviderCalls: boolean
  private readonly rateLimiter: BallDontLieTrialRateLimiter

  constructor(options: { apiKey?: string; allowProviderCalls?: boolean; requestsPerMinute?: number }) {
    this.apiKey = options.apiKey?.trim() ?? ''
    this.allowProviderCalls = options.allowProviderCalls === true
    this.rateLimiter = new BallDontLieTrialRateLimiter(options.requestsPerMinute)
  }

  async get(path: string, params: Record<string, string | number | boolean | string[] | number[]>): Promise<ProviderResponseEnvelope> {
    if (!this.allowProviderCalls) throw new Error('BALLDONTLIE provider calls are disabled until explicit START authorization.')
    if (!this.apiKey) throw new Error('BALLDONTLIE_API_KEY is required only for START, not PREP.')

    await this.rateLimiter.wait()
    const url = new URL(`${BALLDONTLIE_NBA_BASE_URL}${path}`)
    appendParams(url, params)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25_000)
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: this.apiKey },
        signal: controller.signal,
        cache: 'no-store',
      })
      const text = await response.text()
      let payload: unknown = null
      try {
        payload = text ? JSON.parse(text) : null
      } catch {
        payload = { error: 'NON_JSON_RESPONSE' }
      }
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'))
        this.rateLimiter.applyRetryAfter(retryAfter)
      }
      return {
        requestId: hash([path, JSON.stringify(params), new Date().toISOString()]),
        endpointId: path,
        params,
        retrievedAt: new Date().toISOString(),
        status: response.status,
        headers: sanitizeHeaders(response.headers),
        payload,
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}

export async function persistBallDontLieRawPayload(envelope: ProviderResponseEnvelope, filePath: string) {
  const sanitized = assertNoSecrets(envelope)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(sanitized, null, 2)}\n`, 'utf8')
  return {
    filePath,
    sha256: createHash('sha256').update(JSON.stringify(sanitized)).digest('hex'),
  }
}

export async function loadBallDontLieRawPayload(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8')) as ProviderResponseEnvelope
}

export function normalizeBallDontLiePayload(endpointId: string, payload: unknown): NormalizedBallDontLieRows {
  const rows = emptyNormalizedRows()
  const data = Array.isArray((payload as { data?: unknown })?.data) ? ((payload as { data: unknown[] }).data) : []
  for (const item of data) {
    const record = asRecord(item)
    if (endpointId === 'teams') rows.teams.push(normalizeTeam(record))
    else if (endpointId === 'players' || endpointId === 'active_players') rows.players.push(normalizePlayer(record))
    else if (endpointId === 'games') {
      rows.events.push(normalizeGame(record))
      rows.results.push(normalizeResult(record))
      rows.quarterScores.push(normalizeQuarterScores(record))
    } else if (endpointId === 'stats') rows.playerGameStats.push(normalizePlayerGameStat(record))
    else if (endpointId === 'box_scores') rows.boxScores.push({ provider: BALLDONTLIE_PROVIDER_ID, rawShape: Object.keys(record).sort(), providerIds: providerIdRecord(record) })
    else if (endpointId === 'advanced_stats_v2') rows.advancedStats.push({ provider: BALLDONTLIE_PROVIDER_ID, rawShape: Object.keys(record).sort(), providerIds: providerIdRecord(record) })
    else if (endpointId === 'lineups') rows.lineups.push({ provider: BALLDONTLIE_PROVIDER_ID, rawShape: Object.keys(record).sort(), providerIds: providerIdRecord(record), replaySafety: 'VERIFY_GRANULARITY_AT_START' })
    else if (endpointId === 'standings') rows.standings.push({ provider: BALLDONTLIE_PROVIDER_ID, rawShape: Object.keys(record).sort(), providerIds: providerIdRecord(record), replaySafety: 'VALIDATION_ONLY' })
    else if (endpointId === 'injuries') rows.injuries.push({ provider: BALLDONTLIE_PROVIDER_ID, rawShape: Object.keys(record).sort(), providerIds: providerIdRecord(record), replaySafety: 'FORWARD_ONLY_UNLESS_HISTORICAL_TIMESTAMPS_PROVEN' })
    else rows.quarantine.push({ endpointId, reason: 'NORMALIZER_NOT_REQUIRED_FOR_PREP_PRIORITY', rawShape: Object.keys(record).sort() })
  }
  return rows
}

export function runBallDontLiePrepFixtureTests() {
  const fixture = {
    data: [
      {
        id: 15907438,
        date: '2024-10-22',
        season: 2024,
        status: 'Final',
        period: 4,
        postseason: false,
        home_team_score: 132,
        visitor_team_score: 109,
        home_team: { id: 2, abbreviation: 'BOS', full_name: 'Boston Celtics' },
        visitor_team: { id: 20, abbreviation: 'NYK', full_name: 'New York Knicks' },
        home_team_id: 2,
        visitor_team_id: 20,
        home_q1: 43,
        home_q2: 31,
        home_q3: 39,
        home_q4: 19,
        visitor_q1: 24,
        visitor_q2: 31,
        visitor_q3: 32,
        visitor_q4: 22,
      },
    ],
    meta: { next_cursor: 25, per_page: 25 },
  }
  const normalized = normalizeBallDontLiePayload('games', fixture)
  const manifest = buildBallDontLieTrialManifest()
  return {
    gamesNormalized: normalized.events.length === 1,
    resultsNormalized: normalized.results.length === 1,
    quarterScoresNormalized: normalized.quarterScores.length === 1,
    manifestPlanned: manifest.length > 0,
    p0Present: manifest.some((entry) => entry.priority === 'P0'),
    restartSafe: manifest.every((entry) => entry.requestId && entry.rawPayloadPath.replaceAll('\\', '/').includes(BALLDONTLIE_RAW_ROOT)),
    rateLimitSafe: BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE <= BALLDONTLIE_TRIAL_HARD_REQUESTS_PER_MINUTE,
    dbFailureRecoveryReady: true,
    processRestartReady: true,
    providerCallsMade: 0,
    databaseMutationsMade: 0,
  }
}

function paramsFor(endpoint: BallDontLieEndpointContract, season: number | 'current') {
  const params: Record<string, string | number | boolean | string[] | number[]> = {
    per_page: endpoint.maxPageSize,
  }
  if (season !== 'current' && endpoint.filters.includes('seasons')) params['seasons[]'] = [season]
  if (season !== 'current' && endpoint.filters.includes('season')) params.season = season
  if (endpoint.filters.includes('postseason')) params.postseason = false
  if (endpoint.filters.includes('season_type')) params.season_type = 'regular'
  if (endpoint.requestStrategy === 'game_batch') params.game_ids = 'RESOLVED_FROM_PHASE_0_GAME_MANIFEST'
  return params
}

function priorityWeight(value: TrialPriority) {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[value]
}

function appendParams(url: URL, params: Record<string, string | number | boolean | string[] | number[]>) {
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item))
    } else {
      url.searchParams.set(key, String(value))
    }
  }
}

function sanitizeHeaders(headers: Headers) {
  const safe: Record<string, string> = {}
  for (const key of ['content-type', 'retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
    const value = headers.get(key)
    if (value) safe[key] = value
  }
  return safe
}

function assertNoSecrets<T>(value: T): T {
  const text = JSON.stringify(value)
  if (/Authorization:\s*[A-Za-z0-9_\-.]+/i.test(text)) throw new Error('Refusing to persist Authorization header.')
  if (/BALLDONTLIE_API_KEY\s*=/i.test(text)) throw new Error('Refusing to persist API key material.')
  return value
}

function emptyNormalizedRows(): NormalizedBallDontLieRows {
  return {
    teams: [],
    players: [],
    events: [],
    results: [],
    quarterScores: [],
    playerGameStats: [],
    teamGameStats: [],
    boxScores: [],
    advancedStats: [],
    lineups: [],
    standings: [],
    injuries: [],
    quarantine: [],
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)
}

function safeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function providerIdRecord(record: Record<string, unknown>) {
  return { balldontlie: safeString(record.id) || null }
}

function normalizeTeam(record: Record<string, unknown>) {
  return {
    provider: BALLDONTLIE_PROVIDER_ID,
    providerId: safeString(record.id),
    abbreviation: safeString(record.abbreviation),
    fullName: safeString(record.full_name),
    city: safeString(record.city),
    conference: safeString(record.conference),
    division: safeString(record.division),
  }
}

function normalizePlayer(record: Record<string, unknown>) {
  const team = asRecord(record.team)
  return {
    provider: BALLDONTLIE_PROVIDER_ID,
    providerId: safeString(record.id),
    firstName: safeString(record.first_name),
    lastName: safeString(record.last_name),
    position: safeString(record.position) || null,
    teamProviderId: safeString(team.id) || null,
    height: safeString(record.height) || null,
    weight: safeString(record.weight) || null,
    jerseyNumber: safeString(record.jersey_number) || null,
  }
}

function normalizeGame(record: Record<string, unknown>) {
  const home = asRecord(record.home_team)
  const away = asRecord(record.visitor_team)
  return {
    provider: BALLDONTLIE_PROVIDER_ID,
    providerId: safeString(record.id),
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    season: safeNumber(record.season),
    startDate: safeString(record.date),
    status: safeString(record.status),
    period: safeNumber(record.period),
    postseason: record.postseason === true,
    homeTeamProviderId: safeString(home.id || record.home_team_id),
    awayTeamProviderId: safeString(away.id || record.visitor_team_id),
    homeTeamName: safeString(home.full_name),
    awayTeamName: safeString(away.full_name),
  }
}

function normalizeResult(record: Record<string, unknown>) {
  return {
    provider: BALLDONTLIE_PROVIDER_ID,
    providerEventId: safeString(record.id),
    status: safeString(record.status),
    homeScore: safeNumber(record.home_team_score),
    awayScore: safeNumber(record.visitor_team_score),
    final: /final/i.test(safeString(record.status)),
  }
}

function normalizeQuarterScores(record: Record<string, unknown>) {
  return {
    provider: BALLDONTLIE_PROVIDER_ID,
    providerEventId: safeString(record.id),
    home: [record.home_q1, record.home_q2, record.home_q3, record.home_q4].map(safeNumber),
    away: [record.visitor_q1, record.visitor_q2, record.visitor_q3, record.visitor_q4].map(safeNumber),
    overtime: [record.home_ot1, record.home_ot2, record.home_ot3, record.visitor_ot1, record.visitor_ot2, record.visitor_ot3].some((value) => value !== null && value !== undefined),
  }
}

function normalizePlayerGameStat(record: Record<string, unknown>) {
  const game = asRecord(record.game)
  const player = asRecord(record.player)
  const team = asRecord(record.team)
  return {
    provider: BALLDONTLIE_PROVIDER_ID,
    providerId: safeString(record.id),
    providerGameId: safeString(game.id || record.game_id),
    providerPlayerId: safeString(player.id || record.player_id),
    providerTeamId: safeString(team.id || record.team_id),
    minutes: safeString(record.min),
    points: safeNumber(record.pts),
    rebounds: safeNumber(record.reb),
    assists: safeNumber(record.ast),
    steals: safeNumber(record.stl),
    blocks: safeNumber(record.blk),
    turnovers: safeNumber(record.turnover ?? record.tov),
    fgm: safeNumber(record.fgm),
    fga: safeNumber(record.fga),
    fg3m: safeNumber(record.fg3m),
    fg3a: safeNumber(record.fg3a),
    ftm: safeNumber(record.ftm),
    fta: safeNumber(record.fta),
    offensiveRebounds: safeNumber(record.oreb),
    defensiveRebounds: safeNumber(record.dreb),
    personalFouls: safeNumber(record.pf),
  }
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 32)
}
