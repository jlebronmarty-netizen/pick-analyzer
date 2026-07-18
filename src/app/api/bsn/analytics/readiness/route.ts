import { NextResponse } from 'next/server'
import { getBsnAnalyticsReadiness } from '@/services/bsn-platform.service'

export async function GET() {
  try {
    return NextResponse.json(await getBsnAnalyticsReadiness())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN analytics readiness error',
      },
      { status: 500 }
    )
  }
}
