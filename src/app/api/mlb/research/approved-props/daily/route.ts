import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbApprovedPropsDailyBoard } from '@/services/mlb-approved-prop-daily-evaluation.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function dateInPuertoRico() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Puerto_Rico',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  )
  return String(parts.year) + '-' + String(parts.month) + '-' + String(parts.day)
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  const date = request.nextUrl.searchParams.get('date') ?? dateInPuertoRico()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiError({ id, code: 'BAD_REQUEST', message: 'date must use YYYY-MM-DD.', status: 400 })
  }
  try {
    const board = await getMlbApprovedPropsDailyBoard(date)
    return apiOk({ mode: 'mlb-approved-props-daily-research', board }, id, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown approved MLB prop board error'),
    })
  }
}
