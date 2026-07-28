import fs from 'node:fs'

const servicePath = 'src/services/results-sync.service.ts'
const service = fs.readFileSync(servicePath, 'utf8')

const checks = [
  {
    name: 'MLB Stats results persist under canonical sport_event id',
    pass: service.includes('game_id: event.id'),
  },
  {
    name: 'existing result telemetry uses canonical game_id lookup',
    pass: service.includes('const existingRow = existing.get(row.game_id)'),
  },
  {
    name: 'persistence reports changed game ids for replay boundary',
    pass:
      service.includes('insertedGameIds: inserts.map((row) => row.game_id)') &&
      service.includes('updatedGameIds: updates.map((row) => row.game_id)') &&
      service.includes('reusedGameIds'),
  },
  {
    name: 'event evidence updates only when canonical result row changed',
    pass:
      service.includes('const changedResultIds = new Set([...persisted.insertedGameIds, ...persisted.updatedGameIds])') &&
      service.includes('if (!changedResultIds.has(eventPatch.id)) continue'),
  },
  {
    name: 'timestamp idempotency compares instants instead of string formatting',
    pass:
      service.includes('sameTimestamp(a.commence_time, b.commence_time)') &&
      service.includes('new Date(a).getTime()') &&
      service.includes('return aTime === bTime'),
  },
  {
    name: 'result sync remains scoped away from settlement execution',
    pass:
      !service.includes('settlePredictions(') &&
      !service.includes('executeSettlementReconciliation(') &&
      !service.includes('Learning Brain'),
  },
]

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`)
}

const failed = checks.filter((check) => !check.pass)

if (failed.length > 0) {
  console.error(`Canonical result ingestion recovery validation failed: ${failed.map((check) => check.name).join(', ')}`)
  process.exit(1)
}

console.log(`Canonical result ingestion recovery validation passed: ${checks.length}/${checks.length}`)
