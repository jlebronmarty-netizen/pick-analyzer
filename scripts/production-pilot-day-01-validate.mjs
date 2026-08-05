import fs from 'fs'
import { execFileSync } from 'child_process'

const read = (file) => fs.readFileSync(file, 'utf8')
const json = (file) => JSON.parse(read(file))
const exists = (file) => fs.existsSync(file)
const checks = []
const check = (name, passed, detail = '') => checks.push({ name, passed: Boolean(passed), detail })

const cert = json('docs/CERTIFICATION/production-pilot-day-01.json')
const status = json('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json')
const report = read('docs/PRODUCTION_PILOT/DAY_01_REPORT.md')
const queue = read('docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md')
const changed = execFileSync('git', ['status', '--short', '--untracked-files=all'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.slice(3).trim())
const allowed = new Set([
  'docs/PRODUCTION_PILOT/README.md',
  'docs/PRODUCTION_PILOT/DAY_01_REPORT.md',
  'docs/CERTIFICATION/production-pilot-day-01.json',
  'scripts/production-pilot-day-01-validate.mjs',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
  'scripts/or02-primary-scheduler-migration-vercel-cron-validate.mjs',
  'scripts/mc08h-production-readiness-certify.mjs',
])
const disallowed = changed.filter((file) => !allowed.has(file))

check('Day 1 docs exist', exists('docs/PRODUCTION_PILOT/README.md') && exists('docs/PRODUCTION_PILOT/DAY_01_REPORT.md'))
check('Day 1 certification JSON exists', exists('docs/CERTIFICATION/production-pilot-day-01.json'))
check('only Day 1 reporting/status files changed', disallowed.length === 0, disallowed.join(', '))
check('Day 1 verdict is monitoring pass', cert.status === 'DAY_1_PASS_WITH_MONITORING')
check('Production Pilot Week is active day 1', status.productionPilotWeek?.state === 'ACTIVE' && status.productionPilotWeek?.currentPilotDay === 1)
check('days completed remains zero before Day 1 certification is deployed', status.productionPilotWeek?.daysCompleted === 0)
check('MC-03 not started', cert.pilotWeek.mc03Started === false && status.productionPilotWeek?.mc03Started === false)
check('scheduler and operations healthy', cert.operations.schedulerExecution === 'HEALTHY' && cert.operations.operationsHealth === 'HEALTHY' && cert.operations.missedIntervals === 0)
check('market, provider, product and settlement healthy', cert.operations.marketFreshness === 'HEALTHY' && cert.operations.providerBudget === 'HEALTHY' && cert.operations.productReadiness === 'HEALTHY' && cert.operations.settlementClosure === 'HEALTHY')
check('coverage complete for remaining current board games', cert.coverage.coveragePercent === 100 && cert.coverage.expectedCanonicalPredictions === cert.coverage.actualCanonicalPredictions)
check('no actionable or official picks', cert.product.officialPicks === 0 && cert.product.recommendationEligible === 0 && cert.product.actionable === 0)
check('prior day closed without silent pending', cert.priorDay.settled === cert.priorDay.canonicalPredictions && cert.priorDay.silentPending === 0)
check('current era equation balances', cert.performance.currentEraCanonicalPredictions === cert.performance.currentEraSettled + cert.performance.currentEraPending + cert.performance.currentEraBlocked)
check('replay remains isolated', cert.replay.status === 'ISOLATED' && cert.replay.productionWrites === 0)
check('guardrails unchanged', Object.entries(cert.guardrails).every(([, value]) => value === false || value === 0))
check('issue log has no critical or high', !cert.issues.some((issue) => ['CRITICAL', 'HIGH'].includes(issue.severity)))
check('report explains no-bet state', report.includes('No candidate is an Official Pick') && report.includes('DAY_1_PASS_WITH_MONITORING'))
check('queue marks Production Pilot Week active', queue.includes('| Production Pilot Week | Real-world validation before Multi-Sport Expansion | ACTIVE |'))

const failedChecks = checks.filter((item) => !item.passed)
console.log(JSON.stringify({
  success: failedChecks.length === 0,
  mode: 'production_pilot_day_01_validation_v1',
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
  replayWrites: 0
}, null, 2))

if (failedChecks.length > 0) process.exit(1)
