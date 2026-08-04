import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(ROOT, file))
const cert = JSON.parse(read('docs/CERTIFICATION/p2-2-new-epoch-daily-closure.json'))
const doc = read('docs/CERTIFICATION/P2_2_NEW_EPOCH_DAILY_CLOSURE.md')

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const allowed = new Set([
  'docs/CERTIFICATION/P2_2_NEW_EPOCH_DAILY_CLOSURE.md',
  'docs/CERTIFICATION/p2-2-new-epoch-daily-closure.json',
  'docs/CERTIFICATION/README.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
  'scripts/p2-2-new-epoch-daily-closure-validate.mjs',
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'src/services/provider-budget.service.ts',
  'scripts/p2-2b-current-era-closure-investigation-validate.mjs',
  'scripts/p2-2c-protected-scheduler-closure-recovery-validate.mjs',
  'docs/CERTIFICATION/P2_2B_CURRENT_ERA_CLOSURE_INVESTIGATION.md',
  'docs/CERTIFICATION/p2-2b-current-era-closure-investigation.json',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
  'scripts/p2-1a-canonical-market-prediction-granularity-validate.mjs',
  'scripts/p2-1-supported-market-coverage-validate.mjs',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'scripts/p1-3-production-evaluation-policy-validate.mjs',
  'scripts/p1-2-e2e-system-integrity-validate.mjs',
])
const disallowed = changed.filter((file) => !allowed.has(file))

check('P2.2 is waiting, not falsely passed', cert.status === 'WAITING_FOR_EXTERNAL_EVIDENCE' && doc.includes('WAITING_FOR_EXTERNAL_EVIDENCE'))
check('required closure sequence is explicit', cert.requiredSequence.includes('event_final') && cert.requiredSequence.includes('settlement') && cert.requiredSequence.includes('performance_current_era'))
check('P2.1 coverage prerequisite is satisfied', cert.currentEvidence.coverageExpectedSelections === 48 && cert.currentEvidence.coveragePredictionsCreated === 48 && cert.currentEvidence.coverageMissedOpportunities === 0)
check('external wait root cause is documented', cert.stopCondition.includes('not yet final') && doc.includes('No Current V2 event has yet completed'))
check('read-only observation made no provider calls', cert.currentEvidence.providerCallsFromReads === 0)
check('read-only observation made no mutations', cert.currentEvidence.remoteMutationsFromReads === 0)
check('business rules unchanged', Object.values(cert.guards).every((value) => value === false))
check('P2.3 and MC-03 not started', cert.p23Started === false && cert.mc03Started === false)
check('MC-08E remains paused', cert.mc08eResumed === false)
check('certification docs exist', exists('docs/CERTIFICATION/P2_2_NEW_EPOCH_DAILY_CLOSURE.md'))
check('only bounded P2.2 files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((item) => !item.passed)
const report = {
  success: failedChecks.length === 0,
  mode: 'p2_2_new_epoch_daily_closure_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(report, null, 2))
if (!report.success) process.exit(1)
