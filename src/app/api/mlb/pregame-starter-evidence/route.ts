import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMlbPregameStarterEvidence,
  refreshMlbPregameStarterEvidence,
  validateMlbPregameStarterEvidenceFixtures,
} from '@/services/mlb-pregame-starter-evidence.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('validate') === 'true') return apiOk(validateMlbPregameStarterEvidenceFixtures(), id)
    return apiOk(await getMlbPregameStarterEvidence({ date: searchParams.get('date') }), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB pregame starter evidence error'),
      status: 500,
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    const dryRun = body?.dryRun !== false
    const refreshProvider = body?.refreshProvider === true
    if ((!dryRun || refreshProvider) && !authorized(request)) {
      return apiError({
        id,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized MLB pregame starter evidence refresh request.',
        status: 401,
      })
    }
    return apiOk(
      await refreshMlbPregameStarterEvidence({
        date: typeof body?.date === 'string' ? body.date : null,
        dryRun,
        refreshProvider,
        confirmed: body?.confirmed === true,
        timeoutMs: body?.timeoutMs ?? null,
      }),
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB pregame starter evidence refresh error'),
      status: 500,
    })
  }
}
