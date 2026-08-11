import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(path, 'utf8')
}

function json(path) {
  return JSON.parse(read(path))
}

let failures = 0
function check(name, passed) {
  if (passed) {
    console.log(`PASS ${name}`)
  } else {
    failures += 1
    console.error(`FAIL ${name}`)
  }
}

const cert = json('docs/CERTIFICATION/scheduler-health-reconciliation.json')
const report = read('docs/PRODUCTION_PILOT/SCHEDULER_HEALTH_RECONCILIATION.md')
const reportFlat = report.replace(/\s+/g, ' ')
const health = read('src/services/operations-health.service.ts')
const oddsAcquisition = read('src/services/the-odds-api-current-odds-acquisition.service.ts')

check('stale health source identified', cert.rootCause === 'HEALTH_QUERY_STALE_SOURCE')
check('Stage 3 job type is durable evidence', oddsAcquisition.includes("const STAGE3_PRODUCT_PRIMARY_JOB_TYPE = 'odds03d_stage3_product_primary_v1'"))
check('health reads sports_sync_jobs safely', health.includes('latestPrimarySchedulerSyncJobs') && health.includes(".from('sports_sync_jobs')"))
check('health keeps lifecycle evidence', health.includes('latestLifecycleEvents') && health.includes(".from('operating_day_lifecycle_events')"))
check('Stage 3 primary job recognized', health.includes("'odds03d_stage3_product_primary_v1'") && health.includes('successfulPrimarySyncJob'))
check('Vercel primary source required', health.includes("source === 'VERCEL_OPERATING_DAY_CRON_PRIMARY'"))
check('newer primary evidence selected', health.includes('newerTimestamp(lastLifecycleVercelPrimarySuccessAt, lastVercelPrimarySyncJobSuccessAt)'))
check('primary evidence drives scheduler age', health.includes('const evidenceAge = ageMinutes(lastSuccessfulProtectedInvocationAt)'))
check('fallback health is separate', health.includes('fallbackHealth') && health.includes('affectsPrimarySchedulerHealth: false'))
check('GitHub fallback still reported', health.includes('lastGithubFallbackSuccessAt'))
check('thresholds not weakened', health.includes('EXTERNAL_SCHEDULER_EXPECTED_CADENCE_MINUTES') && health.includes('EXTERNAL_SCHEDULER_GRACE_MINUTES') && health.includes(">= 2 ? 'CRITICAL'"))
check('genuine primary missed intervals still detected', health.includes('missedSchedulerIntervals') && health.includes('evidenceAge > schedulerWindowMinutes'))
check('scheduler evidence source exposed', health.includes('schedulerEvidenceSource') && health.includes('sports_sync_jobs_stage3_primary'))
check('reported-before evidence recorded', cert.reportedLastInvocationBefore === '2026-08-11T11:51:47Z')
check('actual primary evidence recorded', cert.actualPrimaryInvocations.includes('2026-08-11T12:07:49Z') && cert.actualPrimaryInvocations.includes('2026-08-11T12:17:47Z'))
check('provider calls zero', cert.providerCallsFromCertification === 0)
check('production DB mutations zero', cert.productionDbMutationsFromCertification === 0)
check('report explains primary/fallback semantics', reportFlat.includes('Vercel primary') && reportFlat.includes('GitHub fallback'))

if (failures) {
  console.error(`Scheduler health reconciliation validation failed: ${failures}`)
  process.exit(1)
}

console.log('Scheduler health reconciliation validation passed')
