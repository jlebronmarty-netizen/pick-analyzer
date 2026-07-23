import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { loadMlbTemporalHealth } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    const { getMlbTemporalHealth } = await loadMlbTemporalHealth()
    return apiOk(await getMlbTemporalHealth({ date: searchParams.get('date') }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB temporal health error') })
  }
}
