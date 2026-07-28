import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runNhlStoredPreviewPredictionLifecycle } from '@/services/stored-preview-prediction-lifecycle.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const persist = request.nextUrl.searchParams.get('persist') === 'true'
    const limitEvents = Number(request.nextUrl.searchParams.get('limitEvents') ?? 12)
    return apiOk(await runNhlStoredPreviewPredictionLifecycle({ persist, limitEvents }), id)
  } catch (error) {
    console.error('NHL Prediction Engine preview error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown NHL Prediction Engine preview error'),
    })
  }
}
