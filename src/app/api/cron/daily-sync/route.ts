import { NextResponse } from 'next/server'
import { runDailySportsPipeline } from '@/services/daily-pipeline.service'

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')

    if (cronSecret) {
      const expectedHeader = `Bearer ${cronSecret}`

      if (authHeader !== expectedHeader) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
          },
          { status: 401 }
        )
      }
    }

    const result = await runDailySportsPipeline()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Daily sync cron error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error',
      },
      { status: 500 }
    )
  }
}