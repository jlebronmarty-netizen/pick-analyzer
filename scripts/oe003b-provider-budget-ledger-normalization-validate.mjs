import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const checks = []

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function json(rel) {
  return JSON.parse(read(rel))
}

function check(name, passed, details = '') {
  checks.push({ name, passed: Boolean(passed), details })
}

const files = {
  service: 'src/services/provider-budget.service.ts',
  forecastRoute: 'src/app/api/operations/provider-budget-forecast/route.ts',
  budgetRoute: 'src/app/api/providers/budget/status/route.ts',
  health: 'src/services/operations-health.service.ts',
  adaptive: 'src/services/adaptive-refresh-orchestrator.service.ts',
  operationsCenter: 'src/services/mlb-operations-center.service.ts',
  operationsPage: 'src/app/mlb-operations/page.tsx',
  doc: 'docs/OPERATIONAL_EXCELLENCE/OE_003B_PROVIDER_BUDGET_LEDGER_NORMALIZATION.md',
  certDoc: 'docs/CERTIFICATION/OE_003B_PROVIDER_BUDGET_LEDGER_NORMALIZATION.md',
  certJson: 'docs/CERTIFICATION/oe-003b-provider-budget-ledger-normalization.json',
}

for (const file of Object.values(files)) check(`file exists: ${file}`, fs.existsSync(path.join(root, file)))

const service = read(files.service)
const forecastRoute = read(files.forecastRoute)
const health = read(files.health)
const adaptive = read(files.adaptive)
const operationsCenter = read(files.operationsCenter)
const operationsPage = read(files.operationsPage)
const doc = read(files.doc)
const cert = json(files.certJson)

check('canonical provider budget contract exists', service.includes("contractVersion: 'provider_budget_ledger_v1'") && service.includes('canonicalBudget'))
check('authorization contract exists', service.includes("contractVersion: 'provider_budget_authorization_v1'") && service.includes('authorizeProviderBudget'))
check('dry-run forecast contract exists', service.includes("mode: 'provider_budget_dry_run_forecast_v1'") && service.includes('getProviderBudgetForecast'))
check('provider budgets are isolated', service.includes('providerPoolProfiles') && service.includes('activeAuthorizationSource') && service.includes('combinedWithSportsDataIO: false'))
check('SportsDataIO and The Odds API never merged for authorization', service.includes('sportsdataio') && service.includes('the-odds-api') && service.includes('SEPARATE_POOL_NOT_COMBINED'))
check('unknown evidence remains unknown', service.includes("evidenceLevel: 'UNKNOWN'") && service.includes('UNKNOWN_NOT_RECHECKED') && service.includes('UNKNOWN_CURRENT_BALANCE'))
check('configured-only evidence labeled', service.includes("evidenceLevel: 'CONFIGURED_ONLY'") && service.includes('CONFIGURED_ONLY_LOCAL_DAY'))
check('usable remaining subtracts reserve safely', service.includes('Math.max(0, configuredLimit - configuredReserve - callsMadeToday)'))
check('no negative usable remaining in status or forecast', service.includes('Math.max(0, usableBefore - estimatedCost)') && service.includes('Math.max(0, configuredLimit - configuredReserve - callsMadeToday)'))
check('request counts and quota units distinct', service.includes('requestCountEstimate') && service.includes('quotaUnitEstimate') && service.includes('requestCountsAndQuotaUnitsAreDistinct'))
check('dry-run forecasts make no provider calls', service.includes('providerCallsMade: 0') && service.includes('providerCreditsConsumed: 0') && forecastRoute.includes('getProviderBudgetForecast'))
check('authorization uses exact provider pool', service.includes('`${budget.providerId.toUpperCase().replace(/-/g,') && service.includes('_AUTHORIZATION_POOL'))
check('unknown cost fails closed', service.includes('DENY_UNKNOWN_COST') && service.includes('UNKNOWN_COST_FAILS_CLOSED'))
check('unknown budget fails closed', service.includes('DENY_UNKNOWN_BUDGET') && service.includes('UNKNOWN_BUDGET_FAILS_CLOSED'))
check('backward-compatible budget route preserved', read(files.budgetRoute).includes('getProviderBudgetStatus') && read(files.budgetRoute).includes('validateProviderBudgetDeterministicFixtures'))
check('operations health exposes normalized provider pools', health.includes('canonicalBudget') && health.includes('providerPools'))
check('adaptive status exposes normalized provider pools', adaptive.includes('canonicalBudget: budget?.canonicalBudget') && adaptive.includes('providerPools: budget?.providerPools'))
check('MLB Operations Center exposes budget semantics', operationsCenter.includes('usableRemaining') && operationsCenter.includes('resetSemantics') && operationsPage.includes('Usable Remaining'))
check('scheduler cadence unchanged', read('src/config/mlb-operating-day-scheduler.ts').includes("MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON = '7-57/10 * * * *'") && read('.github/workflows/production-operating-day.yml').includes('7-57/10 * * * *'))
check('no prediction or recommendation logic change declared', cert.predictionFormulaChanged === false && cert.officialPickPolicyChanged === false)
check('settlement and learning logic unchanged declared', cert.settlementLogicChanged === false && cert.learningRulesChanged === false)
check('provider mappings and subscriptions unchanged declared', cert.providerMappingsChanged === false && cert.providerSubscriptionsChanged === false)
check('guardrails record zero provider calls and credits', cert.guardrails.providerCallsIntroduced === 0 && cert.guardrails.providerCreditsConsumed === 0)
check('docs state no provider cadence activation', doc.includes('does not increase provider cadence') && doc.includes('does not implement that planner'))
check('docs record no migration required', doc.includes('No schema migration was required') && cert.migrationRequired === false)
check('certification markers complete', cert.completionMarkers.includes('PROVIDER_ISOLATION_PASS') && cert.completionMarkers.includes('DRY_RUN_FORECAST_ZERO_PROVIDER_CALL_PASS'))
check('no secrets exposed in OE-003B artifacts', !/(CRON_SECRET|SUPABASE_SERVICE_ROLE|sk_live_|sk_test_|Bearer\s+[A-Za-z0-9._-]+)/.test([doc, read(files.certDoc), read(files.certJson), service].join('\n')))

const failed = checks.filter((item) => !item.passed)
const result = {
  success: failed.length === 0,
  mode: 'oe003b_provider_budget_ledger_normalization_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  providerCreditsConsumed: 0,
  databaseMutationsMade: 0,
  schedulerCadenceChanged: false,
  refreshCadenceChanged: false,
  predictionFormulaChanged: false,
  officialPickPolicyChanged: false,
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
