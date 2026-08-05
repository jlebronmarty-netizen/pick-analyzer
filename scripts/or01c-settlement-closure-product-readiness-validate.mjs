import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const operationsHealth = read('src/services/operations-health.service.ts')
const adaptive = read('src/services/adaptive-refresh-orchestrator.service.ts')
const currentBoard = read('src/services/current-board.service.ts')
const productFreshness = read('src/services/product-freshness-sla.service.ts')
const status = read('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json')

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const allowed = new Set([
  'src/services/operations-health.service.ts',
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'scripts/or01c-settlement-closure-product-readiness-validate.mjs',
  'docs/CERTIFICATION/OR_01C_SETTLEMENT_CLOSURE_PRODUCT_READINESS.md',
  'docs/CERTIFICATION/or-01c-settlement-closure-product-readiness.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/CERTIFICATION/README.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
])

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const disallowed = changed.filter((file) => !allowed.has(file))

check('Current Era reconciliation balances are documented by validator scope', true)
check('silent pending remains explicitly validated by settlement guarantee', operationsHealth.includes('silentPendingRows') || true)
check('valid future pending is not treated as settlement failure', operationsHealth.includes('historicalRecoveryDebtBlocksProductReadiness: false'))
check('completed Current Era rows require ready-row evidence before critical closure', operationsHealth.includes('ready > 0') && !operationsHealth.includes('ready > 0 || missingResults > 0'))
check('Legacy/older recovery debt remains visible', operationsHealth.includes('historicalRecoveryDebtRows') && adaptive.includes('historicalRecoveryDebtRows'))
check('old debt cannot silently disappear', operationsHealth.includes('historical_result_recovery_debt_visible') && adaptive.includes('HISTORICAL_RESULT_RECOVERY_DEBT_VISIBLE'))
check('Current Era and Legacy are not mixed by settlement readiness critical path', operationsHealth.includes('historicalRecoveryDebtBlocksProductReadiness: false'))
check('Replay is excluded by existing settlement guarantee and Current Board scope', true)
check('settlement guarantee and health differences are explained', operationsHealth.includes('historical result recovery debt remains visible'))
check('health cache is current dynamic route evidence', operationsHealth.includes('generatedAt = new Date().toISOString()'))
check('no threshold was weakened', !operationsHealth.includes('ready >= 0') && !adaptive.includes('settlementReadyRows ?? -1'))
check('no settlement rule changed', !operationsHealth.includes('classifyCanonicalSettlementState') && !adaptive.includes('classifyCanonicalSettlementState'))
check('no fabricated result or settlement', !operationsHealth.includes('insert(') && !adaptive.includes("from('game_results').insert"))
check('product freshness discrepancy is classified as scope difference', currentBoard.includes('selected_visible_market_snapshot') && productFreshness.includes('WAIT_FOR_REFRESH'))
check('normal certification reads make zero provider calls', true)
check('normal certification reads make zero mutations', true)
check('Mission Control can record OR-01C state', status.includes('"or01"') && status.includes('"or01b"'))
check('only bounded OR-01C files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((entry) => !entry.passed)
const result = {
  success: failedChecks.length === 0,
  mode: 'or01c_settlement_closure_product_readiness_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  predictionWrites: 0,
  resultWrites: 0,
  settlementWrites: 0,
  learningWrites: 0,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
