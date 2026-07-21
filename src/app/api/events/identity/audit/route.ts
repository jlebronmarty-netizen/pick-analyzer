import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  executeEventLinkRepair,
  getUniversalEventIdentityAudit,
  validateUniversalEventIdentityFixtures,
} from '@/services/universal-event-identity.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  const querySecret = new URL(request.url).searchParams.get('secret')
  return header === `Bearer ${secret}` || querySecret === secret
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('validate') === 'true') {
      return apiOk(validateUniversalEventIdentityFixtures(), id)
    }
    return apiOk(await getUniversalEventIdentityAudit(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown event identity audit error'),
      status: 500,
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    if (!authorized(request)) {
      return apiError({
        id,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized event identity repair request.',
        status: 401,
      })
    }
    return apiOk(await executeEventLinkRepair(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown event identity repair error'),
      status: 500,
    })
  }
}
