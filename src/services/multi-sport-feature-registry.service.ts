import { SportKey } from '@/config/sports.config'
import { getFeatureDefinitions } from '@/services/feature-store-core.service'
import { MarketKey } from '@/types/multi-sport'

type FeatureSetStatus = 'ready' | 'partial' | 'unsupported'

type FeatureSet = {
  id: string
  sportKey: SportKey
  leagueKey: string | null
  market: MarketKey
  modelVersion: string
  status: FeatureSetStatus
  requiredFeatures: string[]
  optionalFeatures: string[]
  minimumDataSufficiencyScore: number
  minimumFeatureQualityScore: number
  fallbackPolicy: string
  warnings: string[]
}

const FEATURE_SETS: FeatureSet[] = [
  {
    id: 'basketball_nba:moneyline:nba_feature_set_v1',
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    market: 'moneyline',
    modelVersion: 'nba_feature_set_v1',
    status: 'ready',
    requiredFeatures: ['event_context', 'team_form', 'market_odds'],
    optionalFeatures: ['injury_context', 'lineup_context'],
    minimumDataSufficiencyScore: 35,
    minimumFeatureQualityScore: 50,
    fallbackPolicy: 'Allow optional injury/lineup warnings; block missing event, team_form or market_odds.',
    warnings: [],
  },
  {
    id: 'basketball_nba:spread:nba_feature_set_v1',
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    market: 'spread',
    modelVersion: 'nba_feature_set_v1',
    status: 'ready',
    requiredFeatures: ['event_context', 'team_form', 'market_odds'],
    optionalFeatures: ['injury_context', 'lineup_context'],
    minimumDataSufficiencyScore: 40,
    minimumFeatureQualityScore: 55,
    fallbackPolicy: 'Require market_odds line and team_form; optional context may degrade confidence.',
    warnings: [],
  },
  {
    id: 'basketball_nba:total:nba_feature_set_v1',
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    market: 'total',
    modelVersion: 'nba_feature_set_v1',
    status: 'ready',
    requiredFeatures: ['event_context', 'team_form', 'market_odds'],
    optionalFeatures: ['injury_context', 'lineup_context'],
    minimumDataSufficiencyScore: 40,
    minimumFeatureQualityScore: 55,
    fallbackPolicy: 'Require totals line and offensive/defensive team form before prediction.',
    warnings: [],
  },
  {
    id: 'baseball_mlb:moneyline:mlb_feature_set_v1',
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    market: 'moneyline',
    modelVersion: 'mlb_feature_set_v1',
    status: 'partial',
    requiredFeatures: ['event_context', 'team_form', 'market_odds'],
    optionalFeatures: ['injury_context', 'lineup_context'],
    minimumDataSufficiencyScore: 35,
    minimumFeatureQualityScore: 50,
    fallbackPolicy: 'Probable pitcher features are not in Feature Store Core V1 and must be added before MLB complete.',
    warnings: ['MLB pitcher-specific features are not yet registered.'],
  },
  {
    id: 'americanfootball_nfl:spread:nfl_feature_set_v1',
    sportKey: 'americanfootball_nfl',
    leagueKey: 'nfl',
    market: 'spread',
    modelVersion: 'nfl_feature_set_v1',
    status: 'partial',
    requiredFeatures: ['event_context', 'team_form', 'market_odds'],
    optionalFeatures: ['injury_context', 'lineup_context'],
    minimumDataSufficiencyScore: 45,
    minimumFeatureQualityScore: 60,
    fallbackPolicy: 'Quarterback/injury context should be required in a later NFL complete module.',
    warnings: ['NFL position-impact feature extensions are not yet registered.'],
  },
  {
    id: 'icehockey_nhl:moneyline:nhl_feature_set_v1',
    sportKey: 'icehockey_nhl',
    leagueKey: 'nhl',
    market: 'moneyline',
    modelVersion: 'nhl_feature_set_v1',
    status: 'partial',
    requiredFeatures: ['event_context', 'team_form', 'market_odds'],
    optionalFeatures: ['injury_context', 'lineup_context'],
    minimumDataSufficiencyScore: 40,
    minimumFeatureQualityScore: 55,
    fallbackPolicy: 'Goalie context is not in Feature Store Core V1 and should be added before NHL complete.',
    warnings: ['NHL goalie-specific features are not yet registered.'],
  },
  {
    id: 'soccer:moneyline:soccer_feature_set_v1',
    sportKey: 'soccer',
    leagueKey: null,
    market: 'moneyline',
    modelVersion: 'soccer_feature_set_v1',
    status: 'partial',
    requiredFeatures: ['event_context', 'team_form', 'market_odds'],
    optionalFeatures: ['lineup_context', 'injury_context'],
    minimumDataSufficiencyScore: 45,
    minimumFeatureQualityScore: 60,
    fallbackPolicy: 'Draw-aware and league-specific features must be added before soccer complete.',
    warnings: ['Soccer draw-aware feature extensions are not yet registered.'],
  },
  {
    id: 'tennis:moneyline:tennis_feature_set_v1',
    sportKey: 'tennis',
    leagueKey: null,
    market: 'moneyline',
    modelVersion: 'tennis_feature_set_v1',
    status: 'partial',
    requiredFeatures: ['event_context', 'market_odds'],
    optionalFeatures: [],
    minimumDataSufficiencyScore: 50,
    minimumFeatureQualityScore: 60,
    fallbackPolicy: 'Individual-player form features must be added before tennis predictions.',
    warnings: ['Feature Store Core V1 does not yet define tennis player-form features.'],
  },
  {
    id: 'mma_ufc:moneyline:ufc_feature_set_v1',
    sportKey: 'mma_ufc',
    leagueKey: 'ufc',
    market: 'moneyline',
    modelVersion: 'ufc_feature_set_v1',
    status: 'partial',
    requiredFeatures: ['event_context', 'market_odds'],
    optionalFeatures: [],
    minimumDataSufficiencyScore: 50,
    minimumFeatureQualityScore: 60,
    fallbackPolicy: 'Fighter-form and bout-specific features must be added before UFC predictions.',
    warnings: ['Feature Store Core V1 does not yet define fighter-form features.'],
  },
]

export function getMultiSportFeatureRegistry() {
  const definitions = getFeatureDefinitions().definitions
  const definitionKeys = new Set(definitions.map((definition) => definition.key))
  const registry = FEATURE_SETS.map((set) => {
    const missingRequired = set.requiredFeatures.filter(
      (feature) => !definitionKeys.has(feature)
    )
    const missingOptional = set.optionalFeatures.filter(
      (feature) => !definitionKeys.has(feature)
    )

    return {
      ...set,
      availableRequiredFeatures: set.requiredFeatures.filter((feature) =>
        definitionKeys.has(feature)
      ),
      missingRequiredFeatures: missingRequired,
      missingOptionalFeatures: missingOptional,
      ready:
        set.status !== 'unsupported' &&
        missingRequired.length === 0,
      warnings: [
        ...set.warnings,
        ...missingRequired.map((feature) => `Missing required feature definition: ${feature}.`),
        ...missingOptional.map((feature) => `Missing optional feature definition: ${feature}.`),
      ],
    }
  })

  return {
    success: true,
    mode: 'multi_sport_feature_registry_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'static_registry_and_feature_definitions',
    },
    status: registry.some((set) => set.ready) ? 'ready' : 'degraded',
    summary: {
      featureSets: registry.length,
      ready: registry.filter((set) => set.ready).length,
      partial: registry.filter((set) => set.status === 'partial').length,
      unsupported: registry.filter((set) => set.status === 'unsupported').length,
      definitions: definitions.length,
      sports: new Set(registry.map((set) => set.sportKey)).size,
      markets: new Set(registry.map((set) => set.market)).size,
    },
    featureSets: registry,
  }
}

export function lookupFeatureSet({
  sportKey,
  market,
  leagueKey = null,
}: {
  sportKey?: string | null
  market?: string | null
  leagueKey?: string | null
}) {
  const registry = getMultiSportFeatureRegistry()
  const matches = registry.featureSets.filter((set) => {
    if (sportKey && set.sportKey !== sportKey) return false
    if (market && set.market !== market) return false
    if (leagueKey && set.leagueKey && set.leagueKey !== leagueKey) return false
    return true
  })

  return {
    success: true,
    mode: 'multi_sport_feature_registry_lookup_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'static_registry_lookup',
    },
    request: {
      sportKey: sportKey ?? null,
      leagueKey,
      market: market ?? null,
    },
    summary: {
      matches: matches.length,
      ready: matches.filter((set) => set.ready).length,
      warnings: matches.reduce((sum, set) => sum + set.warnings.length, 0),
    },
    featureSets: matches,
  }
}

export function runMultiSportFeatureRegistryValidation() {
  const registry = getMultiSportFeatureRegistry()
  const requiredSports = [
    'basketball_nba',
    'baseball_mlb',
    'americanfootball_nfl',
    'icehockey_nhl',
    'soccer',
    'tennis',
    'mma_ufc',
  ]
  const missingSports = requiredSports.filter(
    (sport) => !registry.featureSets.some((set) => set.sportKey === sport)
  )
  const missingRequiredDefinitions = registry.featureSets.flatMap((set) =>
    set.missingRequiredFeatures.map((feature) => `${set.id}:${feature}`)
  )

  return {
    success: missingSports.length === 0 && missingRequiredDefinitions.length === 0,
    mode: 'multi_sport_feature_registry_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'static_registry_validation',
    },
    summary: {
      featureSets: registry.summary.featureSets,
      requiredSports: requiredSports.length,
      missingSports: missingSports.length,
      missingRequiredDefinitions: missingRequiredDefinitions.length,
      unsupportedFeatureSets: registry.summary.unsupported,
    },
    missingSports,
    missingRequiredDefinitions,
    warnings: registry.featureSets.flatMap((set) => set.warnings),
  }
}
