import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbStarterIntelligence } from '@/services/mlb-starter-intelligence.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const intelligence = await getMlbStarterIntelligence({ date })
    return apiOk({
      success: true,
      mode: 'mlb_starter_history_v1',
      generatedAt: intelligence.generatedAt,
      selectedDate: intelligence.selectedDate,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      history: intelligence.history,
      mapping: intelligence.diagnostics.mapping,
      sourceAudit: intelligence.sourceAudit,
    }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB starter history error') })
  }
}
