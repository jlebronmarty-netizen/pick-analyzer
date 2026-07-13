import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { generateNhlPredictionPreview } from '@/services/nhl-prediction-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(generateNhlPredictionPreview(), id)
  } catch (error) {
    console.error('NHL Prediction Engine preview error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown NHL Prediction Engine preview error'),
    })
  }
}
