export type RetryPolicy = {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  jitterRatio: number
  timeoutMs: number
  retryableStatuses: number[]
}

export type CircuitBreakerState = {
  key: string
  failures: number
  openedAt: string | null
  status: 'closed' | 'open' | 'half_open'
}

export type RecordResult<T> = {
  id: string
  success: boolean
  data?: T
  error?: string
  attempts: number
}

export type CursorContract = {
  cursor: string | null
  nextCursor: string | null
  hasMore: boolean
  pageSize: number
}

const DEFAULT_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5000,
  jitterRatio: 0.2,
  timeoutMs: 15000,
  retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitter(ms: number, ratio: number) {
  const spread = ms * ratio
  return Math.max(0, Math.round(ms - spread + Math.random() * spread * 2))
}

export function getDefaultRetryPolicy(overrides: Partial<RetryPolicy> = {}) {
  return {
    ...DEFAULT_POLICY,
    ...overrides,
    retryableStatuses:
      overrides.retryableStatuses ?? DEFAULT_POLICY.retryableStatuses,
  }
}

export function getRetryDelayMs(attempt: number, policy = DEFAULT_POLICY) {
  const exponential = policy.baseDelayMs * 2 ** Math.max(0, attempt - 1)
  return jitter(Math.min(exponential, policy.maxDelayMs), policy.jitterRatio)
}

export function isRetryableStatus(status: number, policy = DEFAULT_POLICY) {
  return policy.retryableStatuses.includes(status)
}

export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs = DEFAULT_POLICY.timeoutMs
) {
  let timeout: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function retryWithBackoff<T>(
  work: (attempt: number) => Promise<T>,
  policy = DEFAULT_POLICY
) {
  let lastError: unknown

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return {
        success: true as const,
        data: await withTimeout(work(attempt), policy.timeoutMs),
        attempts: attempt,
      }
    } catch (error) {
      lastError = error
      if (attempt === policy.maxAttempts) break
      await delay(getRetryDelayMs(attempt, policy))
    }
  }

  return {
    success: false as const,
    error: lastError instanceof Error ? lastError.message : 'Unknown retry error',
    attempts: policy.maxAttempts,
  }
}

export async function runBoundedConcurrency<T, R>({
  items,
  concurrency,
  worker,
}: {
  items: T[]
  concurrency: number
  worker: (item: T, index: number) => Promise<R>
}) {
  const results: R[] = []
  const executing = new Set<Promise<void>>()
  const safeConcurrency = Math.max(1, Math.min(concurrency, 25))

  for (let index = 0; index < items.length; index += 1) {
    const task = Promise.resolve()
      .then(() => worker(items[index], index))
      .then((result) => {
        results[index] = result
      })
      .finally(() => {
        executing.delete(task)
      })

    executing.add(task)

    if (executing.size >= safeConcurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)

  return results
}

export async function runPerRecord<T extends { id?: string }, R>({
  records,
  worker,
  policy = DEFAULT_POLICY,
  concurrency = 5,
}: {
  records: T[]
  worker: (record: T) => Promise<R>
  policy?: RetryPolicy
  concurrency?: number
}): Promise<{
  success: boolean
  results: RecordResult<R>[]
  inserted: number
  failed: number
}> {
  const results = await runBoundedConcurrency({
    items: records,
    concurrency,
    worker: async (record, index) => {
      const result = await retryWithBackoff(() => worker(record), policy)

      return {
        id: record.id ?? String(index),
        success: result.success,
        data: result.success ? result.data : undefined,
        error: result.success ? undefined : result.error,
        attempts: result.attempts,
      }
    },
  })

  const failed = results.filter((item) => !item.success).length

  return {
    success: failed === 0,
    results,
    inserted: results.length - failed,
    failed,
  }
}

export function updateCircuitBreaker({
  state,
  success,
  failureThreshold = 5,
}: {
  state: CircuitBreakerState
  success: boolean
  failureThreshold?: number
}): CircuitBreakerState {
  if (success) {
    return {
      ...state,
      failures: 0,
      openedAt: null,
      status: 'closed',
    }
  }

  const failures = state.failures + 1

  return {
    ...state,
    failures,
    openedAt:
      failures >= failureThreshold
        ? state.openedAt ?? new Date().toISOString()
        : state.openedAt,
    status: failures >= failureThreshold ? 'open' : state.status,
  }
}

export function createCursorContract({
  cursor = null,
  nextCursor = null,
  pageSize,
  returned,
}: {
  cursor?: string | null
  nextCursor?: string | null
  pageSize: number
  returned: number
}): CursorContract {
  return {
    cursor,
    nextCursor,
    hasMore: Boolean(nextCursor) || returned >= pageSize,
    pageSize,
  }
}

export function idempotencyKey(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => String(part ?? '').trim().toLowerCase())
    .join(':')
    .replace(/[^a-z0-9:_-]+/g, '-')
}

export async function getSyncReliabilityStatus() {
  const policy = getDefaultRetryPolicy()
  const breaker = updateCircuitBreaker({
    state: {
      key: 'sample-provider',
      failures: 4,
      openedAt: null,
      status: 'closed',
    },
    success: false,
  })
  const cursor = createCursorContract({
    cursor: null,
    nextCursor: 'page-2',
    pageSize: 25,
    returned: 25,
  })
  const deterministicRecordRun = await runPerRecord({
    records: [{ id: 'ok-1' }, { id: 'fail-1' }],
    concurrency: 2,
    policy: getDefaultRetryPolicy({ maxAttempts: 1, timeoutMs: 1000 }),
    worker: async (record) => {
      if (record.id === 'fail-1') throw new Error('deterministic failure')
      return { processed: record.id }
    },
  })

  return {
    success: true,
    mode: 'sync_reliability_framework_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_local_self_test',
    },
    primitives: {
      boundedConcurrency: true,
      retryWithExponentialBackoff: true,
      jitter: true,
      timeout: true,
      retryableStatusHandling: true,
      circuitBreakerState: true,
      partialSuccessReporting: true,
      perRecordIsolation: true,
      cursorContracts: true,
      idempotencyKeys: true,
    },
    defaultPolicy: policy,
    sampleRetryDelays: [1, 2, 3].map((attempt) =>
      getRetryDelayMs(attempt, getDefaultRetryPolicy({ jitterRatio: 0 }))
    ),
    retryableStatuses: policy.retryableStatuses.map((status) => ({
      status,
      retryable: isRetryableStatus(status),
    })),
    sampleCircuitBreaker: breaker,
    sampleCursor: cursor,
    sampleIdempotencyKey: idempotencyKey([
      'basketball_nba',
      'event',
      'the-odds-api',
      '123',
    ]),
    deterministicRecordRun,
    integrationStatus:
      'Framework primitives are available. Existing sync services should adopt them incrementally when touched.',
  }
}
