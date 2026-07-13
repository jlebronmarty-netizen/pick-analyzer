import { NextRequest, NextResponse } from 'next/server'
import { runSelfLearningEngine } from '@/services/self-learning-engine.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    const result = await runSelfLearningEngine({
      sportKey: body?.sportKey ?? 'baseball_mlb',
      force: Boolean(body?.force),
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Self learning failed',
      },
      {
        status: 500,
      }
    )
  }
}

export async function GET() {
  const result = await runSelfLearningEngine({
    sportKey: 'baseball_mlb',
    force: false,
  })

  return NextResponse.json(result)
}