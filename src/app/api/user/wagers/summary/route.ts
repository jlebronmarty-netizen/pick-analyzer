import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { authenticateUserWagerRequest, summarizeUserWagers, userWagerErrorCode } from '@/services/user-wager-ledger.service'

function status(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 500
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const auth = await authenticateUserWagerRequest(request)
    return apiOk(await summarizeUserWagers(auth, request.nextUrl.searchParams), id)
  } catch (error) {
    const httpStatus = status(error)
    return apiError({
      id,
      code: userWagerErrorCode(error, httpStatus === 401 ? 'AUTH_REQUIRED' : 'UNKNOWN_REMOTE_ERROR'),
      message: errorMessage(error, 'Unable to summarize user wagers'),
      status: httpStatus,
    })
  }
}
