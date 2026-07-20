import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getUniversalProjectionEngine, validateUniversalProjectionEngineFixtures } from '@/services/universal-projection-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date') ?? undefined
    const data = await getUniversalProjectionEngine({ sportKey: 'baseball_mlb', date, dryRun: true })
    return apiOk(
      {
        success: true,
        apiStatus: data.apiStatus,
        mode: 'mlb_projection_health_v1',
        generatedAt: data.generatedAt,
        sportKey: 'baseball_mlb',
        leagueKey: 'mlb',
        selectedDate: data.selectedDate,
        health: data.projectionHealth,
        summary: data.summary,
        featureInputs: data.featureInputs,
        temporalSafety: data.temporalSafety,
        persistence: data.persistence,
        validation: validateUniversalProjectionEngineFixtures(),
        warnings: data.warnings,
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB projection health error'),
    })
  }
}
