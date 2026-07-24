import { NextResponse } from 'next/server'
import { getMlbTeamTotalsReadiness } from '@/services/mlb-team-totals-readiness.service'

export async function GET() {
  try {
    return NextResponse.json(await getMlbTeamTotalsReadiness())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        mode: 'mlb_team_totals_readiness_v1',
        error: error instanceof Error ? error.message : 'Unknown MLB Team Totals readiness error',
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      { status: 500 }
    )
  }
}
