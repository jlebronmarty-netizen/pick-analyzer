import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getPitcherProjectionHealth } from '@/services/mlb-pitcher-projection-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getPitcherProjectionHealth({ date: request.nextUrl.searchParams.get('date') }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB pitcher projection health error') })
  }
}
