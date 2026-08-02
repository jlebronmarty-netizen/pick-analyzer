import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const checks = []

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const productService = read('src/services/product-freshness-sla.service.ts')
const currentBoard = read('src/services/current-board.service.ts')
const dashboardToday = read('src/services/dashboard-today.service.ts')
const marketSuite = read('src/services/market-opportunity-suite.service.ts')
const bestValue = read('src/services/best-value-scanner.service.ts')
const aiFinder = read('src/services/ai-bet-finder.service.ts')
const gameIntel = read('src/services/game-intelligence.service.ts')
const operationsCenter = read('src/services/mlb-operations-center.service.ts')
const homePlan = read('src/components/home/HomeBettingPlan.tsx')
const workspace = read('src/components/market-opportunities/BettingDecisionWorkspace.tsx')
const mostLikely = read('src/components/market-opportunities/MostLikelyTool.tsx')
const bestValueTool = read('src/components/market-opportunities/BestValueTool.tsx')
const changedFiles = execSync('git diff --name-only', { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

check('product freshness service exists', exists('src/services/product-freshness-sla.service.ts'))
check('contract version declared', productService.includes('product_freshness_sla_v1'))
check('fresh status declared', productService.includes("'FRESH'"))
check('aging status declared', productService.includes("'AGING'"))
check('stale status declared', productService.includes("'STALE'"))
check('future timestamp blocks', productService.includes("'INVALID_FUTURE'") && productService.includes('MARKET_TIMESTAMP_IN_FUTURE'))
check('post start blocks', productService.includes("'POST_START'") && productService.includes('POST_START_PREGAME_MARKET_BLOCKED'))
check('missing timestamp unavailable', productService.includes("'UNAVAILABLE'") && productService.includes('MARKET_TIMESTAMP_UNAVAILABLE'))
check('page time is explicitly rejected', productService.includes('pageFetchTimeUsedAsMarketTime: false'))
check('generatedAt is explicitly rejected', productService.includes('generatedAtUsedAsMarketTime: false'))
check('decision critical surfaces exist', productService.includes('rent_play') && productService.includes('moneyline_bet') && productService.includes('smart_parlay') && productService.includes('official_pick'))
check('current board evaluates SLA', currentBoard.includes('evaluateProductFreshnessSla') && currentBoard.includes('productFreshnessSla'))
check('current board uses market source timestamp', currentBoard.includes('marketTimestamp: marketSourceTimestamp'))
check('current board exports empty fallback', currentBoard.includes('emptyCurrentBoardProductFreshnessSla'))
check('today dashboard maps SLA', dashboardToday.includes('productFreshnessStatus') && dashboardToday.includes('productFreshnessActionability'))
check('most likely exposes SLA', marketSuite.includes('productFreshness: candidate.surfaceFreshness.mostLikely'))
check('parlay uses stalest-leg policy', marketSuite.includes('stalest_required_leg_limits_parlay'))
check('best value exposes SLA', bestValue.includes('candidate.surfaceFreshness.bestValue'))
check('AI finder exposes SLA', aiFinder.includes('productFreshness: candidate.surfaceFreshness.bettingWorkspace'))
check('game intelligence exposes SLA', gameIntel.includes('candidate.surfaceFreshness.gameIntelligence'))
check('operations center exposes SLA', operationsCenter.includes('product_freshness_sla_v1') && operationsCenter.includes('productFreshnessSla'))
check('homepage displays actionability', homePlan.includes('freshnessActionability'))
check('workspace gates stale actions', workspace.includes('WAIT_FOR_REFRESH') && workspace.includes('freshnessBlocked'))
check('Most Likely UI displays SLA', mostLikely.includes('Freshness SLA') && mostLikely.includes('Actionability'))
check('Best Value UI displays SLA', bestValueTool.includes('Freshness SLA') && bestValueTool.includes('Market Time'))

const forbiddenRuntimeFiles = [
  'src/services/recommendation-eligibility-policy.service.ts',
  'src/services/settlement-guarantee.service.ts',
  'src/services/operating-day.service.ts',
  'src/services/canonical-acquisition-execution.service.ts',
]
for (const file of forbiddenRuntimeFiles) {
  check(`forbidden runtime file not modified by OE-003F: ${file}`, !changedFiles.includes(file))
}

const failed = checks.filter((item) => !item.passed)
const result = {
  success: failed.length === 0,
  mode: 'oe003f_product_freshness_sla_validation_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
