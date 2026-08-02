import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'docs/OPERATIONAL_EXCELLENCE/OE_003_ADAPTIVE_EVENT_REFRESH_PROVIDER_BUDGET_AUDIT.md',
  'docs/ARCHITECTURE/ADAPTIVE_EVENT_LIFECYCLE_ENGINE.md',
  'docs/ARCHITECTURE/PROVIDER_BUDGET_INTELLIGENCE.md',
  'docs/OPERATIONAL_EXCELLENCE/OE_003_IMPLEMENTATION_ROADMAP.md',
  'docs/CERTIFICATION/oe-003-adaptive-event-refresh-audit.json',
]

const requiredMarkers = [
  'OE_003_AUDIT_PASS',
  'SCHEDULER_EXECUTION_HEALTH_SEPARATED',
  'MARKET_FRESHNESS_HEALTH_SEPARATED',
  'PROVIDER_BUDGET_MODEL_CLASSIFIED',
  'CANONICAL_ACQUISITION_FLOW_AUDITED',
  'PER_EVENT_FRESHNESS_AUDITED',
  'LIFECYCLE_ARCHITECTURE_DEFINED',
  'PRIORITY_BANDS_DEFINED',
  'FRESHNESS_SLA_PROPOSED',
  'BUDGET_SIMULATION_COMPLETE',
  'NO_PROVIDER_CALL_PASS',
  'NO_PROVIDER_CREDIT_PASS',
  'NO_DATABASE_MUTATION_PASS',
  'NO_RUNTIME_CHANGE_PASS',
]

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function assertCheck(name, passed, details = '') {
  return { name, passed: Boolean(passed), details }
}

const checks = []

for (const file of requiredFiles) {
  checks.push(assertCheck(`required file exists: ${file}`, fs.existsSync(path.join(root, file))))
}

const audit = read(requiredFiles[0])
const lifecycle = read(requiredFiles[1])
const budget = read(requiredFiles[2])
const roadmap = read(requiredFiles[3])
const cert = JSON.parse(read(requiredFiles[4]))

checks.push(assertCheck('certification status is PASS', cert.status === 'PASS'))
checks.push(assertCheck('runtime changes are false', cert.runtimeChanges === false))
checks.push(assertCheck('scheduler cadence unchanged', cert.schedulerCadenceChanged === false))
checks.push(assertCheck('prediction formula unchanged', cert.predictionFormulaChanged === false))
checks.push(assertCheck('official pick policy unchanged', cert.officialPickPolicyChanged === false))
checks.push(assertCheck('settlement logic unchanged', cert.settlementLogicChanged === false))
checks.push(assertCheck('provider calls are zero', cert.guardrails.providerCallsMadeByAudit === 0))
checks.push(assertCheck('provider credits are zero', cert.guardrails.providerCreditsConsumedByAudit === 0))
checks.push(assertCheck('database mutations are zero', cert.guardrails.databaseMutationsMadeByAudit === 0))
checks.push(assertCheck('build intentionally not executed', cert.guardrails.buildExecuted === false))
checks.push(assertCheck('local server smoke not run', cert.guardrails.localServerSmokeRun === false))
checks.push(assertCheck('manual deployment not run', cert.guardrails.manualDeploymentRun === false))

for (const marker of requiredMarkers) {
  checks.push(assertCheck(`completion marker present: ${marker}`, cert.completionMarkers.includes(marker)))
}

checks.push(assertCheck('scheduler root cause section present', audit.includes('Scheduler Root Cause Classification')))
checks.push(assertCheck('SportsDataIO cost model classified', audit.includes('SportsDataIO') && audit.includes('CONFIGURED_ONLY')))
checks.push(assertCheck('The Odds API cost model classified', audit.includes('The Odds API') && audit.includes('UNKNOWN')))
checks.push(assertCheck('BSN not assumed covered by The Odds API', audit.includes('BSN is not certified as covered by The Odds API')))
checks.push(assertCheck('canonical acquisition flow documented', audit.includes('ONE CANONICAL ACQUISITION')))
checks.push(assertCheck('per-event freshness table present', audit.includes('Per-Event Freshness Findings')))
checks.push(assertCheck('lifecycle states include settlement before learning', lifecycle.includes('SETTLEMENT') && lifecycle.includes('LEARNING')))
checks.push(assertCheck('priority bands include P0', lifecycle.includes('P0') && lifecycle.includes('P1') && lifecycle.includes('P4')))
checks.push(assertCheck('provider budget health contract separates freshness', budget.includes('schedulerExecution') && budget.includes('marketFreshness') && budget.includes('providerBudget')))
checks.push(assertCheck('roadmap remains bounded through implementation packages', roadmap.includes('OE-003A') && roadmap.includes('OE-003I') && (roadmap.includes('roadmap only') || roadmap.includes('roadmap plus bounded implementation evidence'))))

const forbiddenRuntimeChangeClaims = [
  'prediction formula changed',
  'Official Pick policy changed',
  'settlement rule changed',
  'provider contract changed',
]
for (const phrase of forbiddenRuntimeChangeClaims) {
  checks.push(assertCheck(`forbidden claim absent: ${phrase}`, !`${audit}\n${lifecycle}\n${budget}\n${roadmap}`.toLowerCase().includes(phrase.toLowerCase())))
}

const failed = checks.filter((check) => !check.passed)

const result = {
  success: failed.length === 0,
  mode: 'oe003_adaptive_event_refresh_audit_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  providerCreditsConsumed: 0,
  databaseMutationsMade: 0,
  runtimeChanges: false,
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
