type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

export async function serverCache<T>({
  key,
  ttlMs,
  loader,
}: {
  key: string
  ttlMs: number
  loader: () => Promise<T>
}): Promise<T> {
  const current = cache.get(key)

  if (current && current.expiresAt > Date.now()) {
    return current.value as T
  }

  const value = await loader()

  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  })

  return value
}

export function clearServerCache(key?: string) {
  if (key) {
    cache.delete(key)
    return
  }

  cache.clear()
}