import { NextResponse } from 'next/server'
import {
  runDailySportsPipeline,
  runDailySyncOrchestratorV2,
} from '@/services/daily-pipeline.service'

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

    const url = new URL(request.url)
    const version = url.searchParams.get('version')
    const dryRunParam = url.searchParams.get('dryRun')
    const providerCallBudget = Number(url.searchParams.get('providerCallBudget') ?? 0)
    const timeoutMs = Number(url.searchParams.get('timeoutMs') ?? 15000)
    const result =
      version === '2' || version === 'v2'
        ? await runDailySyncOrchestratorV2({
            dryRun: dryRunParam === null ? true : dryRunParam !== 'false',
            providerCallBudget: Number.isFinite(providerCallBudget) ? providerCallBudget : 0,
            resumeFromStep: url.searchParams.get('resumeFromStep'),
            cancelAfterStep: url.searchParams.get('cancelAfterStep'),
            timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
          })
        : await runDailySportsPipeline()

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
