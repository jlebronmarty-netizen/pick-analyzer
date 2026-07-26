import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { planHistoricalImportOrchestratorV2, validateHistoricalImportOrchestratorV2 } from '@/services/data-foundation-import-orchestrator.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function bodyDataTypes(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : null
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(validateHistoricalImportOrchestratorV2(), id)
    }
    const dataTypes = request.nextUrl.searchParams.get('dataTypes')
    return apiOk(planHistoricalImportOrchestratorV2({
      mode: request.nextUrl.searchParams.get('mode'),
      sportKey: request.nextUrl.searchParams.get('sportKey') ?? request.nextUrl.searchParams.get('sport'),
      leagueKey: request.nextUrl.searchParams.get('leagueKey') ?? request.nextUrl.searchParams.get('league'),
      providerId: request.nextUrl.searchParams.get('providerId') ?? request.nextUrl.searchParams.get('provider'),
      season: request.nextUrl.searchParams.get('season'),
      dateFrom: request.nextUrl.searchParams.get('dateFrom'),
      dateTo: request.nextUrl.searchParams.get('dateTo'),
      dataTypes: dataTypes ? dataTypes.split(',') : null,
      batchSizeDays: parseIntegerParam({ value: request.nextUrl.searchParams.get('batchSizeDays'), fallback: 3, min: 1, max: 31 }),
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown historical import orchestrator error') })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    return apiOk(planHistoricalImportOrchestratorV2({
      mode: typeof body?.mode === 'string' ? body.mode : null,
      sportKey: typeof body?.sportKey === 'string' ? body.sportKey : null,
      leagueKey: typeof body?.leagueKey === 'string' ? body.leagueKey : null,
      providerId: typeof body?.providerId === 'string' ? body.providerId : null,
      season: typeof body?.season === 'string' ? body.season : null,
      dateFrom: typeof body?.dateFrom === 'string' ? body.dateFrom : null,
      dateTo: typeof body?.dateTo === 'string' ? body.dateTo : null,
      dataTypes: bodyDataTypes(body?.dataTypes),
      batchSizeDays: typeof body?.batchSizeDays === 'number' ? body.batchSizeDays : null,
    }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown historical import orchestrator error') })
  }
}
