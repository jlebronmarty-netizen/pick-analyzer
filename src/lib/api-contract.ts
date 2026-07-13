import { NextResponse } from 'next/server'

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'

export type ApiFailure = {
  success: false
  requestId: string
  error: {
    code: ApiErrorCode
    message: string
  }
}

export function requestId(request?: Request) {
  return (
    request?.headers.get('x-request-id') ??
    request?.headers.get('x-correlation-id') ??
    crypto.randomUUID()
  )
}

export function withRequestId<T extends Record<string, unknown>>(
  payload: T,
  id: string
) {
  return {
    ...payload,
    requestId: id,
  }
}

export function apiOk<T extends Record<string, unknown>>(
  payload: T,
  id: string,
  init?: ResponseInit
) {
  return NextResponse.json(withRequestId(payload, id), init)
}

export function apiError({
  id,
  code,
  message,
  status = 500,
}: {
  id: string
  code: ApiErrorCode
  message: string
  status?: number
}) {
  return NextResponse.json<ApiFailure>(
    {
      success: false,
      requestId: id,
      error: {
        code,
        message,
      },
    },
    { status }
  )
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function parseIntegerParam({
  value,
  fallback,
  min,
  max,
}: {
  value: string | null
  fallback: number
  min: number
  max: number
}) {
  const parsed = Number(value ?? fallback)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.round(parsed), min), max)
}

export function parseBooleanParam(value: string | null, fallback = false) {
  if (value === null) return fallback
  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false
  return fallback
}
