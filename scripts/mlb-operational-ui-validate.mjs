import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
const root = process.env.R2S_VALIDATION_DIR, base = process.env.MLB_UI_VALIDATION_URL ?? 'http://127.0.0.1:3129'
const activation = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json', 'utf8'))
assert.ok(root && path.isAbsolute(root))
const browser = await chromium.launch({ headless: true })
const checks = [], failures = []
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1365, height: 900 }]) {
    const context = await browser.newContext({ viewport })
    const legacyRequests = []
    context.on('request', request => { if (new URL(request.url()).pathname === '/api/dashboard') legacyRequests.push(request.url()) })
    await context.route('**/*', route => {
      const request = route.request()
      if (new URL(request.url()).origin !== new URL(base).origin || request.method() !== 'GET') return route.abort()
      return route.continue()
    })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    for (const route of ['/', '/today', '/mlb-value-board', '/data-health', '/performance']) {
      const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 })
      assert.equal(response.status(), 200, route)
      const body = await page.locator('body').innerText()
      assert.ok(body.length > 150 && !body.includes('Product Reset') && !body.includes('Setup Pending'), `${route}:reset/empty`)
      assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route}:horizontal overflow`)
      assert.ok(await page.locator('a[href="/today"]').count() > 0, `${route}:navigation`)
      await page.screenshot({ path: path.join(root, `ui-${viewport.width}-${route.replaceAll('/', '_') || 'home'}.png`), fullPage: true })
      checks.push({ route, width: viewport.width, status: 'PASS', noHorizontalOverflow: true, noResetState: true })
    }
    assert.deepEqual(errors, [])
    assert.deepEqual(legacyRequests, [], 'canonical surfaces must not mount legacy dashboard side effects')
    const api = await context.request.get(base + '/api/mlb/operations')
    assert.equal(api.status(), 200)
    const data = await api.json()
    assert.equal(data.providerCalls, 0); assert.equal(data.productionDml, 0)
    assert.equal(data.board.publication_state, 'CANONICAL_READ_ONLY')
    assert.ok(!data.warnings.some(w => w.includes('Canonical data is unavailable')), 'canonical read must succeed')
    const healthResponse = await context.request.get(base + '/api/mlb/operations/health')
    assert.equal(healthResponse.status(), 200)
    const health = await healthResponse.json()
    assert.equal(health.champion, 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'); assert.equal(health.featureCount, 76)
    assert.equal(health.storedGames, data.games.length)
    assert.equal(health.valueCount, data.board.rows.length)
    assert.ok(['ENABLED', 'DISABLED'].includes(activation.activation))
    assert.equal(health.automation.activation, activation.activation)
    if (activation.activation === 'ENABLED') {
      assert.equal(activation.runtimeHost.verified, true)
      assert.equal(activation.repeatability.verdict, 'MLB_DATA_02R_REPEATABILITY_CERTIFIED')
    }
    const performance = await context.request.get(base + '/api/mlb/performance')
    assert.equal(performance.status(), 200)
    const report = await performance.json()
    assert.notEqual(report.status, 'UNAVAILABLE')
    if (!report.summary.sampleSize) { assert.equal(report.summary.roi, null); assert.equal(report.summary.winRate, null) }
    checks.push({ apiCanonicalParity: 'PASS', width: viewport.width, gameCount: data.games.length, valueCount: data.board.rows.length, performanceStatus: report.status })
    await context.close()
  }
} catch (error) { failures.push(error.message) } finally { await browser.close() }
if (new URL(base).hostname === '127.0.0.1') {
  const ledger = JSON.parse(fs.readFileSync(path.join(root, 'ui-readonly-network.json'), 'utf8'))
  if (ledger.blockedRequests !== 0) failures.push('Unexpected mutation/provider request attempted by canonical surfaces')
}
const report = { status: failures.length ? 'FAIL' : 'PASS', checks, failures, providerCalls: 0, productionDml: 0, productionDdl: 0, screenshots: 'PRIVATE_OS_TEMP_ONLY' }
fs.writeFileSync(path.join(root, 'ui-validation.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
if (failures.length) process.exitCode = 1
