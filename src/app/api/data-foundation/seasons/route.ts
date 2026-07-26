import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSeasonCompetitionGovernanceV2, validateSeasonCompetitionGovernanceV2 } from '@/services/data-foundation-season-governance.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(validateSeasonCompetitionGovernanceV2(), id)
    }
    return apiOk(getSeasonCompetitionGovernanceV2(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown season governance error') })
  }
}
