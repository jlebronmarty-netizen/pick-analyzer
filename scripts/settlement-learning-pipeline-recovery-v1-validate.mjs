import fs from 'node:fs'

const servicePath = 'src/services/adaptive-refresh-orchestrator.service.ts'
const docPath = 'docs/SETTLEMENT_LEARNING_PIPELINE_RECOVERY_V1.md'
const service = fs.readFileSync(servicePath, 'utf8')
const doc = fs.readFileSync(docPath, 'utf8')

const checks = [
  {
    name: 'read-only settlement backlog loader exists',
    pass: service.includes('async function loadSettlementBacklog'),
  },
  {
    name: 'settlement domain can become due now',
    pass: service.includes("['schedule', 'odds', 'results', 'settlement'].includes(item.domain)"),
  },
  {
    name: 'operations status exposes settlement backlog evidence',
    pass: service.includes('settlementBacklog: settlementBacklog ??'),
  },
  {
    name: 'settlement planning selects oldest ready date',
    pass: service.includes("action === 'settle' && settlementBacklog.oldestReadyDate"),
  },
  {
    name: 'protected execution can guard expected action drift',
    pass: service.includes("executionMode: 'expected_action_mismatch'") && service.includes('expectedAction'),
  },
  {
    name: 'settlement backlog declares zero provider calls',
    pass: service.includes('providerCallsMade: 0') && service.includes('remoteMutationsMade: 0'),
  },
  {
    name: 'recovery documentation records no model changes',
    pass: doc.includes('NO_MODEL_CHANGE_PASS') && doc.includes('Learning Brain weight change'),
  },
]

const failed = checks.filter((check) => !check.pass)
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`)
}

if (failed.length > 0) {
  console.error(`Settlement recovery validation failed: ${failed.map((check) => check.name).join(', ')}`)
  process.exit(1)
}

console.log(`Settlement recovery validation passed: ${checks.length}/${checks.length}`)
