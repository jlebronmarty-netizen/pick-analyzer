import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { loadSportsDataIoHistoricalImportReadiness } from '@/lib/server-lazy-diagnostics'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const id = requestId(request)

  try {
    const { jobId } = await context.params
    const { validateSportsDataIoHistoricalImportJob } = await loadSportsDataIoHistoricalImportReadiness()
    const result = validateSportsDataIoHistoricalImportJob(jobId)

    if (!result.success) {
      return apiError({
        id,
        code: 'BAD_REQUEST',
        message: result.validation.errors.join(' '),
        status: 400,
      })
    }

    return apiOk(result, id)
  } catch (error) {
    console.error('SportsDataIO historical import validation error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown historical import validation error'
      ),
    })
  }
}
