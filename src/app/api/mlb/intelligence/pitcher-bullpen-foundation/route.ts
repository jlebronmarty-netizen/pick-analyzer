import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPitcherBullpenFoundations } from '@/services/mlb-model-platform.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const selectedDate = request.nextUrl.searchParams.get('selectedDate') ?? request.nextUrl.searchParams.get('date') ?? '2026-07-17'
    return apiOk(await getMlbPitcherBullpenFoundations(selectedDate), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB pitcher/bullpen foundation error') })
  }
}
