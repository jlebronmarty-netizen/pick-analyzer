import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const shell = read('src/components/dashboard/DashboardShell.tsx')
const probability = read('src/components/probability-picks/ProbabilityPicksClient.tsx')
const performance = read('src/components/performance/PerformanceProductClient.tsx')
const playerProjections = read('src/components/dashboard/MlbPlayerProjectionsPanel.tsx')
const aiOperations = read('src/app/ai-operations/page.tsx')
const helper = read('src/components/product/ProductStatus.tsx')
const docs = read('docs/PRODUCT_NAVIGATION_FRESHNESS_HARDENING_V1.md')

for (const label of ['Primary', 'Opportunities', 'Analysis', 'Performance', 'Operations', 'More']) {
  check(`navigation group ${label}`, shell.includes(`label: '${label}'`))
}

for (const route of ['/dashboard', '/probability-picks', '/most-likely', '/best-value', '/performance', '/sports-center', '/player-projections', '/ai-operations']) {
  check(`navigation route ${route}`, shell.includes(`href: '${route}'`))
}

check('shared status badge helper present', helper.includes('ProductStatusBadge'))
check('shared status banner helper present', helper.includes('ProductStatusBanner'))
check('shared timestamp helper present', helper.includes('productDateTime'))
check('sport readiness helper present', helper.includes('sportReadinessLabel'))

check('probability projection-only banner', probability.includes('Projection Only') && (probability.includes('does not attach sportsbook lines') || probability.includes('does not attach market prices')))
check('probability empty state explains why', probability.includes('Why: either no eligible MLB row meets the selected thresholds'))
check('parlay empty state explains filters', probability.includes('sport eligibility and correlation limits'))
check('probability timestamps use helper', probability.includes('productDateTime(pick.generatedAt)'))

check('performance uses shared timestamp helper', performance.includes('productDateTime(value)'))
check('performance sport readiness labels', performance.includes('sportReadinessLabel(sport.sportKey)'))
check('performance empty state explains why', performance.includes('Why: either this sport has not accumulated eligible settled results'))
check('performance product preview label', performance.includes('Preview Rows'))

check('player projections no recommendation banner', playerProjections.includes('No Recommendation'))
check('player projections data as of timestamp', playerProjections.includes('Data As Of'))
check('player projections blocker empty state explains source', playerProjections.includes('stored projection checks'))

check('ai operations last updated label', aiOperations.includes('Last Updated:'))
check('ai operations shared timestamp helper', aiOperations.includes('productDateTime(panel.lastUpdated'))

for (const marker of [
  'PRODUCT_NAVIGATION_V1_PASS',
  'PRODUCT_FRESHNESS_STANDARDIZATION_PASS',
  'PRODUCT_EMPTY_STATE_PASS',
  'PRODUCT_LANGUAGE_PASS',
  'PRODUCT_STATUS_BADGES_PASS',
  'PRODUCT_CONSISTENCY_PASS',
  'PRODUCT_READABILITY_PASS',
  'NO_PROBABILITY_CHANGE_PASS',
  'NO_MODEL_CHANGE_PASS',
  'NO_LEARNING_CHANGE_PASS',
  'NO_DATABASE_MUTATION_PASS',
  'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
]) {
  check(`doc marker ${marker}`, docs.includes(marker))
}

const changedFiles = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const forbiddenPatterns = [
  /^src\/services\//,
  /^supabase\/migrations\//,
  /^src\/app\/api\//,
]

const forbidden = changedFiles.filter((file) => forbiddenPatterns.some((pattern) => pattern.test(file.replaceAll('\\', '/'))))
check('no services api or migration files changed', forbidden.length === 0, forbidden.join(', '))

const failed = checks.filter((item) => !item.passed)
console.log(JSON.stringify({ success: failed.length === 0, checks, changedFiles }, null, 2))
if (failed.length) process.exit(1)
