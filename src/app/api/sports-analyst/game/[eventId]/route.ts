import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsAnalystForGame, validateSportsAnalystFixtures } from '@/services/sports-analyst.service'

type RouteContext = {
  params: Promise<{
    eventId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('validate') === 'true') {
      return apiOk(validateSportsAnalystFixtures(), id)
    }
    const { eventId } = await context.params
    return apiOk(await getSportsAnalystForGame(decodeURIComponent(eventId)), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown sports analyst error'),
      status: 500,
    })
  }
}
