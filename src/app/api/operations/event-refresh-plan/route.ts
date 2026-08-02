import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { loadEventRefreshPlanner } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const params = request.nextUrl.searchParams
    const { getEventRefreshPlan } = await loadEventRefreshPlanner()
    return apiOk(
      await getEventRefreshPlan({
        sportKey: params.get('sportKey'),
        operatingDate: params.get('operatingDate') ?? params.get('date'),
        eventId: params.get('eventId'),
        priorityBand: params.get('priorityBand'),
        plannedAction: params.get('plannedAction'),
        mode: params.get('mode'),
        limit: parseIntegerParam({ value: params.get('limit'), fallback: 50, min: 1, max: 200 }),
      }),
      id,
    )
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown event refresh plan error') })
  }
}
