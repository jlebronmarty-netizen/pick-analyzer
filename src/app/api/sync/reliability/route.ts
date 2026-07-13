import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSyncReliabilityStatus } from '@/services/sync-reliability.service'

export async function GET(request: Request) {
  const id = requestId(request)

  try {
    return apiOk(await getSyncReliabilityStatus(), id)
  } catch (error) {
    console.error('Sync reliability status error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown sync reliability status error'),
    })
  }
}
