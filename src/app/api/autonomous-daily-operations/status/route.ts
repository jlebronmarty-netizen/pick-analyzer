import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { loadAutonomousDailyOperations } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const selectedDate = request.nextUrl.searchParams.get('selectedDate') ?? request.nextUrl.searchParams.get('date')
    const { getAutonomousDailyOperationsStatus } = await loadAutonomousDailyOperations()
    const result = await getAutonomousDailyOperationsStatus({ selectedDate })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown autonomous daily operations status error'),
      status: 500,
    })
  }
}
