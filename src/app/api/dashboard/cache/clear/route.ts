import { NextResponse } from 'next/server'
import { clearServerCache } from '@/lib/server-cache'

export async function POST() {
  try {
    clearServerCache()

    return NextResponse.json({
      success: true,
      message: 'Dashboard cache cleared.',
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown cache error',
      },
      { status: 500 }
    )
  }
}