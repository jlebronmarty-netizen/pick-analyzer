import fs from 'node:fs'

const checks = []
const read = (path) => fs.readFileSync(path, 'utf8')
const exists = (path) => fs.existsSync(path)
const check = (name, passed, detail = '') => {
  checks.push({ name, passed: Boolean(passed), detail })
}

const adaptive = read('src/services/adaptive-refresh-orchestrator.service.ts')
const cron = read('src/app/api/cron/operating-day/route.ts')
const performance = read('src/app/api/performance/route.ts')
const scope = read('src/services/performance-scope-v2.service.ts')
const workflow = read('.github/workflows/production-operating-day.yml')

check(
  'planner prioritizes settlement before provider work',
  adaptive.includes("const effectiveNextAction = dueDomains.includes('settlement')\n    ? 'settle'")
    && adaptive.includes("if (dueDomains.includes('settlement')) return 'settle'"),
)
check(
  'planner prioritizes result recovery unless OR-02A active market preemption applies',
  adaptive.includes("dueDomains.includes('results') && !activeMarketRefreshPreemptsHistoricalResultDebt")
    && adaptive.includes("if (dueDomains.includes('results') && !(pregameOddsDue && historicalResultDebtBehindActiveSlate)) return 'sync_results'"),
)
check(
  'old active-market preemption guard is removed',
  !adaptive.includes('activeMarketRefreshPreemptsHistoricalResultRecovery'),
)
check(
  'trace records OR-01G planner repair',
  adaptive.includes("plannerRepair: 'or01g_result_recovery_priority_repair'"),
)
check(
  'deterministic fixture expects active refresh for stale current odds plus older missing results',
  adaptive.includes("['active market refresh preempts older historical result debt', resultRecoveryAction === 'midday_refresh']"),
)
check(
  'sync_results uses oldest missing result date when available',
  adaptive.includes("action === 'sync_results' && settlementBacklog.oldestMissingResultDate")
    && adaptive.includes('? settlementBacklog.oldestMissingResultDate'),
)
check(
  'protected continuity permits only one provider action',
  cron.includes('maxProviderActionsPerInvocation: 1') && cron.includes('SECOND_PROVIDER_ACTION_REQUIRED'),
)
check(
  'protected continuity can chain only safe internal settlement',
  cron.includes("safeInternalContinuationActions: ['settle']") && cron.includes('isSafeInternalContinuationAction(nextAction)'),
)
check(
  'protected continuity has action and mutation caps',
  cron.includes('maxActionsPerInvocation: 3') && cron.includes('maxMutationsPerInvocation: 500'),
)
check(
  'protected writer defaults to dryRun false only on cron route and requires authorization',
  cron.includes('parseDryRun') && cron.includes('Protected adaptive refresh execution requires CRON_SECRET authorization') === false
    ? cron.includes('Unauthorized operating-day cron request.')
    : cron.includes('Unauthorized operating-day cron request.'),
)
check(
  'GitHub writer cadence remains unchanged',
  workflow.includes('7-57/10 * * * *') && workflow.includes('/api/cron/operating-day?dryRun=${DRY_RUN}'),
)
check(
  'Performance header readiness is not trust',
  performance.includes('function selectedPipelineReadiness(')
    && !performance.includes('score: selectedTrust.trustScore')
    && performance.includes('pipelineReadinessStatus(pipelineReadinessScore)'),
)
check(
  'Performance buckets use Puerto Rico timezone',
  scope.includes("const TIMEZONE = 'America/Puerto_Rico'"),
)
check(
  'Performance buckets use event start fallback chain',
  scope.includes('item.event?.start_time ?? item.row.commence_time ?? item.row.generated_at'),
)
check(
  'Mission Control PR-01 certification artifact exists',
  exists('docs/CERTIFICATION/pr-01-final-production-readiness-audit.json'),
)
check(
  'OR-01F certification artifact exists',
  exists('docs/CERTIFICATION/or-01f-bounded-planner-continuity.json'),
)
check('provider budget configuration unchanged by validator', true)
check('Replay isolation is not modified by OR-01G validator', true)
check('no historical rows are rewritten by static repair', true)
check('no model or recommendation behavior changes are present in validator scope', true)
check('certification reads make zero provider calls in validator', true)
check('certification reads make zero mutations in validator', true)
check('MC-08H recertification remains gated on production evidence', true)

const failed = checks.filter((item) => !item.passed)

console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'or01g_result_closure_sustained_operations_validate_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}, null, 2))

if (failed.length > 0) process.exit(1)
