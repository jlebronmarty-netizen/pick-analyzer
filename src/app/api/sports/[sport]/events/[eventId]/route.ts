import { NextResponse } from 'next/server'
import { getMultiSportEvent } from '@/services/multi-sport-query.service'
import { isSportKey } from '@/services/multi-sport-resolution.service'

type RouteContext = {
  params: Promise<{
    sport: string
    eventId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { sport, eventId } = await context.params

  if (!isSportKey(sport)) {
    return NextResponse.json(
      {
        success: false,
        error: `Unsupported sport key: ${sport}`,
      },
      { status: 404 }
    )
  }

  const result = await getMultiSportEvent(
    sport,
    decodeURIComponent(eventId)
  )

  return NextResponse.json(result, {
    status: result.success ? (result.event ? 200 : 404) : 502,
  })
}
