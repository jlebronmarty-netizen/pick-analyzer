import { NextResponse } from 'next/server'
import { answerAICopilotQuestion } from '@/services/ai-copilot-chat.service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const question = String(body.question ?? '').trim()

    if (!question) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing question',
        },
        { status: 400 }
      )
    }

    const result = await answerAICopilotQuestion(question)

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI copilot chat error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown AI copilot chat error',
      },
      { status: 500 }
    )
  }
}