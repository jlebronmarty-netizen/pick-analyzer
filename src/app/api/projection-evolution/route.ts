import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getProjectionEvolution } from '@/services/projection-evolution.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    const result = await getProjectionEvolution({
      eventId: searchParams.get('eventId'),
      playerId: searchParams.get('playerId'),
      limit: parseIntegerParam({ value: searchParams.get('limit'), fallback: 60, min: 1, max: 100 }),
    })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown projection evolution error'),
      status: 500,
    })
  }
}
