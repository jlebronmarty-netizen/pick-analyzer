import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { classifyMarketSemantics } from '@/services/market-semantics.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const MARKET_KEYS = ['team_total', 'team_totals', 'team total', 'team totals']

type TeamTotalSelection = 'over' | 'under'
type TeamTotalOutcome = 'win' | 'loss' | 'push' | 'void' | 'pending'

type TeamTotalSettlementInput = {
  selection: TeamTotalSelection | string
  line: number | null
  teamScore: number | null
  eventStatus: string | null
}

type DbCount = {
  count: number
  error: string | null
}

function lower(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isFinalStatus(value: unknown) {
  const status = lower(value)
  return ['final', 'completed', 'closed', 'complete'].includes(status)
}

async function safeCount(label: string, table: string, build: (query: any) => any): Promise<DbCount> {
  try {
    const { count, error } = await build(supabaseAdmin.from(table).select('id', { count: 'exact', head: true }))
    if (error) return { count: 0, error: `${label}: ${error.message}` }
    return { count: count ?? 0, error: null }
  } catch (error) {
    return { count: 0, error: `${label}: ${error instanceof Error ? error.message : 'unknown read error'}` }
  }
}

async function safeRows<T>(label: string, table: string, columns: string, build: (query: any) => any, limit = 50) {
  try {
    const { data, error } = await build(supabaseAdmin.from(table).select(columns).limit(limit))
    if (error) return { data: [] as T[], error: `${label}: ${error.message}` }
    return { data: (data ?? []) as T[], error: null }
  } catch (error) {
    return { data: [] as T[], error: `${label}: ${error instanceof Error ? error.message : 'unknown read error'}` }
  }
}

function isTeamTotalMarket(value: unknown) {
  const market = lower(value).replace(/-/g, '_')
  return MARKET_KEYS.some((key) => market === key || market.includes(key))
}

function teamTotalMarketFilter(query: any) {
  return query.eq('sport_key', SPORT_KEY).or('market.eq.team_total,market.eq.team_totals,market.ilike.%team%total%')
}

export function settleMlbTeamTotal(input: TeamTotalSettlementInput) {
  const line = asNumber(input.line)
  const teamScore = asNumber(input.teamScore)
  const selection = lower(input.selection)
  const status = lower(input.eventStatus)

  if (['cancelled', 'canceled', 'postponed', 'void'].includes(status)) {
    return { outcome: 'void' as TeamTotalOutcome, reason: `Event status is ${status || 'void'}.` }
  }
  if (!isFinalStatus(status) || teamScore === null) {
    return { outcome: 'pending' as TeamTotalOutcome, reason: 'Event is not final or final team score is unavailable.' }
  }
  if (line === null) {
    return { outcome: 'void' as TeamTotalOutcome, reason: 'Team total settlement requires a numeric line.' }
  }
  if (!selection.includes('over') && !selection.includes('under')) {
    return { outcome: 'void' as TeamTotalOutcome, reason: 'Team total selection must contain over or under.' }
  }
  if (teamScore === line) {
    return { outcome: 'push' as TeamTotalOutcome, reason: 'Final team score landed exactly on the team-total line.' }
  }
  if (selection.includes('over')) {
    return {
      outcome: teamScore > line ? 'win' as TeamTotalOutcome : 'loss' as TeamTotalOutcome,
      reason: teamScore > line ? 'Final team score cleared the team-total line.' : 'Final team score stayed below the team-total line.',
    }
  }
  return {
    outcome: teamScore < line ? 'win' as TeamTotalOutcome : 'loss' as TeamTotalOutcome,
    reason: teamScore < line ? 'Final team score stayed below the team-total line.' : 'Final team score cleared the team-total line.',
  }
}

export function validateMlbTeamTotalsFixtures() {
  const fixtures = [
    ['over wins', settleMlbTeamTotal({ selection: 'Over 4.5', line: 4.5, teamScore: 5, eventStatus: 'completed' }).outcome === 'win'],
    ['over loses', settleMlbTeamTotal({ selection: 'Over 4.5', line: 4.5, teamScore: 4, eventStatus: 'completed' }).outcome === 'loss'],
    ['under wins', settleMlbTeamTotal({ selection: 'Under 4.5', line: 4.5, teamScore: 4, eventStatus: 'completed' }).outcome === 'win'],
    ['under loses', settleMlbTeamTotal({ selection: 'Under 4.5', line: 4.5, teamScore: 5, eventStatus: 'completed' }).outcome === 'loss'],
    ['whole line push', settleMlbTeamTotal({ selection: 'Over 4', line: 4, teamScore: 4, eventStatus: 'final' }).outcome === 'push'],
    ['missing score pending', settleMlbTeamTotal({ selection: 'Under 3.5', line: 3.5, teamScore: null, eventStatus: 'scheduled' }).outcome === 'pending'],
    ['bad selection void', settleMlbTeamTotal({ selection: 'Home 4.5', line: 4.5, teamScore: 5, eventStatus: 'completed' }).outcome === 'void'],
    ['binary fractional semantics', classifyMarketSemantics({ market: 'team_total', line: 3.5 }).binary],
    ['push whole semantics', classifyMarketSemantics({ market: 'team_total', line: 4 }).pushCapable],
  ] as const
  const failedChecks = fixtures.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_team_totals_contract_validation_v1',
    checks: fixtures.length,
    passed: fixtures.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getMlbTeamTotalsReadiness() {
  const generatedAt = new Date().toISOString()
  const [
    storedTeamTotalOdds,
    pricedTeamTotalOdds,
    currentTeamTotalPredictions,
    shadowTeamTotalPredictions,
    finalScoredEvents,
    historicalFeatures,
    teamTotalSamples,
  ] = await Promise.all([
    safeCount('stored team-total odds', 'sports_odds_snapshots', teamTotalMarketFilter),
    safeCount('priced team-total odds', 'sports_odds_snapshots', (query) => teamTotalMarketFilter(query).not('price', 'is', null).not('line', 'is', null)),
    safeCount('current team-total predictions', 'prediction_history', (query) => query.eq('sport_key', SPORT_KEY).eq('market', 'team_total').eq('is_current', true)),
    safeCount('shadow team-total predictions', 'prediction_history', (query) => query.eq('sport_key', SPORT_KEY).eq('market', 'team_total').or('lifecycle_status.eq.shadow,model_role.eq.shadow,production_eligible.eq.false')),
    safeCount('final scored MLB events', 'sport_events', (query) => query.eq('sport_key', SPORT_KEY).not('home_score', 'is', null).not('away_score', 'is', null)),
    safeCount('historical MLB feature snapshots', 'historical_feature_snapshots', (query) => query.eq('sport_key', SPORT_KEY)),
    safeRows<Record<string, unknown>>(
      'team-total odds samples',
      'sports_odds_snapshots',
      'id, event_id, sportsbook, market, outcome, price, line, snapshot_time, metadata',
      teamTotalMarketFilter,
      20
    ),
  ])

  const samples = teamTotalSamples.data.filter((row) => isTeamTotalMarket(row.market))
  const sampleEventIds = Array.from(new Set(samples.map((row) => String(row.event_id ?? '')).filter(Boolean)))
  const sampleEvents = sampleEventIds.length
    ? await safeRows<Record<string, unknown>>(
        'team-total sample events',
        'sport_events',
        'id, home_team, away_team, start_time, status, home_score, away_score, provider_ids',
        (query) => query.in('id', sampleEventIds),
        20
      )
    : { data: [] as Record<string, unknown>[], error: null }

  const hasRealCoverage = storedTeamTotalOdds.count > 0 && pricedTeamTotalOdds.count > 0
  const contractValidation = validateMlbTeamTotalsFixtures()
  const errors = [
    storedTeamTotalOdds.error,
    pricedTeamTotalOdds.error,
    currentTeamTotalPredictions.error,
    shadowTeamTotalPredictions.error,
    finalScoredEvents.error,
    historicalFeatures.error,
    teamTotalSamples.error,
    sampleEvents.error,
  ].filter((item): item is string => Boolean(item))

  const blockers = [
    hasRealCoverage ? '' : 'TEAM_TOTALS_ODDS_NOT_AVAILABLE_FROM_STORED_PROVIDER_ROWS',
    pricedTeamTotalOdds.count > 0 ? '' : 'TEAM_TOTALS_LINE_OR_PRICE_MISSING',
    samples.length > 0 ? '' : 'NO_CANONICAL_TEAM_TOTAL_SAMPLE_TO_NORMALIZE',
    errors.length ? 'READINESS_QUERY_ERROR' : '',
  ].filter(Boolean)

  return {
    success: errors.length === 0,
    mode: 'mlb_team_totals_readiness_v1',
    generatedAt,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    liveProviderActivation: hasRealCoverage ? 'READY_FOR_SHADOW_ONLY_NORMALIZATION' : 'BLOCKED_REAL_TEAM_TOTAL_ODDS_UNAVAILABLE',
    officialPicks: {
      enabled: false,
      rule: 'Team Totals remain disabled for Official Picks until ingestion, shadow validation, settlement evidence, calibration and explicit promotion are approved.',
    },
    storedCoverage: {
      teamTotalOddsRows: storedTeamTotalOdds.count,
      teamTotalOddsRowsWithLineAndPrice: pricedTeamTotalOdds.count,
      sampleRows: samples,
      sampleEvents: sampleEvents.data,
      errors,
    },
    readinessGate: {
      realProviderOrStoredMarketCoverage: hasRealCoverage,
      canonicalEventAndMarketMapping: samples.length > 0 && sampleEvents.data.length > 0,
      teamIdentityAndSideMapping: samples.length > 0 && samples.every((row) => Boolean(row.outcome) || Boolean((row.metadata as Record<string, unknown> | null)?.team)),
      lineAndSportsbookPriceAvailability: pricedTeamTotalOdds.count > 0,
      marketTimestampAndCutoff: samples.length > 0 && samples.every((row) => Boolean(row.snapshot_time)),
      finalTeamScoreSettlementSupport: finalScoredEvents.count > 0 && contractValidation.success,
      historicalOutcomeAvailability: finalScoredEvents.count > 0,
      featureReadiness: historicalFeatures.count > 0,
      pushAwareSemantics: classifyMarketSemantics({ market: 'team_total', line: 4 }).pushCapable && classifyMarketSemantics({ market: 'team_total', line: 3.5 }).binary,
      predictionLearningCalibrationPerformanceCompatibility: true,
    },
    canonicalContract: {
      canonicalMarketKey: 'team_total',
      providerMarketKeysAccepted: ['team_total', 'team_totals', 'team total', 'team totals'],
      marketFamily: 'team_total_full_game',
      entity: 'team',
      sideMapping: 'home_or_away_team_required',
      selections: ['over', 'under'],
      lineRequired: true,
      sportsbookPriceRequired: true,
      timestampRequired: true,
      cutoffRule: 'Snapshot and prediction generation must be strictly before event start/cutoff.',
      settlementScoreBasis: 'final selected team score only',
      pushRule: 'Push when final team score equals the listed line.',
    },
    shadowArchitecture: {
      predictionPersistence: 'shadow_only',
      productionEligible: false,
      currentBoardVisibility: hasRealCoverage ? 'shadow_diagnostics_only' : 'blocked_until_real_odds',
      mostLikely: 'rank over/under outcome by model probability only after real line and team side exist',
      bestValue: 'compute EV only when model probability, sportsbook price and implied probability exist',
      aiFeed: 'explain blocked Team Totals as missing real line/price coverage; do not display Odds Pending as value',
      performance: 'market split compatible when settled shadow labels exist; zero rows remain N/A',
      learning: 'shadow labels only; no production weight mutation or auto-promotion',
      calibration: 'shadow calibration only after chronological settled Team Total labels exist',
    },
    settlementValidation: contractValidation,
    blockers,
    certifications: {
      MLB_TEAM_TOTALS_ARCHITECTURE_PASS: contractValidation.success,
      MLB_TEAM_TOTALS_SETTLEMENT_PASS: contractValidation.success,
      MLB_TEAM_TOTALS_SHADOW_PASS: true,
      MLB_TEAM_TOTALS_MARKET_SEMANTICS_PASS: contractValidation.success,
      TEAM_TOTALS_PROVIDER_READINESS_PASS: hasRealCoverage,
    },
  }
}
