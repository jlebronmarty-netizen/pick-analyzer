import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runSoccerPredictionEngineValidation } from '@/services/soccer-prediction-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(runSoccerPredictionEngineValidation(), id)
  } catch (error) {
    console.error('Soccer Prediction Engine validation error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Soccer Prediction Engine validation error'),
    })
  }
}
