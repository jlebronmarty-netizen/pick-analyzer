import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getRetrosheetGameEngineDiagnostics } from '@/services/retrosheet-game-reconstruction.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const { searchParams } = new URL(request.url)
    const result = await getRetrosheetGameEngineDiagnostics({
      gameId: searchParams.get('gameId'),
      limit: parseIntegerParam({ value: searchParams.get('limit'), fallback: 50, min: 1, max: 250 }),
    })
    return apiOk(result, id)
  } catch (error) {
    console.error('Retrosheet game engine diagnostics error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Retrosheet game engine diagnostics error'),
    })
  }
}
