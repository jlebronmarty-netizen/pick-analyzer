import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSharedSportPredictionEngineSdk } from '@/services/sport-prediction-engine-sdk.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getSharedSportPredictionEngineSdk(), id)
  } catch (error) {
    console.error('Shared Sport Prediction SDK error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Shared Sport Prediction SDK error'),
    })
  }
}
