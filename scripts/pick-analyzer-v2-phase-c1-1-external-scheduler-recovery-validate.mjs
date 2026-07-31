import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const checks = []

const files = {
  scheduler: '.github/workflows/production-operating-day.yml',
  heartbeat: '.github/workflows/production-operating-day-heartbeat.yml',
  guarantee: 'src/services/settlement-guarantee.service.ts',
  markdown: 'docs/PICK_ANALYZER_V2_PHASE_C1_1_EXTERNAL_SCHEDULER_RECOVERY.md',
  json: 'docs/pick-analyzer-v2-phase-c1-1-external-scheduler-recovery.json',
  schedulerReliability: 'docs/SCHEDULER_RELIABILITY.md',
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8')
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

for (const file of Object.values(files)) check(`input exists: ${file}`, fs.existsSync(path.join(ROOT, file)))

const scheduler = read(files.scheduler)
const heartbeat = read(files.heartbeat)
const guarantee = read(files.guarantee)
const markdown = read(files.markdown)
const artifact = JSON.parse(read(files.json))
const schedulerReliability = read(files.schedulerReliability)

check('writer workflow remains scheduled', scheduler.includes('schedule:') && scheduler.includes('7-57/10 * * * *'))
check('writer workflow supports dispatch', scheduler.includes('workflow_dispatch:'))
check('writer workflow calls production endpoint dryRun=false', scheduler.includes('https://pick-analyzer.vercel.app') && scheduler.includes('/api/cron/operating-day?dryRun=${DRY_RUN}') && scheduler.includes("default: \"false\""))
check('writer workflow uses protected auth header without printing secret', scheduler.includes('--header "Authorization: Bearer ${CRON_SECRET}"') && !scheduler.includes('echo "${CRON_SECRET'))
check('writer workflow fails non-2xx visibly', scheduler.includes('if [ "${status_code}" -lt 200 ] || [ "${status_code}" -ge 300 ]; then'))
check('writer workflow is bounded below cadence', scheduler.includes('timeout-minutes: 6') && scheduler.includes('--max-time 120'))
check('writer concurrency is isolated', scheduler.includes('group: production-operating-day-writer') && !scheduler.includes('group: production-operating-day-runtime'))
check('heartbeat concurrency is isolated', heartbeat.includes('group: production-operating-day-heartbeat') && !heartbeat.includes('group: production-operating-day-runtime'))
check('heartbeat remains dry-run observer', heartbeat.includes('DRY_RUN: "true"') && heartbeat.includes('dryRun=true'))
check('heartbeat timeout is bounded', heartbeat.includes('timeout-minutes: 5'))
check('guarantee imports operations health', guarantee.includes("import { getOperationsHealth } from '@/services/operations-health.service'"))
check('guarantee reports scheduler health', guarantee.includes('schedulerHealth') && guarantee.includes('missedSchedulerIntervals') && guarantee.includes('nextExpectedSchedulerWindow'))
check('guarantee fails when scheduler is late or critical', guarantee.includes('SCHEDULER_LATE_OR_CRITICAL') && guarantee.includes('actionRequiredReasons.length === 0'))
check('guarantee route remains read-only', !/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(guarantee))
check('artifact records root cause', artifact.rootCause.primary === 'WRITER_HEARTBEAT_SHARED_CONCURRENCY_AND_BOUNDARY_CADENCE_RISK')
check('artifact records external scheduled proof', artifact.externalEvidence.schedulerRun.event === 'schedule' && artifact.externalEvidence.schedulerRun.conclusion === 'success')
check('artifact records settlement guarantee pass evidence', artifact.productionEvidence.settlementGuaranteeAfter.guarantee === 'PASS')
check('scheduler reliability docs updated', schedulerReliability.includes('production-operating-day-writer') && schedulerReliability.includes('7-57/10 * * * *'))
check('C2 not started', markdown.includes('C2 was not started'))

const failedChecks = checks.filter((item) => !item.passed)
const result = {
  generatedAt: new Date().toISOString(),
  verdict: failedChecks.length === 0 ? 'PICK_ANALYZER_V2_PHASE_C1_1_EXTERNAL_SCHEDULER_RECOVERY_PASS' : 'PICK_ANALYZER_V2_PHASE_C1_1_EXTERNAL_SCHEDULER_RECOVERY_FAIL',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (failedChecks.length) process.exit(1)
