import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbStarterAssignments } from '@/services/mlb-starter-sync.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getMlbStarterAssignments({ date: request.nextUrl.searchParams.get('date') }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB starter assignment error') })
  }
}
