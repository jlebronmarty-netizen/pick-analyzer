import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3107)
const useExternalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === 'true'
const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() || `http://127.0.0.1:${port}`
const vercelOidcToken = process.env.VERCEL_GITHUB_OIDC_TOKEN?.trim()

export default defineConfig({
  testDir: './tests/product-experience',
  outputDir: './test-results/product-experience/playwright-artifacts',
  reporter: [
    ['list'],
    ['json', { outputFile: './test-results/product-experience/results.json' }],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    extraHTTPHeaders: vercelOidcToken
      ? { 'x-vercel-trusted-oidc-idp-token': vercelOidcToken }
      : undefined,
  },
  webServer: useExternalServer ? undefined : {
    command: `npm.cmd run start -- -p ${port}`,
    url: `http://127.0.0.1:${port}/api/system/version`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
