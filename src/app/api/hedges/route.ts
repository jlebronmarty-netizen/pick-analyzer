import { NextResponse } from 'next/server'
import { buildHedges } from '@/services/hedge-builder.service'

export async function GET() {
  try {
    const result =
      await buildHedges()

    return NextResponse.json(
      result
    )
  } catch (error) {
    console.error(
      'Hedge builder error:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown hedge error',
      },
      {
        status: 500,
      }
    )
  }
}