import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getModelSegments } from '@/services/model-segments.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const search = request.nextUrl.searchParams
    return apiOk(
      await getModelSegments({
        sport: search.get('sport'),
        league: search.get('league'),
        market: search.get('market'),
        dateFrom: search.get('dateFrom'),
        dateTo: search.get('dateTo'),
        confidenceBucket: search.get('confidenceBucket'),
        probabilityBucket: search.get('probabilityBucket'),
        homeAway: search.get('homeAway'),
        favoriteUnderdog: search.get('favoriteUnderdog'),
        settlementResult: search.get('settlementResult'),
        limit: parseIntegerParam({ value: search.get('limit'), fallback: 2000, min: 1, max: 5000 }),
      }),
      id
    )
  } catch (error) {
    console.error('Model segments error:', { requestId: id, error })
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown model segments error'),
    })
  }
}
