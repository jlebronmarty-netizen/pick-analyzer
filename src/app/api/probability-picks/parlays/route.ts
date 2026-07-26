import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getProbabilityParlays } from '@/services/probability-picks.service'
import type { ProbabilityParlayMode, ProbabilityParlayScope } from '@/types/probability-picks'

function numberParam(value: string | null) {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function modeParam(value: string | null): ProbabilityParlayMode | null {
  const raw = String(value ?? '').toUpperCase()
  return raw === 'CONSERVATIVE' || raw === 'BALANCED' || raw === 'AGGRESSIVE' ? raw : null
}

function scopeParam(value: string | null): ProbabilityParlayScope | null {
  const raw = String(value ?? '').toUpperCase()
  return raw === 'MLB_ONLY' || raw === 'MULTI_SPORT' ? raw : null
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const limit = parseIntegerParam({ value: request.nextUrl.searchParams.get('limit'), fallback: 20, min: 1, max: 50 })
    return apiOk(await getProbabilityParlays({
      sport: request.nextUrl.searchParams.get('sport'),
      market: request.nextUrl.searchParams.get('market'),
      minProbability: numberParam(request.nextUrl.searchParams.get('minProbability')),
      minConfidence: numberParam(request.nextUrl.searchParams.get('minConfidence')),
      minQuality: numberParam(request.nextUrl.searchParams.get('minQuality')),
      starterStatus: request.nextUrl.searchParams.get('starterStatus'),
      projectionQuality: request.nextUrl.searchParams.get('projectionQuality'),
      date: request.nextUrl.searchParams.get('date'),
      mode: modeParam(request.nextUrl.searchParams.get('mode')),
      scope: scopeParam(request.nextUrl.searchParams.get('scope')),
      minLegs: numberParam(request.nextUrl.searchParams.get('minLegs')),
      maxLegs: numberParam(request.nextUrl.searchParams.get('maxLegs')),
      limit,
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown probability parlays error') })
  }
}
