import { NextRequest, NextResponse } from 'next/server'
import { getBsnAiCoach } from '@/services/bsn-platform.service'

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('query') ?? ''
    return NextResponse.json(await getBsnAiCoach({ query }))
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN AI coach error',
      },
      { status: 500 }
    )
  }
}
