import { NextResponse } from 'next/server'
import { loadBsnModelMaturity } from '@/lib/server-lazy-diagnostics'

export async function GET() {
  try {
    const { getBsnExplanationEngine } = await loadBsnModelMaturity()
    const data = await getBsnExplanationEngine()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN explanation engine error',
      },
      { status: 500 }
    )
  }
}
