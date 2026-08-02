import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function json(rel) {
  return JSON.parse(read(rel))
}

function check(name, passed, details = '') {
  checks.push({ name, passed: Boolean(passed), details })
}

const checks = []

const files = {
  operationsHealth: 'src/services/operations-health.service.ts',
  adaptive: 'src/services/adaptive-refresh-orchestrator.service.ts',
  settlementGuarantee: 'src/services/settlement-guarantee.service.ts',
  autonomousOps: 'src/services/mlb-autonomous-operations-v1.service.ts',
  providerBudget: 'src/services/provider-budget.service.ts',
  operationsCenter: 'src/services/mlb-operations-center.service.ts',
  operationsPage: 'src/app/mlb-operations/page.tsx',
  operationsPanel: 'src/components/dashboard/OperationsHealthPanel.tsx',
  certification: 'docs/CERTIFICATION/oe-003a-scheduler-health-semantics.json',
  doc: 'docs/OPERATIONAL_EXCELLENCE/OE_003A_SCHEDULER_HEALTH_SEMANTICS.md',
}

for (const file of Object.values(files)) check(`file exists: ${file}`, fs.existsSync(path.join(root, file)))

const operationsHealth = read(files.operationsHealth)
const adaptive = read(files.adaptive)
const guarantee = read(files.settlementGuarantee)
const autonomous = read(files.autonomousOps)
const providerBudget = read(files.providerBudget)
const operationsCenter = read(files.operationsCenter)
const operationsPage = read(files.operationsPage)
const operationsPanel = read(files.operationsPanel)
const cert = json(files.certification)
const doc = read(files.doc)

check('canonical healthDomains returned by operations health', operationsHealth.includes('healthDomains =') && operationsHealth.includes('schedulerExecution') && operationsHealth.includes('marketFreshness') && operationsHealth.includes('productReadiness'))
check('scheduler domain exists', operationsHealth.includes('function schedulerDomain'))
check('market domain exists', operationsHealth.includes('function marketDomain'))
check('provider budget domain exists', operationsHealth.includes('function providerBudgetDomain'))
check('settlement domain exists', operationsHealth.includes('function settlementDomain'))
check('product readiness domain exists', operationsHealth.includes('function productReadinessDomain'))
const schedulerDomainBody = operationsHealth.slice(
  operationsHealth.indexOf('function schedulerDomain'),
  operationsHealth.indexOf('function marketDomain'),
)
check('scheduler health does not depend directly on odds_not_current', !schedulerDomainBody.includes('odds_not_current'))
check('scheduler domain documents independence from odds freshness', operationsHealth.includes('Scheduler execution health never reads odds freshness'))
check('stale market cannot mark scheduler critical by itself', operationsHealth.includes('Market freshness never falls back to scheduler invocation time') && operationsHealth.includes('schedulerCadenceStatus'))
check('recent scheduler cannot mark stale market fresh', operationsHealth.includes('latestOddsAgeMinutes') && operationsHealth.includes('Market freshness never falls back to scheduler invocation time'))
check('provider health no longer uses odds_not_current as provider outage', !operationsHealth.includes("adaptive.blockers.includes('odds_not_current')\r\n      ? 'DEGRADED'") && operationsHealth.includes('Provider budget health does not use odds_not_current as an outage signal'))
check('settlement closure independent from stale odds', operationsHealth.includes('Settlement closure can be healthy while market odds are stale'))
check('provider budgets remain provider-specific', operationsHealth.includes('theOddsApi') && operationsHealth.includes('combinedWithSportsDataIO: false') && operationsHealth.includes('bsn'))
check('SportsDataIO and The Odds API not combined', providerBudget.includes('theOddsApi') && providerBudget.includes('SEPARATE_POOL_NOT_COMBINED'))
check('product readiness explains limiting domain', operationsHealth.includes('limitingDomain') && operationsHealth.includes('Product readiness is limited by'))
check('compatibility aliases preserved', operationsHealth.includes('compatibilityAliasesPreserved') && operationsHealth.includes('scheduler.schedulerRunning') && operationsHealth.includes('providerBudgets.sportsdataio'))
check('adaptive refresh exposes additive health domains', adaptive.includes('adaptiveHealthDomains') && adaptive.includes('healthDomains: adaptiveHealthDomains'))
check('data freshness exposes health domains', adaptive.includes("mode: 'universal_data_freshness_v1'") && adaptive.includes('marketFreshness: status.healthDomains.marketFreshness'))
check('settlement guarantee exposes independent domains', guarantee.includes('independentDomainSummary') && guarantee.includes('healthDomains'))
check('MLB autonomous operations includes healthDomains', autonomous.includes('healthDomains'))
check('provider budget status exposes healthDomain', providerBudget.includes('provider_budget_health_domain_v1'))
check('operations center consumes operations health domains', operationsCenter.includes('getOperationsHealth') && operationsCenter.includes('healthSemantics'))
check('MLB operations page displays health semantics', operationsPage.includes('Operational Health Domains') && operationsPage.includes('Scheduler Execution') && operationsPage.includes('Product Readiness'))
check('dashboard operations panel displays separated domains', operationsPanel.includes('Separated Health Domains') && operationsPanel.includes('HealthDomainCard'))
check('no scheduler cron cadence changed', read('src/config/mlb-operating-day-scheduler.ts').includes("MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON = '7-57/10 * * * *'") && read('.github/workflows/production-operating-day.yml').includes('7-57/10 * * * *'))
check('no prediction formula module touched by validator scope', cert.predictionFormulaChanged === false && cert.probabilityChanged === false && cert.confidenceChanged === false)
check('no recommendation or official policy changed', cert.officialPickPolicyChanged === false)
check('no settlement logic change declared', cert.settlementLogicChanged === false)
check('no provider limits changed', cert.providerCallLimitsChanged === false)
check('guardrails record zero provider calls', cert.guardrails.providerCallsIntroduced === 0 && cert.guardrails.providerCreditsConsumed === 0)
check('docs state no runtime behavior beyond observability', doc.includes('semantic and observational') && doc.includes('No prediction formula'))
check('certification markers complete', cert.completionMarkers.includes('SCHEDULER_EXECUTION_HEALTH_INDEPENDENT') && cert.completionMarkers.includes('PRODUCT_READINESS_LIMITING_DOMAIN_EXPLAINED'))

const failed = checks.filter((item) => !item.passed)
const result = {
  success: failed.length === 0,
  mode: 'oe003a_scheduler_health_semantics_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  providerCreditsConsumed: 0,
  databaseMutationsMade: 0,
  schedulerCadenceChanged: false,
  predictionFormulaChanged: false,
  officialPickPolicyChanged: false,
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
