import { NextRequest } from 'next/server'
import { apiOk, requestId } from '@/lib/api-contract'
import { validateOperatingDayDeterministicFixtures } from '@/services/operating-day.service'

export async function GET(request: NextRequest) {
  return apiOk(validateOperatingDayDeterministicFixtures(), requestId(request))
}
