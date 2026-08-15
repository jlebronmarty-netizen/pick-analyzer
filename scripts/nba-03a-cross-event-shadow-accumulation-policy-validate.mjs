import fs from 'node:fs'

const service = fs.readFileSync('src/services/nba-current-era-shadow-canary.service.ts', 'utf8')
const script = fs.readFileSync('scripts/nba-03a-cross-event-shadow-accumulation-policy.mjs', 'utf8')
const cert = JSON.parse(fs.readFileSync('docs/CERTIFICATION/nba-03a-cross-event-shadow-accumulation-policy.json', 'utf8'))

const checks = []
function check(name, pass) {
  checks.push({ name, pass: Boolean(pass) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
}

check('certification status recorded', cert.status === 'NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_CERTIFIED')
check('policy version recorded', cert.policy?.policyVersion === 'NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_V1')
check('event cap defined', service.includes('eventCap: Math.max(2, Math.ceil(batchSize / 5))'))
check('event-market cap defined', service.includes('eventMarketCap: Math.max(1, Math.ceil'))
check('model identity cap defined', service.includes('modelIdentityCap: Math.max(1, Math.ceil(batchSize / 25))'))
check('round robin uses event order', service.includes('for (const eventId of eventOrder)'))
check('selection only uses write eligible rows', service.includes('candidate.writeEligible && candidate.candidateKey'))
check('existing duplicate gate unchanged', service.includes("if (logicalKey && existingLogicalKeys.has(logicalKey)) skipReasons.push('ALREADY_EXISTS')"))
check('write-one path unchanged', service.includes("mode === 'write-one'") && service.includes('savePredictionHistory([buildNbaCurrentEraShadowPredictionRow'))
check('policy script is dry-run', script.includes("runNbaCurrentEraShadowCanary({ mode: 'dry-run'"))
check('policy script does not call write-one', !script.includes("mode: 'write-one'"))
check('policy script reports 10/25/50', script.includes('for (const size of [10, 25, 50])'))
check('policy script compares old and proposed', script.includes('oldSelection') && script.includes('proposed'))
check('policy script reports concentration', script.includes('largestEventShare') && script.includes('largestEventMarketShare'))
check('policy script includes model probabilities', script.includes('generateNbaPredictions') && script.includes('modelProbability'))
const selectorStart = service.indexOf('export function selectNbaCurrentEraShadowAccumulationBatch')
const selectorEnd = service.indexOf('export function evaluateNbaCurrentEraShadowCandidate')
const selectorBody = service.slice(selectorStart, selectorEnd)
check('not profitability driven', !/\b(edge|ev|confidence|probability|sportsbookPreference|favorite|underdog)\b/.test(selectorBody))
check('Official Pick isolation unchanged', service.includes('recommended_pick: false'))
check('product eligibility unchanged', service.includes('production_eligible: false'))
check('provider calls zero for policy', cert.providerCalls === 0)
check('database mutations zero for policy', cert.databaseMutations === 0)
check('current era row count unchanged in cert', cert.currentEraRowsBefore === cert.currentEraRowsAfter)

const failed = checks.filter((item) => !item.pass)
if (failed.length) {
  console.error(`\\nnba_03a_cross_event_shadow_accumulation_policy_validate_v1 FAIL ${checks.length - failed.length}/${checks.length}`)
  process.exit(1)
}

console.log(`\\nnba_03a_cross_event_shadow_accumulation_policy_validate_v1 PASS ${checks.length}/${checks.length}`)
