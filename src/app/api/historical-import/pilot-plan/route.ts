import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { loadSportsDataIoHistoricalImportReadiness } from '@/lib/server-lazy-diagnostics'

export async function POST(request: NextRequest) {
  const id = requestId(request)

  try {
    const body = await request.json().catch(() => ({}))
    const { buildSportsDataIoPilotPlan } = await loadSportsDataIoHistoricalImportReadiness()
    return apiOk(
      buildSportsDataIoPilotPlan({
        sportKey: body?.sportKey ?? body?.sport ?? null,
        leagueKey: body?.leagueKey ?? body?.league ?? null,
        season: body?.season ?? null,
        dateFrom: body?.dateFrom ?? null,
        dateTo: body?.dateTo ?? null,
        domains: Array.isArray(body?.domains) ? body.domains : null,
      }),
      id
    )
  } catch (error) {
    console.error('SportsDataIO pilot plan error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown SportsDataIO pilot plan error'),
    })
  }
}
