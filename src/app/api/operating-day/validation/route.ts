import { NextRequest } from 'next/server'
import { apiOk, requestId } from '@/lib/api-contract'
import { loadOperatingDayService } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  const { validateOperatingDayDeterministicFixtures } = await loadOperatingDayService()
  return apiOk(validateOperatingDayDeterministicFixtures(), requestId(request))
}
