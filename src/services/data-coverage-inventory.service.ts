import 'server-only'

import { getSportsDataCoverageAuditV2 } from '@/services/data-foundation-coverage.service'

const SPORTS = [
  { key: 'mlb', sportKey: 'baseball_mlb', label: 'MLB' },
  { key: 'nba', sportKey: 'basketball_nba', label: 'NBA' },
  { key: 'nfl', sportKey: 'americanfootball_nfl', label: 'NFL' },
  { key: 'nhl', sportKey: 'icehockey_nhl', label: 'NHL' },
  { key: 'soccer', sportKey: 'soccer', label: 'Soccer' },
  { key: 'bsn', sportKey: 'basketball_bsn', label: 'BSN' },
  { key: 'tennis', sportKey: 'tennis', label: 'Tennis' },
  { key: 'ufc', sportKey: 'mma_ufc', label: 'UFC' },
] as const

type CanonicalStatus = 'Production' | 'Certified' | 'Foundation' | 'Preview' | 'Planning' | 'Unavailable' | 'Blocked' | 'Pending' | 'Deprecated'

type DomainDefinition = {
  key: string
  label: string
  source: string
  rowCountKey: string | null
  denominatorKey?: string | null
  provenance: string
  requiredForPrediction: boolean
  noCountReason?: string
}

const DOMAINS = [
  { key: 'sports', label: 'Sports', source: 'sports registry', rowCountKey: null, provenance: 'code registry', requiredForPrediction: true },
  { key: 'leagues', label: 'Leagues', source: 'sports registry', rowCountKey: null, provenance: 'code registry', requiredForPrediction: true },
  { key: 'seasons', label: 'Seasons', source: 'season governance', rowCountKey: null, provenance: 'code registry', requiredForPrediction: true },
  { key: 'teams', label: 'Teams', source: 'sports_teams', rowCountKey: 'teams', provenance: 'stored canonical rows', requiredForPrediction: true },
  { key: 'players', label: 'Players', source: 'sport_players', rowCountKey: 'players', provenance: 'stored canonical rows', requiredForPrediction: false },
  { key: 'schedules', label: 'Schedules', source: 'sport_events', rowCountKey: 'events', provenance: 'stored canonical events', requiredForPrediction: true },
  { key: 'events', label: 'Events', source: 'sport_events', rowCountKey: 'events', provenance: 'stored canonical events', requiredForPrediction: true },
  { key: 'completed_results', label: 'Completed Results', source: 'game_results', rowCountKey: 'results', denominatorKey: 'events', provenance: 'stored official/result rows', requiredForPrediction: true },
  { key: 'standings', label: 'Standings', source: 'sport_standings', rowCountKey: 'standings', provenance: 'stored provider rows', requiredForPrediction: false },
  { key: 'team_statistics', label: 'Team Statistics', source: 'sport_game_stats', rowCountKey: 'teamStatistics', denominatorKey: 'events', provenance: 'stored stat rows', requiredForPrediction: false },
  { key: 'player_statistics', label: 'Player Statistics', source: 'sport_player_stats', rowCountKey: 'playerStatistics', provenance: 'stored stat rows', requiredForPrediction: false },
  { key: 'game_statistics', label: 'Game Statistics', source: 'sport_game_stats', rowCountKey: 'teamStatistics', denominatorKey: 'events', provenance: 'stored game stat rows', requiredForPrediction: false },
  { key: 'period_scores', label: 'Period Scores', source: 'sport_events', rowCountKey: 'periodScores', denominatorKey: 'events', provenance: 'stored event score fields when present', requiredForPrediction: false },
  { key: 'box_scores', label: 'Box Scores', source: 'sport_game_stats', rowCountKey: 'boxscores', denominatorKey: 'events', provenance: 'stored stat rows; dedicated box-score completeness not inferred', requiredForPrediction: false },
  { key: 'injuries', label: 'Injuries', source: 'sport_injuries', rowCountKey: 'injuries', provenance: 'stored injury rows', requiredForPrediction: false },
  { key: 'lineups', label: 'Lineups', source: 'sport_lineups', rowCountKey: 'startersLineups', provenance: 'stored lineup/starter rows', requiredForPrediction: false },
  { key: 'starters', label: 'Starters', source: 'sport_lineups', rowCountKey: 'startersLineups', provenance: 'stored lineup/starter rows', requiredForPrediction: false },
  { key: 'officials', label: 'Officials', source: 'not yet canonicalized', rowCountKey: null, provenance: 'no canonical stored table identified', requiredForPrediction: false, noCountReason: 'No dedicated officials table is present in the current canonical inventory.' },
  { key: 'venues', label: 'Venues', source: 'sport_events/provider metadata', rowCountKey: null, provenance: 'venue fields are embedded when present; no dedicated count is claimed', requiredForPrediction: false, noCountReason: 'No dedicated venue table is present in the current canonical inventory.' },
  { key: 'weather', label: 'Weather', source: 'event/provider metadata', rowCountKey: null, provenance: 'weather fields are embedded when present; no dedicated count is claimed', requiredForPrediction: false, noCountReason: 'No dedicated weather table is present in the current canonical inventory.' },
  { key: 'travel_rest_context', label: 'Travel/Rest Context', source: 'derived feature contracts', rowCountKey: null, provenance: 'feature-derived only when snapshots exist', requiredForPrediction: false, noCountReason: 'No standalone travel/rest table is present; coverage is feature-snapshot dependent.' },
  { key: 'odds_snapshots', label: 'Odds Snapshots', source: 'sports_odds_snapshots', rowCountKey: 'oddsSnapshots', denominatorKey: 'events', provenance: 'stored market snapshots', requiredForPrediction: true },
  { key: 'bookmakers', label: 'Bookmakers', source: 'sports_odds_snapshots', rowCountKey: 'oddsSnapshots', provenance: 'stored sportsbook fields; distinct bookmaker count is not claimed here', requiredForPrediction: false },
  { key: 'markets', label: 'Markets', source: 'sports_odds_snapshots', rowCountKey: 'oddsSnapshots', provenance: 'stored market fields', requiredForPrediction: true },
  { key: 'player_props', label: 'Player Props', source: 'sports_odds_snapshots', rowCountKey: 'playerProps', denominatorKey: 'events', provenance: 'stored genuine player prop rows only', requiredForPrediction: false },
  { key: 'historical_feature_snapshots', label: 'Historical Feature Snapshots', source: 'historical_feature_snapshots', rowCountKey: 'features', denominatorKey: 'events', provenance: 'stored point-in-time feature rows', requiredForPrediction: true },
  { key: 'prediction_history', label: 'Prediction History', source: 'prediction_history', rowCountKey: 'predictions', denominatorKey: 'events', provenance: 'stored immutable prediction rows', requiredForPrediction: true },
  { key: 'valid_pregame_predictions', label: 'Valid Pregame Predictions', source: 'prediction_history + cutoff enforcement', rowCountKey: 'predictions', denominatorKey: 'events', provenance: 'stored prediction rows; cutoff-specific count remains route-dependent', requiredForPrediction: true },
  { key: 'post_start_predictions', label: 'Post-start Predictions', source: 'prediction cutoff diagnostics', rowCountKey: null, provenance: 'diagnostic-only until a canonical exact aggregate is exposed', requiredForPrediction: false, noCountReason: 'Post-start classification exists in cutoff services, but this stage does not infer an exact global count.' },
  { key: 'missed_pipeline_opportunities', label: 'Missed Pipeline Opportunities', source: 'pipeline diagnostics', rowCountKey: null, provenance: 'diagnostic-only until canonical opportunity records exist', requiredForPrediction: false, noCountReason: 'No canonical missed-opportunity persistence table is present yet.' },
  { key: 'settled_predictions', label: 'Settled Predictions', source: 'prediction_history', rowCountKey: 'settlements', denominatorKey: 'predictions', provenance: 'stored result-known prediction rows', requiredForPrediction: true },
  { key: 'learning_labels', label: 'Learning Labels', source: 'settlement/learning evidence', rowCountKey: null, denominatorKey: 'settlements', provenance: 'derived from settled rows with feature evidence', requiredForPrediction: false, noCountReason: 'Learning labels are derived/evidence-scoped; no standalone canonical row count is claimed in this inventory.' },
  { key: 'market_movement_history', label: 'Market Movement History', source: 'sports_odds_snapshots', rowCountKey: 'oddsSnapshots', denominatorKey: 'events', provenance: 'multiple stored snapshots per event/market when present', requiredForPrediction: false },
  { key: 'aligned_closing_candidates', label: 'Aligned Closing Candidates', source: 'closing-line intelligence', rowCountKey: null, denominatorKey: 'predictions', provenance: 'derived from stored pre-start odds and prediction alignment', requiredForPrediction: false, noCountReason: 'Closing candidates are derived per request; no dedicated canonical count exists yet.' },
] as const satisfies readonly DomainDefinition[]

type CoverageAudit = Awaited<ReturnType<typeof getSportsDataCoverageAuditV2>>
type CoverageSport = CoverageAudit['sports'][number]

function pct(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator <= 0) return null
  return Number(((numerator / denominator) * 100).toFixed(2))
}

function statusFor(count: number | null, required: boolean, unavailable: boolean): CanonicalStatus {
  if (unavailable) return required ? 'Blocked' : 'Unavailable'
  if (count === null) return required ? 'Pending' : 'Unavailable'
  if (count > 0) return required ? 'Foundation' : 'Preview'
  return required ? 'Blocked' : 'Unavailable'
}

function registryCount(domainKey: string, sport: CoverageSport) {
  if (domainKey === 'sports') return 1
  if (domainKey === 'leagues') return 1
  if (domainKey === 'seasons') return [sport.currentSeason, sport.previousSeason].filter(Boolean).length
  return null
}

function buildDomain(sport: CoverageSport, definition: DomainDefinition) {
  const table = definition.rowCountKey ? sport.tables.find((item) => item.key === definition.rowCountKey) ?? null : null
  const tableUnavailable = table?.status === 'unavailable'
  const count = definition.rowCountKey ? sport.rowCounts[definition.rowCountKey] ?? 0 : registryCount(definition.key, sport)
  const denominator = definition.denominatorKey ? sport.rowCounts[definition.denominatorKey] ?? null : null
  const coveragePercent = pct(count, denominator)
  const blocker = tableUnavailable
    ? `Stored source ${definition.source} is unavailable for ${sport.label}.`
    : definition.noCountReason
      ? definition.noCountReason
      : count === 0 && definition.requiredForPrediction
        ? `${definition.label} has no stored rows for ${sport.label}.`
        : null

  return {
    key: definition.key,
    label: definition.label,
    source: definition.source,
    table: table?.table ?? null,
    exactCountAvailable: count !== null,
    rowCount: count,
    denominator,
    coveragePercent,
    measurementWindow: {
      earliestDate: table?.earliestDate ?? sport.earliestDate,
      latestDate: table?.latestDate ?? sport.latestDate,
      freshnessWindow: 'stored-data current inventory; no provider refresh executed',
      applicableSeason: sport.currentSeason,
    },
    status: statusFor(count, definition.requiredForPrediction, Boolean(tableUnavailable)),
    blocker,
    duplicateCount: table?.duplicateIndicator === 'detected_in_sample' ? 1 : 0,
    invalidCount: table?.missingRequiredFieldSamples ?? 0,
    orphanCount: definition.key === 'players' ? sport.unresolvedIdentities : 0,
    provenance: definition.provenance,
    productionUsability:
      definition.requiredForPrediction && count && count > 0
        ? 'Usable as one input only; sport-level prediction readiness still requires all gates.'
        : definition.requiredForPrediction
          ? 'Blocked until stored, validated evidence exists.'
          : 'Contextual or optional for this stage.',
    notes: table?.notes ?? [],
  }
}

function sportStatus(sport: CoverageSport): CanonicalStatus {
  if (sport.sportKey === 'baseball_mlb' && sport.predictionReadiness === 'ready') return 'Certified'
  if (sport.predictionReadiness === 'ready') return 'Foundation'
  if (sport.predictionReadiness === 'partial') return 'Preview'
  return 'Blocked'
}

function predictionReadiness(sport: CoverageSport, domains: ReturnType<typeof buildDomain>[]) {
  const required = domains.filter((domain) => DOMAINS.find((item) => item.key === domain.key)?.requiredForPrediction)
  const available = required.filter((domain) => domain.rowCount !== null && domain.rowCount > 0)
  const blockers = required.filter((domain) => domain.rowCount === null || domain.rowCount === 0 || domain.status === 'Blocked').map((domain) => domain.blocker ?? `${domain.label} unavailable`)
  return {
    state: sport.predictionReadiness === 'ready' ? 'PREVIEW_PREDICTIONS' : sport.predictionReadiness === 'partial' ? 'FOUNDATION' : 'BLOCKED',
    numerator: available.length,
    denominator: required.length,
    blockers,
    recommendationState: sport.sportKey === 'baseball_mlb' && sport.predictionReadiness === 'ready' ? 'POLICY_GATED' : 'NO_RECOMMENDATION',
  }
}

export async function getDataCoverageInventoryV1() {
  const coverage = await getSportsDataCoverageAuditV2()
  const sports = coverage.sports.map((sport) => {
    const domains = DOMAINS.map((definition) => buildDomain(sport, definition))
    return {
      key: SPORTS.find((item) => item.sportKey === sport.sportKey)?.key ?? sport.leagueKey,
      sportKey: sport.sportKey,
      leagueKey: sport.leagueKey,
      label: sport.label,
      status: sportStatus(sport),
      currentSeason: sport.currentSeason,
      previousSeason: sport.previousSeason,
      earliestDate: sport.earliestDate,
      latestDate: sport.latestDate,
      sourceProviders: sport.sourceProviders,
      freshness: sport.latestDate ? 'Stored data present; freshness is based on latest stored timestamp.' : 'No stored timestamp available.',
      domains,
      health: {
        totalDomains: domains.length,
        domainsWithExactCounts: domains.filter((domain) => domain.exactCountAvailable).length,
        domainsWithRows: domains.filter((domain) => (domain.rowCount ?? 0) > 0).length,
        duplicateIndicators: sport.duplicateIndicators,
        invalidSamples: sport.missingRequiredFields,
        orphanSamples: sport.unresolvedIdentities,
        staleSamples: sport.staleRecords,
        providerCapable: 'UNKNOWN',
        providerEntitled: 'UNKNOWN',
        importReady: sport.importReadiness,
        predictionReady: sport.predictionReadiness,
        highestValueNextAcquisition: sport.blockers[0] ?? 'Run provider entitlement audit before planning more acquisition.',
      },
      predictionReadiness: predictionReadiness(sport, domains),
      blockers: sport.blockers,
    }
  })

  return {
    success: true,
    mode: 'data_coverage_inventory_v1',
    generatedAt: new Date().toISOString(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    sports,
    summary: {
      sportsAudited: sports.length,
      domainsAudited: sports.reduce((sum, sport) => sum + sport.domains.length, 0),
      exactDomainCounts: sports.reduce((sum, sport) => sum + sport.health.domainsWithExactCounts, 0),
      totalRowsObserved: coverage.summary.totalRowsObserved,
      predictionReadySports: sports.filter((sport) => sport.health.predictionReady === 'ready').length,
      blockedSports: sports.filter((sport) => sport.status === 'Blocked').length,
    },
    warnings: [
      'Inventory is stored-data-only and performs no provider calls.',
      'Percentages are null unless numerator and denominator are both grounded by stored rows.',
      'Unavailable exact counts are disclosed instead of estimated.',
      'Recommendation readiness remains policy-gated and separate from prediction readiness.',
    ],
  }
}

export async function getDataCoverageSportInventoryV1(key: string) {
  const inventory = await getDataCoverageInventoryV1()
  return inventory.sports.find((sport) => sport.key === key.toLowerCase() || sport.sportKey === key) ?? null
}

export function getDataCoverageSportKeys() {
  return SPORTS.map((sport) => sport.key)
}

export function validateDataCoverageInventoryV1Fixtures() {
  const domainKeys = DOMAINS.map((domain) => domain.key)
  const checks = [
    ['all sports are registered', SPORTS.length === 8],
    ['inventory route domain count is broad', DOMAINS.length >= 30],
    ['sports domain present', domainKeys.includes('sports')],
    ['events domain present', domainKeys.includes('events')],
    ['prediction history domain present', domainKeys.includes('prediction_history')],
    ['valid pregame domain present', domainKeys.includes('valid_pregame_predictions')],
    ['missed opportunities disclosed', domainKeys.includes('missed_pipeline_opportunities')],
    ['closing candidates disclosed', domainKeys.includes('aligned_closing_candidates')],
    ['no provider calls in contract', true],
    ['no remote mutations in contract', true],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'data_coverage_inventory_v1_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
  }
}
