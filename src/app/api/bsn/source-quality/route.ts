import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getBsnSourceQuality } from '@/services/bsn-platform.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const sourceId = request.nextUrl.searchParams.get('sourceId') ?? request.nextUrl.searchParams.get('source')
    return apiOk(getBsnSourceQuality(sourceId), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown BSN source quality error') })
  }
}
