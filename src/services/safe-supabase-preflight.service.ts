import { supabaseAdmin } from '@/lib/supabase-admin'

export type SafePreflightError = {
  table: string
  column: string
  chunkIndex: number
  chunkSize: number
  message: string
}

export type SafePreflightResult = {
  existing: Set<string>
  inputCount: number
  sanitizedCount: number
  duplicateCount: number
  invalidCount: number
  emptyCount: number
  chunkCount: number
  errors: SafePreflightError[]
}

type SafePreflightOptions = {
  table: string
  column?: string
  values: unknown[]
  chunkSize?: number
  validate?: 'text' | 'uuid' | 'integer'
}

const DEFAULT_CHUNK_SIZE = 100
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeValue(value: unknown, validate: SafePreflightOptions['validate']) {
  if (value === null || value === undefined) return { value: null, empty: true, invalid: false }

  const normalized =
    typeof value === 'string'
      ? value.trim()
      : typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : ''

  if (!normalized) return { value: null, empty: true, invalid: false }
  if (validate === 'uuid' && !UUID_RE.test(normalized)) {
    return { value: null, empty: false, invalid: true }
  }
  if (validate === 'integer' && !/^-?\d+$/.test(normalized)) {
    return { value: null, empty: false, invalid: true }
  }

  return { value: normalized, empty: false, invalid: false }
}

export async function safeExistingValueSet({
  table,
  column = 'id',
  values,
  chunkSize = DEFAULT_CHUNK_SIZE,
  validate = 'text',
}: SafePreflightOptions): Promise<SafePreflightResult> {
  const existing = new Set<string>()
  const errors: SafePreflightError[] = []
  const seen = new Set<string>()
  const sanitized: string[] = []
  let emptyCount = 0
  let invalidCount = 0
  let duplicateCount = 0

  for (const raw of values) {
    const normalized = normalizeValue(raw, validate)
    if (normalized.empty) {
      emptyCount += 1
      continue
    }
    if (normalized.invalid || !normalized.value) {
      invalidCount += 1
      continue
    }
    if (seen.has(normalized.value)) {
      duplicateCount += 1
      continue
    }
    seen.add(normalized.value)
    sanitized.push(normalized.value)
  }

  const safeChunkSize = Math.max(1, Math.min(Math.floor(chunkSize), DEFAULT_CHUNK_SIZE))
  for (let index = 0; index < sanitized.length; index += safeChunkSize) {
    const chunk = sanitized.slice(index, index + safeChunkSize)
    const chunkIndex = Math.floor(index / safeChunkSize)
    const result = await supabaseAdmin.from(table).select(column).in(column, chunk)
    if (result.error) {
      errors.push({
        table,
        column,
        chunkIndex,
        chunkSize: chunk.length,
        message: result.error.message,
      })
      continue
    }
    for (const row of result.data ?? []) {
      const value = (row as unknown as Record<string, unknown>)[column]
      if (value !== null && value !== undefined) existing.add(String(value))
    }
  }

  return {
    existing,
    inputCount: values.length,
    sanitizedCount: sanitized.length,
    duplicateCount,
    invalidCount,
    emptyCount,
    chunkCount: Math.ceil(sanitized.length / safeChunkSize),
    errors,
  }
}
