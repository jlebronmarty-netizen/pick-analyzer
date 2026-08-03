import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getPredictionEpochGovernanceV2, validatePredictionEpochGovernanceV2 } from '@/services/prediction-epoch-governance-v2.service'
import { activatePredictionEpochV2 } from '@/services/prediction-epoch-runtime.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(await validatePredictionEpochGovernanceV2(), id)
    }
    return apiOk(await getPredictionEpochGovernanceV2(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown prediction epoch governance error') })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const auth = request.headers.get('authorization') ?? ''
    const expected = process.env.CRON_SECRET
    if (!expected || auth !== `Bearer ${expected}`) {
      return apiError({ id, code: 'UNAUTHORIZED', message: 'Protected epoch activation requires scheduler authorization.', status: 401 })
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const result = await activatePredictionEpochV2({
      dryRun: body.dryRun !== false,
      confirmed: body.confirmed === true,
      activationTimestamp: typeof body.activationTimestamp === 'string' ? body.activationTimestamp : null,
      certifiedBaselineCommit: typeof body.certifiedBaselineCommit === 'string' ? body.certifiedBaselineCommit : null,
      activatedBy: typeof body.activatedBy === 'string' ? body.activatedBy : null,
    })
    return apiOk(result, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown prediction epoch activation error') })
  }
}
