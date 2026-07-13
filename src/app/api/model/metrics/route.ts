import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getModelMetricsFramework } from '@/services/model-metrics-framework.service'

export async function GET(request: Request) {
  const id = requestId(request)

  try {
    return apiOk(await getModelMetricsFramework(), id)
  } catch (error) {
    console.error('Model metrics framework error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown model metrics framework error'),
    })
  }
}
