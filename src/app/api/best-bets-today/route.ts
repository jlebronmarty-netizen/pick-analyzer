import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getBestBetsToday, validateBestBetsTodayFixtures } from '@/services/best-bets-today.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    const includeValidation = searchParams.get('includeValidation') === 'true'
    const data = await getBestBetsToday({
      sportKey: searchParams.get('sportKey') ?? 'baseball_mlb',
    })

    return apiOk(
      {
        ...data,
        validation: includeValidation ? validateBestBetsTodayFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown best bets today error'),
      status: 500,
    })
  }
}
