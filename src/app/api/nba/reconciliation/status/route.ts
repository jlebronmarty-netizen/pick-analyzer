import { NextResponse } from 'next/server'
import { getNbaReconciliationStatus } from '@/services/nba-data-quality.service'

export async function GET() {
  try {
    const result = await getNbaReconciliationStatus()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA reconciliation status failed',
      },
      { status: 500 }
    )
  }
}
