import { NextResponse } from 'next/server'
import { getMlbFirstFiveReadiness } from '@/services/mlb-first-five-readiness.service'

export async function GET() {
  try {
    return NextResponse.json(await getMlbFirstFiveReadiness())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        mode: 'mlb_first_five_readiness_v1',
        error: error instanceof Error ? error.message : 'Unknown MLB First Five readiness error',
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      { status: 500 }
    )
  }
}
