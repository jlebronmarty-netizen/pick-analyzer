import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getFrozenPitcherErRuntimeParity } from '@/services/mlb-pitcher-er-frozen-runtime.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const parity = await getFrozenPitcherErRuntimeParity()
    return apiOk({
      ...parity,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
    }, id, {
      status: parity.certified ? 200 : 409,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB pitcher ER runtime parity error'),
    })
  }
}
