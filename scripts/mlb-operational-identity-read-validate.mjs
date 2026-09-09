import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { partitionReadIdentities, createSupabaseProductionRepository } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { createWriteJournal } from './mlb-data-02r-r2t-write-journal.mjs'
import { createPrivateRunStore } from './mlb-data-02r-r2t-private-run-store.mjs'
const ids = Array.from({ length: 140 }, (_, i) => `baseball_mlb:feature:${i}:` + 'a'.repeat(220))
const batches = partitionReadIdentities(ids)
assert.deepEqual(batches.flat(), ids)
assert.ok(batches.length > 1)
assert.ok(batches.every(b => b.reduce((n, id) => n + encodeURIComponent(id).length + 6, 0) <= 3000))
assert.deepEqual(partitionReadIdentities([...ids, ...ids]).flat(), ids)
assert.throws(() => partitionReadIdentities(['x'.repeat(3001)]), /READ_IDENTITY_TOO_LONG/)
const calls = []
let drift = false
const client = { from(table) { assert.equal(table, 'pick2_game_predictions'); return { select(columns) { assert.equal(columns, '*'); return { in(column, scope) { assert.equal(column, 'deterministic_identity'); calls.push(scope); return { async limit(cap) { assert.equal(cap, scope.length + 1); return { data: scope.map(id => ({ deterministic_identity: drift ? 'OUTSIDE_SCOPE' : id })), error: null } } } } } } } } }
const repository = createSupabaseProductionRepository({ client })
assert.equal((await repository.readPredictions(ids)).length, 140)
assert.deepEqual(calls, batches)
drift = true
await assert.rejects(() => repository.readPredictions(ids), /READ_IDENTITY_SCOPE/)
drift = false
const store = createPrivateRunStore(fs.mkdtempSync(path.join(os.tmpdir(), 'pick-analyzer-journal-read-test-')))
store.acquire()
try {
  const runContext = { run_id: 'structural-journal' }
  const journal = createWriteJournal({ client, store, runContext })
  let executions = 0
  await journal.perform({ table: 'pick2_game_predictions', rows: ids.map(id => ({ deterministic_identity: id })), cap: 140 }, async () => { executions++; return { inserted: 140 } })
  assert.equal(journal.summary()[0].actualRows, 140)
  const saved = store.load('writes-structural-journal'); saved.entries[0].state = 'PENDING'; store.save('writes-structural-journal', saved)
  const recovered = createWriteJournal({ client, store, runContext }); await recovered.recover()
  assert.equal(recovered.summary()[0].state, 'APPLIED'); assert.equal(recovered.summary()[0].recoveredByIndependentReadback, true); assert.equal(executions, 1)
  saved.entries[0].state = 'PENDING'; store.save('writes-structural-journal', saved); drift = true
  await assert.rejects(() => createWriteJournal({ client, store, runContext }).recover(), /READBACK_SCOPE/)
} finally { store.release() }
const report = { status: 'PASS', checks: 9, identities: 140, batches: batches.length, byteCap: 3000, providerCalls: 0, productionDml: 0, productionDdl: 0 }
fs.writeFileSync(path.join(os.tmpdir(), 'pick-analyzer-operational-mission/identity-read-validation.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
