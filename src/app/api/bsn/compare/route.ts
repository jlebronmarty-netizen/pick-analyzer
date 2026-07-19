import { NextRequest, NextResponse } from 'next/server'
import { compareBsnTeams } from '@/services/bsn-intelligence-engine.service'

export async function GET(request: NextRequest) {
  try {
    const teamA = request.nextUrl.searchParams.get('teamA') ?? request.nextUrl.searchParams.get('a')
    const teamB = request.nextUrl.searchParams.get('teamB') ?? request.nextUrl.searchParams.get('b')
    if (!teamA || !teamB) {
      return NextResponse.json(
        {
          success: false,
          error: 'teamA and teamB query parameters are required.',
          providerCallsMade: 0,
          remoteMutationsMade: 0,
        },
        { status: 400 }
      )
    }
    return NextResponse.json(await compareBsnTeams(teamA, teamB))
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN comparison error',
      },
      { status: 500 }
    )
  }
}