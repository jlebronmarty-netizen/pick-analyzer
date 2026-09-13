// Read-only UI verification. Fixture HTML lives outside the repository and is never deployed.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
const base = process.env.MLB_UI_VALIDATION_URL
const output = process.env.MLB_UI_RENDER_DIR
assert(base && output && path.isAbsolute(output), 'Explicit URL and private output directory required')
fs.mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = [], errors = []
const sizes = [375, 390, 430, 768, 1440]
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (request.method() !== 'GET' || (url.protocol !== 'file:' && url.origin !== new URL(base).origin)) return route.abort()
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  for (const route of ['/today', '/mlb-value-board', '/data-health', '/mlb']) {
    const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 90000 })
    assert.equal(response.status(), 200, route)
    for (const width of sizes) {
      await page.setViewportSize({ width, height: 900 })
      for (const theme of ['dark', 'light']) {
        await page.evaluate(theme => { document.documentElement.classList.remove('pa-light', 'pa-dark'); document.documentElement.classList.add('pa-' + theme) }, theme)
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route}/${width}/${theme}: overflow`)
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
        results.push({ route, width, theme, violations: axe.violations.map(v => ({ id: v.id, count: v.nodes.length })) })
        if (width === 390 || width === 1440) await page.screenshot({ path: path.join(output, route.slice(1) + '-' + width + '-' + theme + '.png'), fullPage: width === 1440 })
      }
    }
    await page.setViewportSize({ width: 390, height: 844 })
    if (route === '/today') {
      const count = await page.locator('[data-game-card]').count()
      for (const name of ['All', 'Picks', 'Value', 'No Edge', 'Waiting', 'Started']) {
        const button = page.getByRole('button', { name, exact: true })
        await button.focus(); await page.keyboard.press('Enter')
        await assert.equal(await button.getAttribute('aria-pressed'), 'true')
      }
      await page.getByRole('button', { name: 'All', exact: true }).click()
      assert.equal(await page.locator('[data-game-card]').count(), count)
      assert.equal(await page.getByText('How to read this game', { exact: true }).count(), 0)
      const view = await (await context.request.get(base + '/api/mlb/operations')).json()
      assert.equal(view.providerCalls, 0); assert.equal(view.productionDml, 0)
      assert.equal(count, view.games.length, 'Canonical current slate parity')
      const summary = await page.locator('[data-slate-summary="Official Picks"]').innerText()
      assert.equal(Number(summary), view.board.rows.filter(r => (r.opportunity_status ?? r.status) === 'OFFICIAL_PICK').length)
      results.push({ canonicalGameCount: count, canonicalParity: 'PASS', keyboardFilters: 'PASS' })
    }
    if (route === '/mlb-value-board') {
      const view = await (await context.request.get(base + '/api/mlb/operations')).json()
      for (const status of ['OFFICIAL_PICK', 'VALUE_CANDIDATE', 'WATCHLIST', 'NO_EDGE', 'BLOCKED']) {
        assert.equal(Number(await page.locator(`[data-summary="${status}"]`).innerText()), view.board.rows.filter(r => (r.opportunity_status ?? r.status) === status).length)
      }
      results.push({ canonicalBoardParity: 'PASS' })
    }
    if (route === '/data-health') {
      const summary = page.getByText('Advanced Diagnostics', { exact: true })
      assert.equal(await summary.evaluate(el => el.parentElement.open), false)
      await summary.focus(); await page.keyboard.press('Enter')
      assert.equal(await summary.evaluate(el => el.parentElement.open), true)
      results.push({ diagnosticsKeyboard: 'PASS', defaultCollapsed: true })
    }
    if (route === '/mlb') assert(await page.getByRole('heading', { name: 'MLB Research Lab', exact: true, level: 1 }).isVisible())
  }
  if (process.env.MLB_UI_FIXTURE_RENDER_DIR) {
    for (const file of fs.readdirSync(process.env.MLB_UI_FIXTURE_RENDER_DIR).filter(f => f.endsWith('.html'))) {
      await page.goto('file:///' + path.join(process.env.MLB_UI_FIXTURE_RENDER_DIR, file).replaceAll('\\', '/'))
      for (const width of sizes) {
        await page.setViewportSize({ width, height: 900 })
        for (const theme of ['dark', 'light']) {
          await page.evaluate(theme => { document.documentElement.className = 'pa-' + theme }, theme)
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${file}/${width}/${theme}: overflow`)
          const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
          results.push({ fixture: file, width, theme, violations: axe.violations.map(v => ({ id: v.id, count: v.nodes.length })) })
        }
      }
    }
  }
  assert.deepEqual(errors, [], 'Browser errors')
  const violations = results.filter(r => r.violations?.length)
  fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ results, errors, violations }, null, 2))
  console.log(JSON.stringify({ checks: results.length, violations, errors, UI_CANONICAL_DATA_PARITY: 'PASS', providerCallsFromUi: 0 }))
  assert.equal(violations.length, 0, 'Accessibility violations')
} finally { await browser.close() }
