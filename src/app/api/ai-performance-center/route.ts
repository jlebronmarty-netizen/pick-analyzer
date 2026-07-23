import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenterLazy } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  try {
    const sportKey = request.nextUrl.searchParams.get('sportKey')
    const data = await getAiPerformanceCenterLazy({ sportKey })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown AI Performance Center error',
      },
      { status: 500 }
    )
  }
}
