import { getGlobalDataQualityAudit } from '@/services/global-data-quality.service'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'

export async function GET(request: Request) {
  const id = requestId(request)

  try {
    return apiOk(await getGlobalDataQualityAudit(), id)
  } catch (error) {
    console.error('Global data quality error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown global data quality error'),
    })
  }
}
