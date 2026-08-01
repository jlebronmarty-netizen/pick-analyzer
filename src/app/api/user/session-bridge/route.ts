import { NextRequest, NextResponse } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { authenticateUserWagerRequest, userWagerBearerToken, userWagerErrorCode, userWagerSessionCookieName } from '@/services/user-wager-ledger.service'

function status(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 500
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const token = userWagerBearerToken(request)
    if (!token) {
      return apiError({ id, code: 'AUTH_REQUIRED', message: 'Authentication required for session bridge.', status: 401 })
    }
    const auth = await authenticateUserWagerRequest(request)
    const response = apiOk({
      version: 'release14a1.session-bridge.v1',
      userId: auth.userId,
      bridged: true,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }, id)
    response.cookies.set(userWagerSessionCookieName, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    })
    return response
  } catch (error) {
    const httpStatus = status(error)
    return apiError({
      id,
      code: userWagerErrorCode(error, httpStatus === 401 ? 'AUTH_VERIFICATION_FAILED' : 'UNKNOWN_REMOTE_ERROR'),
      message: errorMessage(error, 'Unable to establish authenticated API session bridge'),
      status: httpStatus,
    })
  }
}

export async function DELETE(request: NextRequest) {
  const id = requestId(request)
  const response = NextResponse.json({
    version: 'release14a1.session-bridge.v1',
    bridged: false,
    requestId: id,
  })
  response.cookies.set(userWagerSessionCookieName, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
