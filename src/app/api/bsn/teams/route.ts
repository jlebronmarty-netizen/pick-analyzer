import { NextResponse } from 'next/server'
import { getBsnTeams } from '@/services/bsn.service'

export async function GET() {
  try {
    const data = await getBsnTeams()
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