import { NextRequest, NextResponse } from 'next/server'
import { loadNbaPredictionSettlement } from '@/lib/server-lazy-diagnostics'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  const authHeader = request.headers.get('authorization')
  const { searchParams } = new URL(request.url)
  return authHeader === `Bearer ${cronSecret}` || searchParams.get('secret') === cronSecret
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { eventId } = await params
    const { settleNbaPredictions } = await loadNbaPredictionSettlement()
    const result = await settleNbaPredictions(eventId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA event settlement failed',
      },
      { status: 500 }
    )
  }
}
