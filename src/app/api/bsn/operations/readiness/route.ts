import { NextResponse } from 'next/server'
import { getBsnOperationsReadiness } from '@/services/bsn-platform.service'

export async function GET() {
  try {
    return NextResponse.json(await getBsnOperationsReadiness())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN operations readiness error',
      },
      { status: 500 }
    )
  }
}
