import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbStarterIntelligence } from '@/services/mlb-starter-intelligence.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const eventId = request.nextUrl.searchParams.get('eventId')
    return apiOk(await getMlbStarterIntelligence({ date, eventId }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB starter intelligence error') })
  }
}
