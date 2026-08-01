import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { archiveUserWager, authenticateUserWagerRequest, getUserWager, updateUserWager } from '@/services/user-wager-ledger.service'

function status(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 500
}

function code(httpStatus: number) {
  if (httpStatus === 401) return 'UNAUTHORIZED'
  if (httpStatus === 404) return 'NOT_FOUND'
  if (httpStatus === 400) return 'BAD_REQUEST'
  return 'INTERNAL_ERROR'
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request)
  try {
    const auth = await authenticateUserWagerRequest(request)
    const params = await context.params
    return apiOk(await getUserWager(auth, params.id), id)
  } catch (error) {
    const httpStatus = status(error)
    return apiError({ id, code: code(httpStatus), message: errorMessage(error, 'Unable to load user wager'), status: httpStatus })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request)
  try {
    const auth = await authenticateUserWagerRequest(request)
    const params = await context.params
    return apiOk(await updateUserWager(auth, params.id, await request.json()), id)
  } catch (error) {
    const httpStatus = status(error)
    return apiError({ id, code: code(httpStatus), message: errorMessage(error, 'Unable to update user wager'), status: httpStatus })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = requestId(request)
  try {
    const auth = await authenticateUserWagerRequest(request)
    const params = await context.params
    return apiOk(await archiveUserWager(auth, params.id), id)
  } catch (error) {
    const httpStatus = status(error)
    return apiError({ id, code: code(httpStatus), message: errorMessage(error, 'Unable to archive user wager'), status: httpStatus })
  }
}
