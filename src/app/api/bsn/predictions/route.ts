import { NextResponse } from 'next/server'
import { generateBsnPredictions } from '@/services/bsn-predictions.service'

export async function GET() {
  try {
    const data = await generateBsnPredictions({ saveHistory: true })

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN prediction error',
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  return GET()
}