import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { loadMlbMarketExpansionRoadmap } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date') ?? '2026-07-19'
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const {
      getMlbMarketExpansionRoadmap,
      validateMlbMarketExpansionRoadmapFixtures,
    } = await loadMlbMarketExpansionRoadmap()
    const roadmap = await getMlbMarketExpansionRoadmap(date)
    return apiOk(
      {
        ...roadmap,
        validation: includeValidation ? validateMlbMarketExpansionRoadmapFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB market expansion roadmap error'),
    })
  }
}
