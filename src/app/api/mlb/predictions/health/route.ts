import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPredictionEngineHealth } from '@/services/mlb-prediction-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getMlbPredictionEngineHealth(), id)
  } catch (error) {
    console.error('MLB Prediction Engine health error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB Prediction Engine health error'),
    })
  }
}
