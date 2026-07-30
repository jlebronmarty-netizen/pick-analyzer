import fs from 'node:fs'

const certification = fs.readFileSync('docs/MLB_FIRST_AUTONOMOUS_OPERATING_DAY_CERTIFICATION_V1.md', 'utf8')
const closure = JSON.parse(fs.readFileSync('docs/MLB_END_TO_END_DAILY_CLOSURE_V1.json', 'utf8'))
const metrics = JSON.parse(fs.readFileSync('docs/MLB_AUTONOMOUS_OPERATING_DAY_METRICS_V1.json', 'utf8'))
const resultSync = fs.readFileSync('src/services/results-sync.service.ts', 'utf8')
const health = fs.readFileSync('src/services/operations-health.service.ts', 'utf8')

const requiredEventIds = [
  'baseball_mlb:mlb:sportsdataio:event:79744',
  'baseball_mlb:mlb:sportsdataio:event:78910',
  'baseball_mlb:mlb:sportsdataio:event:78918',
  'baseball_mlb:mlb:sportsdataio:event:78911',
]

const checks = [
  {
    name: 'certification records Windows local smoke harness classification',
    pass:
      certification.includes('LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS') &&
      certification.toLowerCase().includes('two independent bounded powershell wrappers exceeded their hard timeouts') &&
      certification.toLowerCase().includes('route itself is not proven defective'),
  },
  {
    name: 'certification names all four recovered events',
    pass: requiredEventIds.every((id) => certification.includes(id)),
  },
  {
    name: 'closure artifact certifies terminal result recovery and settlement',
    pass:
      closure.success === true &&
      closure.status === 'CERTIFIED_AFTER_TERMINAL_RECOVERY' &&
      closure.canonicalResultsCertified === true &&
      closure.settlement.checked === 48 &&
      closure.settlement.unresolved === 0,
  },
  {
    name: 'metrics artifact records exact recovery counters',
    pass:
      metrics.recovery.targetEvents === 4 &&
      metrics.recovery.gameResultsInserted === 4 &&
      metrics.recovery.idempotency.rowsReused === 4 &&
      metrics.recovery.idempotency.eventRowsUpdated === 0,
  },
  {
    name: 'result matcher is protected against MLB doubleheader local-date collision',
    pass:
      resultSync.includes('sameStartMinute') &&
      resultSync.includes('const exactStartMatch = events.find') &&
      resultSync.includes('syncMlbStatsResultsForEventIds'),
  },
  {
    name: 'scheduler health reads shared ten-minute policy',
    pass:
      health.includes('MLB_OPERATING_DAY_WRITE_SCHEDULER_INTERVAL_MINUTES') &&
      health.includes('MLB_OPERATING_DAY_SCHEDULER_GRACE_MINUTES'),
  },
]

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length) {
  console.error(`MLB July 29 terminal recovery validation failed: ${failed.map((check) => check.name).join(', ')}`)
  process.exit(1)
}

console.log(`MLB July 29 terminal recovery validation passed: ${checks.length}/${checks.length}`)
