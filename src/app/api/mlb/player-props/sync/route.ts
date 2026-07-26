import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, parseIntegerParam, requestId } from '@/lib/api-contract'
import { syncMlbPlayerProps } from '@/services/mlb-player-prop-sync.service'
import type { MlbPlayerPropIngestionProvider } from '@/types/mlb-player-prop-ingestion'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

function provider(value: unknown): MlbPlayerPropIngestionProvider | null {
  if (value === 'sportsdataio' || value === 'the-odds-api') return value
  return null
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    const live = parseBooleanParam(request.nextUrl.searchParams.get('live'), false) || body?.live === true
    const dryRun = live ? false : body?.dryRun === undefined ? true : parseBooleanParam(String(body.dryRun), true)
    if (!dryRun && !authorized(request)) {
      return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized MLB player prop sync request.', status: 401 })
    }
    const result = await syncMlbPlayerProps({
      date: typeof body?.date === 'string' ? body.date : null,
      dryRun,
      confirmed: body?.confirmed === true,
      confirm: request.nextUrl.searchParams.get('confirm') ?? (typeof body?.confirm === 'string' ? body.confirm : null),
      provider: provider(body?.provider),
      maximumEvents: parseIntegerParam({
        value: body?.maximumEvents === undefined ? null : String(body.maximumEvents),
        fallback: 1,
        min: 1,
        max: 3,
      }),
    })
    const status = result.status === 'DRY_RUN' ? 200 : result.status.startsWith('BLOCKED') ? 409 : 200
    return apiOk(result, id, { status })
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player prop sync error') })
  }
}
