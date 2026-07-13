type CacheEntry<T> = {
  expiresAt: number
  value: T
}

const cache = new Map<string, CacheEntry<unknown>>()

type Options = {
  timeoutMs?: number
  ttlMs?: number
  retries?: number
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function resilientFetchJson<T>(
  key: string,
  url: string,
  options: Options = {}
): Promise<T | null> {
  const timeoutMs = options.timeoutMs ?? 2000
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000
  const retries = options.retries ?? 0

  const cached = cache.get(key)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()

    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
      })

      clearTimeout(timer)

      if (!response.ok) {
        throw new Error(`${response.status}`)
      }

      const json = (await response.json()) as T

      cache.set(key, {
        value: json,
        expiresAt: Date.now() + ttlMs,
      })

      return json
    } catch {
      clearTimeout(timer)

      if (attempt < retries) {
        await sleep(250)
      }
    }
  }

  return null
}