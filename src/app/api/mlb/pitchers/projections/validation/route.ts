import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { previewPitcherProjection, validateMlbPitcherProjectionFixtures } from '@/services/mlb-pitcher-projection-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const slate = await previewPitcherProjection({ date, limit: 200 })
    return apiOk({
      success: slate.validation.success && validateMlbPitcherProjectionFixtures().success,
      mode: 'mlb_pitcher_projection_validation_api_v1',
      generatedAt: slate.generatedAt,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      deterministicFixtures: validateMlbPitcherProjectionFixtures(),
      slateValidation: slate.validation,
      leakageCounters: slate.health.leakageCounters,
    }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB pitcher projection validation error') })
  }
}
