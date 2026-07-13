import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { listHistoricalImportJobs } from '@/services/historical-import-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const result = await listHistoricalImportJobs()
    return apiOk(result, id)
  } catch (error) {
    console.error('Historical import jobs error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown historical import jobs error'),
    })
  }
}
