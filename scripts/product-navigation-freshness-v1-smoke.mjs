const port = Number(process.env.PRODUCT_NAV_SMOKE_PORT ?? 3047)
const baseUrl = process.env.PRODUCT_NAV_SMOKE_BASE_URL ?? `http://127.0.0.1:${port}`
const defaultRoutes = [
  '/api/system/version',
  '/dashboard',
  '/probability-picks',
  '/performance',
  '/player-projections',
  '/api/current-board',
  '/ai-operations',
]
const routes = (process.env.PRODUCT_NAV_SMOKE_ROUTES ?? '')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean)
if (!routes.length) routes.push(...defaultRoutes)

const routeTimeoutMs = Number(process.env.PRODUCT_NAV_SMOKE_ROUTE_TIMEOUT_MS ?? 12_000)
const totalTimeoutMs = Number(process.env.PRODUCT_NAV_SMOKE_TOTAL_TIMEOUT_MS ?? 90_000)

async function routeCheck(route) {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), routeTimeoutMs)
  try {
    const response = await fetch(`${baseUrl}${route}`, { signal: controller.signal, cache: 'no-store' })
    const body = await Promise.race([
      response.text(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('body timeout')), routeTimeoutMs)),
    ])
    return {
      route,
      status: response.status,
      ok: response.status >= 200 && response.status < 400,
      timedOut: false,
      bytes: String(body).length,
      ms: Date.now() - started,
    }
  } catch (error) {
    return {
      route,
      status: 'TIMEOUT_OR_ERROR',
      ok: false,
      timedOut: true,
      bytes: 0,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timer)
  }
}

const watchdog = setTimeout(() => {
  console.log(JSON.stringify({
    success: false,
    baseUrl,
    routes: [],
    error: `HTTP-only smoke exceeded ${totalTimeoutMs}ms`,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }, null, 2))
  process.exit(1)
}, totalTimeoutMs)

try {
  const results = []
  for (const route of routes) results.push(await routeCheck(route))
  const failed = results.filter((result) => !result.ok)
  console.log(JSON.stringify({
    success: failed.length === 0,
    mode: 'HTTP_ONLY_EXISTING_SERVER',
    baseUrl,
    routes: results,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }, null, 2))
  process.exitCode = failed.length ? 1 : 0
} finally {
  clearTimeout(watchdog)
}
