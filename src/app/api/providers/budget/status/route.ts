import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getProviderBudgetStatus, validateProviderBudgetDeterministicFixtures } from '@/services/provider-budget.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const provider = request.nextUrl.searchParams.get('provider') ?? 'sportsdataio'
    const sportKey = request.nextUrl.searchParams.get('sportKey') ?? 'baseball_mlb'
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const status = await getProviderBudgetStatus({ provider, sportKey })
    return apiOk(
      {
        ...status,
        validation: includeValidation ? validateProviderBudgetDeterministicFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown provider budget status error'),
    })
  }
}
