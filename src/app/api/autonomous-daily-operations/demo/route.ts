import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getAutonomousDailyOperationsStatus } from '@/services/autonomous-daily-operations.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const selectedDate = request.nextUrl.searchParams.get('selectedDate') ?? request.nextUrl.searchParams.get('date')
    const status = await getAutonomousDailyOperationsStatus({ selectedDate })
    return apiOk({
      ...status,
      mode: 'autonomous_daily_operations_demo_v1',
      demoMode: true,
      writeActionsAvailable: false,
      providerCallsAllowed: false,
      secretsExposed: false,
      adminControlsHidden: true,
      performanceDataFabricated: false,
    }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown autonomous demo status error') })
  }
}
