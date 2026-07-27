import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPlayerPropComparisons, validatePlayerPropComparisonFixtures } from '@/services/mlb-player-prop-comparison.service'
import { getMlbPlayerPropIngestionHealth, validateMlbPlayerPropIngestionFixtures } from '@/services/mlb-player-prop-sync.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const market = request.nextUrl.searchParams.get('market')
    const [comparison, ingestionHealth] = await Promise.all([
      getMlbPlayerPropComparisons({ date, market, limit: 500 }),
      getMlbPlayerPropIngestionHealth(),
    ])
    const fixtures = validatePlayerPropComparisonFixtures()
    const ingestionFixtures = validateMlbPlayerPropIngestionFixtures()
    return apiOk({
      success: comparison.validation.success && fixtures.success && ingestionFixtures.success,
      mode: 'mlb_player_prop_market_comparison_validation_api_v1',
      generatedAt: comparison.generatedAt,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      deterministicFixtures: fixtures,
      ingestionDeterministicFixtures: ingestionFixtures,
      comparisonValidation: comparison.validation,
      health: comparison.health,
      ingestionHealth,
    }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player prop validation error') })
  }
}
