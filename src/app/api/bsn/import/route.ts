import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { validateBsnSourceInput } from '@/services/bsn-platform.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const sourceId = request.nextUrl.searchParams.get('sourceId') ?? 'bsn_csv_import'
    return apiOk(
      validateBsnSourceInput({
        sourceId,
        mode: 'validate',
        rows: [],
      }),
      id
    )
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown BSN import plan error') })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    return apiOk(validateBsnSourceInput({ ...body, mode: body?.mode ?? 'dry_run' }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown BSN import validation error') })
  }
}
