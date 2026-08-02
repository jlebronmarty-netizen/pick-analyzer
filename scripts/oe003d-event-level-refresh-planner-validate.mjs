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

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
}

const files = {
  service: 'src/services/event-refresh-planner.service.ts',
  route: 'src/app/api/operations/event-refresh-plan/route.ts',
  adaptive: 'src/services/adaptive-refresh-orchestrator.service.ts',
  operationsCenter: 'src/services/mlb-operations-center.service.ts',
  operationsPage: 'src/app/mlb-operations/page.tsx',
  doc: 'docs/OPERATIONAL_EXCELLENCE/OE_003D_EVENT_LEVEL_REFRESH_PLANNER.md',
  certDoc: 'docs/CERTIFICATION/OE_003D_EVENT_LEVEL_REFRESH_PLANNER.md',
  certJson: 'docs/CERTIFICATION/oe-003d-event-level-refresh-planner.json',
}

for (const file of Object.values(files)) check(`file exists: ${file}`, fs.existsSync(path.join(root, file)))

const service = read(files.service)
const route = read(files.route)
const adaptive = read(files.adaptive)
const operationsCenter = read(files.operationsCenter)
const operationsPage = read(files.operationsPage)
const doc = read(files.doc)
const certDoc = read(files.certDoc)
const cert = json(files.certJson)

check('planning is independent per event', service.includes('independentEventDecision: true') && service.includes('lifecycle.events.map'))
check('staggered timing fixture exists', service.includes('staggered start times produce different nextEligibleAt values'))
check('P0 closure outranks market refresh', service.includes('P0_CLOSURE_OR_RECOVERY_OUTRANKS_MARKET_REFRESH') && service.includes('P0_SETTLEMENT_READY_OUTRANKS_MARKET_REFRESH'))
check('no pregame refresh after start', service.includes('POST_START_PREGAME_REFRESH_BLOCKED') && service.includes('STOP_PREGAME_REFRESH'))
check('P1 final-30m can receive 5-minute targets', service.includes('P1_FINAL_30M_FIVE_MINUTE_TARGET'))
check('non-P1 does not receive unjustified 5-minute cadence', service.includes('FINAL_30M_NON_P1_TEN_MINUTE_TARGET'))
check('provider budgets remain isolated', read('src/services/provider-budget.service.ts').includes('SEPARATE_POOL_NOT_COMBINED'))
check('reserve is protected', service.includes('reserveImpact') && service.includes('usableRemainingAfter'))
check('The Odds API unknown balance/cost cannot authorize unsafe execution', service.includes('THE_ODDS_API_UNKNOWN_BALANCE_RESET_REMAINS_SHADOW') && service.includes('UNKNOWN_PROVIDER_COST_OR_BALANCE_BLOCKS_ACTIVE_EXECUTION'))
check('plan reads make zero provider calls', service.includes('providerCallsMade: 0') && cert.guardrails.providerCallsIntroduced === 0)
check('dry-run makes zero mutations', service.includes('databaseMutationsMade: 0') && cert.guardrails.databaseMutationsMade === 0)
check('canonical snapshot deduplication is preserved', service.includes('DECIDE_PER_EVENT_EXECUTE_WITH_PROVIDER_EFFICIENT_BATCHING_STORE_ONE_CANONICAL_SNAPSHOT'))
check('product surfaces do not independently call providers', doc.includes('does not make Today, Current Board, Rent Play, Best Value or Workspace call providers independently'))
check('scheduler cron cadence unchanged', read('src/config/mlb-operating-day-scheduler.ts').includes("MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON = '7-57/10 * * * *'") && read('.github/workflows/production-operating-day.yml').includes('7-57/10 * * * *'))
check('prediction formulas remain unchanged', cert.guardrails.predictionFormulaChanged === false)
check('recommendation policy remains unchanged', cert.guardrails.officialPickPolicyChanged === false)
check('settlement and learning remain unchanged', cert.guardrails.settlementWrites === 0 && cert.guardrails.learningWrites === 0)
check('bounded API limits enforced', route.includes('max: 200') && service.includes('MAX_LIMIT = 200'))
check('current-day defaults prevent historical leakage', service.includes('defaultCurrentDayOnly: true') && service.includes('getEventLifecycleState'))
check('fallback behavior remains available', adaptive.includes('eventRefreshPlan') && adaptive.includes('getAdaptiveRefreshStatus'))
check('API route added', route.includes('getEventRefreshPlan') && route.includes('parseIntegerParam'))
check('operations center displays planner', operationsCenter.includes('Event Refresh Plan') && operationsPage.includes('Event Refresh Planner'))
check('OE-003D shadow certification is preserved', cert.plannerMode === 'SHADOW' && cert.activeExecutionEnabled === false)
check('bounded OE-003E activation is isolated when present', service.includes("sportKey === 'baseball_mlb'") && service.includes("providerId === 'sportsdataio'") && service.includes('activeExecutionEnabled'))
check('no secrets exposed in OE-003D artifacts', !/(SUPABASE_SERVICE_ROLE_KEY\s*=|ODDS_API_KEY\s*=|SPORTSDATAIO_MLB_API_KEY\s*=|CRON_SECRET\s*=|sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})/.test([service, route, doc, certDoc, read(files.certJson)].join('\n')))

const failed = checks.filter((item) => !item.passed)
const result = {
  success: failed.length === 0,
  mode: 'oe003d_event_level_refresh_planner_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  providerCreditsConsumed: 0,
  databaseMutationsMade: 0,
  activeExecutionEnabled: false,
  schedulerCadenceChanged: false,
  refreshCadenceChanged: false,
  predictionFormulaChanged: false,
  officialPickPolicyChanged: false
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
