import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMlbPlayerDataExcellencePitcherOuts,
  validateMlbPlayerDataExcellenceFixtures,
} from '@/services/mlb-player-data-excellence.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const season = request.nextUrl.searchParams.get('season') ?? '2026'
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const audit = await getMlbPlayerDataExcellencePitcherOuts({ season })
    return apiOk({
      ...audit,
      validation: includeValidation ? validateMlbPlayerDataExcellenceFixtures() : undefined,
    }, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB player data excellence audit error'),
    })
  }
}
