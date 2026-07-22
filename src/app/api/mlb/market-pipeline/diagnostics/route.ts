import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMlbMarketPipelineDiagnostics,
  validateMlbMarketPipelineDiagnosticsFixtures,
} from '@/services/mlb-market-pipeline-diagnostics.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const selectedDate = request.nextUrl.searchParams.get('date') ?? request.nextUrl.searchParams.get('selectedDate') ?? undefined
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const diagnostics = await getMlbMarketPipelineDiagnostics(selectedDate)
    return apiOk(
      {
        ...diagnostics,
        validation: includeValidation ? validateMlbMarketPipelineDiagnosticsFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB market pipeline diagnostic error'),
      status: 500,
    })
  }
}
