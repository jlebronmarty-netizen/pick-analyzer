import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { classifyMarketSemantics } from '@/services/market-semantics.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const MARKET_KEYS = ['first_five', 'first_five_moneyline', 'first_five_run_line', 'first_five_spread', 'first_five_total', 'first5', 'first5_moneyline', 'first5_run_line', 'first5_total', 'f5_moneyline', 'f5_run_line', 'f5_total']

type FirstFiveMarket = 'first_five_moneyline' | 'first_five_spread' | 'first_five_total'
type FirstFiveOutcome = 'win' | 'loss' | 'push' | 'void' | 'pending'

type FirstFiveSettlementInput = {
  market: FirstFiveMarket
  selection: string
  selectedScore: number | null
  opponentScore: number | null
  line?: number | null
  eventStatus: string | null
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

function firstFiveMarketFilter(query: any) {
  return query.eq('sport_key', SPORT_KEY).in('market', MARKET_KEYS)
}

async function safeCount(label: string, table: string, build: (query: any) => any) {
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

async function safeExists(label: string, table: string, columns: string, build: (query: any) => any) {
  try {
    const { data, error } = await build(supabaseAdmin.from(table).select(columns).limit(1))
    if (error) return { exists: false, error: `${label}: ${error.message}` }
    return { exists: (data ?? []).length > 0, error: null }
  } catch (error) {
    return { exists: false, error: `${label}: ${error instanceof Error ? error.message : 'unknown read error'}` }
  }
}

function decision(outcome: FirstFiveOutcome, reason: string) {
  return { outcome, reason }
}

export function settleMlbFirstFive(input: FirstFiveSettlementInput) {
  const selected = asNumber(input.selectedScore)
  const opponent = asNumber(input.opponentScore)
  const line = asNumber(input.line)
  const selection = lower(input.selection)
  const status = lower(input.eventStatus)

  if (['cancelled', 'canceled', 'postponed', 'void'].includes(status)) {
    return decision('void', `Event status is ${status || 'void'}.`)
  }
  if (!isFinalStatus(status) || selected === null || opponent === null) {
    return decision('pending', 'First-five score basis is unavailable or event is not final.')
  }
  if (input.market !== 'first_five_moneyline' && line === null) {
    return decision('void', 'First-five run line and total settlement require a numeric line.')
  }

  if (input.market === 'first_five_moneyline') {
    if (selected === opponent) return decision('push', 'First-five moneyline tied after five innings.')
    return decision(selected > opponent ? 'win' : 'loss', selected > opponent ? 'Selected side led after five innings.' : 'Selected side trailed after five innings.')
  }

  if (input.market === 'first_five_spread') {
    const adjusted = selected + Number(line)
    if (adjusted === opponent) return decision('push', 'First-five adjusted score equals opponent score.')
    return decision(adjusted > opponent ? 'win' : 'loss', adjusted > opponent ? 'Selected side covered the first-five run line.' : 'Selected side did not cover the first-five run line.')
  }

  const combined = selected + opponent
  if (combined === Number(line)) return decision('push', 'First-five total landed exactly on the line.')
  if (selection.includes('over')) {
    return decision(combined > Number(line) ? 'win' : 'loss', combined > Number(line) ? 'First-five total went over.' : 'First-five total stayed under.')
  }
  if (selection.includes('under')) {
    return decision(combined < Number(line) ? 'win' : 'loss', combined < Number(line) ? 'First-five total stayed under.' : 'First-five total went over.')
  }
  return decision('void', 'First-five total selection must contain over or under.')
}

export function validateMlbFirstFiveFixtures() {
  const fixtures = [
    ['moneyline win', settleMlbFirstFive({ market: 'first_five_moneyline', selection: 'Home', selectedScore: 3, opponentScore: 2, eventStatus: 'completed' }).outcome === 'win'],
    ['moneyline push tie', settleMlbFirstFive({ market: 'first_five_moneyline', selection: 'Away', selectedScore: 2, opponentScore: 2, eventStatus: 'completed' }).outcome === 'push'],
    ['run line cover', settleMlbFirstFive({ market: 'first_five_spread', selection: 'Away +0.5', selectedScore: 2, opponentScore: 2, line: 0.5, eventStatus: 'completed' }).outcome === 'win'],
    ['run line push', settleMlbFirstFive({ market: 'first_five_spread', selection: 'Home -1', selectedScore: 3, opponentScore: 2, line: -1, eventStatus: 'completed' }).outcome === 'push'],
    ['total over win', settleMlbFirstFive({ market: 'first_five_total', selection: 'Over 4.5', selectedScore: 3, opponentScore: 2, line: 4.5, eventStatus: 'completed' }).outcome === 'win'],
    ['total under win', settleMlbFirstFive({ market: 'first_five_total', selection: 'Under 4.5', selectedScore: 2, opponentScore: 2, line: 4.5, eventStatus: 'completed' }).outcome === 'win'],
    ['total push', settleMlbFirstFive({ market: 'first_five_total', selection: 'Over 4', selectedScore: 2, opponentScore: 2, line: 4, eventStatus: 'completed' }).outcome === 'push'],
    ['missing first-five score pending', settleMlbFirstFive({ market: 'first_five_total', selection: 'Over 4.5', selectedScore: null, opponentScore: null, line: 4.5, eventStatus: 'scheduled' }).outcome === 'pending'],
    ['bad total selection void', settleMlbFirstFive({ market: 'first_five_total', selection: 'Home 4.5', selectedScore: 3, opponentScore: 2, line: 4.5, eventStatus: 'completed' }).outcome === 'void'],
    ['first-five moneyline semantics', classifyMarketSemantics({ market: 'first_five_moneyline' }).binary],
    ['first-five spread semantics', classifyMarketSemantics({ market: 'first_five_run_line', line: 0.5 }).binary],
    ['first-five total push semantics', classifyMarketSemantics({ market: 'first_five_total', line: 4 }).pushCapable],
  ] as const
  const failedChecks = fixtures.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_first_five_contract_validation_v1',
    checks: fixtures.length,
    passed: fixtures.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getMlbFirstFiveReadiness() {
  const generatedAt = new Date().toISOString()
  const [
    storedFirstFiveOdds,
    pricedFirstFiveOdds,
    currentFirstFivePredictions,
    shadowFirstFivePredictions,
    historicalFirstFivePlayEvidence,
    historicalGames,
    historicalFeatureEvidence,
    sampleOdds,
  ] = await Promise.all([
    safeCount('stored first-five odds', 'sports_odds_snapshots', firstFiveMarketFilter),
    safeCount('priced first-five odds', 'sports_odds_snapshots', (query) => firstFiveMarketFilter(query).not('price', 'is', null)),
    safeCount('current first-five predictions', 'prediction_history', (query) => query.eq('sport_key', SPORT_KEY).ilike('market', '%first%five%').eq('is_current', true)),
    safeCount('shadow first-five predictions', 'prediction_history', (query) => query.eq('sport_key', SPORT_KEY).ilike('market', '%first%five%').or('lifecycle_status.eq.shadow,model_role.eq.shadow,production_eligible.eq.false')),
    safeExists('historical first-five plays', 'historical_baseball_plays', 'id', (query) => query.lte('inning', 5)),
    safeCount('historical baseball games', 'historical_baseball_games', (query) => query.eq('sport_key', SPORT_KEY)),
    safeExists('historical MLB feature snapshots', 'historical_feature_snapshots', 'id', (query) => query.eq('sport_key', SPORT_KEY)),
    safeRows<Record<string, unknown>>('first-five odds samples', 'sports_odds_snapshots', 'id, event_id, sportsbook, market, outcome, price, line, snapshot_time, metadata', firstFiveMarketFilter, 20),
  ])

  const validation = validateMlbFirstFiveFixtures()
  const hasRealCoverage = storedFirstFiveOdds.count > 0 && pricedFirstFiveOdds.count > 0
  const errors = [
    storedFirstFiveOdds.error,
    pricedFirstFiveOdds.error,
    currentFirstFivePredictions.error,
    shadowFirstFivePredictions.error,
    historicalFirstFivePlayEvidence.error,
    historicalGames.error,
    historicalFeatureEvidence.error,
    sampleOdds.error,
  ].filter((item): item is string => Boolean(item))
  const blockers = [
    hasRealCoverage ? '' : 'FIRST_FIVE_ODDS_NOT_AVAILABLE_FROM_STORED_PROVIDER_ROWS',
    pricedFirstFiveOdds.count > 0 ? '' : 'FIRST_FIVE_LINE_OR_PRICE_MISSING',
    historicalFirstFivePlayEvidence.exists ? '' : 'FIRST_FIVE_HISTORICAL_INNING_SCORE_BASIS_MISSING',
    'FIRST_FIVE_LISTED_STARTER_CHANGE_RULES_REQUIRE_APPROVAL',
    errors.length ? 'READINESS_QUERY_ERROR' : '',
  ].filter(Boolean)

  return {
    success: errors.length === 0,
    mode: 'mlb_first_five_readiness_v1',
    generatedAt,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    liveProviderActivation: hasRealCoverage ? 'READY_FOR_SHADOW_ONLY_NORMALIZATION' : 'BLOCKED_REAL_FIRST_FIVE_ODDS_UNAVAILABLE',
    officialPicks: {
      enabled: false,
      rule: 'First Five markets remain disabled for Official Picks until odds, inning-score settlement, starter-change handling, calibration and explicit promotion are approved.',
    },
    storedCoverage: {
      firstFiveOddsRows: storedFirstFiveOdds.count,
      firstFiveOddsRowsWithPrice: pricedFirstFiveOdds.count,
      currentFirstFivePredictions: currentFirstFivePredictions.count,
      shadowFirstFivePredictions: shadowFirstFivePredictions.count,
      historicalFirstFiveScoreBasisAvailable: historicalFirstFivePlayEvidence.exists,
      historicalGames: historicalGames.count,
      historicalFeatureEvidenceAvailable: historicalFeatureEvidence.exists,
      sampleRows: sampleOdds.data,
      errors,
    },
    readinessGate: {
      realProviderOrStoredMarketCoverage: hasRealCoverage,
      canonicalEventAndMarketMapping: sampleOdds.data.length > 0,
      teamIdentityAndSideMapping: sampleOdds.data.length > 0,
      lineAndSportsbookPriceAvailability: pricedFirstFiveOdds.count > 0,
      marketTimestampAndCutoff: sampleOdds.data.length > 0 && sampleOdds.data.every((row) => Boolean(row.snapshot_time)),
      firstFiveScoreSettlementSupport: historicalFirstFivePlayEvidence.exists && validation.success,
      historicalOutcomeAvailability: historicalFirstFivePlayEvidence.exists && historicalGames.count > 0,
      featureReadiness: historicalFeatureEvidence.exists,
      pushAwareSemantics: validation.success,
      starterChangeRulesReady: false,
      predictionLearningCalibrationPerformanceCompatibility: true,
    },
    canonicalContract: {
      canonicalMarketFamily: 'first_five',
      marketKeys: ['first_five_moneyline', 'first_five_run_line', 'first_five_total'],
      period: 'first_five_innings',
      scoreBasis: 'away/home score after exactly five completed innings',
      selections: {
        first_five_moneyline: ['home', 'away'],
        first_five_run_line: ['home_with_line', 'away_with_line'],
        first_five_total: ['over', 'under'],
      },
      sportsbookPriceRequired: true,
      timestampRequired: true,
      cutoffRule: 'Snapshot and prediction generation must be strictly before event start/cutoff.',
      starterChangeRule: 'blocked pending explicit listed-starter/opener/no-action policy approval',
      pushRules: {
        first_five_moneyline: 'Push when tied after five innings for two-way F5 moneyline contract.',
        first_five_run_line: 'Push when selected first-five adjusted score equals opponent score.',
        first_five_total: 'Push when combined first-five score equals the listed total.',
      },
    },
    shadowArchitecture: {
      predictionPersistence: 'shadow_only',
      productionEligible: false,
      currentBoardVisibility: hasRealCoverage ? 'shadow_diagnostics_only' : 'blocked_until_real_odds',
      mostLikely: 'rank F5 side/total outcome by model probability only after real market key, line and score basis exist',
      bestValue: 'compute EV only when model probability, sportsbook price and implied probability exist',
      aiFeed: 'explain blocked First Five as missing real line/price coverage and unapproved starter-change rules',
      performance: 'market split compatible when settled shadow labels exist; zero rows remain N/A',
      learning: 'shadow labels only; no production weight mutation or auto-promotion',
      calibration: 'shadow calibration only after chronological settled First Five labels exist',
    },
    settlementValidation: validation,
    blockers,
    certifications: {
      MLB_FIRST_FIVE_ARCHITECTURE_PASS: validation.success,
      MLB_FIRST_FIVE_SETTLEMENT_PASS: validation.success && historicalFirstFivePlayEvidence.exists,
      MLB_FIRST_FIVE_SHADOW_PASS: true,
      MLB_FIRST_FIVE_MARKET_SEMANTICS_PASS: validation.success,
      FIRST_FIVE_PROVIDER_READINESS_PASS: hasRealCoverage,
      FIRST_FIVE_STARTER_RULES_PASS: false,
    },
  }
}
