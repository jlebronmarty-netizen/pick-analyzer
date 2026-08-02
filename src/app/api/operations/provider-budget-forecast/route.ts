import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getProviderBudgetForecast } from '@/services/provider-budget.service'

function list(value: string | null) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []
}

function num(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const params = request.nextUrl.searchParams
    return apiOk(await getProviderBudgetForecast({
      provider: params.get('provider'),
      sportKey: params.get('sportKey'),
      action: params.get('action'),
      eventCount: num(params.get('eventCount')),
      markets: list(params.get('markets')),
      regions: list(params.get('regions')),
      bookmakers: list(params.get('bookmakers')),
      expectedCadenceMinutes: num(params.get('expectedCadenceMinutes')),
      timeWindowMinutes: num(params.get('timeWindowMinutes')),
      estimatedCost: num(params.get('estimatedCost')),
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown provider budget forecast error') })
  }
}
