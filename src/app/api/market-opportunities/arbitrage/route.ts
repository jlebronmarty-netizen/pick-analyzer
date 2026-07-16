import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getArbitrageOpportunities } from '@/services/market-opportunity-suite.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    const result = await getArbitrageOpportunities({
      staleMinutes: parseIntegerParam({ value: searchParams.get('staleMinutes'), fallback: 120, min: 5, max: 1440 }),
      investment: parseIntegerParam({ value: searchParams.get('investment'), fallback: 1000, min: 10, max: 100000 }),
    })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown arbitrage opportunity error'),
      status: 500,
    })
  }
}
