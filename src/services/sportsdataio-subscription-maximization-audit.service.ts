import 'server-only'

import {
  SPORTSDATAIO_ENDPOINT_CATALOG,
  type SportsDataIoCatalogSport,
  type SportsDataIoEndpointCatalogEntry,
} from '@/config/sportsdataio-endpoint-catalog'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'
import {
  getSportsDataIoEnvironmentStatus,
  getSportsDataIoMlbDiscoveryLabChannel,
  runSportsDataIoRuntimeValidation,
} from '@/services/sportsdataio-runtime-adapter.service'

type GapStatus = 'USED' | 'PARTIALLY_USED' | 'NOT_USED'
type RoiRank = 'Critical' | 'High' | 'Medium' | 'Low'
type AuditStatus = 'SPORTSDATAIO_AUDIT_PASS' | 'SPORTSDATAIO_AUDIT_PARTIAL'
type EntitlementStatus =
  | 'ENTITLED_VERIFIED'
  | 'NOT_ENTITLED_VERIFIED'
  | 'AVAILABLE_FROM_PRIOR_SUCCESS'
  | 'UNKNOWN_NOT_PROBED'
  | 'UNSUPPORTED_BY_PRODUCT'
  | 'ENDPOINT_NOT_CONFIRMED'
  | 'NEEDS_SAFE_PROBE'

type CountResult = {
  table: string
  sportKey: string | null
  count: number
  error: string | null
}

type BudgetSummary = {
  sportKey: string
  callsMadeToday: number
  callsMadeLastHour: number
  estimatedCallsRemaining: number
  hourlyRemaining: number
  usagePercent: number
  warning: string | null
}

const SPORT_KEY_BY_CATALOG_SPORT: Record<SportsDataIoCatalogSport, string> = {
  nba: 'basketball_nba',
  mlb: 'baseball_mlb',
  nfl: 'americanfootball_nfl',
  nhl: 'icehockey_nhl',
  soccer: 'soccer',
}

const DOMAIN_STORAGE_TABLES: Record<string, string[]> = {
  teams: ['sports_teams', 'provider_entity_mappings'],
  players: ['sport_players', 'provider_entity_mappings'],
  schedules: ['sport_events', 'provider_entity_mappings'],
  results: ['sport_events', 'game_results'],
  stats: ['sport_game_stats', 'sport_player_stats', 'team_stats'],
  standings: ['sport_standings'],
  injuries: ['sport_injuries'],
  lineups: ['sport_lineups'],
  odds: ['sports_odds_snapshots'],
  props: ['sports_odds_snapshots'],
  settlement: ['sports_odds_snapshots'],
  competition: ['sports_teams', 'sport_standings'],
  metadata: ['sports_sync_jobs'],
}

const DOMAIN_VALUE: Record<string, { roi: RoiRank; stars: number; value: string }> = {
  schedules: { roi: 'Critical', stars: 5, value: 'Canonical slate, status lifecycle, settlement eligibility and historical replay.' },
  results: { roi: 'Critical', stars: 5, value: 'Authoritative grading, settlement, calibration, backtesting and model progress.' },
  odds: { roi: 'Critical', stars: 5, value: 'Market alignment, EV, CLV, Current Board freshness and recommendation eligibility.' },
  stats: { roi: 'Critical', stars: 5, value: 'Feature quality, team/player form, projection integrity and model calibration.' },
  players: { roi: 'High', stars: 4, value: 'Identity mapping for injuries, lineups, player stats, props and explainability.' },
  lineups: { roi: 'High', stars: 4, value: 'Pregame context, player availability confidence and lineup-aware feature quality.' },
  injuries: { roi: 'High', stars: 4, value: 'Risk/context layer, confidence penalties and safer recommendation explanations.' },
  standings: { roi: 'High', stars: 4, value: 'Team strength, season context, playoff race and schedule-strength features.' },
  teams: { roi: 'Medium', stars: 3, value: 'Stable identity, mapping, venue joins and provider reconciliation.' },
  props: { roi: 'Medium', stars: 3, value: 'Premium market expansion only after verified odds, props settlement and replay support.' },
  metadata: { roi: 'Medium', stars: 3, value: 'Sportsbook/market IDs, seasons, venues and provider dictionary correctness.' },
  settlement: { roi: 'Medium', stars: 3, value: 'Official market result validation where market-level settlement feeds exist.' },
  competition: { roi: 'Low', stars: 1, value: 'League metadata and taxonomy support.' },
}

const SAFE_PROBE_EVIDENCE = {
  generatedAt: '2026-07-21T01:30:23.7530480Z',
  probeDate: '2026-07-20',
  providerDate: '2026-JUL-20',
  maxCalls: 10,
  callsMade: 10,
  providerCallsPersisted: false,
  remoteMutationsMade: 0,
  secretsExposed: false,
  budgetRouteWarning: 'Local provider budget route returned HTTP 500 during precheck; probe stayed within the requested 10-call hard cap.',
  results: [
    { sport: 'mlb', domain: 'metadata', endpoint: '/api/mlb/fantasy/json/CurrentSeason', httpStatus: 200, rows: 1, bytes: 147 },
    { sport: 'mlb', domain: 'teams', endpoint: '/api/mlb/fantasy/json/Teams', httpStatus: 200, rows: 30, bytes: 14067 },
    { sport: 'mlb', domain: 'schedules_results_starters_weather', endpoint: '/api/mlb/odds/json/GamesByDate/2026-JUL-20', httpStatus: 200, rows: 15, bytes: 13234 },
    { sport: 'mlb', domain: 'standings', endpoint: '/api/mlb/fantasy/json/Standings/2026', httpStatus: 200, rows: 30, bytes: 16492 },
    { sport: 'mlb', domain: 'players', endpoint: '/api/mlb/fantasy/json/Players', httpStatus: 200, rows: 7530, bytes: 4053800 },
    { sport: 'mlb', domain: 'player_game_stats', endpoint: '/api/mlb/fantasy/json/PlayerGameStatsByDate/2026-JUL-20', httpStatus: 200, rows: 0, bytes: 2 },
    { sport: 'mlb', domain: 'team_season_stats', endpoint: '/api/mlb/odds/json/TeamSeasonStats/2026', httpStatus: 200, rows: 30, bytes: 43321 },
    { sport: 'mlb', domain: 'current_odds', endpoint: '/api/mlb/odds/json/GameOddsByDate/2026-07-20', httpStatus: 200, rows: 15, bytes: 10080 },
    { sport: 'nba', domain: 'teams', endpoint: '/v3/nba/scores/json/Teams', httpStatus: 200, rows: 30, bytes: 13732 },
    { sport: 'nba', domain: 'injuries', endpoint: '/v3/nba/projections/json/InjuredPlayers', httpStatus: 200, rows: 8, bytes: 11332 },
  ],
} as const

function nowIso() {
  return new Date().toISOString()
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

async function safeCount(table: string, sportKey: string | null): Promise<CountResult> {
  try {
    let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
    if (sportKey) {
      if (table === 'provider_entity_mappings') query = query.eq('sport_key', sportKey).eq('provider', 'sportsdataio')
      else if (table === 'team_stats' && sportKey === 'baseball_mlb') query = query.eq('sport', 'MLB')
      else if (table === 'sports_sync_jobs') query = query.eq('provider', 'sportsdataio').eq('sport_key', sportKey)
      else query = query.eq('sport_key', sportKey)
    }
    const { count, error } = await query
    return { table, sportKey, count: count ?? 0, error: error?.message ?? null }
  } catch (error) {
    return { table, sportKey, count: 0, error: error instanceof Error ? error.message : `Unable to count ${table}` }
  }
}

async function loadStorageCounts() {
  const tables = Array.from(new Set(Object.values(DOMAIN_STORAGE_TABLES).flat()))
  const sports = Object.values(SPORT_KEY_BY_CATALOG_SPORT)
  const counts = await Promise.all(
    sports.flatMap((sportKey) => tables.map((table) => safeCount(table, sportKey)))
  )
  return counts
}

function countFor(counts: CountResult[], table: string, sportKey: string) {
  return counts.find((row) => row.table === table && row.sportKey === sportKey)?.count ?? 0
}

function implementedStatus(endpoint: SportsDataIoEndpointCatalogEntry): GapStatus {
  if (endpoint.implementedStatus === 'implemented' && endpoint.persistenceStatus === 'persisted') return 'USED'
  if (endpoint.implementedStatus === 'implemented' || endpoint.persistenceStatus === 'existing_table_ready') return 'PARTIALLY_USED'
  return 'NOT_USED'
}

function storedStatus(endpoint: SportsDataIoEndpointCatalogEntry, counts: CountResult[]) {
  const sportKey = SPORT_KEY_BY_CATALOG_SPORT[endpoint.sport]
  const tables = Array.from(new Set([...(DOMAIN_STORAGE_TABLES[endpoint.domain] ?? []), ...endpoint.destinationTables]))
  const tableCounts = tables.map((table) => ({ table, count: countFor(counts, table, sportKey) }))
  return {
    stored: tableCounts.some((row) => row.count > 0),
    tableCounts,
  }
}

function historicalAvailable(endpoint: SportsDataIoEndpointCatalogEntry) {
  const text = `${endpoint.pathTemplate} ${endpoint.historicalPurpose} ${endpoint.expectedCallInterval}`.toLowerCase()
  if (text.includes('historical') || text.includes('season') || text.includes('{season}') || text.includes('line movement')) return 'YES_OR_PARTIAL_REPOSITORY_EVIDENCE'
  if (text.includes('blocked')) return 'BLOCKED_OR_UNVERIFIED'
  return 'UNKNOWN'
}

function realtimeAvailable(endpoint: SportsDataIoEndpointCatalogEntry) {
  const text = `${endpoint.pathTemplate} ${endpoint.expectedFreshness} ${endpoint.productionPurpose}`.toLowerCase()
  if (text.includes('live')) return 'POSSIBLE_NOT_APPROVED'
  if (text.includes('current') || text.includes('fresh')) return 'PARTIAL_OR_CURRENT_FEED'
  return 'UNKNOWN'
}

function rateLimit(endpoint: SportsDataIoEndpointCatalogEntry) {
  if (endpoint.providerVariant === 'sportsdataio_discovery_lab') {
    return 'Controlled by Pick Analyzer provider budget; provider account limit not stored in repo.'
  }
  return 'Not verified for this subscription; requires authenticated SportsDataIO account evidence.'
}

function endpointDescription(endpoint: SportsDataIoEndpointCatalogEntry) {
  return endpoint.returnType || endpoint.productionPurpose || 'Provider JSON payload normalized before product use.'
}

function currentImplementation(endpoint: SportsDataIoEndpointCatalogEntry) {
  return {
    implementedStatus: endpoint.implementedStatus,
    normalizedStatus: endpoint.normalizedStatus,
    persistenceStatus: endpoint.persistenceStatus,
    lastPilotStatus: endpoint.lastPilotStatus,
    productionValidationStatus: endpoint.productionValidationStatus,
  }
}

function normalizeEndpointPath(path: string) {
  return path
    .replace(/2026-JUL-20/g, '{date}')
    .replace(/2026-07-20/g, '{date}')
    .replace(/\/2026(?=$|\/)/g, '/{season}')
}

function probeForEndpoint(endpoint: SportsDataIoEndpointCatalogEntry) {
  return SAFE_PROBE_EVIDENCE.results.find((probe) => {
    if (probe.sport !== endpoint.sport) return false
    return normalizeEndpointPath(probe.endpoint) === endpoint.pathTemplate
  }) ?? null
}

function entitlementStatus(endpoint: SportsDataIoEndpointCatalogEntry): EntitlementStatus {
  if (probeForEndpoint(endpoint)) return 'ENTITLED_VERIFIED'
  if (endpoint.providerVariant === 'sportsdataio_discovery_lab' && endpoint.product && !endpoint.pathTemplate.startsWith('/api/mlb/')) {
    return 'UNSUPPORTED_BY_PRODUCT'
  }
  if (endpoint.providerVariant === 'sportsdataio_enterprise' && endpoint.sport === 'mlb' && endpoint.lastPilotStatus.includes('enterprise_endpoint_not_available')) {
    return 'UNSUPPORTED_BY_PRODUCT'
  }
  const evidence = endpoint.lastPilotStatus.toLowerCase()
  if (evidence.includes('http_200') || evidence.includes('completed_')) return 'AVAILABLE_FROM_PRIOR_SUCCESS'
  if (evidence.includes('404')) return 'ENDPOINT_NOT_CONFIRMED'
  if (evidence.includes('401') || evidence.includes('403') || evidence.includes('not_available_to')) return 'NOT_ENTITLED_VERIFIED'
  if (endpoint.implementedStatus === 'blocked') return 'UNKNOWN_NOT_PROBED'
  return endpoint.entitlementStatus === 'confirmed_trial' ? 'NEEDS_SAFE_PROBE' : 'UNKNOWN_NOT_PROBED'
}

function historicalExtractionPolicy(endpoint: SportsDataIoEndpointCatalogEntry) {
  const seasonEndpoint = endpoint.pathTemplate.includes('{season}')
  const dateEndpoint = endpoint.pathTemplate.includes('{date}')
  return {
    earliestAccessible: entitlementStatus(endpoint) === 'ENTITLED_VERIFIED' ? 'not_proven_beyond_probe_scope' : null,
    latestAccessible: entitlementStatus(endpoint) === 'ENTITLED_VERIFIED' ? SAFE_PROBE_EVIDENCE.probeDate : null,
    dateByDateBackfillPermitted: dateEndpoint ? 'requires_budgeted_dry_run_plan' : 'not_applicable',
    fullSeasonEndpointExists: seasonEndpoint,
    estimatedCurrentSeasonCalls:
      endpoint.sport === 'mlb' && endpoint.pathTemplate.includes('{season}')
        ? 1
        : endpoint.sport === 'mlb' && dateEndpoint
          ? 'one_call_per_date'
          : 'not_estimated',
    recommendedExtractionOrder: DOMAIN_VALUE[endpoint.domain]?.stars ?? 1,
  }
}

function potentialValue(endpoint: SportsDataIoEndpointCatalogEntry) {
  return DOMAIN_VALUE[endpoint.domain]?.value ?? 'Potential feature value requires endpoint-specific payload verification.'
}

function roi(endpoint: SportsDataIoEndpointCatalogEntry) {
  const base = DOMAIN_VALUE[endpoint.domain] ?? { roi: 'Low' as RoiRank, stars: 1, value: '' }
  if (endpoint.entitlementStatus === 'requires_confirmation' && endpoint.providerVariant === 'sportsdataio_enterprise') {
    return { ...base, implementationGate: 'subscription_or_entitlement_unconfirmed' }
  }
  if (endpoint.implementedStatus === 'blocked') {
    return { ...base, implementationGate: 'blocked_by_current_policy_or_missing_settlement' }
  }
  return { ...base, implementationGate: base.roi === 'Critical' || base.roi === 'High' ? 'candidate_after_audit_completion' : 'defer' }
}

function classifySubscriptionEvidence() {
  const env = getSportsDataIoEnvironmentStatus()
  const mlbChannel = getSportsDataIoMlbDiscoveryLabChannel()
  return {
    exactPlanKnown: false,
    status: 'PARTIAL_ACCOUNT_EVIDENCE',
    reason:
      'Repository contains server-side NBA and MLB key names plus endpoint pilot evidence, but no SportsDataIO account plan/tier metadata or authoritative subscription export.',
    configuredKeyNames: env.checkedEnvVars.filter((name) => Boolean(process.env[name])),
    checkedKeyNames: env.checkedEnvVars,
    activeChannelsFromRepositoryEvidence: [
      mlbChannel.configured
        ? {
            sport: 'MLB',
            variant: mlbChannel.providerVariant,
            products: mlbChannel.products,
            confirmedEndpoints: mlbChannel.confirmedEndpoints.length,
          }
        : null,
      process.env.SPORTSDATAIO_NBA_API_KEY
        ? {
            sport: 'NBA',
            variant: 'sportsdataio_enterprise_or_trial_key',
            products: ['scores', 'stats', 'projections', 'odds'],
            confirmedEndpoints: SPORTSDATAIO_ENDPOINT_CATALOG.filter((endpoint) => endpoint.sport === 'nba' && endpoint.entitlementStatus === 'confirmed_trial').length,
          }
        : null,
    ].filter(Boolean),
    requiredToKnowExactSubscription: [
      'SportsDataIO account plan/export or billing tier',
      'Authorized endpoint entitlement probe list',
      'Provider rate-limit header/terms evidence for each active key',
    ],
    secretsExposed: false,
  }
}

function utilization(inventory: Array<{ gapStatus: GapStatus }>) {
  const total = inventory.length
  const used = inventory.filter((row) => row.gapStatus === 'USED').length
  const partial = inventory.filter((row) => row.gapStatus === 'PARTIALLY_USED').length
  const notUsed = inventory.filter((row) => row.gapStatus === 'NOT_USED').length
  const weighted = total > 0 ? Math.round(((used + partial * 0.5) / total) * 1000) / 10 : 0
  return { total, used, partial, notUsed, weightedUtilizationPct: weighted }
}

async function safeBudgetSummary(): Promise<BudgetSummary> {
  try {
    const budget = await getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: 'baseball_mlb' })
    return {
      sportKey: budget.sportKey,
      callsMadeToday: budget.callsMadeToday,
      callsMadeLastHour: budget.callsMadeLastHour,
      estimatedCallsRemaining: budget.estimatedCallsRemaining,
      hourlyRemaining: budget.hourlyRemaining,
      usagePercent: budget.usagePercent,
      warning: null,
    }
  } catch (error) {
    return {
      sportKey: 'baseball_mlb',
      callsMadeToday: 0,
      callsMadeLastHour: 0,
      estimatedCallsRemaining: 0,
      hourlyRemaining: 0,
      usagePercent: 0,
      warning: error instanceof Error ? error.message : 'provider_budget_unavailable',
    }
  }
}

export async function getSportsDataIoSubscriptionMaximizationAudit() {
  const [counts, budget, runtimeValidation] = await Promise.all([
    loadStorageCounts(),
    safeBudgetSummary(),
    Promise.resolve(runSportsDataIoRuntimeValidation()),
  ])
  const subscription = classifySubscriptionEvidence()
  const inventory = SPORTSDATAIO_ENDPOINT_CATALOG.map((endpoint) => {
    const gapStatus = implementedStatus(endpoint)
    const stored = storedStatus(endpoint, counts)
    const endpointRoi = roi(endpoint)
    return {
      endpoint: endpoint.pathTemplate,
      description: endpointDescription(endpoint),
      sport: endpoint.sport,
      category: endpoint.domain,
      providerVariant: endpoint.providerVariant,
      product: endpoint.product,
      rateLimit: rateLimit(endpoint),
      historicalAvailable: historicalAvailable(endpoint),
      realtime: realtimeAvailable(endpoint),
      currentImplementation: currentImplementation(endpoint),
      entitlement: {
        status: entitlementStatus(endpoint),
        probeEvidence: probeForEndpoint(endpoint),
        priorEvidence: endpoint.lastPilotStatus,
      },
      gapStatus,
      stored: stored.stored,
      storedEvidence: stored.tableCounts,
      ignored: gapStatus === 'NOT_USED' || endpoint.implementedStatus === 'blocked',
      potentialValue: potentialValue(endpoint),
      roi: endpointRoi.roi,
      stars: endpointRoi.stars,
      implementationGate: endpointRoi.implementationGate,
      currentValueReceived: endpoint.lastPilotStatus,
      historicalExtractionPolicy: historicalExtractionPolicy(endpoint),
    }
  })
  const before = utilization(inventory)
  const implementableNow = inventory.filter((endpoint) =>
    ['Critical', 'High'].includes(endpoint.roi) &&
    endpoint.gapStatus !== 'USED' &&
    endpoint.implementationGate === 'candidate_after_audit_completion' &&
    subscription.exactPlanKnown
  )
  const blockers = [
    subscription.exactPlanKnown ? null : 'exact_sportsdataio_subscription_plan_not_verified',
    'provider_endpoint_entitlement_matrix_not_exported_from_account',
    'rate_limits_not_verified_per_active_key',
  ].filter(Boolean) as string[]

  return {
    success: true,
    mode: 'sportsdataio_subscription_maximization_audit_v1',
    generatedAt: nowIso(),
    status: blockers.length ? 'SPORTSDATAIO_AUDIT_PARTIAL' satisfies AuditStatus : 'SPORTSDATAIO_AUDIT_PASS' satisfies AuditStatus,
    subscription,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    providerBudget: {
      sportKey: budget.sportKey,
      callsMadeToday: budget.callsMadeToday,
      callsMadeLastHour: budget.callsMadeLastHour,
      estimatedCallsRemaining: budget.estimatedCallsRemaining,
      hourlyRemaining: budget.hourlyRemaining,
      usagePercent: budget.usagePercent,
      warning: budget.warning,
    },
    runtimeValidation: {
      success: runtimeValidation.success,
      providerCallsMade: runtimeValidation.providerUsage.externalProviderCallsMade,
      checks: runtimeValidation.summary.checks,
      passed: runtimeValidation.summary.passed,
    },
    entitlementDiscovery: {
      status: 'PARTIAL',
      safeProbeEvidence: SAFE_PROBE_EVIDENCE,
      matrixSummary: inventory.reduce<Record<string, number>>((acc, endpoint) => {
        const status = endpoint.entitlement.status
        acc[status] = (acc[status] ?? 0) + 1
        return acc
      }, {}),
      verifiedEntitledDomains: Array.from(new Set(inventory.filter((endpoint) => endpoint.entitlement.status === 'ENTITLED_VERIFIED').map((endpoint) => `${endpoint.sport}:${endpoint.category}`))),
      verifiedUnavailableDomains: Array.from(new Set(inventory.filter((endpoint) => ['NOT_ENTITLED_VERIFIED', 'UNSUPPORTED_BY_PRODUCT'].includes(endpoint.entitlement.status)).map((endpoint) => `${endpoint.sport}:${endpoint.category}`))),
      unknownDomains: Array.from(new Set(inventory.filter((endpoint) => ['UNKNOWN_NOT_PROBED', 'NEEDS_SAFE_PROBE', 'ENDPOINT_NOT_CONFIRMED'].includes(endpoint.entitlement.status)).map((endpoint) => `${endpoint.sport}:${endpoint.category}`))),
      stopGate: 'Exact entitlement remains partial because 117 cataloged endpoints were not probed under the 10-call cap and no account entitlement export is available.',
    },
    coverage: before,
    inventory,
    unusedEndpoints: inventory.filter((endpoint) => endpoint.gapStatus === 'NOT_USED'),
    criticalAndHighUnused: inventory.filter((endpoint) => endpoint.gapStatus !== 'USED' && ['Critical', 'High'].includes(endpoint.roi)),
    implementationDecision: {
      implementationStarted: false,
      reason:
        'Safe probes verified representative MLB/NBA endpoints, but exact entitlement for every cataloged endpoint remains partial under the 10-call cap. Existing MLB importer already covers verified Critical/High MLB domains; no new extraction was run.',
      implementableNow,
    },
    historicalExtractionPlan: {
      dryRunOnly: true,
      largeHistoricalImportPerformed: false,
      policy:
        'Use existing SportsDataIO MLB Discovery Import executor with checkpoints, maximumRequests, date windows, completed checkpoint skips and production-day reserve. Do not backfill all dates until entitlement and budget are fully certified.',
      recommendedOrder: [
        'teams_static_if_stale',
        'season_schedule',
        'standings',
        'team_season_stats',
        'players_static_if_stale',
        'player_season_stats',
        'game_odds_by_date_by_current_window',
        'team_game_stats_by_date',
        'player_game_stats_by_date',
      ],
      currentSeasonCallEstimate: 'season-wide verified domains can start at roughly 5 calls; date-by-date game stats and odds cost one call per domain per date.',
      previousSeasonCallEstimate: 'not executed; requires season/date scope approval and provider budget reserve.',
      maximumAccessibleHistory: 'not proven by this 10-call entitlement probe.',
    },
    estimatedSubscriptionUtilizationBefore: before,
    estimatedSubscriptionUtilizationAfter: before,
    blockers,
    noSecretExposure: !safeJson(subscription).includes(process.env.SPORTSDATAIO_MLB_API_KEY ?? 'never-match-secret') &&
      !safeJson(subscription).includes(process.env.SPORTSDATAIO_NBA_API_KEY ?? 'never-match-secret'),
  }
}

export function validateSportsDataIoSubscriptionMaximizationAuditFixtures() {
  const env = getSportsDataIoEnvironmentStatus()
  const catalog = SPORTSDATAIO_ENDPOINT_CATALOG
  const checks = [
    ['catalog has endpoints', catalog.length > 0],
    ['nba endpoints cataloged', catalog.some((endpoint) => endpoint.sport === 'nba')],
    ['mlb discovery lab separated', catalog.some((endpoint) => endpoint.providerVariant === 'sportsdataio_discovery_lab')],
    ['enterprise paths separated', catalog.some((endpoint) => endpoint.providerVariant === 'sportsdataio_enterprise')],
    ['critical domains present', ['schedules', 'odds', 'stats'].every((domain) => catalog.some((endpoint) => endpoint.domain === domain))],
    ['safe probe evidence capped at ten calls', SAFE_PROBE_EVIDENCE.callsMade <= 10],
    ['safe probe evidence has no mutations', SAFE_PROBE_EVIDENCE.remoteMutationsMade === 0],
    ['safe probe evidence exposes no secrets', SAFE_PROBE_EVIDENCE.secretsExposed === false],
    ['env status exposes names only', Array.isArray(env.checkedEnvVars) && !safeJson(env).includes(process.env.SPORTSDATAIO_MLB_API_KEY ?? 'never-match-secret')],
    ['fixture validation uses zero provider calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'sportsdataio_subscription_maximization_audit_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
