import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSettlementCoreStatus } from '@/services/settlement-core.service'

export async function GET(request: Request) {
  const id = requestId(request)

  try {
    return apiOk(getSettlementCoreStatus(), id)
  } catch (error) {
    console.error('Settlement core status error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown settlement core status error'),
    })
  }
}
