import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type CapabilityStatus =
  | 'fully_supported'
  | 'ingestion_only'
  | 'prediction_pending'
  | 'settlement_pending'
  | 'unsupported'
  | 'unavailable_from_provider'

type MarketCapability = {
  canonicalMarketKey: string
  providerMarketKey: string | null
  marketFamily: 'game' | 'team' | 'first_five' | 'pitcher_prop' | 'batter_prop' | 'arbitrage'
  selectionStructure: string
  lineRequired: boolean
  priceRequired: boolean
  supportedSportsbooks: string[]
  settlementRule: string
  pushRule: string
  featureRequirements: string[]
  predictionModelSupport: CapabilityStatus
  recommendationSupport: CapabilityStatus
  currentStatus: CapabilityStatus
  userVisible: boolean
  evidence: string
}

const CORE_SPORTSBOOKS = ['Consensus']

const CAPABILITIES: MarketCapability[] = [
  {
    canonicalMarketKey: 'moneyline',
    providerMarketKey: 'moneyline',
    marketFamily: 'game',
    selectionStructure: 'home_or_away_team',
    lineRequired: false,
    priceRequired: true,
    supportedSportsbooks: CORE_SPORTSBOOKS,
    settlementRule: 'Selected team must win the game.',
    pushRule: 'No push except no-decision/data-error handling.',
    featureRequirements: ['team form', 'season strength', 'recent form', 'cutoff-safe pregame odds'],
    predictionModelSupport: 'fully_supported',
    recommendationSupport: 'fully_supported',
    currentStatus: 'fully_supported',
    userVisible: true,
    evidence: 'sports_odds_snapshots and prediction_history currently support full-game MLB moneyline candidates.',
  },
  {
    canonicalMarketKey: 'run_line',
    providerMarketKey: 'run_line',
    marketFamily: 'game',
    selectionStructure: 'home_or_away_team_with_line',
    lineRequired: true,
    priceRequired: true,
    supportedSportsbooks: CORE_SPORTSBOOKS,
    settlementRule: 'Selected team plus run-line spread must cover.',
    pushRule: 'Push when adjusted margin equals zero.',
    featureRequirements: ['team form', 'season strength', 'recent form', 'cutoff-safe pregame odds'],
    predictionModelSupport: 'fully_supported',
    recommendationSupport: 'fully_supported',
    currentStatus: 'fully_supported',
    userVisible: true,
    evidence: 'MLB run line is normalized and routed through the shared spread contract.',
  },
  {
    canonicalMarketKey: 'total',
    providerMarketKey: 'total',
    marketFamily: 'game',
    selectionStructure: 'over_or_under_with_total',
    lineRequired: true,
    priceRequired: true,
    supportedSportsbooks: CORE_SPORTSBOOKS,
    settlementRule: 'Final combined score must finish over or under the listed total.',
    pushRule: 'Push when final combined score equals the line.',
    featureRequirements: ['team scoring context', 'season strength', 'recent form', 'cutoff-safe pregame odds'],
    predictionModelSupport: 'fully_supported',
    recommendationSupport: 'fully_supported',
    currentStatus: 'fully_supported',
    userVisible: true,
    evidence: 'Full-game total rows are normalized and predicted for MLB prospective previews.',
  },
  {
    canonicalMarketKey: 'team_total',
    providerMarketKey: null,
    marketFamily: 'team',
    selectionStructure: 'team_over_or_under_with_total',
    lineRequired: true,
    priceRequired: true,
    supportedSportsbooks: [],
    settlementRule: 'Deterministic shadow settlement uses final selected-team score only.',
    pushRule: 'Push when team score equals the line.',
    featureRequirements: ['team offense projection', 'opposing starter', 'bullpen', 'park/weather', 'lineup'],
    predictionModelSupport: 'prediction_pending',
    recommendationSupport: 'unsupported',
    currentStatus: 'unavailable_from_provider',
    userVisible: false,
    evidence: 'Provider-independent readiness and settlement contracts exist; no verified stored SportsDataIO MLB team-total odds are currently normalized.',
  },
  {
    canonicalMarketKey: 'first_five',
    providerMarketKey: null,
    marketFamily: 'first_five',
    selectionStructure: 'first_five_moneyline_run_line_or_total',
    lineRequired: true,
    priceRequired: true,
    supportedSportsbooks: [],
    settlementRule: 'Requires first-five score data and market-specific rules.',
    pushRule: 'Market-specific push rules pending verified odds and scores.',
    featureRequirements: ['starting pitcher form', 'first-time-through-order offense', 'lineup quality', 'park/weather'],
    predictionModelSupport: 'prediction_pending',
    recommendationSupport: 'unsupported',
    currentStatus: 'unavailable_from_provider',
    userVisible: false,
    evidence: 'No verified stored first-five MLB odds are currently normalized.',
  },
  {
    canonicalMarketKey: 'pitcher_props',
    providerMarketKey: null,
    marketFamily: 'pitcher_prop',
    selectionStructure: 'player_over_or_under_with_line',
    lineRequired: true,
    priceRequired: true,
    supportedSportsbooks: [],
    settlementRule: 'Requires player-stat settlement for exact prop type.',
    pushRule: 'Push when stat equals the line, if sportsbook terms support push.',
    featureRequirements: ['projected innings', 'pitch count', 'K/BB rates', 'opponent profile', 'rest'],
    predictionModelSupport: 'prediction_pending',
    recommendationSupport: 'unsupported',
    currentStatus: 'unavailable_from_provider',
    userVisible: false,
    evidence: 'Projection availability is not sportsbook prop pricing and must not be treated as odds.',
  },
  {
    canonicalMarketKey: 'batter_props',
    providerMarketKey: null,
    marketFamily: 'batter_prop',
    selectionStructure: 'player_over_or_under_with_line',
    lineRequired: true,
    priceRequired: true,
    supportedSportsbooks: [],
    settlementRule: 'Requires player-stat settlement for exact prop type.',
    pushRule: 'Push when stat equals the line, if sportsbook terms support push.',
    featureRequirements: ['lineup confirmation', 'expected plate appearances', 'handedness matchup', 'park/weather'],
    predictionModelSupport: 'prediction_pending',
    recommendationSupport: 'unsupported',
    currentStatus: 'unavailable_from_provider',
    userVisible: false,
    evidence: 'No verified stored batter prop sportsbook odds are currently normalized.',
  },
  {
    canonicalMarketKey: 'arbitrage',
    providerMarketKey: null,
    marketFamily: 'arbitrage',
    selectionStructure: 'same_event_market_line_across_two_or_more_books',
    lineRequired: true,
    priceRequired: true,
    supportedSportsbooks: [],
    settlementRule: 'Arbitrage scanner only; not a recommendation model.',
    pushRule: 'All legs must share identical settlement terms and line.',
    featureRequirements: ['fresh simultaneous multi-book prices'],
    predictionModelSupport: 'unsupported',
    recommendationSupport: 'unsupported',
    currentStatus: 'unavailable_from_provider',
    userVisible: true,
    evidence: 'Consensus-only rows cannot prove arbitrage; at least two distinct books are required.',
  },
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function providerGameId(event: { provider_ids: Record<string, unknown> | null; id: string }) {
  const ids = asRecord(event.provider_ids)
  return String(ids.sportsdataio ?? ids.sportsdataio_game_id ?? event.id)
}

export async function getMlbMarketCapabilityRegistry() {
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, start_time, home_team, away_team, provider_ids, metadata, status')
    .eq('sport_key', 'baseball_mlb')
    .eq('league_key', 'mlb')
    .gte('start_time', '2026-07-17T04:00:00.000Z')
    .lt('start_time', '2026-07-18T04:00:00.000Z')
    .or('home_team.eq.BOS,away_team.eq.BOS')
    .order('start_time', { ascending: true })
  if (error) throw new Error(`MLB market capability event audit failed: ${error.message}`)
  const tbBos = (data ?? []).filter((event) => {
    const home = String(event.home_team ?? '').toUpperCase()
    const away = String(event.away_team ?? '').toUpperCase()
    return [home, away].includes('TB') && [home, away].includes('BOS')
  })
  const providerIds = new Set(tbBos.map(providerGameId))
  const startTimes = new Set(tbBos.map((event) => String(event.start_time ?? '')))
  const doubleheaderStatus =
    tbBos.length >= 2 && providerIds.size === tbBos.length && startTimes.size === tbBos.length
      ? 'legitimate_distinct_events_by_provider_id_and_start_time'
      : tbBos.length >= 2
        ? 'needs_manual_review'
        : 'not_applicable'
  return {
    success: true,
    mode: 'mlb_market_capability_registry_v1',
    generatedAt: new Date().toISOString(),
    sportKey: 'baseball_mlb',
    provider: 'sportsdataio',
    providerCallsMade: 0,
    capabilities: CAPABILITIES,
    summary: {
      fullySupported: CAPABILITIES.filter((item) => item.currentStatus === 'fully_supported').map((item) => item.canonicalMarketKey),
      ingestionOnly: CAPABILITIES.filter((item) => item.currentStatus === 'ingestion_only').map((item) => item.canonicalMarketKey),
      pendingModel: CAPABILITIES.filter((item) => item.currentStatus === 'prediction_pending').map((item) => item.canonicalMarketKey),
      unavailable: CAPABILITIES.filter((item) => item.currentStatus === 'unavailable_from_provider').map((item) => item.canonicalMarketKey),
      visibleTabs: CAPABILITIES.filter((item) => item.userVisible).map((item) => item.canonicalMarketKey),
    },
    doubleheaderAudit: {
      matchup: 'TB @ BOS',
      selectedDate: '2026-07-17',
      eventsFound: tbBos.length,
      providerEventIds: Array.from(providerIds).sort(),
      startTimes: Array.from(startTimes).sort(),
      status: doubleheaderStatus,
      rule: 'Do not merge games solely by teams/date; provider event ID and start time keep doubleheaders distinct.',
    },
  }
}

export function validateMlbMarketCapabilityRegistryFixtures() {
  const fullySupported = CAPABILITIES.filter((item) => item.currentStatus === 'fully_supported')
  const arbitrage = CAPABILITIES.find((item) => item.canonicalMarketKey === 'arbitrage')
  const checks = [
    ['core markets supported', fullySupported.map((item) => item.canonicalMarketKey).sort().join(',') === 'moneyline,run_line,total'],
    ['props not user-visible', CAPABILITIES.filter((item) => item.marketFamily.includes('prop')).every((item) => !item.userVisible)],
    ['arbitrage requires multibook', arbitrage?.evidence.toLowerCase().includes('two distinct books') === true],
    ['deterministic validation made zero calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_market_capability_registry_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}
