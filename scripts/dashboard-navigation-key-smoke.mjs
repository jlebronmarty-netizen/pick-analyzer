import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { chromium } from '@playwright/test'

const execFileAsync = promisify(execFile)
const port = Number(process.env.SMOKE_PORT ?? 3048)
const totalTimeoutMs = Number(process.env.SMOKE_TOTAL_TIMEOUT_MS ?? 120000)
const baseUrl = `http://127.0.0.1:${port}`
const startedAt = Date.now()
let server = null
let browser = null
let exiting = false

function stamp(message) {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

async function getPortOwner() {
  const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp'])
  const line = stdout.split(/\r?\n/).find((row) => row.includes(`:${port}`) && row.includes('LISTENING'))
  if (!line) return null
  const parts = line.trim().split(/\s+/)
  return Number(parts[4])
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
  if (exiting) return
  exiting = true
  stamp('CLEANUP START')
  if (browser) {
    await browser.close().catch(() => {})
  }
  if (server?.pid) {
    await killTree(server.pid, 'server-root')
  }
  const owner = await getPortOwner().catch(() => null)
  if (owner) {
    await killTree(owner, 'port-owner')
  }
  const remaining = await getPortOwner().catch(() => null)
  stamp(`CLEANUP END portFree=${remaining === null}`)
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function waitForReady() {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    stamp(`READINESS CHECK START ${baseUrl}/api/system/version`)
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/system/version`, 5000)
      stamp(`READINESS CHECK END status=${response.status}`)
      if (response.status === 200) return
    } catch (error) {
      stamp(`READINESS CHECK END error=${error.name}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('readiness timeout')
}

const watchdog = setTimeout(async () => {
  stamp('WATCHDOG TIMEOUT')
  await cleanup()
  process.exit(124)
}, totalTimeoutMs)

try {
  stamp('DASHBOARD NAV KEY SMOKE START')
  const preOwner = await getPortOwner()
  if (preOwner) throw new Error(`port ${port} already in use by PID ${preOwner}`)

  stamp('SERVER START BEGIN')
  server = (await import('node:child_process')).spawn(
    'cmd.exe',
    ['/c', 'npm.cmd', 'run', 'start', '--', '-p', String(port), '-H', '127.0.0.1'],
    { stdio: 'ignore', windowsHide: true },
  )
  stamp(`SERVER START END pid=${server.pid}`)
  await waitForReady()

  const consoleFindings = []
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('console', (message) => {
    const text = message.text()
    if (/same key|unique "key"|hydration|hydrated/i.test(text)) {
      consoleFindings.push({ type: message.type(), text })
    }
  })

  stamp('ROUTE START /dashboard')
  const response = await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 })
  stamp(`ROUTE END /dashboard status=${response?.status() ?? 'NO_RESPONSE'}`)
  await page.waitForTimeout(500)

  const result = {
    success: (response?.status() ?? 0) === 200 && consoleFindings.length === 0,
    route: '/dashboard',
    statusCode: response?.status() ?? null,
    duplicateKeyWarnings: consoleFindings,
    elapsedMs: Date.now() - startedAt,
  }
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exitCode = 1
} catch (error) {
  console.log(JSON.stringify({
    success: false,
    route: '/dashboard',
    error: error.message,
    elapsedMs: Date.now() - startedAt,
  }, null, 2))
  process.exitCode = 1
} finally {
  clearTimeout(watchdog)
  await cleanup()
}
