import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const read = (file) => fs.readFileSync(file, 'utf8')
const json = (file) => JSON.parse(read(file))
const exists = (file) => fs.existsSync(file)
const checks = []
const check = (name, passed, detail = '') => checks.push({ name, passed: Boolean(passed), detail })

const cert = json('docs/CERTIFICATION/production-pilot-pi-01.json')
const report = read('docs/PRODUCTION_PILOT/INCIDENT_PI_01_GITHUB_FALLBACK_TIMEOUT.md')
const workflow = read('.github/workflows/production-operating-day.yml')
const route = read('src/app/api/cron/operating-day/route.ts')
const changed = execFileSync('git', ['status', '--short', '--untracked-files=all'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.slice(3).trim())

const allowed = new Set([
  'docs/PRODUCTION_PILOT/INCIDENT_PI_01_GITHUB_FALLBACK_TIMEOUT.md',
  'docs/PRODUCTION_PILOT/README.md',
  'docs/CERTIFICATION/production-pilot-pi-01.json',
  'scripts/production-pilot-pi-01-validate.mjs',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/PROJECT_STATUS.md',
  'scripts/production-pilot-day-01-validate.mjs',
])
const disallowed = changed.filter((file) => !allowed.has(file))

const incidentRuns = cert.runs.filter((run) => [236, 237].includes(run.runNumber))

check('PI-01 docs exist', exists('docs/PRODUCTION_PILOT/INCIDENT_PI_01_GITHUB_FALLBACK_TIMEOUT.md') && exists('docs/CERTIFICATION/production-pilot-pi-01.json'))
check('PI-01 verdict is classified without runtime repair', cert.status === 'CLASSIFIED_NO_RUNTIME_REPAIR_REQUIRED')
check('only bounded PI-01 files changed', disallowed.length === 0, disallowed.join(', '))
check('incident runs captured', incidentRuns.length === 2)
check('incident runs had no steps', incidentRuns.every((run) => run.stepsReturned === 0 && run.jobConclusion === 'cancelled'))
check('incident runs did not call the app', incidentRuns.every((run) => run.appInvocation === null && run.providerCallsMade === 0 && run.remoteMutationsMade === 0))
check('15-minute duration captured', incidentRuns.every((run) => run.durationSeconds >= 900 && run.durationSeconds <= 910))
check('normal runs complete quickly', cert.normalRunComparison.every((run) => run.conclusion === 'success' && run.durationSeconds <= 20 && run.stepDurationSeconds <= 3))
check('workflow is bounded below 15 minutes when steps run', workflow.includes('timeout-minutes: 6') && workflow.includes('--max-time 120'))
check('fallback still uses primary lease skip', route.includes('recentPrimarySchedulerLease') && route.includes('fallback_skipped_primary_recent_success'))
check('scheduler cadence unchanged', workflow.includes('7-57/10 * * * *'))
check('root cause avoids app blame', cert.incident.rootCause === 'GITHUB_HOSTED_RUNNER_OR_CONCURRENCY_PRE_STEP_CANCELLATION')
check('safety guarantees hold', Object.entries(cert.safety).every(([, value]) => value === false || value === 0))
check('no runtime or workflow repair required', cert.repair.runtimeRepairRequired === false && cert.repair.workflowRepairRequired === false)
check('Day 3 and MC-03 not started', cert.pilotDecision.day3Started === false && cert.pilotDecision.mc03Started === false)
check('report records app not invoked', report.includes('protected Pick Analyzer endpoint was not called') && report.includes('No runtime or workflow repair was made'))

const failedChecks = checks.filter((item) => !item.passed)
console.log(JSON.stringify({
  success: failedChecks.length === 0,
  mode: 'production_pilot_pi_01_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  predictionWrites: 0,
  resultWrites: 0,
  settlementWrites: 0,
  learningWrites: 0
}, null, 2))

if (failedChecks.length > 0) process.exit(1)
