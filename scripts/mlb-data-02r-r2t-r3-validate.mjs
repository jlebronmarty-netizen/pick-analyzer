// Local R3 tests only. The actual manual launcher is restricted to ONE Odds
// request per invocation, persisted for retry. This validator acquires no data
// and does not publish the in-memory manifest used to test the readiness guard.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { collectRuntimeSourcePaths, normalizedFileDigest, verifyR3Certificate, R3_GATE_IDS } from './mlb-data-02r-r2t-r3-readiness.mjs'
import { manualRunAuthorization, verifyManualSchemaPreflight, verifyInitialMissionLedger } from './mlb-operational-manual-refresh.mjs'
import { createCurrentSlateRunFreeze, requireRunScopedLiveAuthorization } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { operatingDate } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'

const root = process.env.R2S_VALIDATION_DIR
assert.ok(root && path.isAbsolute(root))
const checks = []
const check = name => checks.push({ name, status: 'PASS' })
const sourceHashes = Object.fromEntries(collectRuntimeSourcePaths().map(file => [file, normalizedFileDigest(file)]))
const candidate = { certificationVerdict: 'MLB_DATA_02R_R2T_R3_LIVE_REENABLEMENT_CERTIFIED',
  r2tR2Verdict: 'MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION_CERTIFIED',
  champion: 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1', policy: 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1', featureCount: 76,
  syntheticProductionPaths: 0, gates: R3_GATE_IDS.map(id => ({ id, status: 'PASS' })), sourceHashes }
assert.equal(verifyR3Certificate(candidate).status, 'R3_CERTIFIED')
check('candidate inventory covers actual transitive runtime, model, policy and schemas')
for (const mutate of [c => { c.certificationVerdict = 'PENDING' }, c => { c.featureCount = 75 }, c => { c.champion = 'OTHER' },
  c => { c.policy = 'OTHER' }, c => { c.syntheticProductionPaths = 1 }, c => { c.gates.pop() }, c => { c.gates[0].status = 'FAIL' },
  c => { c.gates[0].id = c.gates[1].id }, c => { delete c.sourceHashes['scripts/mlb-operational-manual-refresh.mjs'] }]) {
  const changed = structuredClone(candidate); mutate(changed)
  assert.throws(() => verifyR3Certificate(changed), /R2T_LIVE_BLOCKED/)
}
assert.throws(() => verifyR3Certificate(candidate, () => '0'.repeat(64)), /SOURCE_DRIFT/)
check('uncertified, incomplete, duplicate, model, policy, fixture and source-drift manifests block')
const at = '2026-09-09T03:00:00.000Z'
const preflight = { status: 'PASS', checkedAt: at, projectRef: 'structural-project', nativeSnapshotUniqueIndexes: 6, orphanSnapshotReferences: 0,
  invalidIndexes: 0, schemaCompatible: true, ddlDigest: '3f2df0f2baf8b4cd405bc10560c47eadc143198df85a80fb3577b4b03d5b1f46' }
verifyManualSchemaPreflight(preflight, { at, projectRef: preflight.projectRef })
for (const changes of [{ checkedAt: '2026-09-09T02:00:00Z' }, { checkedAt: '2026-09-09T04:00:00Z' }, { projectRef: 'other' },
  { orphanSnapshotReferences: 1 }, { invalidIndexes: 1 }, { nativeSnapshotUniqueIndexes: 5 }, { schemaCompatible: false }, { ddlDigest: 'changed' }]) {
  assert.throws(() => verifyManualSchemaPreflight({ ...preflight, ...changes }, { at, projectRef: preflight.projectRef }), /MLB_MANUAL_BLOCK/)
}
check('preflight rejects stale/future/wrong-project evidence, orphan/invalid indexes and schema drift')
const mission = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_MISSION_STATUS.json', 'utf8'))
if (mission.providerAccounting.runs.length === 0 && Object.entries(mission.providerAccounting).filter(([key]) => ['MLBOfficial', 'sharedStatcast', 'OddsAPI', 'BALLDONTLIE', 'SportsDataIO', 'otherSportsProviders', 'missionOddsConsumed'].includes(key)).every(([, value]) => value === 0)) verifyInitialMissionLedger(mission)
else assert.throws(() => verifyInitialMissionLedger(mission), /LEDGER_RECOVERY/, 'real nonzero mission accounting must prevent ledger reset')
for (const consumed of [1, 2, -1]) assert.throws(() => verifyInitialMissionLedger({ ...mission, providerAccounting: { ...mission.providerAccounting, missionOddsConsumed: consumed } }), /LEDGER_RECOVERY/)
assert.throws(() => verifyInitialMissionLedger({ ...mission, providerAccounting: { ...mission.providerAccounting, runs: ['previous'] } }), /LEDGER_RECOVERY/)
check('missing private ledger cannot reset previously consumed mission budget')
const before = Date.now()
const freeze = createCurrentSlateRunFreeze({ mode: 'LIVE_EXECUTE', runId: 'r3-actual-time-guard', executionPackageSha: 'a'.repeat(40) })
assert.ok(Date.parse(freeze.run_as_of) >= before && Date.parse(freeze.run_as_of) <= Date.now())
assert.equal(freeze.run_date, operatingDate(freeze.run_as_of))
const auth = manualRunAuthorization(freeze)
requireRunScopedLiveAuthorization(auth, freeze)
assert.equal(auth.providerCaps.THE_ODDS_API.maxCalls, 1)
assert.equal(auth.providerCaps.BALLDONTLIE.maxCalls, 0)
assert.equal(auth.providerCaps.SPORTSDATAIO.maxCalls, 0)
for (const key of ['ddlAllowed', 'settlementAllowed', 'automationAllowed']) assert.throws(() => requireRunScopedLiveAuthorization({ ...auth, [key]: true }, freeze), /FORBIDDEN/)
assert.throws(() => requireRunScopedLiveAuthorization({ ...auth, execution_package_sha: 'b'.repeat(40) }, freeze), /SHA_MISMATCH/)
assert.throws(() => requireRunScopedLiveAuthorization({ ...auth, authorizedDmlTargets: ['unexpected_table'] }, freeze), /TARGET_FORBIDDEN/)
check('actual-time Puerto Rico freeze and package-scoped authorization enforce ONE Odds request and forbidden operations')
const report = { status: 'PASS', generatedAt: new Date().toISOString(), checks, testedSourceHashes: sourceHashes, providerCalls: 0, productionDml: 0, productionDdl: 0,
  liveExecution: false, candidateManifestPublished: false }
fs.writeFileSync(path.join(root, 'r3-guards.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ status: report.status, checks: checks.length, sourceFiles: Object.keys(sourceHashes).length, providerCalls: 0, productionDml: 0, productionDdl: 0 }))
