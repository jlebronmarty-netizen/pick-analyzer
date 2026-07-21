import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getPlayerIntelligence, validatePlayerIntelligenceFixtures } from '@/services/player-intelligence.service'

type RouteContext = {
  params: Promise<{
    playerId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('validate') === 'true') {
      return apiOk(validatePlayerIntelligenceFixtures(), id)
    }
    const { playerId } = await context.params
    return apiOk(await getPlayerIntelligence(decodeURIComponent(playerId)), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown player intelligence error'),
      status: 500,
    })
  }
}
