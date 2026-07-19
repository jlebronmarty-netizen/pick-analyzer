import type { BasketballCanonicalEntity } from '@/services/basketball/types/entities'

export type BasketballKnowledgeFeature =
  | 'team_form'
  | 'home_performance'
  | 'away_performance'
  | 'quarter_tendencies'
  | 'first_half_performance'
  | 'second_half_performance'
  | 'over_under_trends'
  | 'pace'
  | 'efficiency'
  | 'offensive_rating'
  | 'defensive_rating'
  | 'net_rating'
  | 'rest'
  | 'travel'
  | 'momentum'
  | 'winning_streak'
  | 'losing_streak'
  | 'clutch_performance'
  | 'playoff_performance'

export const BASKETBALL_KNOWLEDGE_FEATURES: BasketballKnowledgeFeature[] = [
  'team_form',
  'home_performance',
  'away_performance',
  'quarter_tendencies',
  'first_half_performance',
  'second_half_performance',
  'over_under_trends',
  'pace',
  'efficiency',
  'offensive_rating',
  'defensive_rating',
  'net_rating',
  'rest',
  'travel',
  'momentum',
  'winning_streak',
  'losing_streak',
  'clutch_performance',
  'playoff_performance',
]

export function planBasketballKnowledgeGeneration(entities: BasketballCanonicalEntity[] = []) {
  const completedGames = entities.filter((entity) => entity.kind === 'game' && entity.status === 'final')
  const teams = new Set<string>()
  for (const game of completedGames) {
    if (game.kind === 'game') {
      teams.add(game.homeTeamId)
      teams.add(game.awayTeamId)
    }
  }

  return {
    success: true,
    mode: 'basketball_knowledge_layer_v1',
    providerCallsMade: 0,
    knowledgeVersion: 'basketball_knowledge_v1',
    input: {
      entities: entities.length,
      completedGames: completedGames.length,
      teams: teams.size,
    },
    features: BASKETBALL_KNOWLEDGE_FEATURES.map((feature) => ({
      feature,
      status: completedGames.length > 0 ? 'ready_for_generation' : 'waiting_for_completed_games',
      featureStoreTarget: feature === 'quarter_tendencies' || feature === 'first_half_performance'
        ? 'basketball_period_context'
        : 'basketball_team_intelligence',
      noLeakageRule: 'Use only completed games observed before the target cutoff.',
    })),
    outputContracts: {
      versionedKnowledge: true,
      versionedFeatures: true,
      featureStoreIntegration: true,
      predictionSdkReadable: true,
    },
  }
}
