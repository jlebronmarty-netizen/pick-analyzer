import { NextResponse } from 'next/server'
import { loadBsnModelMaturity } from '@/lib/server-lazy-diagnostics'

export async function GET() {
  try {
    const { getBsnBacktestingEngine } = await loadBsnModelMaturity()
    const data = await getBsnBacktestingEngine()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN backtesting error',
      },
      { status: 500 }
    )
  }
}
