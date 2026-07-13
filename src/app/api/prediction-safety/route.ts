import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getPredictionSafetyStatus } from '@/services/prediction-safety.service'

export async function GET(request: Request) {
  const id = requestId(request)

  try {
    return apiOk(getPredictionSafetyStatus(), id)
  } catch (error) {
    console.error('Prediction safety status error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown prediction safety status error'),
    })
  }
}
