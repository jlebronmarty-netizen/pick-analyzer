import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMlbMarketCapabilityRegistry,
  validateMlbMarketCapabilityRegistryFixtures,
} from '@/services/mlb-market-capability-registry.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const registry = await getMlbMarketCapabilityRegistry()
    return apiOk(
      {
        ...registry,
        validation: includeValidation ? validateMlbMarketCapabilityRegistryFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB market capability registry error'),
    })
  }
}
