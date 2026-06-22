import { NextResponse } from 'next/server'
import { settlePredictions } from '@/services/prediction-settlement.service'

export async function GET() {
  try {
    const result = await settlePredictions()

    return NextResponse.json({
      success: true,
      message: 'Prediction settlement completed',
      result,
    })
  } catch (error) {
    console.error('Prediction settlement failed:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown settlement error',
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  return GET()
}