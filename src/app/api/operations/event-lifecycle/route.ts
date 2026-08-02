import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { loadEventLifecycleState } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const params = request.nextUrl.searchParams
    const { getEventLifecycleState } = await loadEventLifecycleState()
    return apiOk(
      await getEventLifecycleState({
        sportKey: params.get('sportKey'),
        operatingDate: params.get('operatingDate') ?? params.get('date'),
        eventId: params.get('eventId'),
        lifecycleState: params.get('lifecycleState'),
        priorityBand: params.get('priorityBand'),
        limit: parseIntegerParam({ value: params.get('limit'), fallback: 50, min: 1, max: 200 }),
      }),
      id,
    )
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown event lifecycle error') })
  }
}
