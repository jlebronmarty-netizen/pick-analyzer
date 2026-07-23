import { NextResponse } from 'next/server'
import { loadBsnModelMaturity } from '@/lib/server-lazy-diagnostics'

export async function GET() {
  try {
    const { getBsnModelMaturity } = await loadBsnModelMaturity()
    const data = await getBsnModelMaturity()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN model maturity error',
      },
      { status: 500 }
    )
  }
}
