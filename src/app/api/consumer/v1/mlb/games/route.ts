import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getPickEdgeGames } from '@/services/pick-edge-consumer-v1.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    const response = await getPickEdgeGames(searchParams.get('date'))
    return apiOk({ success: true, ...response }, id)
  } catch (error) {
    return apiError({
      id,
      code: String(error).includes('INVALID_CONSUMER_DATE') ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown consumer games error'),
      status: String(error).includes('INVALID_CONSUMER_DATE') ? 400 : 500,
    })
  }
}
