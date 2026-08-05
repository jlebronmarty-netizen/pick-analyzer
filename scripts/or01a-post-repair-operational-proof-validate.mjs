import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const cert = read('docs/CERTIFICATION/OR_01A_POST_REPAIR_OPERATIONAL_PROOF.md')
const ops = read('docs/OPERATIONAL_EXCELLENCE/OR_01A_POST_REPAIR_OPERATIONAL_PROOF.md')
const status = read('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json')
const json = JSON.parse(read('docs/CERTIFICATION/or-01a-post-repair-operational-proof.json'))

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const allowed = new Set([
  'scripts/or01a-post-repair-operational-proof-validate.mjs',
  'docs/CERTIFICATION/OR_01A_POST_REPAIR_OPERATIONAL_PROOF.md',
  'docs/CERTIFICATION/or-01a-post-repair-operational-proof.json',
  'docs/OPERATIONAL_EXCELLENCE/OR_01A_POST_REPAIR_OPERATIONAL_PROOF.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/CERTIFICATION/README.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
])

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const disallowed = changed.filter((file) => !allowed.has(file))

check('OR-01A classification is honest non-pass', json.classification === 'OR_01A_EXTERNAL_WAIT_CADENCE_AND_NEXT_MARKET_WINDOW_PROOF')
check('MC-08H was not rerun', json.mc08h.rerun === false && cert.includes('MC-08H was not rerun'))
check('manual writer was not triggered', json.manualProtectedWriterExecutions === 0 && cert.includes('Manual protected writer executions: 0'))
check('GitHub public metadata is recorded', cert.includes('30965570325') && cert.includes('30961154690'))
check('GitHub logs limitation is recorded', cert.includes('GitHub run logs returned HTTP 403'))
check('scheduler critical evidence is recorded', cert.includes('Scheduler Execution: CRITICAL') && cert.includes('missed intervals 18'))
check('market proof did not greenwash empty board', cert.includes('Market Freshness: UNKNOWN') && cert.includes('Current Board candidates 0'))
check('older missing-result backlog remains visible', cert.includes('9 older completed prediction rows still lack canonical game_results'))
check('Mission Control records OR-01A external wait', status.includes('"or01a"') && status.includes('EXTERNAL_WAIT_CADENCE_AND_NEXT_MARKET_WINDOW_PROOF'))
check('operations evidence mirrors certification', ops.includes('Production Ready: NO') && ops.includes('Do not start Production Pilot Week'))
check('provider and mutation accounting stayed zero for certification reads', json.providerCallsMadeByCertificationReads === 0 && json.remoteMutationsMadeByCertificationReads === 0)
check('only bounded OR-01A files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((entry) => !entry.passed)
const result = {
  success: failedChecks.length === 0,
  mode: 'or01a_post_repair_operational_proof_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  predictionWrites: 0,
  resultWrites: 0,
  settlementWrites: 0,
  learningWrites: 0,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
