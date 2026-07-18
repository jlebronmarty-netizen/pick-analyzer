import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getAutonomousSchedulerStatus } from '@/services/autonomous-daily-operations.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getAutonomousSchedulerStatus(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown autonomous scheduler status error') })
  }
}
