import { NextResponse } from 'next/server'
import { loadBsnModelMaturity } from '@/lib/server-lazy-diagnostics'

export async function GET() {
  try {
    const { getBsnPerformanceCenter } = await loadBsnModelMaturity()
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
