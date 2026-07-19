import { NextResponse } from 'next/server'
import { getBsnPerformanceCenter } from '@/services/bsn-model-maturity.service'

export async function GET() {
  try {
    const data = await getBsnPerformanceCenter()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN performance center error',
      },
      { status: 500 }
    )
  }
}
