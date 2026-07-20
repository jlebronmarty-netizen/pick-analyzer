import { NextRequest } from 'next/server'
import { apiOk, requestId } from '@/lib/api-contract'
import { validateAdaptiveRefreshFixtures } from '@/services/adaptive-refresh-orchestrator.service'
import { validateMarketAlignmentFixtures } from '@/services/market-alignment.service'

export async function GET(request: NextRequest) {
  const adaptive = validateAdaptiveRefreshFixtures()
  const marketAlignment = validateMarketAlignmentFixtures()
  return apiOk({
    ...adaptive,
    success: adaptive.success && marketAlignment.success,
    marketAlignment,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }, requestId(request))
}
