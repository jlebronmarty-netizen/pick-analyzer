import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runNhlPredictionEngineValidation } from '@/services/nhl-prediction-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(runNhlPredictionEngineValidation(), id)
  } catch (error) {
    console.error('NHL Prediction Engine validation error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown NHL Prediction Engine validation error'),
    })
  }
}
