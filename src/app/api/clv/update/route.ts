import { NextResponse } from 'next/server'
import { updateClosingLineValue } from '@/services/clv.service'

export async function GET() {
  try {
    const result = await updateClosingLineValue()

    return NextResponse.json(result)
  } catch (error) {
    console.error('CLV update error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown CLV update error',
      },
      { status: 500 }
    )
  }
}