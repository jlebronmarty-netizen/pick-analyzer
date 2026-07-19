import { NextResponse } from 'next/server'
import { getBsnPowerRankings } from '@/services/bsn-intelligence-engine.service'

export async function GET() {
  try {
    return NextResponse.json(await getBsnPowerRankings())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN power rankings error',
      },
      { status: 500 }
    )
  }
}