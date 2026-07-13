import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runSportPredictionSdkValidation } from '@/services/sport-prediction-engine-sdk.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(runSportPredictionSdkValidation(), id)
  } catch (error) {
    console.error('Shared Sport Prediction SDK validation error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown Shared Sport Prediction SDK validation error'
      ),
    })
  }
}
