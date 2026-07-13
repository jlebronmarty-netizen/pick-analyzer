import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getTennisPredictionEngineHealth } from '@/services/tennis-prediction-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getTennisPredictionEngineHealth(), id)
  } catch (error) {
    console.error('Tennis Prediction Engine health error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Tennis Prediction Engine health error'),
    })
  }
}
