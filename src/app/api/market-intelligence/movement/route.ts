import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getMarketMovementIntelligence, validateMarketMovementFixtures } from '@/services/market-movement-intelligence.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = request.nextUrl
    if (searchParams.get('validate') === 'true') return apiOk(validateMarketMovementFixtures(), id)
    return apiOk(await getMarketMovementIntelligence({
      sport: searchParams.get('sport'),
      eventId: searchParams.get('eventId'),
      market: searchParams.get('market'),
      sportsbook: searchParams.get('sportsbook'),
      freshness: searchParams.get('freshness') as never,
      limit: parseIntegerParam({ value: searchParams.get('limit'), fallback: 25, min: 1, max: 100 }),
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown market movement intelligence error') })
  }
}
