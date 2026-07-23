import { NextResponse } from 'next/server'
import { getAiLearningLifecycle } from '@/services/ai-learning-lifecycle.service'

export async function GET() {
  try {
    const lifecycle = await getAiLearningLifecycle()
    return NextResponse.json(lifecycle)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        mode: 'ai_learning_lifecycle_v1',
        error: error instanceof Error ? error.message : 'Unknown AI learning lifecycle error',
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      { status: 500 }
    )
  }
}
