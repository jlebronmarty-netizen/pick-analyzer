import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { stable, sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { createPrivateRunStore } from './mlb-data-02r-r2t-private-run-store.mjs'

const checks = []
for (const value of [null, false, 0, -0, NaN, [undefined, null, , 3], { b: undefined, a: ['é', '\ud800', true] }, { x: new Date(0) }]) {
  assert.equal(sha256(value), crypto.createHash('sha256').update(stable(value)).digest('hex'))
}
checks.push('Exact legacy canonical digest parity including nullable and sparse values')
const chunk = 'x'.repeat(32 * 1024 * 1024)
const large = Array(18).fill(chunk)
assert.throws(() => stable(large), /Invalid string length/)
const expected = crypto.createHash('sha256').update('[')
for (let i = 0; i < large.length; i++) { if (i) expected.update(','); expected.update(JSON.stringify(chunk)) }
expected.update(']')
assert.equal(sha256(large), expected.digest('hex'))
checks.push('576 MiB evidence exceeds legacy string limit and hashes successfully without contract drift')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pick-analyzer-large-checkpoint-'))
const store = createPrivateRunStore(root)
store.acquire()
try {
  const value = { frozenDigest: 'freeze', evidence: { contexts: Array.from({ length: 14 }, (_, game) => ({ target: { game }, dependencies: { rows: [{ id: game, payload: 'structural-test'.repeat(1000) }] } })), nativeGames: [], blockedGames: [] } }
  value.evidenceDigest = sha256(value.evidence)
  store.save('run', value)
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'run.json'), 'utf8'))
  assert.equal(manifest.privateContextShards.parts.length, 14)
  assert.equal(manifest.evidence.contexts, undefined)
  assert.deepEqual(store.load('run'), value)
  checks.push('Fourteen-game checkpoint shards reconstruct exact evidence and original digest')
  store.save('run', { ...value, odds: { payload: [] } })
  assert.deepEqual(store.load('run'), { ...value, odds: { payload: [] } })
  checks.push('Atomic manifest replacement preserves checkpoint across downstream saves')
  const current = JSON.parse(fs.readFileSync(path.join(root, 'run.json'), 'utf8'))
  fs.writeFileSync(path.join(root, current.privateContextShards.parts[0].key + '.json'), '{}')
  assert.throws(() => store.load('run'), /PRIVATE_CONTEXT_DIGEST_DRIFT/)
  checks.push('Changed shard fails closed before evidence use')
  store.save('legacy', { evidence: { contexts: [] } })
  assert.deepEqual(store.load('legacy'), { evidence: { contexts: [] } })
  checks.push('Legacy empty checkpoints remain readable')
} finally { store.release() }
const report = { status: 'PASS', checks, providerCalls: 0, productionDml: 0, productionDdl: 0 }
fs.writeFileSync(path.join(os.tmpdir(), 'pick-analyzer-operational-mission/large-checkpoint-validation.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
