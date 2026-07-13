import { NextRequest, NextResponse } from 'next/server'
import { getNbaReconciliationPlan } from '@/services/nba-data-quality.service'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const dryRun = searchParams.get('dryRun') !== 'false'
    const result = await getNbaReconciliationPlan({ dryRun })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA reconciliation plan failed',
      },
      { status: 500 }
    )
  }
}
