import { NextRequest, NextResponse } from 'next/server'
import { explainTopPicks } from '@/services/explainability.service'
import { explainPick } from '@/services/ai-pick-explainer.service'

export async function GET() {
  try {
    const result = await explainTopPicks()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Pick explainability error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown explainability error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const result = explainPick(body)

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI Pick Explainer error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to explain pick',
      },
      {
        status: 500,
      }
    )
  }
}