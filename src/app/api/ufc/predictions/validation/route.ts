import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runUfcPredictionEngineValidation } from '@/services/ufc-prediction-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(runUfcPredictionEngineValidation(), id)
  } catch (error) {
    console.error('UFC Prediction Engine validation error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown UFC Prediction Engine validation error'),
    })
  }
}
