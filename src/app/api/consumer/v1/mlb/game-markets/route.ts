import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getPickEdgeOpportunities } from '@/services/pick-edge-consumer-v1.service'
import type { ConsumerSort } from '@/types/pick-edge-consumer-v1'

const SORTS = new Set<ConsumerSort>(['probability', 'edge', 'ev', 'game_time'])

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    const sortParam = searchParams.get('sort') as ConsumerSort | null
    const sort: ConsumerSort = sortParam && SORTS.has(sortParam) ? sortParam : 'probability'
    const gamePkParam = searchParams.get('gamePk')
    const gamePk = gamePkParam === null ? null : Number(gamePkParam)
    if (gamePkParam !== null && (!Number.isSafeInteger(gamePk) || Number(gamePk) <= 0)) {
      return apiError({ id, code: 'BAD_REQUEST', message: `Invalid gamePk: ${gamePkParam}`, status: 400 })
    }
    const response = await getPickEdgeOpportunities({
      date: searchParams.get('date'),
      family: searchParams.get('family'),
      gamePk,
      sort,
      limit: parseIntegerParam({ value: searchParams.get('limit'), fallback: 100, min: 1, max: 200 }),
    })
    response.data = response.data.filter((item) => ['MONEYLINE', 'RUN_LINE', 'TOTAL'].includes(item.family))
    return apiOk({ success: true, ...response }, id)
  } catch (error) {
    return apiError({
      id,
      code: String(error).includes('INVALID_CONSUMER_DATE') ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown consumer game-markets error'),
      status: String(error).includes('INVALID_CONSUMER_DATE') ? 400 : 500,
    })
  }
}
