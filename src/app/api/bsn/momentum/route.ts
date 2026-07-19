import { NextResponse } from 'next/server'
import { getBsnMomentum } from '@/services/bsn-intelligence-engine.service'

export async function GET() {
  try {
    return NextResponse.json(await getBsnMomentum())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN momentum error',
      },
      { status: 500 }
    )
  }
}