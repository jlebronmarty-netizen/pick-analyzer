import fs from 'node:fs'

const schedulerConfig = fs.readFileSync('src/config/mlb-operating-day-scheduler.ts', 'utf8')
const autonomous = fs.readFileSync('src/services/mlb-autonomous-operations-v1.service.ts', 'utf8')
const adaptive = fs.readFileSync('src/services/adaptive-refresh-orchestrator.service.ts', 'utf8')
const health = fs.readFileSync('src/services/operations-health.service.ts', 'utf8')
const results = fs.readFileSync('src/services/results-sync.service.ts', 'utf8')

const checks = [
  {
    name: 'shared scheduler config defines production write cadence',
    pass:
      schedulerConfig.includes("MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON = '*/10 * * * *'") &&
      schedulerConfig.includes('MLB_OPERATING_DAY_WRITE_SCHEDULER_INTERVAL_MINUTES = 10'),
  },
  {
    name: 'shared scheduler config defines heartbeat cadence',
    pass: schedulerConfig.includes("MLB_OPERATING_DAY_HEARTBEAT_CRON = '3,33 * * * *'"),
  },
  {
    name: 'operations surfaces import shared scheduler cadence',
    pass:
      autonomous.includes('MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON') &&
      adaptive.includes('MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON') &&
      health.includes('MLB_OPERATING_DAY_WRITE_SCHEDULER_INTERVAL_MINUTES'),
  },
  {
    name: 'legacy 15-minute health cron text is not hardcoded in health surfaces',
    pass:
      !autonomous.includes("7,22,37,52 * * * *") &&
      !adaptive.includes("7,22,37,52 * * * *") &&
      !health.includes("7,22,37,52 * * * *"),
  },
  {
    name: 'MLB Stats matching prefers exact start minute before same-team local-date fallback',
    pass:
      results.includes('function sameStartMinute') &&
      results.includes('const exactStartMatch = events.find') &&
      results.indexOf('const exactStartMatch = events.find') < results.indexOf('return events.find((event) => {'),
  },
  {
    name: 'targeted MLB result sync is available for bounded recovery',
    pass:
      results.includes('syncMlbStatsResultsForEventIds') &&
      results.includes('loadMlbEventsByIds') &&
      results.includes('lockScope: `targeted:'),
  },
]

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length) {
  console.error(`Scheduler health alignment validation failed: ${failed.map((check) => check.name).join(', ')}`)
  process.exit(1)
}

console.log(`Scheduler health alignment validation passed: ${checks.length}/${checks.length}`)
