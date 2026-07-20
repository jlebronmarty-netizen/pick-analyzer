import { NextRequest } from 'next/server'
import { apiOk, requestId } from '@/lib/api-contract'
import { validateAdaptiveRefreshFixtures } from '@/services/adaptive-refresh-orchestrator.service'

export async function GET(request: NextRequest) {
  return apiOk(validateAdaptiveRefreshFixtures(), requestId(request))
}
