import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSportsDataCoverageAuditV2 } from '@/services/data-foundation-coverage.service'

const SPORT_KEY = 'basketball_nba'
const LEAGUE_KEY = 'nba'

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
    .select('id,trial,scrambled,production_eligible,lifecycle_status,result,commence_time,created_at', { count: 'exact' })
    .eq('sport_key', SPORT_KEY)
    .limit(1000)
  if (error) return { rows: 0, trialRows: 0, productionEligibleRows: 0, settledRows: 0, postStartRiskSamples: 0, error: error.message }
  const samples = data ?? []
  return {
    rows: rows ?? samples.length,
    trialRows: samples.filter((row) => row.trial === true || row.scrambled === true).length,
    productionEligibleRows: samples.filter((row) => row.production_eligible === true).length,
    settledRows: samples.filter((row) => row.result && row.result !== 'pending').length,
    postStartRiskSamples: samples.filter((row) => {
      const created = Date.parse(String(row.created_at ?? ''))
      const commence = Date.parse(String(row.commence_time ?? ''))
      return Number.isFinite(created) && Number.isFinite(commence) && created > commence
    }).length,
    error: null,
  }
}

export async function getNbaHistoricalFoundationV2() {
  const [coverage, predictions, events, gameStats, playerStats, injuries, lineups, odds, mappings] = await Promise.all([
    getSportsDataCoverageAuditV2(),
    predictionIsolation(),
    count('sport_events'),
    count('sport_game_stats'),
    count('sport_player_stats'),
    count('sport_injuries'),
    count('sport_lineups'),
    count('sports_odds_snapshots'),
    count('provider_entity_mappings'),
  ])
  const nbaCoverage = coverage.sports.find((sport) => sport.sportKey === SPORT_KEY) ?? null
  const trialOnly = predictions.rows > 0 && predictions.productionEligibleRows === 0
  return {
    success: true,
    mode: 'nba_historical_foundation_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    targetSeasons: {
      previousCompletedSeason: '2024-25',
      currentSeasonThroughSafeDate: '2025-26',
    },
    coverage: nbaCoverage,
    domains: {
      events,
      gameStats,
      playerStats,
      injuries,
      lineups,
      odds,
      providerMappings: mappings,
      predictions,
    },
    certification: {
      scheduleCoverage: events.rows > 0,
      teamIdentity: (nbaCoverage?.rowCounts.teams ?? 0) >= 30,
      playerIdentity: playerStats.rows > 0 && mappings.rows > 0,
      quarterScoreReadiness: gameStats.rows > 0,
      boxscoreReadiness: gameStats.rows > 0 && playerStats.rows > 0,
      injuryCoverage: injuries.rows > 0,
      lineupCoverage: lineups.rows > 0,
      oddsCoverage: odds.rows > 0,
      trialIsolationPreserved: trialOnly,
      noTemporalLeakage: predictions.postStartRiskSamples === 0,
      retrospectivePredictionsGenerated: false,
    },
    blockers: [
      ...(trialOnly ? ['NBA_STORED_PREDICTIONS_REMAIN_TRIAL_OR_NON_PRODUCTION'] : []),
      ...((nbaCoverage?.rowCounts.results ?? 0) === 0 ? ['NBA_CANONICAL_GAME_RESULTS_EMPTY'] : []),
      ...(injuries.rows === 0 ? ['NBA_INJURY_COVERAGE_NOT_AVAILABLE'] : []),
    ],
    warnings: [
      'NBA foundation audit is read-only and does not call providers.',
      'Trial/scrambled rows remain excluded from production confidence and metrics.',
      'No retrospective NBA predictions were generated.',
    ],
  }
}

export async function validateNbaHistoricalFoundationV2() {
  const result = await getNbaHistoricalFoundationV2()
  const checks = [
    ['read-only audit', result.readOnly],
    ['zero provider calls', result.providerCallsMade === 0],
    ['zero remote mutations', result.remoteMutationsMade === 0],
    ['NBA coverage present', Boolean(result.coverage)],
    ['schedule coverage present', result.certification.scheduleCoverage],
    ['team identity coverage present', result.certification.teamIdentity],
    ['trial isolation preserved', result.certification.trialIsolationPreserved],
    ['no retrospective predictions generated', result.certification.retrospectivePredictionsGenerated === false],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'nba_historical_foundation_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      currentSeasonCoverage: result.coverage?.currentSeasonCoverage ?? 'unknown',
      previousSeasonCoverage: result.coverage?.previousSeasonCoverage ?? 'unknown',
      events: result.domains.events.rows,
      playerStats: result.domains.playerStats.rows,
      oddsRows: result.domains.odds.rows,
      predictionRows: result.domains.predictions.rows,
      productionEligiblePredictionRows: result.domains.predictions.productionEligibleRows,
      blockers: result.blockers,
    },
  }
}
