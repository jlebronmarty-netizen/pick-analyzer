import { NextRequest, NextResponse } from 'next/server'
import { validateBsnManualEntry } from '@/services/bsn-platform.service'

export async function GET() {
  return NextResponse.json(validateBsnManualEntry({ type: 'note' }))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    return NextResponse.json(validateBsnManualEntry(body))
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN admin validation error',
      },
      { status: 500 }
    )
  }
}
