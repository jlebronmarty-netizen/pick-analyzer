import { NextResponse } from 'next/server'
import { validateAiBrainLazy } from '@/lib/server-lazy-diagnostics'

export async function GET() {
  try {
    return NextResponse.json(await validateAiBrainLazy())
  } catch (error) {
    return NextResponse.json({ success: false, apiStatus: 'ERROR', error: error instanceof Error ? error.message : 'Unknown AI Brain validation error' }, { status: 500 })
  }
}
