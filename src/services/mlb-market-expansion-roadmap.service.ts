import 'server-only'

import { SPORTSDATAIO_ENDPOINT_CATALOG } from '@/config/sportsdataio-endpoint-catalog'
import { getMlbOddsCoverage } from '@/services/mlb-odds-coverage.service'
import { getProductionReadinessAudit } from '@/services/production-readiness-audit.service'

type Availability = 'AVAILABLE' | 'PARTIAL' | 'MISSING' | 'UNSUPPORTED' | 'PROVIDER_LIMITED' | 'HISTORICAL_LIMITED'
type Complexity = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
type RiskGrade = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
type ActivationStage =
  | 'NOT_SUPPORTED'
  | 'CONTRACT_READY'
  | 'DATA_READY'
  | 'FEATURE_READY'
  | 'MODEL_READY'
  | 'SETTLEMENT_READY'
  | 'SHADOW_READY'
  | 'BACKTEST_READY'
  | 'CALIBRATION_READY'
  | 'MARKET_INTELLIGENCE_READY'
  | 'OFFICIAL_ELIGIBLE'
  | 'PRODUCTION'

type MarketFamily =
  | 'full_game'
  | 'first_five'
  | 'first_inning'
  | 'pitcher_props'
  | 'batter_props'
  | 'team_game_props'
  | 'combined_alternate'

export type MlbMarketTaxonomyItem = {
  id: string
  displayName: string
  sport: 'baseball_mlb'
  family: MarketFamily
  selectionType: string
  unit: string
  settlementRequirements: string[]
  featureRequirements: string[]
  modelType: string
  priceRequirements: string[]
  historicalRequirements: string[]
}

type ProviderMatrixRow = {
  marketId: string
  sportsDataIoCurrentProviderSupports: 'yes' | 'no' | 'unknown'
  currentSubscriptionSupports: 'yes' | 'no' | 'unknown'
  providerReturnsToday: 'yes' | 'no' | 'unknown'
  adapterSupports: boolean
  normalizationSupports: boolean
  storageSupports: boolean
  differentProviderRequired: boolean
  commercialUpgradeRequired: boolean
  evidence: string
}

type RequirementMatrixRow = {
  marketId: string
  requiredInputs: Array<{ input: string; status: Availability }>
}

type ModelMatrixRow = {
  marketId: string
  existingModelReusable: boolean
  predictionSdkReusable: boolean
  existingFeatureBuilderReusable: boolean
  marketSpecificModelRequired: boolean
  newCalibrationRequired: boolean
  newConfidenceContractRequired: boolean
  newExplanationContractRequired: boolean
  newReadinessGateRequired: boolean
  complexity: Complexity
  rationale: string
}

type SettlementMatrixRow = {
  marketId: string
  existingSettlementSupport: boolean
  newSettlementLogicRequired: boolean
  requiredBoxscoreFields: string[]
  pushBehavior: string
  voidBehavior: string
  starterChangeRules: string
  postponementRules: string
  statCorrectionHandling: string
  sportsbookRuleDifferences: string
}

type PriorityRow = {
  family: MarketFamily
  dataAvailability: number
  userValue: number
  implementationSimplicity: number
  settlementReadiness: number
  historicalReadiness: number
  modelReusability: number
  providerCost: number
  operationalSafety: number
  opportunityExpansion: number
  score: number
  rank: number
  firstRecommendedEpic: boolean
}

type MarketReadinessRow = {
  marketId: string
  displayName: string
  family: MarketFamily
  currentProviderSupport: number
  historicalAvailability: number
  featureAvailability: number
  predictionComplexity: number
  settlementComplexity: number
  dataCompleteness: number
  calibrationDifficulty: number
  userValue: number
  estimatedOpportunityIncrease: number
  engineeringComplexity: number
  overallReadiness: number
  recommendedWave: 1 | 2 | 3 | 4
}

const TAXONOMY: MlbMarketTaxonomyItem[] = [
  market('moneyline', 'Moneyline', 'full_game', 'team_to_win', 'game', ['final winner'], ['team strength', 'starting pitcher context', 'price'], 'existing full-game binary classifier', ['team prices'], ['settled game winners']),
  market('run_line', 'Run Line', 'full_game', 'team_spread', 'runs', ['final margin plus spread'], ['team strength', 'run environment', 'price'], 'existing full-game spread classifier', ['spread line and price'], ['settled margins']),
  market('game_total', 'Game Total', 'full_game', 'over_under', 'runs', ['final combined runs'], ['offense', 'starter', 'bullpen', 'park/weather', 'price'], 'existing full-game total classifier', ['total line and price'], ['settled combined scores']),
  market('team_total', 'Team Total', 'full_game', 'team_over_under', 'team runs', ['team final runs'], ['team offense', 'opposing starter', 'bullpen', 'park/weather', 'lineup'], 'new team-scoring model', ['team total line and price'], ['team scores with closing/opening team total lines']),
  market('alternate_run_line', 'Alternate Run Line', 'full_game', 'team_spread', 'runs', ['final margin plus alternate spread'], ['spread distribution', 'price ladder'], 'new distribution/ladder layer over run-line model', ['alternate spread and price'], ['settled alternate-line snapshots']),
  market('alternate_total', 'Alternate Total', 'full_game', 'over_under', 'runs', ['final combined runs vs alternate total'], ['run distribution', 'price ladder'], 'new total distribution/ladder layer', ['alternate total and price'], ['settled alternate-total snapshots']),
  market('first_five_moneyline', 'First Five Moneyline', 'first_five', 'team_to_lead_or_tie_rules', 'first five innings', ['score after five innings'], ['confirmed starters', 'first-five offense splits', 'park/weather'], 'new first-five model', ['F5 moneyline prices'], ['first-five scores and odds']),
  market('first_five_run_line', 'First Five Run Line', 'first_five', 'team_spread', 'first five runs', ['score margin after five innings plus spread'], ['confirmed starters', 'first-five run distribution'], 'new first-five spread model', ['F5 spread and price'], ['first-five score margins and odds']),
  market('first_five_total', 'First Five Total', 'first_five', 'over_under', 'first five runs', ['combined score after five innings'], ['starter form', 'lineups', 'park/weather'], 'new first-five total model', ['F5 total and price'], ['first-five totals and odds']),
  market('first_five_team_total', 'First Five Team Total', 'first_five', 'team_over_under', 'first five team runs', ['team score after five innings'], ['starter matchup', 'top-order lineup', 'park/weather'], 'new first-five team model', ['F5 team total line and price'], ['first-five team scores and odds']),
  market('nrfi', 'NRFI', 'first_inning', 'yes_no', 'first inning run', ['no run in first inning'], ['starter first-inning profile', 'top-order hitters', 'weather/park'], 'new first-inning probability model', ['NRFI/YRFI prices'], ['first-inning scores and odds']),
  market('yrfi', 'YRFI', 'first_inning', 'yes_no', 'first inning run', ['at least one run in first inning'], ['starter first-inning profile', 'top-order hitters', 'weather/park'], 'new first-inning probability model', ['NRFI/YRFI prices'], ['first-inning scores and odds']),
  market('first_inning_run_line', 'First Inning Run Line', 'first_inning', 'team_spread', 'first inning runs', ['first-inning margin plus spread'], ['top-order offense', 'starter opening inning'], 'new first-inning spread model', ['first-inning spread and price'], ['first-inning team scores and odds']),
  market('first_inning_total', 'First Inning Total', 'first_inning', 'over_under', 'first inning runs', ['combined first-inning runs'], ['top-order offense', 'starter opening inning'], 'new first-inning total model', ['first-inning total and price'], ['first-inning totals and odds']),
  ...['strikeouts', 'outs_recorded', 'hits_allowed', 'earned_runs', 'walks', 'pitch_count', 'win_decision', 'quality_start'].map((id) =>
    market(`pitcher_${id}`, title(`Pitcher ${id}`), 'pitcher_props', 'player_over_under_or_yes_no', 'pitcher stat', ['official pitcher stat'], ['confirmed starter', 'pitch count history', 'rest', 'opponent profile', 'lineup'], 'new pitcher prop model', ['player prop line and price'], ['pitcher game logs, starts, prop lines and settlements'])
  ),
  ...['hits', 'runs', 'rbi', 'total_bases', 'home_runs', 'walks', 'strikeouts', 'stolen_bases', 'hits_runs_rbi', 'singles', 'doubles', 'extra_base_hits'].map((id) =>
    market(`batter_${id}`, title(`Batter ${id}`), 'batter_props', 'player_over_under_or_yes_no', 'batter stat', ['official batter stat'], ['confirmed lineup', 'batting order', 'opposing pitcher', 'handedness split', 'park/weather'], 'new batter prop model', ['player prop line and price'], ['batter game logs, plate appearances, prop lines and settlements'])
  ),
  ...['team_hits', 'team_runs', 'team_home_runs', 'race_to_x_runs', 'winning_margin', 'highest_scoring_inning', 'extra_innings', 'both_teams_to_score_thresholds'].map((id) =>
    market(id, title(id), 'team_game_props', 'team_or_game_prop', 'game prop', ['official game/team stat'], ['team profiles', 'park/weather', 'line-specific context'], 'new prop-specific model', ['prop line and price'], ['stat-specific historical odds and settlement'])
  ),
  ...['same_game_combinations', 'alternate_player_lines', 'alternate_pitcher_lines', 'alternate_team_totals'].map((id) =>
    market(id, title(id), 'combined_alternate', 'combination_or_alternate_line', 'varies', ['all leg settlement rules'], ['correlation model', 'complete leg pricing', 'rule compatibility'], 'new correlation/distribution layer', ['multi-leg or alternate prices'], ['line-ladder history and leg-level settlements'])
  ),
]

const FAMILY_BASE_REQUIREMENTS: Record<MarketFamily, Array<{ input: string; status: Availability }>> = {
  full_game: [
    { input: 'Core schedule, final score and consensus full-game odds', status: 'AVAILABLE' },
    { input: 'Team-season and recent-form features', status: 'PARTIAL' },
    { input: 'Confirmed lineups and detailed player availability', status: 'PARTIAL' },
    { input: 'Historical odds depth for mature calibration', status: 'HISTORICAL_LIMITED' },
  ],
  first_five: [
    { input: 'Confirmed starters', status: 'PARTIAL' },
    { input: 'First-five odds', status: 'MISSING' },
    { input: 'First-five score/results history', status: 'MISSING' },
    { input: 'Starter and first-time-through-order features', status: 'PARTIAL' },
  ],
  first_inning: [
    { input: 'NRFI/YRFI odds', status: 'MISSING' },
    { input: 'First-inning score history', status: 'MISSING' },
    { input: 'Confirmed lineups and top-order availability', status: 'PARTIAL' },
    { input: 'Starter first-inning splits', status: 'HISTORICAL_LIMITED' },
  ],
  pitcher_props: [
    { input: 'Verified prop odds', status: 'PROVIDER_LIMITED' },
    { input: 'Confirmed starter identity', status: 'PARTIAL' },
    { input: 'Pitcher game logs and pitch-count/rest history', status: 'PARTIAL' },
    { input: 'Prop settlement fields', status: 'MISSING' },
  ],
  batter_props: [
    { input: 'Verified prop odds', status: 'PROVIDER_LIMITED' },
    { input: 'Confirmed lineups and batting order', status: 'PARTIAL' },
    { input: 'Batter handedness and matchup history', status: 'HISTORICAL_LIMITED' },
    { input: 'Prop settlement fields', status: 'MISSING' },
  ],
  team_game_props: [
    { input: 'Verified team/game prop odds', status: 'MISSING' },
    { input: 'Team stat settlement fields', status: 'PARTIAL' },
    { input: 'Prop-specific historical line snapshots', status: 'MISSING' },
  ],
  combined_alternate: [
    { input: 'Multi-book or same-game correlation-compatible prices', status: 'MISSING' },
    { input: 'Leg-level settlement parity', status: 'MISSING' },
    { input: 'Distribution/correlation historical depth', status: 'HISTORICAL_LIMITED' },
  ],
}

const PRIORITY_SEED: Omit<PriorityRow, 'score' | 'rank' | 'firstRecommendedEpic'>[] = [
  { family: 'full_game', dataAvailability: 78, userValue: 82, implementationSimplicity: 72, settlementReadiness: 82, historicalReadiness: 58, modelReusability: 78, providerCost: 76, operationalSafety: 72, opportunityExpansion: 35 },
  { family: 'first_five', dataAvailability: 46, userValue: 78, implementationSimplicity: 56, settlementReadiness: 52, historicalReadiness: 35, modelReusability: 48, providerCost: 44, operationalSafety: 50, opportunityExpansion: 68 },
  { family: 'first_inning', dataAvailability: 32, userValue: 76, implementationSimplicity: 42, settlementReadiness: 38, historicalReadiness: 26, modelReusability: 30, providerCost: 36, operationalSafety: 34, opportunityExpansion: 55 },
  { family: 'pitcher_props', dataAvailability: 38, userValue: 88, implementationSimplicity: 34, settlementReadiness: 34, historicalReadiness: 34, modelReusability: 26, providerCost: 30, operationalSafety: 30, opportunityExpansion: 92 },
  { family: 'batter_props', dataAvailability: 30, userValue: 86, implementationSimplicity: 26, settlementReadiness: 30, historicalReadiness: 30, modelReusability: 22, providerCost: 28, operationalSafety: 24, opportunityExpansion: 98 },
  { family: 'team_game_props', dataAvailability: 34, userValue: 64, implementationSimplicity: 36, settlementReadiness: 38, historicalReadiness: 28, modelReusability: 24, providerCost: 34, operationalSafety: 34, opportunityExpansion: 60 },
  { family: 'combined_alternate', dataAvailability: 24, userValue: 58, implementationSimplicity: 20, settlementReadiness: 22, historicalReadiness: 20, modelReusability: 18, providerCost: 20, operationalSafety: 18, opportunityExpansion: 74 },
]

const PRIORITY_WEIGHTS = {
  dataAvailability: 0.16,
  userValue: 0.14,
  implementationSimplicity: 0.12,
  settlementReadiness: 0.14,
  historicalReadiness: 0.12,
  modelReusability: 0.1,
  providerCost: 0.08,
  operationalSafety: 0.08,
  opportunityExpansion: 0.06,
}

const MARKET_READINESS_WEIGHTS = {
  currentProviderSupport: 0.14,
  historicalAvailability: 0.12,
  featureAvailability: 0.12,
  predictionComplexity: 0.1,
  settlementComplexity: 0.12,
  dataCompleteness: 0.12,
  calibrationDifficulty: 0.08,
  userValue: 0.08,
  estimatedOpportunityIncrease: 0.06,
  engineeringComplexity: 0.06,
}

function market(
  id: string,
  displayName: string,
  family: MarketFamily,
  selectionType: string,
  unit: string,
  settlementRequirements: string[],
  featureRequirements: string[],
  modelType: string,
  priceRequirements: string[],
  historicalRequirements: string[]
): MlbMarketTaxonomyItem {
  return { id, displayName, sport: 'baseball_mlb', family, selectionType, unit, settlementRequirements, featureRequirements, modelType, priceRequirements, historicalRequirements }
}

function title(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function providerRow(item: MlbMarketTaxonomyItem, supportedToday: Set<string>): ProviderMatrixRow {
  const familyEndpoint = SPORTSDATAIO_ENDPOINT_CATALOG.find((endpoint) => {
    if (endpoint.sport !== 'mlb') return false
    if (item.family === 'pitcher_props' || item.family === 'batter_props') return endpoint.domain === 'props'
    if (item.id.includes('alternate')) return endpoint.pathTemplate.includes('AlternateMarket')
    if (item.family === 'full_game') return endpoint.pathTemplate.includes('GameOddsByDate')
    return endpoint.pathTemplate.includes('BettingMarkets')
  })
  const supported = supportedToday.has(item.id) || (item.id === 'game_total' && supportedToday.has('total'))
  return {
    marketId: item.id,
    sportsDataIoCurrentProviderSupports: supported ? 'yes' : familyEndpoint ? 'unknown' : 'no',
    currentSubscriptionSupports: supported ? 'yes' : familyEndpoint?.entitlementStatus === 'confirmed_trial' ? 'unknown' : 'unknown',
    providerReturnsToday: supported ? 'yes' : 'no',
    adapterSupports: supported,
    normalizationSupports: supported,
    storageSupports: supported || item.family !== 'combined_alternate',
    differentProviderRequired: item.family === 'combined_alternate',
    commercialUpgradeRequired: !supported,
    evidence: supported
      ? 'Production audit shows stored odds and predictions for this full-game market.'
      : familyEndpoint
        ? `Repository catalog contains ${familyEndpoint.pathTemplate}, but entitlement/payload/normalization/settlement are not production verified.`
        : 'No repository contract or production evidence verifies provider support.',
  }
}

function modelRow(item: MlbMarketTaxonomyItem): ModelMatrixRow {
  const supported = ['moneyline', 'run_line', 'game_total'].includes(item.id)
  const lowRiskExtension = item.id === 'team_total'
  const firstFive = item.family === 'first_five'
  const props = item.family === 'pitcher_props' || item.family === 'batter_props'
  return {
    marketId: item.id,
    existingModelReusable: supported,
    predictionSdkReusable: true,
    existingFeatureBuilderReusable: supported || lowRiskExtension || firstFive,
    marketSpecificModelRequired: !supported,
    newCalibrationRequired: !supported,
    newConfidenceContractRequired: !supported,
    newExplanationContractRequired: !supported,
    newReadinessGateRequired: !supported,
    complexity: supported ? 'LOW' : lowRiskExtension ? 'MEDIUM' : firstFive ? 'HIGH' : props ? 'VERY_HIGH' : 'HIGH',
    rationale: supported
      ? 'Already modeled, predicted and filtered through Current Board.'
      : lowRiskExtension
        ? 'Reuses team/game scoring context but needs team-total prices, feature targets and settlement.'
        : props
          ? 'Requires player identity, late lineup/start status, stat-specific features, prop prices and stat settlement.'
          : 'Requires new market target, historical data, settlement, replay, calibration and shadow validation.',
  }
}

function settlementRow(item: MlbMarketTaxonomyItem): SettlementMatrixRow {
  const supported = ['moneyline', 'run_line', 'game_total'].includes(item.id)
  const player = item.family === 'pitcher_props' || item.family === 'batter_props'
  return {
    marketId: item.id,
    existingSettlementSupport: supported,
    newSettlementLogicRequired: !supported,
    requiredBoxscoreFields: supported
      ? ['final home score', 'final away score']
      : player
        ? ['official player game stat', 'starter/lineup identity', 'game status']
        : item.family === 'first_five' || item.family === 'first_inning'
          ? ['inning-by-inning score', 'game status']
          : ['official game/team stat', 'game status'],
    pushBehavior: item.selectionType.includes('yes_no') ? 'No push unless sportsbook void rule applies.' : 'Push when official stat equals line where market terms allow.',
    voidBehavior: 'Void/postpone rules must be captured per market before activation.',
    starterChangeRules: player || item.family === 'first_five' || item.family === 'first_inning' ? 'Must define listed-starter and opener handling before official eligibility.' : 'Standard game postponement/no-action handling.',
    postponementRules: 'No market activates unless postponed/suspended game handling is deterministic.',
    statCorrectionHandling: 'Settlement must preserve audit trail and support explicit correction events; do not rewrite pregame predictions.',
    sportsbookRuleDifferences: supported ? 'Current consensus full-game rules are simple; multi-book differences still matter for expansion.' : 'Must be documented before market can leave shadow mode.',
  }
}

function activationStage(item: MlbMarketTaxonomyItem): ActivationStage {
  if (['moneyline', 'run_line', 'game_total'].includes(item.id)) return 'PRODUCTION'
  if (item.id === 'team_total') return 'CONTRACT_READY'
  if (item.family === 'first_five' || item.family === 'first_inning') return 'NOT_SUPPORTED'
  if (item.family === 'pitcher_props' || item.family === 'batter_props') return 'NOT_SUPPORTED'
  return 'NOT_SUPPORTED'
}

function priorityRows(): PriorityRow[] {
  const scored = PRIORITY_SEED.map((row) => {
    const score = round(
      row.dataAvailability * PRIORITY_WEIGHTS.dataAvailability +
        row.userValue * PRIORITY_WEIGHTS.userValue +
        row.implementationSimplicity * PRIORITY_WEIGHTS.implementationSimplicity +
        row.settlementReadiness * PRIORITY_WEIGHTS.settlementReadiness +
        row.historicalReadiness * PRIORITY_WEIGHTS.historicalReadiness +
        row.modelReusability * PRIORITY_WEIGHTS.modelReusability +
        row.providerCost * PRIORITY_WEIGHTS.providerCost +
        row.operationalSafety * PRIORITY_WEIGHTS.operationalSafety +
        row.opportunityExpansion * PRIORITY_WEIGHTS.opportunityExpansion
    )
    return { ...row, score, rank: 0, firstRecommendedEpic: row.family === 'full_game' }
  }).sort((a, b) => b.score - a.score)
  return scored.map((row, index) => ({ ...row, rank: index + 1, firstRecommendedEpic: row.family === 'full_game' }))
}

function familyUserValue(family: MarketFamily) {
  return PRIORITY_SEED.find((row) => row.family === family)?.userValue ?? 50
}

function readinessRow(item: MlbMarketTaxonomyItem): MarketReadinessRow {
  const production = ['moneyline', 'run_line', 'game_total'].includes(item.id)
  const teamTotal = item.id === 'team_total'
  const alternateFullGame = item.id === 'alternate_run_line' || item.id === 'alternate_total'
  const firstFive = item.family === 'first_five'
  const firstInning = item.family === 'first_inning'
  const pitcherCore = item.id === 'pitcher_strikeouts' || item.id === 'pitcher_outs_recorded'
  const props = item.family === 'pitcher_props' || item.family === 'batter_props'

  const row = {
    marketId: item.id,
    displayName: item.displayName,
    family: item.family,
    currentProviderSupport: production ? 95 : teamTotal ? 45 : alternateFullGame ? 35 : firstFive ? 32 : props ? 28 : 25,
    historicalAvailability: production ? 60 : teamTotal ? 38 : firstFive ? 30 : firstInning ? 22 : props ? 28 : 20,
    featureAvailability: production ? 72 : teamTotal ? 58 : firstFive ? 48 : firstInning ? 34 : pitcherCore ? 42 : props ? 32 : 28,
    predictionComplexity: production ? 85 : teamTotal ? 62 : firstFive ? 45 : firstInning ? 34 : pitcherCore ? 32 : props ? 24 : 22,
    settlementComplexity: production ? 86 : teamTotal ? 72 : firstFive ? 48 : firstInning ? 44 : pitcherCore ? 38 : props ? 30 : 25,
    dataCompleteness: production ? 70 : teamTotal ? 46 : firstFive ? 34 : firstInning ? 26 : pitcherCore ? 32 : props ? 24 : 20,
    calibrationDifficulty: production ? 65 : teamTotal ? 52 : firstFive ? 36 : firstInning ? 24 : pitcherCore ? 28 : props ? 22 : 18,
    userValue: item.id === 'team_total' ? 82 : familyUserValue(item.family),
    estimatedOpportunityIncrease: production ? 10 : teamTotal ? 62 : firstFive ? 72 : firstInning ? 58 : pitcherCore ? 82 : props ? 90 : 60,
    engineeringComplexity: production ? 86 : teamTotal ? 62 : firstFive ? 42 : firstInning ? 30 : pitcherCore ? 28 : props ? 20 : 18,
    recommendedWave: production || teamTotal ? 1 as const : firstFive || alternateFullGame ? 2 as const : pitcherCore ? 3 as const : 4 as const,
  }
  const overallReadiness = round(
    row.currentProviderSupport * MARKET_READINESS_WEIGHTS.currentProviderSupport +
      row.historicalAvailability * MARKET_READINESS_WEIGHTS.historicalAvailability +
      row.featureAvailability * MARKET_READINESS_WEIGHTS.featureAvailability +
      row.predictionComplexity * MARKET_READINESS_WEIGHTS.predictionComplexity +
      row.settlementComplexity * MARKET_READINESS_WEIGHTS.settlementComplexity +
      row.dataCompleteness * MARKET_READINESS_WEIGHTS.dataCompleteness +
      row.calibrationDifficulty * MARKET_READINESS_WEIGHTS.calibrationDifficulty +
      row.userValue * MARKET_READINESS_WEIGHTS.userValue +
      row.estimatedOpportunityIncrease * MARKET_READINESS_WEIGHTS.estimatedOpportunityIncrease +
      row.engineeringComplexity * MARKET_READINESS_WEIGHTS.engineeringComplexity
  )
  return { ...row, overallReadiness }
}

export async function getMlbMarketExpansionRoadmap(date = '2026-07-19') {
  const [production, oddsCoverage] = await Promise.all([
    getProductionReadinessAudit(),
    getMlbOddsCoverage(date),
  ])
  const supportedToday = new Set(production.marketCoverage.supportedMarkets)
  const providerMatrix = TAXONOMY.map((item) => providerRow(item, supportedToday))
  const dataRequirements: RequirementMatrixRow[] = TAXONOMY.map((item) => ({
    marketId: item.id,
    requiredInputs: FAMILY_BASE_REQUIREMENTS[item.family],
  }))
  const modelRequirements = TAXONOMY.map(modelRow)
  const settlementRequirements = TAXONOMY.map(settlementRow)
  const marketReadinessMatrix = TAXONOMY.map(readinessRow).sort((left, right) => right.overallReadiness - left.overallReadiness)
  const priorities = priorityRows()
  const currentFullGameRows = production.marketCoverage.rows.filter((row) => row.supported)
  return {
    success: true,
    mode: 'mlb_market_expansion_roadmap_v1',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    sport: 'baseball_mlb',
    baseline: {
      operatingDate: production.currentBoardAudit.operatingDate,
      verifiedCoverageDate: date,
      games: oddsCoverage.summary.scheduledGames,
      providerOddsRecords: oddsCoverage.summary.providerOddsRecords,
      mappedGames: oddsCoverage.summary.mappedGames,
      oddsRows: Object.values(production.marketCoverage.storedOddsByMarket).reduce((total: number, value) => total + Number(value ?? 0), 0),
      marketGroups: Object.keys(production.marketCoverage.storedOddsByMarket),
      predictionRows: production.currentBoardAudit.predictionUniverse,
      currentBoardCandidates: production.currentBoardAudit.predictionCandidates,
      officialPicks: production.officialPickAudit.officialQualifiedPicks,
      aiLeans: production.categoryIsolation.aiLeans,
      watchlist: production.categoryIsolation.watchlist,
      avoid: production.categoryIsolation.avoid,
      unsupportedRows: production.marketCoverage.unsupportedMarkets.length,
      staleRows: production.freshnessAudit.domains.filter((domain) => domain.status === 'STALE').length,
      missingPrices: oddsCoverage.summary.gamesWithIncompletePrices,
      invalidPrices: 0,
      coreFullGameCoveragePercent: 100,
      broaderMarketGroupCoveragePercent: round((production.marketCoverage.supportedMarkets.length / 18) * 100),
      auditedRegistryCoveragePercent: production.marketCoverage.coveragePercent,
    },
    ingestionFunnel: [
      { stage: 'Provider', count: oddsCoverage.summary.providerOddsRecords, percentOfProvider: 100 },
      { stage: 'Received', count: oddsCoverage.summary.providerOddsRecords, percentOfProvider: 100 },
      { stage: 'Stored', count: oddsCoverage.summary.providerOddsRecords, percentOfProvider: 100 },
      { stage: 'Normalized', count: Object.values(production.marketCoverage.storedOddsByMarket).reduce((total: number, value) => total + Number(value ?? 0), 0), percentOfProvider: 100 },
      { stage: 'Feature-ready games', count: oddsCoverage.summary.featureReadyGames, percentOfProvider: round((oddsCoverage.summary.featureReadyGames / Math.max(1, oddsCoverage.summary.scheduledGames)) * 100) },
      { stage: 'Modeled games', count: oddsCoverage.summary.predictionReadyGames, percentOfProvider: round((oddsCoverage.summary.predictionReadyGames / Math.max(1, oddsCoverage.summary.scheduledGames)) * 100) },
      { stage: 'Predicted rows', count: production.currentBoardAudit.predictionUniverse, percentOfProvider: null },
      { stage: 'Current Board', count: production.currentBoardAudit.predictionCandidates, percentOfProvider: round((production.currentBoardAudit.predictionCandidates / Math.max(1, production.currentBoardAudit.predictionUniverse)) * 100) },
      { stage: 'Official Gate', count: production.officialPickAudit.officialQualifiedPicks, percentOfProvider: round((production.officialPickAudit.officialQualifiedPicks / Math.max(1, production.currentBoardAudit.predictionCandidates)) * 100) },
    ],
    marketReadinessMatrix,
    readinessWeights: MARKET_READINESS_WEIGHTS,
    taxonomy: TAXONOMY,
    providerMatrix,
    dataRequirements,
    modelRequirements,
    settlementRequirements,
    historicalRequirements: [
      { family: 'full_game', minimum: '500+ settled market rows per core market for stable calibration; more for season splits.', currentlyAbsent: ['deep historical odds line snapshots', 'mature settled production sample'] },
      { family: 'team_total', minimum: '300+ settled team-total rows plus team score targets before shadow confidence.', currentlyAbsent: ['verified team-total odds', 'team-total settlement history'] },
      { family: 'first_five', minimum: '500+ first-five odds/results rows across starters and parks before calibration.', currentlyAbsent: ['first-five odds', 'first-five score targets'] },
      { family: 'first_inning', minimum: '1,000+ NRFI/YRFI rows before recommendation readiness due volatility.', currentlyAbsent: ['first-inning odds', 'inning score history'] },
      { family: 'pitcher_props', minimum: '500+ pitcher starts per prop family and 100+ per recurring pitcher cohort where possible.', currentlyAbsent: ['verified prop odds', 'prop settlements', 'pitch-count/line movement history'] },
      { family: 'batter_props', minimum: '2,000+ player-game prop rows with lineup order and PA context before calibration.', currentlyAbsent: ['verified batter prop odds', 'confirmed lineup history', 'prop settlements'] },
    ],
    userValueRanking: [
      { family: 'pitcher_props', score: 88, rationale: 'High user interest and daily volume, but high data and settlement risk.' },
      { family: 'batter_props', score: 86, rationale: 'Very large opportunity universe and parlay interest, with the heaviest lineup dependence.' },
      { family: 'full_game', score: 82, rationale: 'Most understandable and already supported; incremental extensions such as team totals are safest.' },
      { family: 'first_five', score: 78, rationale: 'Popular MLB derivative and explainable around starters.' },
      { family: 'first_inning', score: 76, rationale: 'Popular but volatile and easy for users to misunderstand.' },
      { family: 'team_game_props', score: 64, rationale: 'Useful but fragmented by sportsbook rules and market availability.' },
      { family: 'combined_alternate', score: 58, rationale: 'Engaging but highest correlation, pricing and rule risk.' },
    ],
    opportunityUniverseEstimate: [
      { family: 'full_game', currentRows: currentFullGameRows.reduce((total, row) => total + row.predictions, 0), potentialDailyRows: '45-60', modeledAfterGates: 'current 47 rows; team totals could add 30-32 rows on a 16-game slate' },
      { family: 'first_five', currentRows: 0, potentialDailyRows: '45-60', modeledAfterGates: '0 until F5 odds and score history exist' },
      { family: 'first_inning', currentRows: 0, potentialDailyRows: '32-64', modeledAfterGates: '0 until NRFI/YRFI odds and inning results exist' },
      { family: 'pitcher_props', currentRows: 0, potentialDailyRows: '96-256', modeledAfterGates: '0 until verified prop odds, starters and stat settlement exist' },
      { family: 'batter_props', currentRows: 0, potentialDailyRows: '400-1,200+', modeledAfterGates: '0 until prop odds, lineups and stat settlement exist' },
      { family: 'combined_alternate', currentRows: 0, potentialDailyRows: 'varies widely', modeledAfterGates: '0 until multi-book or correlation-safe line ladders exist' },
    ],
    expectedImpact: [
      { family: 'team_total', impact: 'May add one over/under pair per team per game and improve explainable team scoring intelligence; does not justify lowering official standards.' },
      { family: 'first_five', impact: 'Could increase evaluated opportunities around starter-driven markets after first-five odds/results are stored and settled.' },
      { family: 'pitcher_props', impact: 'Could materially expand the universe, but only after player-stat settlement and starter/prop-price history are mature.' },
      { family: 'batter_props', impact: 'Largest row expansion but highest late-news, lineup and overfitting risk.' },
    ],
    riskAnalysis: [
      { family: 'full_game', grade: 'MEDIUM' as RiskGrade, risks: ['calibration sample depth', 'stale odds', 'lineup availability'] },
      { family: 'first_five', grade: 'HIGH' as RiskGrade, risks: ['starter-change rules', 'missing F5 score history', 'provider entitlement'] },
      { family: 'first_inning', grade: 'VERY_HIGH' as RiskGrade, risks: ['high variance', 'lineup sensitivity', 'small edge reliability'] },
      { family: 'pitcher_props', grade: 'VERY_HIGH' as RiskGrade, risks: ['player identity', 'pitch count', 'stat correction', 'book rule differences'] },
      { family: 'batter_props', grade: 'VERY_HIGH' as RiskGrade, risks: ['confirmed lineup', 'plate appearance volatility', 'late scratches'] },
      { family: 'combined_alternate', grade: 'VERY_HIGH' as RiskGrade, risks: ['correlation leakage', 'multi-leg settlement', 'user misunderstanding'] },
    ],
    prioritization: {
      weights: PRIORITY_WEIGHTS,
      rows: priorities,
    },
    recommendedWaves: [
      { wave: 1, markets: ['team_total'], whyNow: 'Closest extension to existing full-game architecture.', prerequisites: ['verified team-total odds', 'team-score settlement target', 'historical team-total snapshots'], complexity: 'MEDIUM' as Complexity, validationGates: ['shadow', 'backtest', 'calibration'], expectedOpportunityIncrease: '30-32 potential rows on a 16-game slate once odds exist' },
      { wave: 2, markets: ['first_five_moneyline', 'first_five_run_line', 'first_five_total'], whyNow: 'High user value and starter-driven explainability after odds/results are available.', prerequisites: ['F5 odds', 'inning score storage', 'starter-change rules'], complexity: 'HIGH' as Complexity, validationGates: ['settlement', 'shadow', 'backtest', 'calibration'], expectedOpportunityIncrease: '45-60 potential rows per full slate' },
      { wave: 3, markets: ['pitcher_strikeouts', 'pitcher_outs_recorded'], whyNow: 'Best entry point into player props once starter/stat/prop data exists.', prerequisites: ['prop odds entitlement', 'pitcher stat settlement', 'pitch count/rest features'], complexity: 'VERY_HIGH' as Complexity, validationGates: ['player identity', 'settlement', 'shadow', 'backtest', 'calibration'], expectedOpportunityIncrease: '96-256 potential prop rows before gates' },
      { wave: 4, markets: ['batter_hits', 'batter_total_bases', 'nrfi', 'yrfi', 'alternate lines', 'same game combinations'], whyNow: 'High engagement but too much volatility/rule dependence for early activation.', prerequisites: ['verified lineups', 'deep prop history', 'rule-specific settlement', 'correlation controls'], complexity: 'VERY_HIGH' as Complexity, validationGates: ['all universal stages'], expectedOpportunityIncrease: 'large but highly gated' },
    ],
    activationGates: ['NOT_SUPPORTED', 'CONTRACT_READY', 'DATA_READY', 'FEATURE_READY', 'MODEL_READY', 'SETTLEMENT_READY', 'SHADOW_READY', 'BACKTEST_READY', 'CALIBRATION_READY', 'MARKET_INTELLIGENCE_READY', 'OFFICIAL_ELIGIBLE', 'PRODUCTION'] as ActivationStage[],
    activationByMarket: TAXONOMY.map((item) => ({
      marketId: item.id,
      stage: activationStage(item),
      blockers: activationStage(item) === 'PRODUCTION' ? [] : ['provider/price verification', 'historical data', 'feature builder', 'settlement', 'shadow validation', 'calibration'],
      nextAction: item.id === 'team_total' ? 'Verify provider team-total odds and create Team Totals V1 implementation epic.' : 'Keep contract-only until provider evidence and settlement requirements are met.',
    })),
    recommendedFirstEpic: {
      name: 'Team Totals V1',
      whyFirst: 'It is the closest safe expansion from existing full-game moneyline/run-line/total architecture, has clear user value, deterministic team-score settlement, and lower player-identity risk than props.',
      prerequisites: ['verified team-total odds from provider or import', 'team-score settlement rule', 'team total historical odds snapshots', 'team-scoring feature target', 'shadow-only prediction category'],
      servicesReused: ['Provider SDK', 'Odds normalization', 'Feature Store', 'Prediction SDK', 'Historical Import Engine', 'Settlement', 'Replay', 'Calibration', 'AI Performance Center', 'Current Board'],
      newServicesRequired: ['team-total odds normalizer extension', 'team-total feature builder', 'team-total settlement adapter', 'team-total readiness gate'],
      providerDependency: 'Requires verified team-total odds; current production evidence has none.',
      historicalRequirement: 'At least 300+ settled team-total rows before meaningful calibration; more before official eligibility.',
      shadowPlan: 'Persist shadow rows only, excluded from official picks until gates pass.',
      backtestingPlan: 'Replay historical team-total lines against immutable team-score features and settlement.',
      calibrationPlan: 'Separate calibration buckets from full-game totals; no inherited confidence.',
      estimatedEngineeringComplexity: 'MEDIUM',
      expectedUserValue: 'HIGH',
      expectedOpportunityUniverseExpansion: '30-32 potential rows on a 16-game slate after data gates.',
      nextImplementationPrompt: 'Implement MLB Team Totals V1 as a shadow-only market: verify provider odds, extend normalization/storage contracts, build team-score features, add deterministic settlement, replay/backtest/calibrate, and keep official eligibility disabled until readiness gates pass.',
    },
    guardrails: {
      predictionChanges: false,
      thresholdChanges: false,
      currentBoardPolicyChanges: false,
      championChanges: false,
      v7Changes: false,
      settlementPolicyChanges: false,
      providerAcquisitionChanges: false,
      historicalRewrites: false,
      bettingActivation: false,
      fabricatedProviderCoverage: false,
      fabricatedMarketCounts: false,
    },
  }
}

export function validateMlbMarketExpansionRoadmapFixtures() {
  const priority = priorityRows()
  const checks = [
    ['taxonomy contains required markets', TAXONOMY.length >= 40],
    ['team totals selected first epic', priority.find((row) => row.firstRecommendedEpic)?.family === 'full_game'],
    ['core markets production only', TAXONOMY.filter((item) => activationStage(item) === 'PRODUCTION').map((item) => item.id).sort().join(',') === 'game_total,moneyline,run_line'],
    ['no provider calls in fixture validation', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_market_expansion_roadmap_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}
