import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getBestValueOpportunities } from '@/services/best-value-scanner.service'

const modes = ['current', 'upcoming', 'historical_explorer', 'all_stored_advanced'] as const

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') ?? 'current'
    const result = await getBestValueOpportunities({
      mode: modes.includes(mode as never) ? (mode as (typeof modes)[number]) : 'current',
      includePasses: parseBooleanParam(searchParams.get('includePasses'), false),
      limit: parseIntegerParam({ value: searchParams.get('limit'), fallback: 50, min: 1, max: 100 }),
    })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown best value scanner error'),
      status: 500,
    })
  }
}
