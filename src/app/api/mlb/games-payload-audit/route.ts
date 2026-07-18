import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMlbGamesPayloadAudit,
  validateMlbGamesPayloadAuditFixtures,
} from '@/services/mlb-games-payload-audit.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date') ?? '2026-07-17'
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const audit = await getMlbGamesPayloadAudit(date)
    return apiOk(
      {
        ...audit,
        validation: includeValidation ? validateMlbGamesPayloadAuditFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB games payload audit error'),
    })
  }
}
