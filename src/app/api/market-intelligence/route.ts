import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, parseIntegerParam, requestId } from '@/lib/api-contract'
import {
  getMarketIntelligence,
  validateMarketIntelligenceFixtures,
  type MarketIntelligenceRecommendation,
  type MarketIntelligenceSort,
} from '@/services/market-intelligence-engine.service'

const sorts: MarketIntelligenceSort[] = [
  'best_combined',
  'highest_probability',
  'highest_ev',
  'highest_confidence',
  'highest_ai_rating',
  'lowest_risk',
]

const recommendations: MarketIntelligenceRecommendation[] = ['Elite', 'Strong Value', 'Watch', 'Pass', 'Unavailable']

function numeric(value: string | null) {
  if (value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (parseBooleanParam(searchParams.get('validate'), false)) {
      return apiOk(validateMarketIntelligenceFixtures(), id)
    }
    const sortParam = searchParams.get('sort') as MarketIntelligenceSort | null
    const recommendationParam = searchParams.get('recommendation') as MarketIntelligenceRecommendation | null
    const result = await getMarketIntelligence({
      sort: sortParam && sorts.includes(sortParam) ? sortParam : 'best_combined',
      limit: parseIntegerParam({ value: searchParams.get('limit'), fallback: 25, min: 1, max: 100 }),
      includeUnavailable: parseBooleanParam(searchParams.get('includeUnavailable'), true),
      filters: {
        sport: searchParams.get('sport') ?? undefined,
        game: searchParams.get('game') ?? undefined,
        market: searchParams.get('market') ?? undefined,
        sportsbook: searchParams.get('sportsbook') ?? undefined,
        recommendation: recommendationParam && recommendations.includes(recommendationParam) ? recommendationParam : undefined,
        risk: ['low', 'medium', 'high'].includes(searchParams.get('risk') ?? '') ? (searchParams.get('risk') as 'low' | 'medium' | 'high') : undefined,
        minAiRating: numeric(searchParams.get('minAiRating')),
        minConfidence: numeric(searchParams.get('minConfidence')),
        minEdge: numeric(searchParams.get('minEdge')),
        minEv: numeric(searchParams.get('minEv')),
        minOdds: numeric(searchParams.get('minOdds')),
        maxOdds: numeric(searchParams.get('maxOdds')),
      },
    })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown market intelligence error'),
      status: 500,
    })
  }
}
