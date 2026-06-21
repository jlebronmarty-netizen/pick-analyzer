import { NextResponse } from 'next/server'
import { testSportsApiProviders } from '@/services/apis/api-factory'

export async function GET() {
  try {
    const result = await testSportsApiProviders()

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown provider test error'

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}