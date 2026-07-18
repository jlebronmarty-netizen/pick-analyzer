import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getNextSlateStatus, validateNextSlateDeterministicFixtures } from '@/services/next-slate.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const status = await getNextSlateStatus({
      sportKey: request.nextUrl.searchParams.get('sportKey') ?? request.nextUrl.searchParams.get('sport'),
      leagueKey: request.nextUrl.searchParams.get('leagueKey') ?? request.nextUrl.searchParams.get('league'),
      searchDays: parseIntegerParam({
        value: request.nextUrl.searchParams.get('searchDays'),
        fallback: 7,
        min: 1,
        max: 14,
      }),
    })
    return apiOk(
      {
        ...status,
        validation: includeValidation ? validateNextSlateDeterministicFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown next slate status error'),
    })
  }
}
