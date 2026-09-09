// Local guard tests only; no production clients or provider transport.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createPrivateRunStore } from './mlb-data-02r-r2t-private-run-store.mjs'
import { crosswalkMarketEvents } from './mlb-data-02r-r2g-persistence-interfaces.mjs'
import { createProviderLedger } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'

const root = process.env.R2S_VALIDATION_DIR
if (!root || !path.isAbsolute(root)) throw new Error('ISOLATED_VALIDATION_REQUIRED')
const checks = []
const check = name => checks.push({ name, status: 'PASS' })
const native = { game_pk: 900000001, home_team_name: 'Structural Home', away_team_name: 'Structural Away', scheduled_at: '2026-09-05 02:10:00+00' }
const row = { provider_event_id: 'structural-event', home_team: native.home_team_name, away_team: native.away_team_name, commence_time: '2026-09-04T22:10:00-04:00' }
const args = { normalizedRows: [row], nativeGames: [native], eligibleGamePks: [native.game_pk], runAsOf: '2026-09-05T01:00:00Z' }
assert.equal(crosswalkMarketEvents(args)[0].classification, 'MATCHED')
assert.throws(() => crosswalkMarketEvents({ ...args, normalizedRows: [{ ...row, commence_time: 'INVALID' }] }), /INVALID_TIME/)
assert.throws(() => crosswalkMarketEvents({ ...args, nativeGames: [native, { ...native, game_pk: 900000002 }] }), /AMBIGUOUS/)
check('crosswalk normalizes equivalent UTC offsets and PostgreSQL timestamps; invalid and ambiguous times block')
const storeRoot = path.join(root, `private-store-test-${process.pid}`)
const store = createPrivateRunStore(storeRoot)
const concurrent = createPrivateRunStore(storeRoot)
store.acquire()
try {
  assert.equal(store.locked, true)
  assert.throws(() => concurrent.acquire(), /EEXIST/)
  store.save('checkpoint', { version: 1 })
  store.save('checkpoint', { version: 2 })
  assert.deepEqual(concurrent.load('checkpoint'), { version: 2 })
  assert.throws(() => store.save('../escape', {}), /KEY_INVALID/)
  assert.throws(() => createPrivateRunStore(process.cwd()), /UNDER_OS_TEMP/)
} finally { store.release() }
concurrent.acquire(); concurrent.release()
check('private checkpoint replacement, exclusive lock, release and repository/path escape guards')
let saved = { MLB_OFFICIAL: 1 }
const caps = { MLB_OFFICIAL: { allowed: true, maxCalls: 2 } }
const ledger = createProviderLedger(caps, { initial: saved, onConsume: event => { saved = { ...saved, [event.provider]: event.consumed } } })
ledger.consume('MLB_OFFICIAL')
const resumed = createProviderLedger(caps, { initial: saved })
assert.equal(resumed.read('MLB_OFFICIAL'), 2)
assert.throws(() => resumed.consume('MLB_OFFICIAL'), /CAP_EXCEEDED/)
assert.throws(() => resumed.consume('MLB_OFFICIAL', -1), /INVALID_CALL_COUNT/)
assert.throws(() => resumed.consume('BALLDONTLIE'), /PROVIDER/)
check('provider consumption survives restart and rejects cap overrun, negative calls and unauthorized providers')
const report = { status: 'PASS', checks, providerCalls: 0, productionDml: 0, productionDdl: 0 }
fs.writeFileSync(path.join(root, 'operational-guards.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
