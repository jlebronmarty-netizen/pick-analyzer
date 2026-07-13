import { NextResponse } from 'next/server'
import {
  getLatestModelVersion,
  getModelHistory,
  getModelVersionComparison,
} from '@/services/model-versioning.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const sportKey = searchParams.get('sportKey') ?? 'baseball_mlb'
    const limit = Number(searchParams.get('limit') ?? 20)

    const [latest, history, comparison] = await Promise.all([
      getLatestModelVersion(sportKey),
      getModelHistory(sportKey, limit),
      getModelVersionComparison(sportKey),
    ])

    return NextResponse.json({
      success: true,
      sportKey,
      latest,
      history,
      comparison,
      count: history.length,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Model versions failed:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown model versions error',
      },
      { status: 500 }
    )
  }
}