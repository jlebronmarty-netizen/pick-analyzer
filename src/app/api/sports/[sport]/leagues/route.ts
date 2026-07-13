import { NextResponse } from 'next/server'
import { getMultiSportLeagues } from '@/services/multi-sport-query.service'
import { isSportKey } from '@/services/multi-sport-resolution.service'

type RouteContext = {
  params: Promise<{
    sport: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
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

  const result = await getMultiSportLeagues(sport)

  return NextResponse.json(result, {
    status: result.success ? 200 : 502,
  })
}
