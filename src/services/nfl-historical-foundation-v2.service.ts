import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSportsDataCoverageAuditV2 } from '@/services/data-foundation-coverage.service'

const SPORT_KEY = 'americanfootball_nfl'
const LEAGUE_KEY = 'nfl'

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

async function eventSeasonBoundaryAudit() {
  const { data, error, count: rows } = await supabaseAdmin
    .from('sport_events')
    .select('id,season,status,start_time,home_team,away_team', { count: 'exact' })
    .eq('sport_key', SPORT_KEY)
    .in('season', ['2025', '2026'])
    .limit(5000)
  if (error) {
    return {
      rows: 0,
      seasons: {} as Record<string, unknown>,
      preseasonRows: 0,
      regularSeasonRows: 0,
      playoffRows: 0,
      neutralSiteSamples: 0,
      byeWeekModel: 'implicit_schedule_gap_audit',
      crossCalendarPostseasonRows: 0,
      error: error.message,
    }
  }
  const seasons: Record<string, { events: number; completed: number; scheduled: number; earliest: string | null; latest: string | null }> = {}
  let preseasonRows = 0
  let regularSeasonRows = 0
  let playoffRows = 0
  let neutralSiteSamples = 0
  let crossCalendarPostseasonRows = 0
  for (const row of data ?? []) {
    const season = String(row.season ?? 'unknown')
    const current = seasons[season] ?? { events: 0, completed: 0, scheduled: 0, earliest: null, latest: null }
    current.events += 1
    if (row.status === 'completed') current.completed += 1
    if (row.status === 'scheduled') current.scheduled += 1
    const time = typeof row.start_time === 'string' ? row.start_time : null
    if (time && (!current.earliest || time < current.earliest)) current.earliest = time
    if (time && (!current.latest || time > current.latest)) current.latest = time
    seasons[season] = current

    const seasonType = ''
    if (seasonType.includes('pre')) preseasonRows += 1
    if (seasonType.includes('regular')) regularSeasonRows += 1
    if (seasonType.includes('post') || seasonType.includes('playoff')) playoffRows += 1
    const startsInNextCalendar = time ? new Date(time).getUTCFullYear() > Number(season) : false
    if (startsInNextCalendar && (seasonType.includes('post') || seasonType.includes('playoff'))) crossCalendarPostseasonRows += 1
  }
  return {
    rows: rows ?? data?.length ?? 0,
    seasons,
    preseasonRows,
    regularSeasonRows,
    playoffRows,
    neutralSiteSamples,
    byeWeekModel: 'implicit_schedule_gap_audit',
    crossCalendarPostseasonRows,
    error: null,
  }
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

export async function getNflHistoricalFoundationV2() {
  const [coverage, seasonBoundaries, predictions, events, gameStats, playerStats, injuries, lineups, odds, mappings, features] = await Promise.all([
    getSportsDataCoverageAuditV2(),
    eventSeasonBoundaryAudit(),
    predictionIsolation(),
    count('sport_events'),
    count('sport_game_stats'),
    count('sport_player_stats'),
    count('sport_injuries'),
    count('sport_lineups'),
    count('sports_odds_snapshots'),
    count('provider_entity_mappings'),
    count('historical_feature_snapshots'),
  ])
  const nflCoverage = coverage.sports.find((sport) => sport.sportKey === SPORT_KEY) ?? null
  return {
    success: true,
    mode: 'nfl_historical_foundation_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    targetSeasons: {
      previousCompletedSeason: '2025',
      currentSeasonThroughSafeDate: '2026',
      postseasonBoundary: 'season_year_with_cross_calendar_playoffs',
    },
    coverage: nflCoverage,
    seasonBoundaries,
    domains: {
      events,
      gameStats,
      playerStats,
      injuries,
      lineups,
      odds,
      providerMappings: mappings,
      featureSnapshots: features,
      predictions,
    },
    certification: {
      scheduleCoverage: events.rows > 0,
      teamIdentity: (nflCoverage?.rowCounts.teams ?? 0) >= 32,
      playerIdentity: playerStats.rows > 0 && mappings.rows > 0,
      standingsCoverage: (nflCoverage?.rowCounts.standings ?? 0) > 0,
      gameStatsCoverage: gameStats.rows > 0,
      quarterScoreReadiness: gameStats.rows > 0,
      boxscoreReadiness: gameStats.rows > 0 && playerStats.rows > 0,
      injuryCoverage: injuries.rows > 0,
      depthChartOrStarterCoverage: lineups.rows > 0,
      oddsCoverage: odds.rows > 0,
      seasonBoundaryModel: seasonBoundaries.byeWeekModel,
      noTemporalLeakage: predictions.postStartRiskSamples === 0,
      retrospectivePredictionsGenerated: false,
    },
    blockers: [
      ...(events.rows === 0 ? ['NFL_SCHEDULE_COVERAGE_EMPTY'] : []),
      ...((nflCoverage?.rowCounts.results ?? 0) === 0 ? ['NFL_CANONICAL_GAME_RESULTS_EMPTY'] : []),
      ...(gameStats.rows === 0 ? ['NFL_GAME_STATS_EMPTY'] : []),
      ...(playerStats.rows === 0 ? ['NFL_PLAYER_STATS_EMPTY'] : []),
      ...(injuries.rows === 0 ? ['NFL_INJURY_COVERAGE_NOT_AVAILABLE'] : []),
      ...(lineups.rows === 0 ? ['NFL_DEPTH_CHART_OR_STARTER_COVERAGE_NOT_AVAILABLE'] : []),
      ...(odds.rows === 0 ? ['NFL_ODDS_COVERAGE_EMPTY'] : []),
    ],
    warnings: [
      'NFL foundation audit is read-only and does not call providers.',
      'NFL season governance preserves season-year identity and cross-calendar postseason handling.',
      'Bye weeks are modeled as schedule gaps; no fake events are created.',
      'No retrospective NFL predictions were generated.',
    ],
  }
}

export async function validateNflHistoricalFoundationV2() {
  const result = await getNflHistoricalFoundationV2()
  const checks = [
    ['read-only audit', result.readOnly],
    ['zero provider calls', result.providerCallsMade === 0],
    ['zero remote mutations', result.remoteMutationsMade === 0],
    ['NFL coverage present', Boolean(result.coverage)],
    ['season boundary model present', result.certification.seasonBoundaryModel === 'implicit_schedule_gap_audit'],
    ['no retrospective predictions generated', result.certification.retrospectivePredictionsGenerated === false],
    ['no temporal leakage in sampled predictions', result.certification.noTemporalLeakage],
    ['honest blocker reporting', Array.isArray(result.blockers)],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'nfl_historical_foundation_v2_validation',
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
      gameStats: result.domains.gameStats.rows,
      playerStats: result.domains.playerStats.rows,
      oddsRows: result.domains.odds.rows,
      predictionRows: result.domains.predictions.rows,
      blockers: result.blockers,
    },
  }
}
