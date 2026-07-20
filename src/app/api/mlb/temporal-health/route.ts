import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbTemporalHealth } from '@/services/mlb-temporal-health.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    return apiOk(await getMlbTemporalHealth({ date: searchParams.get('date') }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB temporal health error') })
  }
}
