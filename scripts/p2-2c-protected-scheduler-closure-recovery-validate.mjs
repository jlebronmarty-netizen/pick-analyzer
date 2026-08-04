import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const orchestrator = read('src/services/adaptive-refresh-orchestrator.service.ts')
const budget = read('src/services/provider-budget.service.ts')
const route = read('src/app/api/cron/operating-day/route.ts')
const p22bValidator = read('scripts/p2-2b-current-era-closure-investigation-validate.mjs')

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const allowed = new Set([
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'src/services/provider-budget.service.ts',
  'scripts/p2-2c-protected-scheduler-closure-recovery-validate.mjs',
  'scripts/p2-2b-current-era-closure-investigation-validate.mjs',
  'scripts/p2-2-new-epoch-daily-closure-validate.mjs',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
  'scripts/p2-1a-canonical-market-prediction-granularity-validate.mjs',
  'scripts/p2-1-supported-market-coverage-validate.mjs',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'scripts/p1-3-production-evaluation-policy-validate.mjs',
  'scripts/p1-2-e2e-system-integrity-validate.mjs',
  'scripts/mission-control-v1-validate.mjs',
  'docs/CERTIFICATION/P2_2C_PROTECTED_SCHEDULER_CLOSURE_RECOVERY.md',
  'docs/CERTIFICATION/p2-2c-protected-scheduler-closure-recovery.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
])

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const disallowed = changed.filter((file) => !allowed.has(file))

check(
  'sync_results remains mapped to MLB Stats API',
  orchestrator.includes("if (action === 'status_refresh' || action === 'sync_results') return 'mlb_stats_api'")
)
check(
  'protected route maps budget denial to HTTP 409',
  route.includes('BUDGET_BLOCKED: 409') && route.includes("status: CRON_STATUS_HTTP[adaptiveStatus]")
)
check(
  'MLB Stats API provider is normalized',
  budget.includes("if (['mlb-stats-api', 'mlbstatsapi', 'mlb-stats'].includes(value)) return 'mlb-stats-api'")
)
check(
  'MLB Stats API has explicit budget profile',
  budget.includes("providerId: 'mlb-stats-api'") &&
    budget.includes("providerDisplayName: 'MLB Stats API'") &&
    budget.includes("largestConsumer: 'operating_day_result_sync'")
)
check(
  'MLB Stats API uses bounded HTTP request cost model',
  budget.includes("normalized === 'sportsdataio' || normalized === 'mlb-stats-api'") &&
    budget.includes("actionKey.includes('sync_results')") &&
    budget.includes("Math.min(3")
)
check(
  'unknown budget still fails closed for truly unknown providers',
  budget.includes("result = 'DENY_UNKNOWN_BUDGET'") &&
    budget.includes('UNKNOWN_BUDGET_FAILS_CLOSED')
)
check(
  'concurrency lock remains enabled',
  orchestrator.includes('claimProviderActionLock(lockKey, 8 * 60 * 1000)') &&
    orchestrator.includes('duplicate_or_overlapping_run_blocked')
)
check(
  'internal settlement action does not inherit provider-call budget demand',
  orchestrator.includes("const internalAction = ['settle', 'lock', 'replay', 'calibrate'].includes(String(action))") &&
    orchestrator.includes('requestedCalls: requestedProviderCalls')
)
check(
  'successful write-producing execution continues as changed work',
  orchestrator.includes('result.success && remoteMutationsMade > 0') &&
    orchestrator.includes("? 'SUCCESS_CHANGED'")
)
check(
  'settlement eligibility still requires authoritative game_results',
  orchestrator.includes('function isAuthoritativeSettlementResult') &&
    orchestrator.includes('result.home_score !== null && result.away_score !== null')
)
check(
  'P2.2B prior-date result sync repair remains present',
  orchestrator.includes('function isPriorDateResultImportCandidate') &&
    p22bValidator.includes('prior-date result-sync classifier exists') &&
    p22bValidator.includes('missing-result backlog uses prior-date classifier')
)
check(
  'only bounded P2.2C files changed',
  disallowed.length === 0,
  disallowed.join(', ')
)

const failedChecks = checks.filter((entry) => !entry.passed)
const result = {
  success: failedChecks.length === 0,
  mode: 'p2_2c_protected_scheduler_closure_recovery_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
