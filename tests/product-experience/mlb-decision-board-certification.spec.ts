import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'mobile-375', width: 375, height: 667 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1440', width: 1440, height: 900 },
]

const certifiedCanaryEventId = 'baseball_mlb:mlb:sportsdataio:event:79431'
const certifiedProviderEventId = '35484b18fe129394ebc819752a8b92c1'

async function waitForReady(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)
  await expect(page.locator('body')).toBeVisible()
  await page.locator('main').getByText(/^Loading\b/i).first().waitFor({ state: 'detached', timeout: 30_000 }).catch(() => undefined)
}

async function horizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    document: Math.ceil(document.documentElement.scrollWidth - document.documentElement.clientWidth),
    body: Math.ceil(document.body.scrollWidth - document.body.clientWidth),
  }))
}

test.describe('MLB Decision Board protected-preview certification', () => {
  for (const viewport of viewports) {
    test(`renders without horizontal overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/mlb')
      await waitForReady(page)
      await expect(page.getByText('MLB Decision Board V1', { exact: true })).toBeVisible()
      await expect(page.getByText('SHADOW V1', { exact: true })).toBeVisible()
      const overflow = await horizontalOverflow(page)
      expect(overflow.document, JSON.stringify(overflow)).toBeLessThanOrEqual(2)
      expect(overflow.body, JSON.stringify(overflow)).toBeLessThanOrEqual(2)
    })
  }

  test('passes WCAG A/AA axe baseline on the MLB board', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/mlb')
    await waitForReady(page)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    await testInfo.attach('mlb-axe-results', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    })
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })

  test('supports keyboard focus and Player Props / Markets tabs', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/mlb')
    await waitForReady(page)
    await page.keyboard.press('Tab')
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      return {
        visible: rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight,
        focusVisible: (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none' || String(el.className).includes('focus'),
      }
    })
    expect(focus).not.toBeNull()
    expect(focus?.visible).toBe(true)
    expect(focus?.focusVisible).toBe(true)

    await page.getByRole('button', { name: 'Player Props' }).click()
    await expect(page.getByRole('button', { name: 'Player Props' })).toBeVisible()
    await page.getByRole('button', { name: 'Markets' }).click()
    await expect(page.getByRole('button', { name: 'Markets' })).toBeVisible()
  })

  test('Decision Board API preserves the shadow/read-only safety contract', async ({ request }) => {
    const response = await request.get('/api/mlb/decision-board')
    expect(response.ok()).toBe(true)
    const body = await response.json()
    expect(body.mode).toBe('mlb_decision_board_v1')
    expect(body.productionActivationEnabled).toBe(false)
    expect(body.summary?.betCount).toBe(0)
    expect(Array.isArray(body.props)).toBe(true)
    expect(Array.isArray(body.markets)).toBe(true)
    for (const item of [...(body.props ?? []), ...(body.markets ?? [])]) {
      expect(['LEAN', 'NO_BET', 'BLOCKED']).toContain(item.decision)
      expect(item.bestBook === null || ['FanDuel', 'Caesars'].includes(item.bestBook)).toBe(true)
      for (const quote of item.quotes ?? []) {
        expect(['FanDuel', 'Caesars']).toContain(quote.book)
        expect(Number.isFinite(quote.odds)).toBe(true)
      }
    }
  })

  test('bounded player-prop health read succeeds without provider calls or mutations', async ({ request }) => {
    const response = await request.get('/api/mlb/player-props/health')
    expect(response.ok()).toBe(true)
    const body = await response.json()
    expect(body.ingestion?.mode).toBe('mlb_player_prop_recent_ingestion_health_v1')
    expect(body.ingestion?.providerCallsMade).toBe(0)
    expect(body.ingestion?.remoteMutationsMade).toBe(0)
    expect(body.ingestion?.rowsRead).toBeGreaterThanOrEqual(14)
    expect(body.ingestion?.validation?.success).toBe(true)
  })

  test('certified canary rows are persisted, canonical, sportsbook-bounded and ineligible for Official Picks', async ({ request }) => {
    const response = await request.get(`/api/mlb/player-props/certification-snapshots?eventId=${encodeURIComponent(certifiedCanaryEventId)}`)
    expect(response.ok()).toBe(true)
    const body = await response.json()
    expect(body.readOnly).toBe(true)
    expect(body.eventId).toBe(certifiedCanaryEventId)
    expect(body.summary?.count).toBe(14)
    expect(body.summary?.providerEventIds).toEqual([certifiedProviderEventId])
    expect(Array.isArray(body.rows)).toBe(true)
    expect(body.rows).toHaveLength(14)
    for (const row of body.rows) {
      expect(row.sourceVersion).toBe('mlb_decision_board_player_prop_sync_v1')
      expect(row.providerEventId).toBe(certifiedProviderEventId)
      expect(row.market).toMatch(/^player_props:/)
      expect(['FanDuel', 'Caesars']).toContain(row.sportsbook)
      expect(row.officialPickEligible).toBe(false)
      expect(row.playerId).toBeTruthy()
      expect(row.playerName).toBeTruthy()
      expect(['over', 'under']).toContain(String(row.outcome).toLowerCase())
      expect(Number.isFinite(Number(row.price))).toBe(true)
      expect(Number.isFinite(Number(row.line))).toBe(true)
    }
  })
})
