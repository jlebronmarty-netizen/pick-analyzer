import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoNbaTrialIsolationAudit } from '@/services/sportsdataio-nba-trial-isolation-audit.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(await getSportsDataIoNbaTrialIsolationAudit(), id)
  } catch (error) {
    console.error('SportsDataIO NBA trial isolation audit error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown SportsDataIO NBA trial isolation audit error'),
    })
  }
}
