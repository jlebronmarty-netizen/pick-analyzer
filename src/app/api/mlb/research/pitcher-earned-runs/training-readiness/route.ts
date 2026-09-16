import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runMlbPitcherErTrainingReadiness } from '@/services/mlb-pitcher-earned-runs-training-readiness.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const report = await runMlbPitcherErTrainingReadiness()
    return apiOk(report, id, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return apiError({
      id,
      code: 'PA12_ER_TRAINING_READINESS_UNAVAILABLE',
      message: errorMessage(error, 'PA-12 Pitcher ER training readiness unavailable'),
    })
  }
}
