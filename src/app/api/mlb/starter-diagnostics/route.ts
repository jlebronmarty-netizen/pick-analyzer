import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbStarterIntelligence, validateMlbStarterIntelligenceFixtures } from '@/services/mlb-starter-intelligence.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const eventId = request.nextUrl.searchParams.get('eventId')
    const intelligence = await getMlbStarterIntelligence({ date, eventId })
    return apiOk({
      success: true,
      mode: 'mlb_starter_diagnostics_v1',
      generatedAt: intelligence.generatedAt,
      selectedDate: intelligence.selectedDate,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      sourceAudit: intelligence.sourceAudit,
      summary: intelligence.summary,
      diagnostics: intelligence.diagnostics,
      validation: validateMlbStarterIntelligenceFixtures(),
      certifications: intelligence.certifications,
    }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB starter diagnostics error') })
  }
}
