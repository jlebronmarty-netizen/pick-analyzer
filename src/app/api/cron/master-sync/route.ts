import { NextResponse } from 'next/server'
import { runMasterSync } from '@/services/master-sync.service'
import { runSelfLearningEngine } from '@/services/self-learning-engine.service'
import { clearServerCache } from '@/lib/server-cache'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return true

  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const secret = url.searchParams.get('secret')

  return authHeader === `Bearer ${cronSecret}` || secret === cronSecret
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    const result = await runMasterSync()

    const selfLearning = await runSelfLearningEngine({
      sportKey: 'baseball_mlb',
      force: false,
    })

    clearServerCache()

    return NextResponse.json({
      success: result.success,
      message: 'Master sync completed',
      result,
      selfLearning,
    })
  } catch (error) {
    console.error('Master sync failed:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown master sync error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}