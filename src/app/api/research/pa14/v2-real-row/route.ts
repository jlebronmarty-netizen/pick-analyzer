import { NextResponse } from 'next/server'

import { materializePa14V2RealBazRow } from '@/services/pa14-v2-real-evidence.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  try {
    const result = await materializePa14V2RealBazRow()
    return NextResponse.json(result, {
      status: result.certificationCandidate ? 200 : 409,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        researchOnly: true,
        productionEligible: false,
        contractReady: false,
        certificationCandidate: false,
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    )
  }
}
