import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoHistoricalImportJob } from '@/services/sportsdataio-historical-import-readiness.service'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const id = requestId(request)

  try {
    const { jobId } = await context.params

    if (!jobId) {
      return apiError({
        id,
        code: 'BAD_REQUEST',
        message: 'jobId is required.',
        status: 400,
      })
    }

    return apiOk(getSportsDataIoHistoricalImportJob(jobId), id)
  } catch (error) {
    console.error('SportsDataIO historical import job error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown historical import job error'),
    })
  }
}
