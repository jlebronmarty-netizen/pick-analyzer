import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const checks = []

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function json(relativePath) {
  return JSON.parse(read(relativePath))
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const requiredFiles = [
  'docs/MISSION_CONTROL/MC_01_OPERATIONAL_READINESS_CLOSURE.md',
  'docs/CERTIFICATION/MC_01_OPERATIONAL_READINESS_CLOSURE.md',
  'docs/CERTIFICATION/mc-01-operational-readiness-closure.json',
  'scripts/mc01-operational-readiness-closure-validate.mjs',
]

for (const file of requiredFiles) check(`required file exists: ${file}`, exists(file))

const status = json('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json')
const certification = json('docs/CERTIFICATION/mc-01-operational-readiness-closure.json')
const service = read('src/services/mission-control.service.ts')
const settlement = read('src/services/settlement-guarantee.service.ts')
const mc01 = read('docs/MISSION_CONTROL/MC_01_OPERATIONAL_READINESS_CLOSURE.md')
const queue = read('docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md')
const log = read('docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md')
const projectStatus = read('docs/PROJECT_STATUS.md')
const roadmap = read('docs/MASTER_ROADMAP.md')

check('MC-01 certification is conditional or certified', ['CONDITIONAL_PASS', 'PRODUCTION_CERTIFIED'].includes(certification.status))
check('Mission Control status tracks MC-01 current mission', status.currentMission?.id === 'MC-01' && ['CONDITIONAL_PASS', 'PRODUCTION_CERTIFIED'].includes(status.currentMission?.state))
check('Mission Control keeps MC-02 out of execution', queue.includes('MC-02 is READY but was not started'))
check('MC-STOP-005 state is explicit', (status.mc01?.activeStopCondition === 'MC-STOP-005' && certification.activeStopConditions?.[0]?.id === 'MC-STOP-005') || (status.mc01?.activeStopCondition === null && Array.isArray(certification.activeStopConditions) && certification.activeStopConditions.length === 0))
check('runtime service reports MC-00 production certified', service.includes("id: 'MC-00'") && service.includes("state: 'PRODUCTION_CERTIFIED'"))
check('runtime service reports MC-01 conditional', service.includes("id: 'MC-01'") && service.includes("state: 'CONDITIONAL_PASS'"))
check('runtime service uses MC-01 as current mission', service.includes('currentMission: queue[1]'))
check('runtime service excludes MC-01 from next mission search', service.includes("!['MC-00', 'MC-01'].includes(mission.id)"))
const actionRequiredBlock = settlement.slice(settlement.indexOf('const actionRequiredReasons'), settlement.indexOf('const operationalWarningReasons'))
check('settlement guarantee no longer fails on scheduler late alone', !actionRequiredBlock.includes('SCHEDULER_LATE_OR_CRITICAL'))
check('settlement guarantee exposes scheduler operational warnings', settlement.includes('operationalWarningReasons') && settlement.includes('SCHEDULER_LATE_OR_CRITICAL'))
check('settlement action reasons remain settlement-specific', settlement.includes('SETTLEMENT_READY_ROWS_REMAIN') && settlement.includes('SILENT_PENDING_ROWS_REMAIN'))
check('MC-01 docs include entry and exit criteria', mc01.includes('## Entry Criteria') && mc01.includes('## Exit Criteria'))
check('MC-01 docs include required operational domains', ['Scheduler execution', 'Market freshness', 'Canonical acquisition', 'Provider budget authorization', 'Settlement closure', 'Learning evidence', 'Performance synchronization', 'Current Board', 'Daily Brief', 'Personal Ledger'].every((item) => mc01.includes(item)))
check('MC-01 docs record protected route auth evidence', mc01.includes('HTTP 401') && certification.productionEvidenceBeforeRepair.protectedDryRunWithoutSecretHttp === 401)
check('MC-01 docs record settlement rows clear', certification.productionEvidenceBeforeRepair.settlementReadyRows === 0 && certification.productionEvidenceBeforeRepair.silentPendingRows === 0)
check('guardrails preserve zero mutation/write behavior', certification.guardrails.providerCreditsConsumedByRepairs === 0 && certification.guardrails.databaseMutationsMadeByRepairs === 0 && certification.guardrails.predictionWrites === 0 && certification.guardrails.settlementWrites === 0 && certification.guardrails.learningWrites === 0)
check('Mission Control log appended MC-01', log.includes('MC-01 Operational Readiness Closure') && log.includes('CONDITIONAL_PASS'))
check('production-certified MC-01 has recovery evidence', certification.status !== 'PRODUCTION_CERTIFIED' || (certification.manualProtectedSchedulerDiagnostic?.conclusion === 'success' && certification.productionEvidenceAfterManualDiagnostic?.operationsHealthStatus === 'HEALTHY' && certification.productionEvidenceAfterManualDiagnostic?.marketFreshnessStatus === 'HEALTHY'))
check('Project Status mentions MC-01', projectStatus.includes('MC-01 Operational Readiness Closure'))
check('Master Roadmap mentions MC-01 final state', roadmap.includes('MC-01 Operational Readiness Closure') && (roadmap.includes('CONDITIONAL_PASS') || roadmap.includes('PRODUCTION_CERTIFIED')))

const stagedFiles = execSync('git diff --cached --name-only', { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const protectedDirtyFiles = [
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/OPERATIONAL_EXCELLENCE/MORNING_OPERATIONAL_CHECKLIST.md',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json',
]
check('protected dirty files are not staged', protectedDirtyFiles.every((file) => !stagedFiles.includes(file)))

const failed = checks.filter((item) => !item.passed)
const result = {
  success: failed.length === 0,
  mode: 'mc01_operational_readiness_closure_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
