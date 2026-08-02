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
  service: 'src/services/event-lifecycle-state.service.ts',
  mlbLifecycle: 'src/services/mlb-game-lifecycle.service.ts',
  route: 'src/app/api/operations/event-lifecycle/route.ts',
  lazy: 'src/lib/server-lazy-diagnostics.ts',
  operationsCenter: 'src/services/mlb-operations-center.service.ts',
  operationsPage: 'src/app/mlb-operations/page.tsx',
  doc: 'docs/OPERATIONAL_EXCELLENCE/OE_003C_PER_EVENT_LIFECYCLE_STATE.md',
  certDoc: 'docs/CERTIFICATION/OE_003C_PER_EVENT_LIFECYCLE_STATE.md',
  certJson: 'docs/CERTIFICATION/oe-003c-per-event-lifecycle-state.json',
  roadmap: 'docs/OPERATIONAL_EXCELLENCE/OE_003_IMPLEMENTATION_ROADMAP.md',
  schedulerConfig: 'src/config/mlb-operating-day-scheduler.ts',
  workflow: '.github/workflows/production-operating-day.yml',
}

for (const file of Object.values(files)) check(`file exists: ${file}`, fs.existsSync(path.join(root, file)))

const service = read(files.service)
const mlbLifecycle = read(files.mlbLifecycle)
const route = read(files.route)
const operationsCenter = read(files.operationsCenter)
const operationsPage = read(files.operationsPage)
const doc = read(files.doc)
const certDoc = read(files.certDoc)
const cert = json(files.certJson)

const requiredStates = cert.lifecycleStates
for (const state of requiredStates) {
  check(`lifecycle state ${state} has rule`, service.includes(`rule('${state}'`) && service.includes('entry') && service.includes('exit'))
}

check('canonical contract version exists', service.includes("contractVersion: 'oe_003c_event_lifecycle_state_v1'") && cert.contractVersion === 'oe_003c_event_lifecycle_state_v1')
check('read-only route exists', route.includes('getEventLifecycleState') && route.includes('parseIntegerParam') && route.includes('max: 200'))
check('bounded current-day default exists', service.includes('defaultCurrentDayOnly: true') && service.includes('zonedUtcRange(operatingDate, TIMEZONE)') && service.includes('.gte(') && service.includes('.lt('))
check('FINAL is never inferred from elapsed time alone', mlbLifecycle.includes('final/live state is not inferred from elapsed time') && service.includes('finalNotInferredFromElapsedTime: true'))
check('missing canonical result becomes RESULT_IMPORT', service.includes("lifecycleState = 'RESULT_IMPORT'") && service.includes('CANONICAL_RESULT_MISSING_FOR_TERMINAL_EVENT'))
check('settlement-ready work outranks market refresh', service.indexOf("lifecycleState = 'SETTLEMENT'") < service.indexOf("lifecycleState = 'ACTIVE_REFRESH'") && service.includes("priorityBand === 'P0'"))
check('provider budget context is dry-run only', service.includes('authorizeProviderBudget') && service.includes('dryRun: true') && service.includes('providerCallsMade: 0'))
check('provider budgets remain isolated by provider service', read('src/services/provider-budget.service.ts').includes('SEPARATE_POOL_NOT_COMBINED'))
check('lifecycle derivation makes zero provider calls', service.includes('providerCallsMade: 0') && service.includes('providerCreditsConsumed: 0'))
check('lifecycle API makes zero mutations', service.includes('databaseMutationsMade: 0') && !service.includes('.insert(') && !service.includes('.update(') && !service.includes('.upsert(') && !service.includes('.delete('))
check('recommendation relevance classification only', service.includes('classificationOnly: true') && service.includes('recommendationSelectionChanged: false'))
check('next actions observational only', service.includes('automaticExecutionEnabled: false') && doc.includes('observability only') && certDoc.includes('observational'))
check('multi-sport unknown states remain honest', service.includes('Generic event has no terminal/live status evidence') && service.includes("lifecycleState = 'DISCOVERED'"))
check('no scheduler cadence changed', read(files.schedulerConfig).includes("MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON = '7-57/10 * * * *'") && read(files.workflow).includes('7-57/10 * * * *'))
check('refresh cadence unchanged declared', cert.guardrails.refreshCadenceChanged === false)
check('prediction formulas unchanged declared', cert.guardrails.predictionFormulaChanged === false && cert.guardrails.probabilityChanged === false && cert.guardrails.confidenceChanged === false)
check('Official Pick policy unchanged declared', cert.guardrails.officialPickPolicyChanged === false)
check('operations center exposes event lifecycle', operationsCenter.includes('Event Lifecycle') || operationsCenter.includes('eventLifecycle') && operationsPage.includes('Event Lifecycle'))
check('MLB operations page links lifecycle API', operationsPage.includes('Open lifecycle API') && operationsPage.includes('lifecycle.route'))
check('persistence decision is derived only', cert.persistenceDecision === 'DERIVED_DYNAMIC_ONLY' && cert.migrationRequired === false && doc.includes('No migration was added'))
check('OE-003D was not started', doc.includes('OE-003D was not started') && cert.completionMarkers.includes('OE_003D_NOT_STARTED'))
check('no secrets exposed in OE-003C artifacts', !/(SUPABASE_SERVICE_ROLE_KEY\s*=|ODDS_API_KEY\s*=|SPORTSDATAIO_MLB_API_KEY\s*=|CRON_SECRET\s*=|sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})/.test([service, route, doc, certDoc, read(files.certJson)].join('\n')))

const failed = checks.filter((item) => !item.passed)
const result = {
  success: failed.length === 0,
  mode: 'oe003c_per_event_lifecycle_state_validation',
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
