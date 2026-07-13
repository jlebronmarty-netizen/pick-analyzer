import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getFeatureDefinitions } from '@/services/feature-store-core.service'
import { SportKey } from '@/config/sports.config'
import { MarketKey } from '@/types/multi-sport'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const searchParams = request.nextUrl.searchParams
    return apiOk(
      getFeatureDefinitions({
        sportKey: (searchParams.get('sport') ?? searchParams.get('sportKey')) as SportKey | null,
        market: searchParams.get('market') as MarketKey | null,
      }),
      id
    )
  } catch (error) {
    console.error('Feature Store definitions error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Feature Store definitions error'),
    })
  }
}
