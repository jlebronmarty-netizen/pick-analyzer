import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getHistoricalProgressiveReplayStatus } from '@/services/historical-progressive-replay.service'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request)
  try {
    const params = await context.params
    return apiOk(await getHistoricalProgressiveReplayStatus({ jobId: params.id, limit: 500 }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown historical replay job status error') })
  }
}
