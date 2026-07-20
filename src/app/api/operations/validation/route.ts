import { NextRequest } from 'next/server'
import { apiOk, requestId } from '@/lib/api-contract'
import { validateAdaptiveRefreshFixtures } from '@/services/adaptive-refresh-orchestrator.service'
import { validateMarketAlignmentFixtures } from '@/services/market-alignment.service'
import { validateRecommendationExplanationFixtures } from '@/services/recommendation-explanation.service'

export async function GET(request: NextRequest) {
  const adaptive = validateAdaptiveRefreshFixtures()
  const marketAlignment = validateMarketAlignmentFixtures()
  const recommendationExplanation = validateRecommendationExplanationFixtures()
  return apiOk({
    ...adaptive,
    success: adaptive.success && marketAlignment.success && recommendationExplanation.success,
    marketAlignment,
    recommendationExplanation,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }, requestId(request))
}
