import { NextResponse } from 'next/server'
import { loadNbaPredictionSettlement } from '@/lib/server-lazy-diagnostics'

export async function GET() {
  try {
    const { getNbaSettlementBacklog } = await loadNbaPredictionSettlement()
    const result = await getNbaSettlementBacklog()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA settlement backlog failed',
      },
      { status: 500 }
    )
  }
}
