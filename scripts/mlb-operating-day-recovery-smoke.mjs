import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { spawn } from 'node:child_process'

const execFileAsync = promisify(execFile)
const port = Number(process.env.SMOKE_PORT ?? 3048)
const totalTimeoutMs = Number(process.env.SMOKE_TOTAL_TIMEOUT_MS ?? 180000)
const routeTimeoutMs = Number(process.env.SMOKE_ROUTE_TIMEOUT_MS ?? 20000)
const baseUrl = `http://127.0.0.1:${port}`
const routes = [
  '/dashboard',
  '/ai-operations',
  '/autonomous-daily-ai',
  '/probability-picks',
  '/performance',
  '/sports-center/mlb',
  '/market-intelligence',
  '/api/dashboard?mode=today&includeValidation=true',
  '/api/current-board',
  '/api/probability-picks',
  '/api/operations/status',
  '/api/operations/adaptive-refresh?dryRun=true',
  '/api/mlb/odds/coverage',
  '/api/mlb/predictions/health',
  '/api/mlb/predictions/validation',
]

let server = null
let cleaned = false

function stamp(message) {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

async function getPortOwner() {
  const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp'], { timeout: 10000 })
  const line = stdout.split(/\r?\n/).find((row) => row.includes(`:${port}`) && row.includes('LISTENING'))
  if (!line) return null
  return Number(line.trim().split(/\s+/)[4])
}

async function killTree(pid, label) {
  if (!pid || Number.isNaN(pid)) return
  stamp(`TASKKILL START ${label} pid=${pid}`)
  try {
    await execFileAsync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { timeout: 10000 })
    stamp(`TASKKILL END ${label}`)
  } catch (error) {
    stamp(`TASKKILL ERROR ${label}: ${error.message}`)
  }
}

async function cleanup() {
  if (cleaned) return
  cleaned = true
  stamp('CLEANUP START')
  if (server?.pid) await killTree(server.pid, 'server-root')
  const owner = await getPortOwner().catch(() => null)
  if (owner) await killTree(owner, 'port-owner')
  const remaining = await getPortOwner().catch(() => null)
  stamp(`CLEANUP END portFree=${remaining === null}`)
}

async function fetchBounded(route, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const start = Date.now()
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: route.includes('/api/operations/adaptive-refresh') ? { accept: 'application/json' } : {},
    })
    const text = await response.text()
    return {
      route,
      statusCode: response.status,
      ok: response.status >= 200 && response.status < 500,
      elapsedMs: Date.now() - start,
      bytes: text.length,
      timeout: false,
      error: null,
    }
  } catch (error) {
    return {
      route,
      statusCode: error.name === 'AbortError' ? 'TIMEOUT' : 'ERROR',
      ok: false,
      elapsedMs: Date.now() - start,
      bytes: 0,
      timeout: error.name === 'AbortError',
      error: error.message,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function waitForReady() {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    stamp(`READINESS START ${baseUrl}/api/system/version`)
    const result = await fetchBounded('/api/system/version', 5000)
    stamp(`READINESS END status=${result.statusCode}`)
    if (result.statusCode === 200) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('readiness timeout')
}

const watchdog = setTimeout(async () => {
  stamp('WATCHDOG TIMEOUT')
  await cleanup()
  process.exit(124)
}, totalTimeoutMs)

const startedAt = Date.now()
try {
  stamp(`MLB RECOVERY SMOKE START port=${port}`)
  const preOwner = await getPortOwner()
  if (preOwner) throw new Error(`port ${port} already in use by PID ${preOwner}`)
  stamp('SERVER START BEGIN')
  server = spawn('cmd.exe', ['/c', 'npm.cmd', 'run', 'start', '--', '-p', String(port), '-H', '127.0.0.1'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  stamp(`SERVER START END pid=${server.pid}`)
  await waitForReady()

  const results = []
  for (const route of routes) {
    stamp(`ROUTE START ${route}`)
    const result = await fetchBounded(route, routeTimeoutMs)
    stamp(`ROUTE END ${route} status=${result.statusCode} elapsedMs=${result.elapsedMs}`)
    results.push(result)
  }

  const failed = results.filter((result) => !result.ok)
  const report = {
    success: failed.length === 0,
    mode: 'mlb_operating_day_recovery_smoke_v1',
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    routes: results,
    failedRoutes: failed,
  }
  console.log(JSON.stringify(report, null, 2))
  if (!report.success) process.exitCode = 1
} catch (error) {
  console.log(JSON.stringify({
    success: false,
    mode: 'mlb_operating_day_recovery_smoke_v1',
    error: error.message,
    elapsedMs: Date.now() - startedAt,
  }, null, 2))
  process.exitCode = 1
} finally {
  clearTimeout(watchdog)
  await cleanup()
}
