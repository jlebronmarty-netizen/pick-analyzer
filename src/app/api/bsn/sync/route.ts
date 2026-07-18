import { NextRequest, NextResponse } from 'next/server'
import { runBsnSyncPlan } from '@/services/bsn-platform.service'

export async function GET() {
  try {
    const data = await runBsnSyncPlan({ dryRun: true, confirmed: false })

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const data = await runBsnSyncPlan({
      dryRun: body?.dryRun ?? true,
      confirmed: body?.confirmed === true,
      idempotencyKey: body?.idempotencyKey ?? null,
    })

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
