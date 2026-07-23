import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import { getBasketballDataPlatform, validateBasketballDataPlatformFixtures } from '@/services/basketball/builders/platform.service'
import type { SportKey } from '@/config/sports.config'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (parseBooleanParam(searchParams.get('validate'), false)) {
      return apiOk(validateBasketballDataPlatformFixtures(), id)
    }
    return apiOk(
      getBasketballDataPlatform({
        sportKey: (searchParams.get('sportKey') as SportKey | null) ?? undefined,
        leagueKey: searchParams.get('leagueKey') ?? undefined,
        season: searchParams.get('season') ?? undefined,
        dateFrom: searchParams.get('dateFrom') ?? undefined,
        dateTo: searchParams.get('dateTo') ?? undefined,
      }),
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown basketball platform error'),
      status: 500,
    })
  }
}
