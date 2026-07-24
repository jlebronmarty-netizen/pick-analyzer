import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbCurrentLineupContext } from '@/services/mlb-current-lineup-context.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const eventId = request.nextUrl.searchParams.get('eventId')
    return apiOk(await getMlbCurrentLineupContext({ date, eventId }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB lineup context error') })
  }
}
