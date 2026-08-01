import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { authenticateUserWagerRequest, createUserWager, listUserWagers } from '@/services/user-wager-ledger.service'

function status(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 500
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const auth = await authenticateUserWagerRequest(request)
    return apiOk(await listUserWagers(auth, request.nextUrl.searchParams), id)
  } catch (error) {
    const httpStatus = status(error)
    return apiError({
      id,
      code: httpStatus === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unable to list user wagers'),
      status: httpStatus,
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const auth = await authenticateUserWagerRequest(request)
    return apiOk(await createUserWager(auth, await request.json()), id, { status: 201 })
  } catch (error) {
    const httpStatus = status(error)
    return apiError({
      id,
      code: httpStatus === 401 ? 'UNAUTHORIZED' : httpStatus === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unable to create user wager'),
      status: httpStatus,
    })
  }
}
