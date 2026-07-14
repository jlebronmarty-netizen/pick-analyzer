import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoNbaPlayerPropsReadiness } from '@/services/sportsdataio-nba-player-props-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getSportsDataIoNbaPlayerPropsReadiness(), id)
  } catch (error) {
    console.error('SportsDataIO NBA player props readiness error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown SportsDataIO NBA player props readiness error'),
    })
  }
}
