import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getProbabilityPicks } from '@/services/probability-picks.service'
import type { ProbabilityFreshnessSummary, ProbabilityPickRisk } from '@/types/probability-picks'

function numberParam(value: string | null) {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function riskParam(value: string | null): ProbabilityPickRisk | 'all' | null {
  const raw = String(value ?? '').toUpperCase()
  if (raw === 'LOW' || raw === 'MEDIUM' || raw === 'HIGH') return raw
  if (raw === 'ALL') return 'all'
  return null
}

function freshnessParam(value: string | null): ProbabilityFreshnessSummary['status'] | 'all' | null {
  const raw = String(value ?? '').toUpperCase()
  if (raw === 'FRESH' || raw === 'AGING' || raw === 'STALE' || raw === 'UNKNOWN') return raw
  if (raw === 'ALL') return 'all'
  return null
}

function sortParam(value: string | null) {
  const raw = String(value ?? '')
  return ['score', 'probability', 'confidence', 'quality', 'stability', 'freshness', 'eventStart'].includes(raw) ? raw as 'score' | 'probability' | 'confidence' | 'quality' | 'stability' | 'freshness' | 'eventStart' : null
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
      maxRisk: riskParam(request.nextUrl.searchParams.get('maxRisk')),
      dataFreshness: freshnessParam(request.nextUrl.searchParams.get('dataFreshness')),
      certificationLevel: request.nextUrl.searchParams.get('certificationLevel'),
      starterStatus: request.nextUrl.searchParams.get('starterStatus'),
      projectionQuality: request.nextUrl.searchParams.get('projectionQuality'),
      sort: sortParam(request.nextUrl.searchParams.get('sort')),
      date: request.nextUrl.searchParams.get('date'),
      limit,
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown probability picks error') })
  }
}
