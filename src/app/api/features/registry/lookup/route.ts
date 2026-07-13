import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { lookupFeatureSet } from '@/services/multi-sport-feature-registry.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const searchParams = request.nextUrl.searchParams
    return apiOk(
      lookupFeatureSet({
        sportKey: searchParams.get('sport') ?? searchParams.get('sportKey'),
        leagueKey: searchParams.get('league') ?? searchParams.get('leagueKey'),
        market: searchParams.get('market'),
      }),
      id
    )
  } catch (error) {
    console.error('Multi-Sport Feature Registry lookup error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown feature registry lookup error'),
    })
  }
}
