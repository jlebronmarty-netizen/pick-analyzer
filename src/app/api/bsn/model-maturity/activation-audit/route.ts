import { NextResponse } from 'next/server'
import { getBsnActivationAudit } from '@/services/bsn-model-maturity.service'

export async function GET() {
  try {
    const data = await getBsnActivationAudit()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN activation audit error',
      },
      { status: 500 }
    )
  }
}
