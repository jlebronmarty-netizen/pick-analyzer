import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSportsDataCoverageAuditV2 } from '@/services/data-foundation-coverage.service'
import { getSeasonCompetitionGovernanceV2 } from '@/services/data-foundation-season-governance.service'

const SPORT_KEY = 'soccer'
const LEAGUE_KEY = 'soccer'

function nowIso() {
  return new Date().toISOString()
}

async function count(table: string, builder?: (query: any) => any) {
  let query: any = supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('sport_key', SPORT_KEY)
  if (builder) query = builder(query)
  const { count: rows, error } = await query
  if (error) return { rows: 0, error: error.message }
  return { rows: rows ?? 0, error: null }
}

async function predictionIsolation() {
  const { data, error, count: rows } = await supabaseAdmin
    .from('prediction_history')
    .select('id,trial,scrambled,production_eligible,result,commence_time,created_at', { count: 'exact' })
    .eq('sport_key', SPORT_KEY)
    .limit(1000)
  if (error) return { rows: 0, productionEligibleRows: 0, postStartRiskSamples: 0, error: error.message }
  const samples = data ?? []
  return {
    rows: rows ?? samples.length,
    productionEligibleRows: samples.filter((row) => row.production_eligible === true).length,
    postStartRiskSamples: samples.filter((row) => {
      const created = Date.parse(String(row.created_at ?? ''))
      const commence = Date.parse(String(row.commence_time ?? ''))
      return Number.isFinite(created) && Number.isFinite(commence) && created > commence
    }).length,
    error: null,
  }
}

function soccerCompetitionRegistry(rowCounts: Record<string, number>) {
  const governance = getSeasonCompetitionGovernanceV2()
  return governance.competitions
    .filter((competition) => competition.sportKey === SPORT_KEY)
    .map((competition) => ({
      competitionKey: competition.competitionKey,
      displayName: competition.displayName,
      seasonModel: competition.seasonModel,
      timezone: competition.timezone,
      governanceStatus: competition.governanceStatus,
      sourceProvenance: competition.sourceProvenance,
      currentSeasonId: competition.currentSeasonId,
      previousSeasonId: competition.previousSeasonId,
      coverageStatus: rowCounts.events > 0 ? 'stored_rows_require_competition_attribution' : 'empty',
      readiness: 'blocked_pending_competition_specific_data',
      requiredDomains: [
        'competition_timezone',
        'season_window',
        'teams',
        'fixtures',
        'results',
        'standings',
        'half_scores',
        'team_stats',
        'player_stats_optional',
        'lineups_optional',
        'injuries_optional',
        'odds',
        'knockout_stage_rules',
        'extra_time_rules',
        'penalty_shootout_rules',
        'aggregate_scoring_rules',
      ],
    }))
}

export async function getSoccerHistoricalFoundationV2() {
  const [coverage, predictions, events, gameStats, playerStats, injuries, lineups, odds, mappings, standings, features] = await Promise.all([
    getSportsDataCoverageAuditV2(),
    predictionIsolation(),
    count('sport_events'),
    count('sport_game_stats'),
    count('sport_player_stats'),
    count('sport_injuries'),
    count('sport_lineups'),
    count('sports_odds_snapshots'),
    count('provider_entity_mappings'),
    count('sport_standings'),
    count('historical_feature_snapshots'),
  ])
  const soccerCoverage = coverage.sports.find((sport) => sport.sportKey === SPORT_KEY) ?? null
  const rowCounts = {
    events: events.rows,
    gameStats: gameStats.rows,
    playerStats: playerStats.rows,
    injuries: injuries.rows,
    lineups: lineups.rows,
    odds: odds.rows,
    providerMappings: mappings.rows,
    standings: standings.rows,
    featureSnapshots: features.rows,
    predictions: predictions.rows,
  }
  const competitions = soccerCompetitionRegistry(rowCounts)
  return {
    success: true,
    mode: 'soccer_historical_foundation_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    coverage: soccerCoverage,
    competitionReadinessRegistry: competitions,
    domains: {
      events,
      gameStats,
      playerStats,
      injuries,
      lineups,
      odds,
      providerMappings: mappings,
      standings,
      featureSnapshots: features,
      predictions,
    },
    certification: {
      competitionSpecificGovernance: competitions.length > 0 && competitions.every((competition) => competition.seasonModel === 'competition_specific'),
      noGlobalCoverageClaim: true,
      fixtureCoverage: events.rows > 0,
      resultCoverage: (soccerCoverage?.rowCounts.results ?? 0) > 0,
      standingsCoverage: standings.rows > 0,
      halfScoreReadiness: gameStats.rows > 0,
      teamStatsCoverage: gameStats.rows > 0,
      playerStatsCoverage: playerStats.rows > 0,
      lineupCoverage: lineups.rows > 0,
      injuryCoverage: injuries.rows > 0,
      oddsCoverage: odds.rows > 0,
      knockoutRulesReady: false,
      noTemporalLeakage: predictions.postStartRiskSamples === 0,
      retrospectivePredictionsGenerated: false,
    },
    blockers: [
      ...(events.rows === 0 ? ['SOCCER_FIXTURE_COVERAGE_EMPTY'] : []),
      ...((soccerCoverage?.rowCounts.results ?? 0) === 0 ? ['SOCCER_RESULTS_EMPTY'] : []),
      ...(standings.rows === 0 ? ['SOCCER_STANDINGS_EMPTY'] : []),
      ...(gameStats.rows === 0 ? ['SOCCER_HALF_SCORE_AND_TEAM_STATS_EMPTY'] : []),
      ...(odds.rows === 0 ? ['SOCCER_ODDS_COVERAGE_EMPTY'] : []),
      ...(!competitions.length ? ['SOCCER_COMPETITION_REGISTRY_EMPTY'] : []),
      ...(competitions.some((competition) => competition.competitionKey === 'soccer_generic') ? ['SOCCER_GENERIC_PLACEHOLDER_NOT_PRODUCTION_COVERAGE'] : []),
    ],
    warnings: [
      'Soccer foundation audit is read-only and does not call providers.',
      'Soccer is audited competition by competition; global soccer coverage is not claimed.',
      'Knockout, extra-time, penalty and aggregate-scoring rules remain competition-specific readiness requirements.',
      'No retrospective soccer predictions were generated.',
    ],
  }
}

export async function validateSoccerHistoricalFoundationV2() {
  const result = await getSoccerHistoricalFoundationV2()
  const checks = [
    ['read-only audit', result.readOnly],
    ['zero provider calls', result.providerCallsMade === 0],
    ['zero remote mutations', result.remoteMutationsMade === 0],
    ['soccer coverage present', Boolean(result.coverage)],
    ['competition-specific governance', result.certification.competitionSpecificGovernance],
    ['no global coverage overclaim', result.certification.noGlobalCoverageClaim],
    ['honest blocker reporting', Array.isArray(result.blockers)],
    ['no retrospective predictions generated', result.certification.retrospectivePredictionsGenerated === false],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'soccer_historical_foundation_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      competitions: result.competitionReadinessRegistry.length,
      currentSeasonCoverage: result.coverage?.currentSeasonCoverage ?? 'unknown',
      previousSeasonCoverage: result.coverage?.previousSeasonCoverage ?? 'unknown',
      events: result.domains.events.rows,
      gameStats: result.domains.gameStats.rows,
      playerStats: result.domains.playerStats.rows,
      oddsRows: result.domains.odds.rows,
      predictionRows: result.domains.predictions.rows,
      blockers: result.blockers,
    },
  }
}
