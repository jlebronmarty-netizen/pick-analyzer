import { NextResponse } from 'next/server'
import { runAutoModelTuning } from '@/services/model-learning.service'

export async function POST() {
  try {
    const result = await runAutoModelTuning()

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Auto tuning failed',
      },
      {
        status: 500,
      }
    )
  }
}

export async function GET() {
  return POST()
}