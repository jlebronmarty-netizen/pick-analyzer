import { NextRequest, NextResponse } from 'next/server'
import { rollbackModelVersion } from '@/services/model-learning.service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const version = Number(body.version)

    if (!version) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing version',
        },
        {
          status: 400,
        }
      )
    }

    const result = await rollbackModelVersion(version)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Rollback failed',
      },
      {
        status: 500,
      }
    )
  }
}