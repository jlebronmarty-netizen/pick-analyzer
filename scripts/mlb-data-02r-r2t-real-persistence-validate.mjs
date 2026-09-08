import fs from 'node:fs'
import assert from 'node:assert/strict'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { buildPregameFeatureRows, assemblePregameVector } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { inferChampion } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
import { createTestRepository, featureInsertRowsForDomain, resolveCanonicalFeatureSnapshotIds, bindFeatureRowsToSnapshotIds, classifyBoundDailyFeatures } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'

if (!process.env.R2S_VALIDATION_DIR || !process.env.R1_READ_CACHE) throw new Error('GUARDED_REAL_CACHE_REQUIRED')
const r1 = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_DATA_02R_R2T_R1_PREGAME_EVIDENCE_PROVENANCE_AND_TARGET_BINDING.json', 'utf8'))
const cache = JSON.parse(fs.readFileSync(process.env.R1_READ_CACHE, 'utf8'))
assert.equal(sha256(cache.dependencies), r1.dependencyEvidence.digest)
assert.equal(cache.digest, r1.dependencyEvidence.digest)
const { target, starters } = r1.selected
assert.equal(target.gamePk, cache.target.gamePk)
assert.equal(target.runAsOf, cache.target.runAsOf)
const built = buildPregameFeatureRows({ target, starters, rawRows: cache.dependencies.rows, dependencyGamePks: cache.dependencies.dependencyGamePks })
const vector = assemblePregameVector({ target, starters, built })
const checks = []
const check = (name, condition) => { assert.ok(condition, name); checks.push({ name, status: 'PASS' }) }
const domains = ['team', 'starter', 'bullpen', 'batter', 'matchup', 'firstInning']
const state = { features: {} }
const repository = createTestRepository(state)
const originalInsert = repository.insertFeatureRows
repository.insertFeatureRows = async (domain, rows, cap) => {
  const result = await originalInsert(domain, featureInsertRowsForDomain(domain, rows), cap)
  state.features[domain] = [...(state.features[domain] ?? []), ...structuredClone(result.rows)]
  return result
}
const snapshots = await repository.insertFeatureRows('snapshots', built.rows.snapshots, built.rows.snapshots.length)
const ids = await resolveCanonicalFeatureSnapshotIds({ repository, plannedSnapshotRows: built.rows.snapshots, insertedSnapshotRows: snapshots.rows })
check('ten real entity snapshots resolve to ten canonical injected UUIDs', ids.byPlannedId.size === 10 && new Set(ids.byPlannedId.values()).size === 10)
check('ambiguous game-level fallback absent', !ids.has(target.gamePk))
const bound = bindFeatureRowsToSnapshotIds(built.rows, ids)
const caps = Object.fromEntries(domains.map((domain) => [domain, bound[domain].length]))
const plan = await classifyBoundDailyFeatures(repository, bound, [target.gamePk], caps)
for (const domain of domains) {
  check(`${domain} exact INSERT_ELIGIBLE cap`, plan.plans[domain].insertEligible === caps[domain])
  await repository.insertFeatureRows(domain, bound[domain], caps[domain])
}
const readback = { ...built, rows: { ...structuredClone(state.features), offense: built.rows.offense } }
const persistedVector = assemblePregameVector({ target, starters, built: readback })
check('all 76 physical readback values preserve exact vector', sha256(vector.values) === sha256(persistedVector.values) && vector.values.length === 76)
check('real Champion post-persistence probability parity', inferChampion({ vector }).artifact.home_probability === inferChampion({ vector: persistedVector }).artifact.home_probability)
check('empty batter is legitimate and persists zero rows', state.features.batter.length === 0)
const second = await classifyBoundDailyFeatures(repository, bound, [target.gamePk], Object.fromEntries(domains.map((domain) => [domain, 0])))
check('second pass reuses all eight daily rows with zero inserts', Object.values(second.plans).reduce((sum, p) => sum + p.reuseNoOp, 0) === 8 && Object.values(second.plans).every((p) => p.insertEligible === 0))
const rebuilt = buildPregameFeatureRows({ target, starters, rawRows: cache.dependencies.rows, dependencyGamePks: cache.dependencies.dependencyGamePks })
const resumedIds = await resolveCanonicalFeatureSnapshotIds({ repository, plannedSnapshotRows: rebuilt.rows.snapshots })
const resumed = bindFeatureRowsToSnapshotIds(rebuilt.rows, resumedIds)
check('restart resolves newly planned UUIDs to existing canonical IDs', sha256(resumed.team) === sha256(bound.team))
const negatives = [
  ['wrong team snapshot', () => { const bad = structuredClone(built.rows); bad.team[0].feature_snapshot_id = bad.team[1].feature_snapshot_id; bindFeatureRowsToSnapshotIds(bad, ids) }],
  ['missing planned snapshot', () => { const bad = structuredClone(built.rows); bad.team[0].feature_snapshot_id = 'missing'; bindFeatureRowsToSnapshotIds(bad, ids) }],
  ['unexpected physical field', () => featureInsertRowsForDomain('team', [{ ...bound.team[0], surprise_column: 1 }])],
  ['invalid FK', () => featureInsertRowsForDomain('team', [{ ...bound.team[0], feature_snapshot_id: 'invalid' }])],
]
for (const [name, fn] of negatives) { assert.throws(fn); check(`${name} fails closed`, true) }
const modified = structuredClone(bound)
modified.team[0].recent_k_rate += 0.001
await assert.rejects(() => classifyBoundDailyFeatures(repository, modified, [target.gamePk], caps), /BLOCK_CONFLICT/)
check('different immutable feature values conflict', true)
const badReadback = structuredClone(state.features.snapshots)
badReadback[0].native_identity_metadata.family = 'wrong'
await assert.rejects(() => resolveCanonicalFeatureSnapshotIds({ repository: createTestRepository({ features: { snapshots: badReadback } }), plannedSnapshotRows: built.rows.snapshots }), /READBACK_PAYLOAD_CONFLICT/)
check('corrupt snapshot provenance blocks canonical resolution', true)
await assert.rejects(() => resolveCanonicalFeatureSnapshotIds({ repository: createTestRepository(), plannedSnapshotRows: built.rows.snapshots, insertedSnapshotRows: snapshots.rows }), /INDEPENDENT_READBACK_MISSING/)
check('insert response cannot substitute for real snapshot readback', true)
let sideEffects = 0
const trap = new Proxy({}, { get: () => async () => { sideEffects++; throw new Error('SIDE_EFFECT') } })
await assert.rejects(() => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', executionPackageSha: 'REAL_PERSISTENCE_TEST', authorization: { authorized: true, execution_package_sha: 'REAL_PERSISTENCE_TEST' }, providers: trap, repository: trap }), /R2T_LIVE_BLOCKED/)
check('actual R2B live entrypoint remains contained before effects', sideEffects === 0)
const report = { generatedAt: new Date().toISOString(), status: 'PARTIAL_REAL_PERSISTENCE_INTEGRATION_PASS',
  scope: 'Real cached 824552 evidence through existing R2I persistence adapters with injected physical repository; not full R2B live traversal or production persistence',
  checks, cacheDigest: cache.digest, gamePk: target.gamePk, rowCounts: { snapshots: 10, ...caps },
  vectorDigest: sha256(vector.values), vectorCount: 76, homeProbability: inferChampion({ vector }).artifact.home_probability,
  providerCalls: 0, productionDml: 0, productionDdl: 0, liveExecutionEnabled: false }
fs.writeFileSync(`${process.env.R2S_VALIDATION_DIR}/real-persistence.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
