import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { loadOperatingDayService } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { getOperatingDayStatus } = await loadOperatingDayService()
    const result = await getOperatingDayStatus({
      selectedDate: request.nextUrl.searchParams.get('date') ?? request.nextUrl.searchParams.get('selectedDate'),
      sportKey: request.nextUrl.searchParams.get('sportKey') ?? request.nextUrl.searchParams.get('sport'),
      leagueKey: request.nextUrl.searchParams.get('leagueKey') ?? request.nextUrl.searchParams.get('league'),
    })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown operating-day status error'),
    })
  }
}
