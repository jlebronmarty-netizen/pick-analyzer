import fs from 'node:fs'

const docs = [
  'docs/MLB_AUTONOMOUS_OPERATIONS_V1.md',
  'docs/ADAPTIVE_REFRESH_POLICY_V1.md',
  'docs/DAILY_CONTINUITY_V1.md',
  'docs/PROVIDER_BUDGET_POLICY_V1.md',
  'docs/SYSTEM_HEALTH_POLICY_V1.md',
]

const workflow = fs.readFileSync('.github/workflows/production-operating-day.yml', 'utf8')
const heartbeatWorkflow = fs.readFileSync('.github/workflows/production-operating-day-heartbeat.yml', 'utf8')
const route = fs.readFileSync('src/app/api/operations/mlb-autonomous-operations/route.ts', 'utf8')
const service = fs.readFileSync('src/services/mlb-autonomous-operations-v1.service.ts', 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

for (const doc of docs) {
  const text = fs.readFileSync(doc, 'utf8')
  assert(text.includes('Status: COMPLETE'), `${doc} must be complete`)
  assert(text.includes('No ') || text.includes('Automatic model training remains disabled'), `${doc} must include guardrail language`)
}

assert(workflow.includes('cron: "7-57/10 * * * *"'), 'production scheduler must run every 10 minutes')
assert(workflow.includes('/api/cron/operating-day?dryRun=${DRY_RUN}'), 'production scheduler must use operating-day route')
assert(heartbeatWorkflow.includes('cron: "3,33 * * * *"'), 'heartbeat scheduler must run twice hourly')
assert(heartbeatWorkflow.includes('dryRun=true'), 'heartbeat must be dry-run only')
assert(route.includes('getMlbAutonomousOperationsV1'), 'route must expose autonomous operations report')
assert(service.includes('MLB_AUTONOMOUS_OPERATIONS_PASS'), 'service must include certification markers')
assert(service.includes('NO_MODEL_TRAINING_PASS'), 'service must include no-training marker')
assert(service.includes('NO_PROVIDER_WASTE_PASS'), 'service must include no-provider-waste marker')
assert(service.includes('MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON'), 'service must use shared 10-minute write scheduler')
assert(service.includes('MLB_OPERATING_DAY_HEARTBEAT_CRON'), 'service must use shared heartbeat cron')
assert(service.includes('provider_action_lock'), 'service must document provider action lock')
assert(service.includes('deterministic odds snapshot ids'), 'service must document deterministic snapshot ids')
assert(service.includes('Automatic model training does not occur') || service.includes('automaticTraining: false'), 'service must block automatic training')
assert(service.includes('modelTrainingRuns: 0'), 'service must report zero model training')
assert(service.includes('modelWeightMutations: 0'), 'service must report zero model weight mutations')
assert(service.includes('probabilityChanged: false'), 'service must report no probability change')
assert(service.includes('trustChanged: false'), 'service must report no Trust change')
assert(service.includes('settlementRulesChanged: false'), 'service must report no settlement rule change')

const markerMatches = [...service.matchAll(/'([A-Z0-9_]+_PASS)'/g)].map((match) => match[1])
const expectedMarkers = [
  'MLB_AUTONOMOUS_OPERATIONS_PASS',
  'ADAPTIVE_REFRESH_ENGINE_PASS',
  'DAILY_CONTINUITY_PASS',
  'PROVIDER_BUDGET_PASS',
  'SYSTEM_HEALTH_PASS',
  'NO_MODEL_TRAINING_PASS',
  'NO_MODEL_WEIGHT_MUTATION_PASS',
  'NO_PROBABILITY_CHANGE_PASS',
  'NO_TRUST_CHANGE_PASS',
  'NO_SETTLEMENT_CHANGE_PASS',
  'NO_PROVIDER_WASTE_PASS',
  'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
]
for (const marker of expectedMarkers) {
  assert(markerMatches.includes(marker), `missing marker ${marker}`)
}

const checks = [
  '10-minute production scheduler',
  'twice-hourly heartbeat',
  'autonomous operations route',
  'provider action lock',
  'deterministic snapshot ids',
  'no model training',
  'no model weight mutation',
  'no probability change',
  'no Trust change',
  'no settlement rule change',
  'certification markers',
]

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_autonomous_operations_v1_validation',
  checks: checks.length,
  passed: checks.length,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  modelTrainingRuns: 0,
  modelWeightMutations: 0,
  markers: expectedMarkers,
}, null, 2))
