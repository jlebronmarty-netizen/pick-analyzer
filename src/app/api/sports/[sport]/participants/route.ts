import { NextRequest, NextResponse } from 'next/server'
import {
  getMultiSportParticipants,
  parseMultiSportQuery,
} from '@/services/multi-sport-query.service'
import { isSportKey } from '@/services/multi-sport-resolution.service'

type RouteContext = {
  params: Promise<{
    sport: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { sport } = await context.params

  if (!isSportKey(sport)) {
    return NextResponse.json(
      {
        success: false,
        error: `Unsupported sport key: ${sport}`,
      },
      { status: 404 }
    )
  }

  const query = parseMultiSportQuery(sport, request.nextUrl.searchParams)
  const result = await getMultiSportParticipants(query)

  return NextResponse.json(result, {
    status: result.success ? 200 : 502,
  })
}
