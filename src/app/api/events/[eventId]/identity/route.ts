import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getEventIdentity } from '@/services/universal-event-identity.service'

type RouteContext = {
  params: Promise<{
    eventId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const id = requestId(request)
  try {
    const { eventId } = await context.params
    return apiOk(await getEventIdentity(decodeURIComponent(eventId)), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown event identity detail error'),
      status: 500,
    })
  }
}
