import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbContextLineage } from '@/services/mlb-context-lineage.service'
import type { MlbContextSnapshotType } from '@/services/mlb-context-lineage.service'

function snapshotType(value: string | null): MlbContextSnapshotType | null {
  if (value === 'MORNING' || value === 'FINAL_PREGAME' || value === 'CURRENT_PROBE') return value
  return null
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const eventId = request.nextUrl.searchParams.get('eventId')
    const type = snapshotType(request.nextUrl.searchParams.get('snapshotType'))
    const allowProviderCalls = request.nextUrl.searchParams.get('allowProviderCalls') === 'true'
    return apiOk(await getMlbContextLineage({
      date,
      eventId,
      snapshotType: type,
      allowProviderCalls,
      persist: false,
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB context lineage error') })
  }
}
