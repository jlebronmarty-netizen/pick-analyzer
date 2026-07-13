import { getGlobalReconciliationPlan } from '@/services/global-data-quality.service'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'

export async function GET(request: Request) {
  const id = requestId(request)

  try {
    return apiOk(await getGlobalReconciliationPlan(), id)
  } catch (error) {
    console.error('Global reconciliation plan error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown global reconciliation plan error'),
    })
  }
}
