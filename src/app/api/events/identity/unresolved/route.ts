import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getEventIdentityUnresolved } from '@/services/universal-event-identity.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getEventIdentityUnresolved(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown event identity unresolved error'),
      status: 500,
    })
  }
}
