import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runTennisPredictionEngineValidation } from '@/services/tennis-prediction-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(runTennisPredictionEngineValidation(), id)
  } catch (error) {
    console.error('Tennis Prediction Engine validation error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Tennis Prediction Engine validation error'),
    })
  }
}
