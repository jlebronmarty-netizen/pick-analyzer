import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getMostLikelyOpportunities } from '@/services/market-opportunity-suite.service'

const sortModes = [
  'highest_probability',
  'best_value',
  'best_combined',
  'lowest_risk',
  'highest_confidence',
  'newest_odds',
] as const

const boardModes = [
  'current_board',
  'upcoming',
  'historical_explorer',
  'all_stored_data',
] as const

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get('sort') ?? 'highest_probability'
    const mode = searchParams.get('mode') ?? 'current_board'
    const result = await getMostLikelyOpportunities({
      sort: sortModes.includes(sort as never) ? (sort as (typeof sortModes)[number]) : 'highest_probability',
      mode: boardModes.includes(mode as never) ? (mode as (typeof boardModes)[number]) : 'current_board',
      limit: parseIntegerParam({ value: searchParams.get('limit'), fallback: 50, min: 1, max: 100 }),
    })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown most likely opportunity error'),
      status: 500,
    })
  }
}
