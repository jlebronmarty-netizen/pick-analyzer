import { NextResponse } from 'next/server'
import { runModelLearning } from '@/services/model-learning.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sportKey = searchParams.get('sport') ?? 'baseball_mlb'

    const result = await runModelLearning(sportKey)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Model learning error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown model learning error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}