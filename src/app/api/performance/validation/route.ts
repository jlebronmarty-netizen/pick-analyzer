import { NextResponse } from 'next/server'
import { validateAiBrain } from '@/services/ai-performance-center.service'

export async function GET() {
  try {
    return NextResponse.json(await validateAiBrain())
  } catch (error) {
    return NextResponse.json({ success: false, apiStatus: 'ERROR', error: error instanceof Error ? error.message : 'Unknown AI Brain validation error' }, { status: 500 })
  }
}
