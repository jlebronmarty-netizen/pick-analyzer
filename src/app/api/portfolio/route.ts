import { NextResponse } from 'next/server'
import { buildPortfolios } from '@/services/portfolio-builder.service'

export async function GET() {
  try {
    const result = await buildPortfolios()

    return NextResponse.json(result)
  } catch (error) {
    console.error(
      'Portfolio builder error:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown portfolio error',
      },
      {
        status: 500,
      }
    )
  }
}