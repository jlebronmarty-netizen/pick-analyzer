import { NextRequest, NextResponse } from 'next/server'
import { getMlbDecisionBoard } from '@/services/mlb-decision-board.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')
  try {
    const data = await getMlbDecisionBoard(date)
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      mode: 'mlb_decision_board_v1',
      error: error instanceof Error ? error.message : 'Unknown MLB Decision Board error',
    }, { status: 500 })
  }
}
