import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { partitionReadIdentities, createSupabaseProductionRepository } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
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
const report = { status: 'PASS', checks: 6, identities: 140, batches: batches.length, byteCap: 3000, providerCalls: 0, productionDml: 0, productionDdl: 0 }
fs.writeFileSync(path.join(os.tmpdir(), 'pick-analyzer-operational-mission/identity-read-validation.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
