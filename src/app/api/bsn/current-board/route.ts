import { NextResponse } from 'next/server'
import { getBsnCurrentBoardReadiness } from '@/services/bsn-platform.service'

export async function GET() {
  try {
    return NextResponse.json(await getBsnCurrentBoardReadiness())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN Current Board readiness error',
      },
      { status: 500 }
    )
  }
}
