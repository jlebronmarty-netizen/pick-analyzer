import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import {
  getDay1RecommendationReadiness,
  validateDay1RecommendationReadinessFixtures,
} from '@/services/day1-recommendation-readiness.service'
import {
  getProspectiveOfficialEligibilityGate,
  promoteProspectiveOfficialCandidate,
  validateProspectiveOfficialEligibilityFixtures,
} from '@/services/prospective-official-eligibility-gate.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get('secret') === secret
  )
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('validate') === 'eligibilityGate') {
      return apiOk(validateProspectiveOfficialEligibilityFixtures(), id)
    }
    if (parseBooleanParam(searchParams.get('eligibilityGate'), false)) {
      return apiOk(await getProspectiveOfficialEligibilityGate(), id)
    }
    if (parseBooleanParam(searchParams.get('validate'), false)) {
      return apiOk(validateDay1RecommendationReadinessFixtures(), id)
    }
    const result = await getDay1RecommendationReadiness()
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown recommendation readiness error'),
      status: 500,
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({
      id,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized recommendation-readiness action.',
      status: 401,
    })
  }
  try {
    const body = await request.json().catch(() => ({}))
    if (body?.action !== 'promote_prospective_official_candidate') {
      return apiError({
        id,
        code: 'BAD_REQUEST',
        message: 'Unsupported recommendation-readiness action.',
        status: 400,
      })
    }
    const result = await promoteProspectiveOfficialCandidate({
      predictionId: body?.predictionId,
      eventId: body?.eventId,
      snapshotId: body?.snapshotId,
      oddsSnapshotId: body?.oddsSnapshotId,
      sportKey: body?.sportKey,
      market: body?.market,
      modelVersion: body?.modelVersion,
      featureSetVersion: body?.featureSetVersion,
      reason: body?.reason,
      idempotencyKey: body?.idempotencyKey,
      confirmed: body?.confirmed === true,
      dryRun: body?.dryRun !== false,
    })
    return apiOk(result, id, result.success ? undefined : { status: 422 })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown recommendation-readiness action error'),
      status: 500,
    })
  }
}
