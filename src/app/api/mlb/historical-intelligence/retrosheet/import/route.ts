import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runRetrosheetControlledImport } from '@/services/retrosheet-controlled-import.service'

export async function POST(request: NextRequest) {
  const id = requestId(request)
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret')

  if (!expected || provided !== expected) {
    return apiError({
      id,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
      status: 401,
    })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { mode?: string | null }
    const mode = body.mode === 'import' || body.mode === 'validate' ? body.mode : 'dry_run'
    const result = await runRetrosheetControlledImport({ mode })
    return apiOk(result, id)
  } catch (error) {
    console.error('Retrosheet controlled import error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Retrosheet controlled import error'),
    })
  }
}
