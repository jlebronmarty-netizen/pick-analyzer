import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMlbCurrentSeasonDataQualityAudit,
  validateMlbCurrentSeasonDataQualityAuditFixtures,
} from '@/services/mlb-current-season-data-quality-audit.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const season = request.nextUrl.searchParams.get('season') ?? '2026'
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const audit = await getMlbCurrentSeasonDataQualityAudit({ season })
    return apiOk({
      ...audit,
      validation: includeValidation ? validateMlbCurrentSeasonDataQualityAuditFixtures() : undefined,
    }, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB current-season data-quality audit error'),
    })
  }
}
