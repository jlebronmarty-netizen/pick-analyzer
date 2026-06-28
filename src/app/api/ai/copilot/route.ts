import { NextResponse } from 'next/server'
import { getAICopilot } from '@/services/ai-copilot.service'

export async function GET() {
  try {
    const result = await getAICopilot()

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI copilot error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown AI copilot error',
      },
      { status: 500 }
    )
  }
}