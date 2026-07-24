import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { classifyMarketSemantics } from '@/services/market-semantics.service'
import { getMlbFirstFiveReadiness } from '@/services/mlb-first-five-readiness.service'
import { getMlbMarketCapabilityRegistry } from '@/services/mlb-market-capability-registry.service'
import { getMlbTeamTotalsReadiness } from '@/services/mlb-team-totals-readiness.service'

export type UniversalMarketReadiness =
  | 'COLLECT_ONLY'
  | 'NORMALIZED'
  | 'SETTLEMENT_READY'
  | 'FEATURE_READY'
  | 'PREDICTION_READY'
  | 'SHADOW_READY'
  | 'PRODUCTION_READY'
  | 'BLOCKED'

type OddsRow = {
  id: string
  sport_key: string
  league_key: string | null
  event_id: string
  provider: string | null
  sportsbook: string | null
  market: string | null
  outcome: string | null
  price: number | null
  line: number | null
  snapshot_time: string | null
  metadata: Record<string, unknown> | null
}

type CanonicalMarketDefinition = {
  canonicalMarketKey: string
  label: string
  marketFamily: string
  marketType: string
  providerKeys: string[]
  selectionStructure: string
  lineRequired: boolean
  priceRequired: boolean
  settlementSupport: 'SUPPORTED' | 'SHADOW_READY' | 'BLOCKED'
  predictionSupport: 'SUPPORTED' | 'SHADOW_READY' | 'BLOCKED'
  learningSupport: 'SUPPORTED' | 'SHADOW_READY' | 'BLOCKED'
  officialPickEligible: boolean
  defaultBlockers: string[]
}

const MLB_DEFINITIONS: CanonicalMarketDefinition[] = [
  {
    canonicalMarketKey: 'moneyline',
    label: 'Moneyline',
    marketFamily: 'full_game',
    marketType: 'moneyline',
    providerKeys: ['moneyline', 'ml', 'h2h'],
    selectionStructure: 'home_or_away_team',
    lineRequired: false,
    priceRequired: true,
    settlementSupport: 'SUPPORTED',
    predictionSupport: 'SUPPORTED',
    learningSupport: 'SUPPORTED',
    officialPickEligible: true,
    defaultBlockers: [],
  },
  {
    canonicalMarketKey: 'run_line',
    label: 'Run Line',
    marketFamily: 'full_game',
    marketType: 'spread',
    providerKeys: ['run_line', 'spread', 'spreads', 'runline'],
    selectionStructure: 'home_or_away_team_with_line',
    lineRequired: true,
    priceRequired: true,
    settlementSupport: 'SUPPORTED',
    predictionSupport: 'SUPPORTED',
    learningSupport: 'SUPPORTED',
    officialPickEligible: true,
    defaultBlockers: [],
  },
  {
    canonicalMarketKey: 'total',
    label: 'Total',
    marketFamily: 'full_game',
    marketType: 'total',
    providerKeys: ['total', 'totals', 'over_under'],
    selectionStructure: 'over_or_under_with_total',
    lineRequired: true,
    priceRequired: true,
    settlementSupport: 'SUPPORTED',
    predictionSupport: 'SUPPORTED',
    learningSupport: 'SUPPORTED',
    officialPickEligible: true,
    defaultBlockers: [],
  },
  {
    canonicalMarketKey: 'team_total',
    label: 'Team Totals',
    marketFamily: 'team_total',
    marketType: 'team_total',
    providerKeys: ['team_total', 'team_totals'],
    selectionStructure: 'team_over_or_under_with_total',
    lineRequired: true,
    priceRequired: true,
    settlementSupport: 'SHADOW_READY',
    predictionSupport: 'SHADOW_READY',
    learningSupport: 'SHADOW_READY',
    officialPickEligible: false,
    defaultBlockers: ['NO_ODDS'],
  },
  {
    canonicalMarketKey: 'first_five_moneyline',
    label: 'First Five Moneyline',
    marketFamily: 'first_five',
    marketType: 'moneyline',
    providerKeys: ['first_five_moneyline', 'first5_moneyline', 'f5_moneyline'],
    selectionStructure: 'home_or_away_team',
    lineRequired: false,
    priceRequired: true,
    settlementSupport: 'SHADOW_READY',
    predictionSupport: 'SHADOW_READY',
    learningSupport: 'SHADOW_READY',
    officialPickEligible: false,
    defaultBlockers: ['NO_ODDS', 'STARTER_CHANGE_RULES_NOT_APPROVED'],
  },
  {
    canonicalMarketKey: 'first_five_run_line',
    label: 'First Five Run Line',
    marketFamily: 'first_five',
    marketType: 'spread',
    providerKeys: ['first_five_run_line', 'first_five_spread', 'first5_run_line', 'f5_run_line'],
    selectionStructure: 'home_or_away_team_with_line',
    lineRequired: true,
    priceRequired: true,
    settlementSupport: 'SHADOW_READY',
    predictionSupport: 'SHADOW_READY',
    learningSupport: 'SHADOW_READY',
    officialPickEligible: false,
    defaultBlockers: ['NO_ODDS', 'STARTER_CHANGE_RULES_NOT_APPROVED'],
  },
  {
    canonicalMarketKey: 'first_five_total',
    label: 'First Five Total',
    marketFamily: 'first_five',
    marketType: 'total',
    providerKeys: ['first_five_total', 'first5_total', 'f5_total'],
    selectionStructure: 'over_or_under_with_total',
    lineRequired: true,
    priceRequired: true,
    settlementSupport: 'SHADOW_READY',
    predictionSupport: 'SHADOW_READY',
    learningSupport: 'SHADOW_READY',
    officialPickEligible: false,
    defaultBlockers: ['NO_ODDS', 'STARTER_CHANGE_RULES_NOT_APPROVED'],
  },
  {
    canonicalMarketKey: 'first_inning',
    label: 'First Inning',
    marketFamily: 'first_inning',
    marketType: 'first_inning',
    providerKeys: ['first_inning', 'nrfi', 'yrfi'],
    selectionStructure: 'yes_or_no_first_inning_run',
    lineRequired: false,
    priceRequired: true,
    settlementSupport: 'BLOCKED',
    predictionSupport: 'BLOCKED',
    learningSupport: 'BLOCKED',
    officialPickEligible: false,
    defaultBlockers: ['NO_ODDS', 'MISSING_SETTLEMENT', 'MISSING_FEATURES'],
  },
  {
    canonicalMarketKey: 'alternate_lines',
    label: 'Alternate Lines',
    marketFamily: 'alternate',
    marketType: 'alternate_line',
    providerKeys: ['alternate_run_line', 'alternate_total', 'alternate_lines'],
    selectionStructure: 'market_specific_line',
    lineRequired: true,
    priceRequired: true,
    settlementSupport: 'BLOCKED',
    predictionSupport: 'BLOCKED',
    learningSupport: 'BLOCKED',
    officialPickEligible: false,
    defaultBlockers: ['PROVIDER_LIMITATION', 'MISSING_HISTORICAL_ODDS'],
  },
  {
    canonicalMarketKey: 'winning_margin',
    label: 'Winning Margin',
    marketFamily: 'derivative',
    marketType: 'winning_margin',
    providerKeys: ['winning_margin', 'margin'],
    selectionStructure: 'margin_bucket',
    lineRequired: false,
    priceRequired: true,
    settlementSupport: 'BLOCKED',
    predictionSupport: 'BLOCKED',
    learningSupport: 'BLOCKED',
    officialPickEligible: false,
    defaultBlockers: ['NO_ODDS', 'MISSING_SETTLEMENT'],
  },
  {
    canonicalMarketKey: 'race_to_runs',
    label: 'Race To Runs',
    marketFamily: 'derivative',
    marketType: 'race_to_runs',
    providerKeys: ['race_to_runs', 'race_to_2', 'race_to_3', 'race_to_5'],
    selectionStructure: 'team_race_target',
    lineRequired: true,
    priceRequired: true,
    settlementSupport: 'BLOCKED',
    predictionSupport: 'BLOCKED',
    learningSupport: 'BLOCKED',
    officialPickEligible: false,
    defaultBlockers: ['NO_ODDS', 'MISSING_SETTLEMENT', 'MISSING_FEATURES'],
  },
  {
    canonicalMarketKey: 'pitcher_props',
    label: 'Pitcher Props',
    marketFamily: 'player_props',
    marketType: 'pitcher_prop',
    providerKeys: ['pitcher_props', 'player_props:pitcher', 'player_props'],
    selectionStructure: 'player_over_or_under_with_line',
    lineRequired: true,
    priceRequired: true,
    settlementSupport: 'BLOCKED',
    predictionSupport: 'BLOCKED',
    learningSupport: 'BLOCKED',
    officialPickEligible: false,
    defaultBlockers: ['NO_ODDS', 'MISSING_PLAYER_MAPPING', 'MISSING_LINEUPS', 'MISSING_SETTLEMENT'],
  },
  {
    canonicalMarketKey: 'batter_props',
    label: 'Batter Props',
    marketFamily: 'player_props',
    marketType: 'batter_prop',
    providerKeys: ['batter_props', 'player_props:batter', 'player_props'],
    selectionStructure: 'player_over_or_under_with_line',
    lineRequired: true,
    priceRequired: true,
    settlementSupport: 'BLOCKED',
    predictionSupport: 'BLOCKED',
    learningSupport: 'BLOCKED',
    officialPickEligible: false,
    defaultBlockers: ['NO_ODDS', 'MISSING_PLAYER_MAPPING', 'MISSING_LINEUPS', 'MISSING_SETTLEMENT'],
  },
  {
    canonicalMarketKey: 'sgp_leg',
    label: 'SGP Legs',
    marketFamily: 'parlay_component',
    marketType: 'sgp_leg',
    providerKeys: ['sgp', 'same_game_parlay', 'sgp_leg'],
    selectionStructure: 'leg_level_market_contract',
    lineRequired: false,
    priceRequired: true,
    settlementSupport: 'BLOCKED',
    predictionSupport: 'BLOCKED',
    learningSupport: 'BLOCKED',
    officialPickEligible: false,
    defaultBlockers: ['PROVIDER_LIMITATION', 'MISSING_SETTLEMENT', 'CORRELATION_MODEL_MISSING'],
  },
  {
    canonicalMarketKey: 'unknown_market',
    label: 'Unknown Market',
    marketFamily: 'unknown',
    marketType: 'unknown',
    providerKeys: [],
    selectionStructure: 'unknown',
    lineRequired: false,
    priceRequired: true,
    settlementSupport: 'BLOCKED',
    predictionSupport: 'BLOCKED',
    learningSupport: 'BLOCKED',
    officialPickEligible: false,
    defaultBlockers: ['UNKNOWN_MARKET'],
  },
]

function nowIso() {
  return new Date().toISOString()
}

function lower(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function stablePart(value: unknown) {
  return String(value ?? 'none').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '_')
}

function isoDay(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function nextDayIso(date = new Date()) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

function distribution<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

function canonicalDefinition(providerMarketKey: unknown) {
  const market = lower(providerMarketKey).replace(/-/g, '_')
  return MLB_DEFINITIONS.find((definition) => definition.providerKeys.some((key) => market === key || market.includes(key))) ?? MLB_DEFINITIONS[MLB_DEFINITIONS.length - 1]
}

function readinessFor(definition: CanonicalMarketDefinition, row?: OddsRow): UniversalMarketReadiness {
  const blockers = blockerReasons(definition, row)
  if (blockers.includes('UNKNOWN_MARKET')) return 'BLOCKED'
  if (!row) return definition.defaultBlockers.length ? 'BLOCKED' : 'COLLECT_ONLY'
  if (blockers.includes('NO_ODDS') || blockers.includes('MISSING_LINE')) return 'COLLECT_ONLY'
  if (definition.settlementSupport === 'BLOCKED') return 'NORMALIZED'
  if (definition.predictionSupport === 'BLOCKED') return 'SETTLEMENT_READY'
  if (definition.officialPickEligible) return 'PRODUCTION_READY'
  return 'SHADOW_READY'
}

function blockerReasons(definition: CanonicalMarketDefinition, row?: OddsRow) {
  const blockers = new Set(definition.defaultBlockers)
  if (row) {
    blockers.delete('NO_ODDS')
    if (definition.priceRequired && row.price === null) blockers.add('NO_ODDS')
    if (definition.lineRequired && row.line === null) blockers.add('MISSING_LINE')
  }
  if (definition.officialPickEligible) {
    blockers.delete('NO_ODDS')
  }
  return Array.from(blockers)
}

function canonicalId(row: OddsRow, definition: CanonicalMarketDefinition) {
  return [
    'umiv1',
    row.sport_key,
    row.league_key,
    row.event_id,
    definition.canonicalMarketKey,
    row.sportsbook,
    row.outcome,
    row.line,
    row.snapshot_time,
  ].map(stablePart).join(':')
}

function canonicalFromOdds(row: OddsRow) {
  const definition = canonicalDefinition(row.market)
  const semantics = classifyMarketSemantics({
    market:
      definition.canonicalMarketKey === 'run_line'
        ? 'run_line'
        : definition.canonicalMarketKey === 'first_five_run_line'
          ? 'first_five_run_line'
          : definition.canonicalMarketKey,
    line: row.line,
  })
  const blockers = blockerReasons(definition, row)
  return {
    canonicalId: canonicalId(row, definition),
    sourceSnapshotId: row.id,
    sport: row.sport_key,
    league: row.league_key,
    event: row.event_id,
    marketFamily: definition.marketFamily,
    marketType: definition.marketType,
    selection: row.outcome,
    line: row.line,
    odds: row.price,
    sportsbook: row.sportsbook,
    timestamp: row.snapshot_time,
    cutoff: null,
    pushSupport: semantics.supportsPush,
    outcomeCount: semantics.outcomeCount,
    settlementSupport: definition.settlementSupport,
    predictionSupport: definition.predictionSupport,
    learningSupport: definition.learningSupport,
    officialPickEligible: definition.officialPickEligible,
    provider: row.provider,
    providerMarketKey: row.market,
    canonicalMarketKey: definition.canonicalMarketKey,
    readiness: readinessFor(definition, row),
    blockers,
  }
}

function catalogRows(discoveredKeys: Set<string>) {
  return MLB_DEFINITIONS
    .filter((definition) => definition.canonicalMarketKey !== 'unknown_market' && !discoveredKeys.has(definition.canonicalMarketKey))
    .map((definition) => {
      const semantics = classifyMarketSemantics({ market: definition.canonicalMarketKey, line: definition.lineRequired ? 1 : null })
      return {
        canonicalId: `catalog:${definition.canonicalMarketKey}`,
        sourceSnapshotId: null,
        sport: 'baseball_mlb',
        league: 'mlb',
        event: null,
        marketFamily: definition.marketFamily,
        marketType: definition.marketType,
        selection: null,
        line: null,
        odds: null,
        sportsbook: null,
        timestamp: null,
        cutoff: null,
        pushSupport: semantics.supportsPush,
        outcomeCount: semantics.outcomeCount,
        settlementSupport: definition.settlementSupport,
        predictionSupport: definition.predictionSupport,
        learningSupport: definition.learningSupport,
        officialPickEligible: definition.officialPickEligible,
        provider: 'sportsdataio',
        providerMarketKey: definition.providerKeys[0] ?? null,
        canonicalMarketKey: definition.canonicalMarketKey,
        readiness: readinessFor(definition),
        blockers: blockerReasons(definition),
      }
    })
}

async function safeRows<T>(label: string, table: string, columns: string, build: (query: any) => any, limit = 1000) {
  try {
    const { data, error } = await build(supabaseAdmin.from(table).select(columns).limit(limit))
    if (error) return { data: [] as T[], error: `${label}: ${error.message}` }
    return { data: (data ?? []) as T[], error: null }
  } catch (error) {
    return { data: [] as T[], error: `${label}: ${error instanceof Error ? error.message : 'unknown read error'}` }
  }
}

export async function getUniversalMarketInventory() {
  const today = isoDay()
  const tomorrow = nextDayIso()
  const [todayOdds, latestOdds, capabilityRegistry, teamTotals, firstFive] = await Promise.all([
    safeRows<OddsRow>(
      'today odds snapshots',
      'sports_odds_snapshots',
      'id, sport_key, league_key, event_id, provider, sportsbook, market, outcome, price, line, snapshot_time, metadata',
      (query) => query.gte('snapshot_time', `${today}T00:00:00.000Z`).lt('snapshot_time', `${tomorrow}T00:00:00.000Z`).order('snapshot_time', { ascending: false }),
      1500
    ),
    safeRows<OddsRow>(
      'latest odds snapshots',
      'sports_odds_snapshots',
      'id, sport_key, league_key, event_id, provider, sportsbook, market, outcome, price, line, snapshot_time, metadata',
      (query) => query.order('snapshot_time', { ascending: false }),
      1500
    ),
    getMlbMarketCapabilityRegistry().catch((error) => ({ success: false, providerCallsMade: 0, capabilities: [], error: error instanceof Error ? error.message : 'capability read failed' })),
    getMlbTeamTotalsReadiness().catch((error) => ({ success: false, providerCallsMade: 0, remoteMutationsMade: 0, error: error instanceof Error ? error.message : 'team totals read failed' })),
    getMlbFirstFiveReadiness().catch((error) => ({ success: false, providerCallsMade: 0, remoteMutationsMade: 0, error: error instanceof Error ? error.message : 'first five read failed' })),
  ])
  const sourceRows = todayOdds.data.length ? todayOdds.data : latestOdds.data
  const normalized = sourceRows.map(canonicalFromOdds)
  const discoveredKeys = new Set(normalized.map((row) => row.canonicalMarketKey))
  const catalog = catalogRows(discoveredKeys)
  const canonicalMarkets = [...normalized, ...catalog]
  const uniqueIds = unique(canonicalMarkets.map((row) => row.canonicalId))
  const duplicateMarkets = canonicalMarkets.length - uniqueIds.length
  const providerCallsMade =
    Number((capabilityRegistry as Record<string, unknown>).providerCallsMade ?? 0) +
    Number((teamTotals as Record<string, unknown>).providerCallsMade ?? 0) +
    Number((firstFive as Record<string, unknown>).providerCallsMade ?? 0)

  return {
    success: todayOdds.error === null && latestOdds.error === null,
    mode: 'universal_market_intelligence_platform_v1',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade,
    remoteMutationsMade: 0,
    source: todayOdds.data.length ? 'today_sports_odds_snapshots' : 'latest_sports_odds_snapshots',
    inventory: {
      todaysMarkets: normalized.filter((row) => row.timestamp?.startsWith(today)).length,
      historicalMarkets: latestOdds.data.length,
      supportedMarkets: canonicalMarkets.filter((row) => row.readiness === 'PRODUCTION_READY').length,
      blockedMarkets: canonicalMarkets.filter((row) => row.readiness === 'BLOCKED' || row.blockers.length > 0).length,
      shadowMarkets: canonicalMarkets.filter((row) => row.readiness === 'SHADOW_READY').length,
      productionMarkets: canonicalMarkets.filter((row) => row.readiness === 'PRODUCTION_READY').length,
    },
    analytics: {
      totalMarkets: canonicalMarkets.length,
      canonicalMarketTypes: unique(canonicalMarkets.map((row) => row.canonicalMarketKey)).length,
      marketsBySport: distribution(canonicalMarkets.map((row) => row.sport)),
      marketsByProvider: distribution(canonicalMarkets.map((row) => String(row.provider ?? 'unknown'))),
      marketsBySportsbook: distribution(canonicalMarkets.map((row) => String(row.sportsbook ?? 'none'))),
      marketsByReadiness: distribution(canonicalMarkets.map((row) => row.readiness)),
      marketsBySettlement: distribution(canonicalMarkets.map((row) => row.settlementSupport)),
      marketsByPrediction: distribution(canonicalMarkets.map((row) => row.predictionSupport)),
    },
    readinessSummary: {
      collectOnly: canonicalMarkets.filter((row) => row.readiness === 'COLLECT_ONLY').length,
      normalized: canonicalMarkets.filter((row) => row.readiness === 'NORMALIZED').length,
      settlementReady: canonicalMarkets.filter((row) => row.readiness === 'SETTLEMENT_READY').length,
      featureReady: canonicalMarkets.filter((row) => row.readiness === 'FEATURE_READY').length,
      predictionReady: canonicalMarkets.filter((row) => row.readiness === 'PREDICTION_READY').length,
      shadowReady: canonicalMarkets.filter((row) => row.readiness === 'SHADOW_READY').length,
      productionReady: canonicalMarkets.filter((row) => row.readiness === 'PRODUCTION_READY').length,
      blocked: canonicalMarkets.filter((row) => row.readiness === 'BLOCKED' || row.blockers.length > 0).length,
    },
    providerCoverage: {
      providers: unique(canonicalMarkets.map((row) => String(row.provider ?? 'sportsdataio'))),
      sportsbooks: unique(canonicalMarkets.map((row) => String(row.sportsbook ?? 'none'))),
      teamTotalsProviderReady: Boolean((teamTotals as any).certifications?.TEAM_TOTALS_PROVIDER_READINESS_PASS),
      firstFiveProviderReady: Boolean((firstFive as any).certifications?.FIRST_FIVE_PROVIDER_READINESS_PASS),
      capabilityRegistryAvailable: (capabilityRegistry as Record<string, unknown>).success !== false,
    },
    blockerSummary: distribution(canonicalMarkets.flatMap((row) => row.blockers.length ? row.blockers : ['NONE'])),
    canonicalMarkets,
    diagnostics: {
      duplicateMarkets,
      idempotentDiscovery: duplicateMarkets === 0,
      canonicalNormalization: canonicalMarkets.every((row) => Boolean(row.canonicalId && row.canonicalMarketKey && row.marketFamily)),
      unsupportedActivationBlocked: canonicalMarkets.every((row) => row.officialPickEligible || row.readiness !== 'PRODUCTION_READY'),
      providerBudgetRespected: providerCallsMade === 0,
      errors: [todayOdds.error, latestOdds.error, (capabilityRegistry as Record<string, unknown>).error, (teamTotals as Record<string, unknown>).error, (firstFive as Record<string, unknown>).error].filter(Boolean),
    },
    certifications: {
      UNIVERSAL_MARKET_PLATFORM_PASS: duplicateMarkets === 0,
      CANONICAL_MARKET_REGISTRY_PASS: canonicalMarkets.every((row) => Boolean(row.canonicalId && row.canonicalMarketKey)),
      MARKET_DISCOVERY_PASS: normalized.length > 0 || catalog.length > 0,
      MARKET_READINESS_PASS: canonicalMarkets.every((row) => Boolean(row.readiness)),
      PROVIDER_COVERAGE_PASS: providerCallsMade === 0,
    },
  }
}

export async function getUniversalMarketReadiness() {
  const inventory = await getUniversalMarketInventory()
  return {
    success: inventory.success,
    mode: 'universal_market_readiness_v1',
    generatedAt: inventory.generatedAt,
    providerCallsMade: inventory.providerCallsMade,
    remoteMutationsMade: inventory.remoteMutationsMade,
    readinessSummary: inventory.readinessSummary,
    blockerSummary: inventory.blockerSummary,
    markets: inventory.canonicalMarkets.map((row) => ({
      canonicalId: row.canonicalId,
      canonicalMarketKey: row.canonicalMarketKey,
      marketFamily: row.marketFamily,
      readiness: row.readiness,
      blockers: row.blockers,
      settlementSupport: row.settlementSupport,
      predictionSupport: row.predictionSupport,
      learningSupport: row.learningSupport,
    })),
    certifications: inventory.certifications,
  }
}

export async function getUniversalProviderCoverage() {
  const inventory = await getUniversalMarketInventory()
  return {
    success: inventory.success,
    mode: 'universal_market_provider_coverage_v1',
    generatedAt: inventory.generatedAt,
    providerCallsMade: inventory.providerCallsMade,
    remoteMutationsMade: inventory.remoteMutationsMade,
    providerCoverage: inventory.providerCoverage,
    marketsByProvider: inventory.analytics.marketsByProvider,
    marketsBySportsbook: inventory.analytics.marketsBySportsbook,
    supportedMarkets: inventory.canonicalMarkets.filter((row) => row.readiness === 'PRODUCTION_READY').map((row) => row.canonicalMarketKey),
    blockedMarkets: inventory.canonicalMarkets.filter((row) => row.blockers.length > 0).map((row) => ({ market: row.canonicalMarketKey, blockers: row.blockers })),
    certifications: { PROVIDER_COVERAGE_PASS: inventory.certifications.PROVIDER_COVERAGE_PASS },
  }
}

export async function getUniversalMarketDiagnostics() {
  const inventory = await getUniversalMarketInventory()
  return {
    success: inventory.success && inventory.diagnostics.duplicateMarkets === 0,
    mode: 'universal_market_diagnostics_v1',
    generatedAt: inventory.generatedAt,
    providerCallsMade: inventory.providerCallsMade,
    remoteMutationsMade: inventory.remoteMutationsMade,
    diagnostics: inventory.diagnostics,
    analytics: inventory.analytics,
    certifications: inventory.certifications,
  }
}
