// Read-only certification review. Each gate has explicit executed evidence.
// Does not overwrite prior certificates, enable live, or label legacy failures
// as passes. The original R2T-R2 instruction explicitly permits classifying old
// validators that conflict with deliberate live containment.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const root = process.env.R2S_VALIDATION_DIR
const legacyRoot = process.env.R2T_LEGACY_VALIDATION_DIR
assert.ok(root && legacyRoot && path.isAbsolute(root) && path.isAbsolute(legacyRoot))
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
// Hash actual tracked bytes, not the guard's private generated-artifact overlay.
const digest = file => createHash('sha256').update(fs.readFileSync(pathToFileURL(path.resolve(file)))).digest('hex')
const prior = read('docs/CERTIFICATION/MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION.json')
const sql = read(path.join(root, 'schema-validation.json'))
const r1 = read(path.join(root, 'artifacts/r2t-r1-validation-evidence.json'))
const champion = read(path.join(root, 'artifacts/r2t-read-only-validation-evidence.json'))
const guards = read(path.join(root, 'operational-guards.json'))
const legacy = read(path.join(legacyRoot, 'stack.json'))
const featureModel = read(path.join(root, 'feature-model-regressions.json'))
const enrichment = read('docs/CERTIFICATION/MLB_DATA_02R_R2T_R2D_CANONICAL_NATIVE_ENRICHMENT_EXECUTION.json')
const parity = prior.storedOutputParity
const evidence = []
const need = (source, name) => {
  const rows = { sql: sql.checks, r1: r1.checks, champion: champion.checks, guards: guards.checks }[source]
  const match = rows?.find(row => (row.name ?? row.label) === name)
  return { source, assertion: name, status: match?.status === 'PASS' ? 'PASS' : 'MISSING_OR_FAILED' }
}
const fact = (name, condition) => ({ source: 'REVIEWED_CONTRACT', assertion: name, status: condition ? 'PASS' : 'FAIL' })
const gate = (number, requirements) => {
  const old = prior.gates.find(g => g.gate === number)
  evidence.push({ gate: number, name: old.name, previousStatus: old.status,
    status: requirements.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL', requirements })
}
gate(1, [fact('previously certified parity case retained', parity.status === 'PASS' && (parity.storedInputDigest ?? parity.stored?.frozen_input_digest)?.length === 64)])
gate(2, [fact('retained probability errors meet certified bound', parity.absoluteHomeError < 3.7e-13 && parity.absoluteAwayError < 3.7e-13), need('sql', 'production prediction plan preserves the already certified stored input digest')])
gate(3, [fact('prior native inventory completed', prior.nativeFieldGapInventory.status === 'COMPLETE')])
gate(4, [fact('safe native enrichment certified; unsafe fields excluded', enrichment.certificationVerdict.endsWith('_CERTIFIED') && enrichment.authorization.excludedFields === 52),
  need('sql', 'production source adapter reconstructs every real archived game from local SQL readback'), need('sql', 'native enrichment UPDATE uses old predicates, reads back and never backdates new evidence'), need('r1', 'starter missing')])
gate(5, [need('sql', 'real revision resume reuses committed snapshots/team/starter'), need('sql', 'snapshot-pinned real revision readback preserves 76-value vector and Champion')])
for (const [number, domain] of [[6, 'team'], [7, 'starter'], [8, 'bullpen'], [9, 'batter'], [10, 'matchup'], [11, 'firstInning']]) {
  const requirements = [need('sql', `${domain} distinct snapshot allowed and same snapshot duplicate rejected`), need('sql', `${domain} orphan snapshot FK rejected after migration`)]
  if (domain === 'batter') requirements.push(need('sql', 'separate real historical batter sample inserted for schema testing'), need('r1', 'no fabricated batter rows'))
  else requirements.push(need('sql', 'every real slate game preserves persisted 76-vector and Champion parity'))
  gate(number, requirements)
}
gate(12, [need('sql', 'all feature foreign keys preserved by migration'), need('r1', 'cross-team snapshot FK'), need('sql', 'all real predictions persist with canonical Champion and snapshot foreign keys')])
gate(13, [need('sql', 'PostgreSQL typed persistence preserves all 76 real values'), need('sql', 'every real slate game preserves persisted 76-vector and Champion parity')])
gate(14, [need('sql', 'PostgreSQL persisted Champion inference parity'), need('sql', 'persisted prediction probabilities preserve real Champion inference')])
gate(15, [need('sql', 'all real current-slate games expand into complete domain plans'), need('sql', 'duplicate targets, stale run date and started-game drift fail closed')])
gate(16, [need('sql', 'every real slate game preserves persisted 76-vector and Champion parity'), need('sql', 'all-game retry is zero-write with exact zero caps')])
gate(17, [need('sql', 'actual production adapter R2B/R2I SQL pipeline completes and retries without provider reacquisition'), need('sql', 'real model plus isolated odds fixture persists value math and all three observation FKs'), need('sql', 'isolated policy fixture persists Official Pick prediction/value UUID handoff'), need('sql', 'production adapter empty slate terminates after one injected schedule read with no downstream calls or writes')])
gate(18, [need('sql', 'real revision resume reuses committed snapshots/team/starter'), need('sql', 'R2B to R2I real-model integration resumes after market handoff without reacquisition'), need('sql', 'uncertain committed INSERT is recovered by exact independent readback and counted once'), need('sql', 'unapplied pending INSERT retries safely without double counting its cap')])
gate(19, [need('sql', 'R2B to R2I full real-model persistence retry performs zero writes'), need('sql', 'value and Official Pick retries preserve immutable decisions with zero writes')])
gate(20, [need('r1', 'actual R2B live containment'), need('r1', 'no provider or write calls')])
const core = fs.readFileSync('scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs', 'utf8')
const canonical = core.slice(core.indexOf('async function runCanonicalR2IStages'), core.indexOf('async function runR2ILegacyDryExecution'))
gate(21, [fact('canonical core invokes real builder and persisted inference without fixture construction', canonical.includes('buildAllPregameFeatureRows(') && canonical.includes('buildPersistedPredictions(') && !/fixture|synthetic_feature|Array\(76\)\.fill/i.test(canonical)), fact('legacy synthetic graph rejects live mode', core.includes("if (mode === 'LIVE_EXECUTE') throw new Error('LEGACY_SYNTHETIC_LIVE_PATH_FORBIDDEN')")), need('r1', 'fixture source in production')])
gate(22, ['wrong game scope', 'started game', 'source observed after asof', 'starter changed', 'starter missing', 'cross-team snapshot FK', 'wrong feature version', 'stale feature row', 'feature count mismatch', 'feature order mismatch'].map(name => need('r1', name)).concat([need('champion', 'artifact digest mismatch'), need('sql', 'prediction payload drift, immutable conflicts and scope escape fail closed'), need('sql', 'raw backdating, corrupt digest and negative provider accounting fail closed')]))
gate(23, [fact('all existing feature/model validators pass', featureModel.length === 9 && featureModel.every(row => row.exitCode === 0)), need('sql', 'certified Policy V1 loads exact config, rejects threshold drift and accepts zero candidates'), need('r1', 'no lineup dependency')])
const legacyResults = legacy.results.map(result => {
  if (result.status === 'PASS') return result
  const log = fs.readFileSync(path.join(legacyRoot, `${result.validator}.log`), 'utf8')
  return { ...result, classification: log.includes('R2T_LIVE_BLOCKED:') ? 'EXPECTED_LIVE_CONTAINMENT_INCOMPATIBILITY' : 'UNRESOLVED_FAILURE', windowsTeardownAssertion: log.includes('Assertion failed') }
})
const protectedHashes = read('docs/CERTIFICATION/MLB_OPERATIONAL_MISSION_STATUS.json').protectedState.hashes
const checks = [fact('all 23 gates have executed evidence', evidence.length === 23 && evidence.every(g => g.status === 'PASS')),
  fact('no disposable assertion failed', sql.checks.length >= 64 && sql.checks.every(c => c.status === 'PASS')),
  fact('legacy stack complete and every non-pass explicitly classified', legacyResults.length === 16 && legacyResults.every(r => r.status === 'PASS' || r.classification === 'EXPECTED_LIVE_CONTAINMENT_INCOMPATIBILITY')),
  fact('private checkpoint/provider guard tests pass', guards.checks.length >= 3 && guards.checks.every(c => c.status === 'PASS')),
  fact('all 19 inherited files unchanged', Object.keys(protectedHashes).length === 19 && Object.entries(protectedHashes).every(([file, hash]) => digest(file) === hash)),
  fact('no providers or production row/schema writes during this certification', [sql, guards, r1.boundaries, champion.boundaries, legacy.boundaries].every(e => e.providerCalls === 0 && e.productionDml === 0 && e.productionDdl === 0))]
const report = { status: checks.every(c => c.status === 'PASS') ? 'INTEGRATION_GATES_VERIFIED_PENDING_PUBLICATION_QUALITY_REVIEW' : 'BLOCKED',
  generatedAt: new Date().toISOString(), gates: evidence, checks, sqlChecks: sql.checks, legacy: legacyResults,
  r1: { checks: r1.checks.length, status: r1.certificationVerdict }, champion: { checks: champion.checks.length, status: champion.status },
  featureModel, operationalGuards: guards.checks, providerCalls: 0, productionDml: 0, productionDdl: 0,
  limitation: 'Real archived replay and explicitly isolated odds fixture; no production live execution. This report does not update canonical certification or enable R3.' }
fs.writeFileSync(path.join(root, 'r2t-r2-gate-review.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ status: report.status, gates: evidence.map(g => ({ gate: g.gate, status: g.status })), failedChecks: checks.filter(c => c.status !== 'PASS') }))
if (report.status === 'BLOCKED') process.exitCode = 1
