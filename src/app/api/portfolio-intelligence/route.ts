import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getPortfolioIntelligence, validatePortfolioIntelligenceFixtures } from '@/services/portfolio-intelligence.service'
import type { PortfolioDependencyTolerance } from '@/types/portfolio-intelligence'

const dependencies: PortfolioDependencyTolerance[] = ['all', 'lower_shared_exposure', 'cross_sport_only']

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = request.nextUrl
    if (searchParams.get('validate') === 'true') return apiOk(validatePortfolioIntelligenceFixtures(), id)
    const dependency = searchParams.get('dependency') as PortfolioDependencyTolerance | null
    return apiOk(await getPortfolioIntelligence({
      sport: searchParams.get('sport') ?? null,
      market: searchParams.get('market') ?? null,
      size: parseIntegerParam({ value: searchParams.get('size'), fallback: 2, min: 2, max: 3 }),
      limit: parseIntegerParam({ value: searchParams.get('limit'), fallback: 20, min: 1, max: 50 }),
      dependency: dependency && dependencies.includes(dependency) ? dependency : 'all',
      freshnessRequirement: searchParams.get('freshness') as never,
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown portfolio intelligence error') })
  }
}
