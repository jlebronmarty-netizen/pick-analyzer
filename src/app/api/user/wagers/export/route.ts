import { NextRequest, NextResponse } from 'next/server'
import { apiError, errorMessage, requestId } from '@/lib/api-contract'
import { authenticateUserWagerRequest, exportUserWagers, userWagerErrorCode } from '@/services/user-wager-ledger.service'

function status(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 500
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const auth = await authenticateUserWagerRequest(request)
    const exported = await exportUserWagers(auth, request.nextUrl.searchParams)
    return new NextResponse(exported.body, {
      headers: {
        'content-type': exported.contentType,
        'x-request-id': id,
      },
    })
  } catch (error) {
    const httpStatus = status(error)
    return apiError({
      id,
      code: userWagerErrorCode(error, httpStatus === 401 ? 'AUTH_REQUIRED' : 'UNKNOWN_REMOTE_ERROR'),
      message: errorMessage(error, 'Unable to export user wagers'),
      status: httpStatus,
    })
  }
}
