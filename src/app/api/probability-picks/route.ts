import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getProbabilityPicks } from '@/services/probability-picks.service'

function numberParam(value: string | null) {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const limit = parseIntegerParam({ value: request.nextUrl.searchParams.get('limit'), fallback: 120, min: 1, max: 500 })
    return apiOk(await getProbabilityPicks({
      sport: request.nextUrl.searchParams.get('sport'),
      market: request.nextUrl.searchParams.get('market'),
      minProbability: numberParam(request.nextUrl.searchParams.get('minProbability')),
      minConfidence: numberParam(request.nextUrl.searchParams.get('minConfidence')),
      minQuality: numberParam(request.nextUrl.searchParams.get('minQuality')),
      starterStatus: request.nextUrl.searchParams.get('starterStatus'),
      projectionQuality: request.nextUrl.searchParams.get('projectionQuality'),
      date: request.nextUrl.searchParams.get('date'),
      limit,
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown probability picks error') })
  }
}
