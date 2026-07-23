import { NextResponse } from 'next/server'
import { loadBsnModelMaturity } from '@/lib/server-lazy-diagnostics'

export async function GET() {
  try {
    const { getBsnActivationAudit } = await loadBsnModelMaturity()
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
