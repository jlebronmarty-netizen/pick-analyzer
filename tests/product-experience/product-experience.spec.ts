import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

type Viewport = { name: string; width: number; height: number }
type RouteSpec = { name: string; path: string; main?: boolean; interactive?: boolean }

const viewports: Viewport[] = [
  { name: 'mobile-375', width: 375, height: 667 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1440', width: 1440, height: 900 },
]

const mainRoutes: RouteSpec[] = [
  { name: 'dashboard', path: '/dashboard', main: true, interactive: true },
  { name: 'game-intelligence', path: '/game-intelligence', main: true, interactive: true },
  { name: 'player-projections', path: '/player-projections', main: true, interactive: true },
  { name: 'performance', path: '/performance', main: true },
  { name: 'most-likely', path: '/most-likely', main: true, interactive: true },
  { name: 'best-value', path: '/best-value', main: true, interactive: true },
  { name: 'betting-workbench', path: '/betting-workbench', main: true, interactive: true },
  { name: 'ai-operations', path: '/ai-operations', main: true },
]

const detailRoutes: RouteSpec[] = [
  {
    name: 'game-detail',
    path: '/game-intelligence/baseball_mlb%3Amlb%3Asportsdataio%3Aevent%3A78846',
    interactive: true,
  },
  {
    name: 'player-detail',
    path: '/player-projections/baseball_mlb%3Abaseball_mlb_mlb_sportsdataio_event_78846%3Abaseball_mlb_mlb_sportsdataio_player_10008331%3Abatter_hits%3Amlb_player_projection_contract_v1%3A2026-07-25',
    interactive: true,
  },
]

const screenshotViewports = new Set(['mobile-390', 'tablet-768', 'desktop-1280'])
const axeRoutes = [...mainRoutes, ...detailRoutes]
const allRoutes = [...mainRoutes, ...detailRoutes]

function safeName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

async function waitForReady(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)
  await expect(page.locator('body')).toBeVisible()
  await page.locator('main').getByText(/^Loading\b/i).first().waitFor({ state: 'detached', timeout: 30_000 }).catch(() => undefined)
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentOverflow = Math.ceil(document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const bodyOverflow = Math.ceil(document.body.scrollWidth - document.body.clientWidth)
    const isInsideScrollableAncestor = (element: HTMLElement) => {
      let current: HTMLElement | null = element.parentElement
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current)
        const scrollable = (style.overflowX === 'auto' || style.overflowX === 'scroll') && current.scrollWidth > current.clientWidth
        if (scrollable) return true
        current = current.parentElement
      }
      return false
    }
    const offenders = Array.from(document.body.querySelectorAll<HTMLElement>('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.innerText || element.getAttribute('aria-label') || '').trim().slice(0, 80),
          left: Math.floor(rect.left),
          right: Math.ceil(rect.right),
          width: Math.ceil(rect.width),
          className: String(element.className || '').slice(0, 120),
          scrollRegion: isInsideScrollableAncestor(element),
        }
      })
      .filter((item) => item.width > 0 && !item.scrollRegion && (item.left < -2 || item.right > window.innerWidth + 2))
      .slice(0, 10)
    return { documentOverflow, bodyOverflow, offenders, width: window.innerWidth }
  })
  expect(overflow, JSON.stringify(overflow, null, 2)).toMatchObject({
    documentOverflow: expect.any(Number),
    bodyOverflow: expect.any(Number),
  })
  expect(overflow.documentOverflow, JSON.stringify(overflow, null, 2)).toBeLessThanOrEqual(2)
  expect(overflow.bodyOverflow, JSON.stringify(overflow, null, 2)).toBeLessThanOrEqual(2)
  expect(overflow.offenders, JSON.stringify(overflow, null, 2)).toHaveLength(0)
}

async function assertReadableInteractiveSurface(page: Page) {
  const focusableCount = await page.locator('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])').count()
  expect(focusableCount).toBeGreaterThan(0)
  const unnamed = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea'))
    return controls
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        href: element.getAttribute('href'),
        type: element.getAttribute('type'),
        text: (element.innerText || element.textContent || element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || '').trim(),
      }))
      .filter((item) => !item.text && item.type !== 'hidden')
      .slice(0, 10)
  })
  expect(unnamed, JSON.stringify(unnamed, null, 2)).toHaveLength(0)
}

async function assertFocusVisible(page: Page) {
  await page.keyboard.press('Tab')
  const focused = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    if (!element || element === document.body) return null
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    return {
      tag: element.tagName.toLowerCase(),
      text: (element.innerText || element.getAttribute('aria-label') || '').trim().slice(0, 80),
      visible: rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight,
      outline: style.outlineStyle !== 'none' && style.outlineWidth !== '0px',
      boxShadow: style.boxShadow !== 'none',
      ringishClass: String(element.className || '').includes('focus-visible') || String(element.className || '').includes('focus:'),
    }
  })
  expect(focused, 'Tab should move focus to a visible element').not.toBeNull()
  expect(focused?.visible, JSON.stringify(focused, null, 2)).toBe(true)
  expect(Boolean(focused?.outline || focused?.boxShadow || focused?.ringishClass), JSON.stringify(focused, null, 2)).toBe(true)
}

async function runAxe(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  await testInfo.attach('axe-results', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  })
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
}

test.describe('Phase 7 rendered viewport certification', () => {
  for (const viewport of viewports) {
    for (const route of allRoutes) {
      test(`${route.name} renders responsively at ${viewport.name}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto(route.path)
        await waitForReady(page)
        await expect(page).toHaveTitle(/Pick Analyzer|Create Next App/)
        await expect(page.locator('body')).toBeVisible()
        await expect(page.locator('main, [role="main"]').first()).toBeVisible()
        await assertNoHorizontalOverflow(page)
        await assertReadableInteractiveSurface(page)
        if (route.main && screenshotViewports.has(viewport.name)) {
          await page.screenshot({
            path: `test-results/product-experience/screenshots/${safeName(route.name)}-${viewport.name}.png`,
            fullPage: true,
          })
        }
        await testInfo.attach('viewport-result', {
          body: JSON.stringify({ route: route.path, viewport }, null, 2),
          contentType: 'application/json',
        })
      })
    }
  }

  for (const route of axeRoutes) {
    test(`${route.name} has no critical axe baseline violations`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto(route.path)
      await waitForReady(page)
      await runAxe(page, testInfo)
    })
  }

  test('keyboard navigation exposes visible focus on representative pages', async ({ page }) => {
    for (const route of ['/dashboard', '/game-intelligence', '/player-projections', '/most-likely']) {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(route)
      await waitForReady(page)
      await assertFocusVisible(page)
      await page.keyboard.press('Escape')
      await assertNoHorizontalOverflow(page)
    }
  })

  test('core rendered navigation links resolve without 404 or loops', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboard')
    await waitForReady(page)
    await page.getByRole('link', { name: /Game Intelligence|Open Game Center|Today's Games/i }).first().click()
    await waitForReady(page)
    expect(page.url()).toContain('/game-intelligence')

    await page.goto('/most-likely')
    await waitForReady(page)
    await page.getByRole('link', { name: /Open Game Center/i }).first().click()
    await waitForReady(page)
    expect(page.url()).toContain('/game-intelligence/')

    await page.goto('/player-projections')
    await waitForReady(page)
    const playerDetailLink = page.locator('a[href^="/player-projections/"]').first()
    if (await playerDetailLink.count()) {
      await playerDetailLink.click()
      await waitForReady(page)
      expect(page.url()).toContain('/player-projections/')
    } else {
      await expect(page.locator('main')).toContainText(/No player projections|Loading MLB player projections|Player projections failed/i)
    }
  })

  test('dashboard canonical viewmodel preserves product semantics', async ({ request }) => {
    const response = await request.get('/api/dashboard?mode=today')
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const viewModel = body.viewModel
    expect(viewModel?.contractVersion).toBe('dashboard_canonical_viewmodel_v1')
    const selectors = viewModel.selectors
    const diagnostics = viewModel.diagnostics

    expect(diagnostics.highestProjectedEqualsMaximumCanonicalProbability).toBe(true)
    expect(diagnostics.highestConfidenceUsesConfidenceField).toBe(true)
    expect(diagnostics.mostUncertainUsesNeutralDistance).toBe(true)
    expect(diagnostics.noComplementOutcomeBorrowsSourceOdds).toBe(true)
    expect(diagnostics.unknownEvValuesSerializedAsZero).toBe(0)
    expect(diagnostics.freshStaleContradictions).toBe(0)
    expect(diagnostics.invalidTotalLineSigns).toBe(0)

    if (selectors.highestRankedPricedMarket.status === 'AVAILABLE') {
      expect(selectors.highestRankedPricedMarket.directlyStoredPrice).toBe(true)
      expect(selectors.highestRankedPricedMarket.americanOdds).not.toBeNull()
      expect(selectors.highestRankedPricedMarket.impliedProbability).not.toBeNull()
    }

    if (selectors.bestAvailableValue.status !== 'AVAILABLE') {
      expect(selectors.bestAvailableValue.metricValue).toBeNull()
      expect(selectors.bestAvailableValue.blocker).toBeTruthy()
      expect(selectors.bestAvailableValue.rankingReason).toMatch(/candidates evaluated/i)
    }

    const badWaitingGames = (body.currentGameCards ?? []).filter((game: any) => (
      Number(game.storedOddsCount ?? 0) > 0 &&
      String(game.operationalStatus ?? '').toUpperCase() !== 'NO_ODDS_STORED' &&
      /waiting for odds/i.test(String(game.operationalStatus ?? game.bettingEligibility ?? ''))
    ))
    expect(badWaitingGames, JSON.stringify(badWaitingGames, null, 2)).toHaveLength(0)
  })
})
