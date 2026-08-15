import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getNbaCurrentEraShadowSchedulerPrecheckStatus,
  runNbaCurrentEraShadowSchedulerCanary,
} from '@/services/nba-current-era-shadow-scheduler.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

function statusFor(classification: string) {
  if (classification === 'PERSISTENCE_FAILURE_BLOCKED' || classification === 'PROVIDER_FAILURE_BLOCKED') return 502
  if (classification === 'PROVIDER_BUDGET_NO_OP') return 409
  return 200
}

async function handle(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized', status: 401 })
  }

  try {
    const mode = request.nextUrl.searchParams.get('mode')
    const status = request.nextUrl.searchParams.get('status')
    if (mode === 'status' || status === 'precheck') {
      const result = await getNbaCurrentEraShadowSchedulerPrecheckStatus()
      return apiOk(
        {
          ...result,
          route: '/api/cron/nba-current-era-shadow',
          providerCallsFromCertificationReads: 0,
          databaseMutationsFromCertificationReads: 0,
        },
        id
      )
    }

    const result = await runNbaCurrentEraShadowSchedulerCanary()
    return apiOk(
      {
        ...result,
        route: '/api/cron/nba-current-era-shadow',
        providerCallsFromCertificationReads: 0,
      },
      id,
      { status: statusFor(result.finalClassification) }
    )
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'NBA shadow scheduler failed'), status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
