import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { generateNflPredictionPreview } from '@/services/nfl-prediction-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(generateNflPredictionPreview(), id)
  } catch (error) {
    console.error('NFL Prediction Engine preview error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown NFL Prediction Engine preview error'),
    })
  }
}
