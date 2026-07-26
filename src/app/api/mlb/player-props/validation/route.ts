import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPlayerPropComparisons, validatePlayerPropComparisonFixtures } from '@/services/mlb-player-prop-comparison.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const comparison = await getMlbPlayerPropComparisons({ date, limit: 500 })
    const fixtures = validatePlayerPropComparisonFixtures()
    return apiOk({
      success: comparison.validation.success && fixtures.success,
      mode: 'mlb_player_prop_market_comparison_validation_api_v1',
      generatedAt: comparison.generatedAt,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      deterministicFixtures: fixtures,
      comparisonValidation: comparison.validation,
      health: comparison.health,
    }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player prop validation error') })
  }
}
