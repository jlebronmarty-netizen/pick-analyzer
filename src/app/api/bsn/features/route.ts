import { NextResponse } from 'next/server'
import { getBsnGeneratedFeatures } from '@/services/bsn-intelligence-engine.service'

export async function GET() {
  try {
    return NextResponse.json(await getBsnGeneratedFeatures())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN features error',
      },
      { status: 500 }
    )
  }
}