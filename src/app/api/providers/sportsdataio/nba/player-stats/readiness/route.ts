import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoNbaPlayerStatsReadiness } from '@/services/sportsdataio-nba-player-stats-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getSportsDataIoNbaPlayerStatsReadiness(), id)
  } catch (error) {
    console.error('SportsDataIO NBA player stats readiness error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown SportsDataIO NBA player stats readiness error'),
    })
  }
}
