import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { previewPitcherProjection } from '@/services/mlb-pitcher-projection-engine.service'

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    const date = typeof body?.date === 'string' ? body.date : null
    const limit = parseIntegerParam({ value: body?.limit === undefined ? null : String(body.limit), fallback: 80, min: 1, max: 200 })
    return apiOk(await previewPitcherProjection({ date, limit }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB pitcher projection preview error') })
  }
}
