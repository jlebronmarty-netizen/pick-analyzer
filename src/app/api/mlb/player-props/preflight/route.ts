import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { syncMlbDecisionBoardPlayerProps } from '@/services/mlb-decision-board-player-prop-sync.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const maximumEvents = parseIntegerParam({
      value: request.nextUrl.searchParams.get('maximumEvents'),
      fallback: 1,
      min: 1,
      max: 3,
    })
    const result = await syncMlbDecisionBoardPlayerProps({
      date,
      dryRun: true,
      provider: 'the-odds-api',
      maximumEvents,
    })
    return apiOk(result, id, { status: 200 })
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player prop preflight error') })
  }
}
