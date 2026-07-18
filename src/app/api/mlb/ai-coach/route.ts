import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbAiCoach, validateMlbAiCoachFixtures } from '@/services/mlb-ai-coach.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const query = request.nextUrl.searchParams.get('query') ?? ''
    const date = request.nextUrl.searchParams.get('date') ?? '2026-07-17'
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const coach = await getMlbAiCoach({ query, date })
    return apiOk(
      {
        ...coach,
        validation: includeValidation ? validateMlbAiCoachFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB AI coach error'),
    })
  }
}
