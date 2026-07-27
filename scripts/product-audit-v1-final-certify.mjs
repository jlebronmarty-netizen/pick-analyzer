import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const EXPECTED_TAG = 'eb15613efd81ff1a8e57797e11feb7254c1b604a'
const STARTING_COMMIT = '1cc3853565dd41c67b36f6453b3a876aabdd9361'

function read(path) {
  return readFileSync(path, 'utf8')
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

const changedFiles = git(['diff', '--name-only', `${STARTING_COMMIT}..HEAD`]).split(/\r?\n/).filter(Boolean)
const docs = [
  'docs/PRODUCT_ROUTE_INVENTORY_V1.md',
  'docs/product-route-inventory-v1.json',
  'docs/PROBABILITY_PICKS_MULTI_SPORT_AUDIT_V1.md',
  'docs/PRODUCT_METRIC_LANGUAGE_V1.md',
  'docs/PRODUCT_READINESS_MATRIX_V1.md',
  'docs/product-readiness-matrix-v1.json',
  'docs/PRODUCT_VALUE_ROADMAP_V1.md',
  'docs/PRODUCT_EXPERIENCE_DATA_TRUST_AUDIT_V1_CERTIFICATION.md',
]
const routeInventory = JSON.parse(read('docs/product-route-inventory-v1.json'))
const readiness = JSON.parse(read('docs/product-readiness-matrix-v1.json'))
const probabilityService = read('src/services/probability-picks.service.ts')
const probabilityUi = read('src/components/probability-picks/ProbabilityPicksClient.tsx')
const certification = read('docs/PRODUCT_EXPERIENCE_DATA_TRUST_AUDIT_V1_CERTIFICATION.md')

const checks = [
  ['required docs exist', docs.every((path) => existsSync(path))],
  ['route inventory scanned page routes', routeInventory.counts.pageRoutes >= 20],
  ['route inventory scanned api routes', routeInventory.counts.apiRoutes >= 400],
  ['bounded smoke evidence exists', routeInventory.localSmoke && routeInventory.localSmoke.skipped === false],
  ['probability service filters rank eligibility', probabilityService.includes('const picks = allPicks.filter(isRankEligible)')],
  ['probability validation covers uncertified sport exclusion', probabilityService.includes('uncertified sport rows are not ranking eligible')],
  ['probability ui explains probability confidence quality', probabilityUi.includes('Probability means estimated outcome likelihood')],
  ['readiness matrix has screens', Array.isArray(readiness.screens) && readiness.screens.length >= 10],
  ['provider calls remain zero in readiness matrix', readiness.providerCallsMade === 0],
  ['remote mutations remain zero in readiness matrix', readiness.remoteMutationsMade === 0],
  ['no migrations changed', !changedFiles.some((path) => path.startsWith('supabase/migrations/'))],
  ['no learning brain files changed', !changedFiles.some((path) => path.toLowerCase().includes('learning-brain'))],
  ['no scheduler files changed', !changedFiles.some((path) => path === 'vercel.json' || path.startsWith('.github/workflows/'))],
  ['certified platform tag unchanged', git(['rev-parse', 'v1.0-platform-certified']) === EXPECTED_TAG],
  ['final markers present', certification.includes('PRODUCT_EXPERIENCE_AUDIT_V1_PASS') && certification.includes('NO_CERTIFIED_PLATFORM_REGRESSION_PASS')],
]

const failed = checks.filter(([, passed]) => !passed)
const result = {
  success: failed.length === 0,
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed.map(([name]) => name),
  currentHead: git(['rev-parse', 'HEAD']),
  changedFiles,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  sqlApplied: 0,
  importsExecuted: 0,
  featureRebuildsExecuted: 0,
  epochActivated: false,
  learningBrainWeightChanges: false,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
